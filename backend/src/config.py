# -*- coding: utf-8 -*-
"""配置与路径管理。

所有目录、文件路径、站点地址相关逻辑集中在此，供其他模块导入。
PROJECT_ROOT 指向 backend/ 目录（本文件位于 backend/src/config.py）。
"""
import os
import socket
from datetime import datetime

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 数据目录：默认 backend/data；部署到 Railway 等平台时，建议挂载持久卷并设置
# 环境变量 DATA_DIR 指向挂载点，避免容器重启后 SQLite 库与上传文件丢失。
DATA_DIR = os.environ.get('DATA_DIR') or os.path.join(PROJECT_ROOT, 'data')
DB_PATH = os.path.join(DATA_DIR, 'tool.db')
TPL_DIR = os.path.join(DATA_DIR, 'templates_storage')
SUB_DIR = os.path.join(DATA_DIR, 'submissions_storage')
RST_DIR = os.path.join(DATA_DIR, 'rosters_storage')

# 前端目录：默认仓库根 frontend/；若部署结构不同可用 FRONTEND_DIR 覆盖。
FRONTEND_DIR = os.path.join(PROJECT_ROOT, '..', 'frontend')
if os.environ.get('FRONTEND_DIR'):
    FRONTEND_DIR = os.environ['FRONTEND_DIR']
ADMIN_DIR = os.path.join(FRONTEND_DIR, 'admin')
USER_DIR = os.path.join(FRONTEND_DIR, 'user')

for _d in (DATA_DIR, TPL_DIR, SUB_DIR, RST_DIR):
    os.makedirs(_d, exist_ok=True)


def get_lan_ip():
    """获取本机局域网 IP（非 127.0.0.1）。失败返回 None。"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith('127.'):
            return ip
    except Exception:
        pass
    return None


def get_fill_base_url():
    """获取填写页面的公开访问基址。

    优先级：数据库 settings.site_url（管理员在「系统设置」显式填写，生产首选）
            > 请求实际到达的主机头（经 ProxyFix 识别 X-Forwarded 头，自动适配
              局域网 / Cloudflare 隧道 / 公网域名 / Railway，绝不会是内网虚拟 IP）
            > 局域网 IP 兜底（仅在本机 localhost 访问时用于同网段扫码）。
    绝不返回 127.0.0.1 / localhost（除非完全没有请求上下文且无局域网 IP）。
    """
    # 1) 数据库显式设置的站点地址
    try:
        from .db import get_db
        db = get_db()
        row = db.execute("SELECT value FROM settings WHERE key = 'site_url'").fetchone()
        if row and row['value']:
            return row['value'].rstrip('/')
    except Exception:
        pass

    # 2) 请求实际到达的主机——自动反映客户端真正使用的地址
    from flask import request, has_request_context
    if has_request_context():
        host = (request.host or '').lower()
        # 通过公网域名 / 隧道 / Railway / 局域网其他设备访问时，直接用该主机头
        if host and not host.startswith('127.') and host not in ('localhost', 'localhost:5000'):
            return request.host_url.rstrip('/')
        # 仅在本机 localhost 访问时才退回局域网 IP，方便同网段设备扫码
        lan = get_lan_ip()
        if lan:
            return f'http://{lan}:5000'

    # 3) 兜底：局域网 IP
    lan = get_lan_ip()
    if lan:
        return f'http://{lan}:5000'
    return 'http://localhost:5000'


def now_str():
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')
