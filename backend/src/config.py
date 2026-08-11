# -*- coding: utf-8 -*-
"""配置与路径管理。

所有目录、文件路径、站点地址相关逻辑集中在此，供其他模块导入。
PROJECT_ROOT 指向 backend/ 目录（本文件位于 backend/src/config.py）。
"""
import os
import socket
import ipaddress
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


def _is_private_host(host):
    """判断一个 host（可带 scheme:// 与端口）是否为内网/私有/回环/链路本地地址。

    返回 True 表示「绝不可用于拼公网填写链接」（含 127.x / 10.x /
    172.16-31.x / 192.168.x / 169.254.x / localhost）。
    非 IP 字面量（真实域名，如 huanhuan.dpdns.org）返回 False → 视为安全。
    """
    if not host:
        return True
    s = str(host).strip()
    # 去掉 scheme://（http://、https:// 等）
    if '://' in s:
        s = s.split('://', 1)[1]
    # 去掉路径与查询
    s = s.split('/', 1)[0]
    h = s.split(':')[0].strip().lower()
    if h in ('localhost', '0.0.0.0', ''):
        return True
    try:
        ip = ipaddress.ip_address(h)
        return ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast
    except ValueError:
        # 不是 IP 字面量 → 是域名，安全
        return False


def get_fill_base_url():
    """获取填写页面的公开访问基址。

    优先级（由高到低）：
      0) 环境变量 BASE_URL / SITE_URL（运维在 Railway/容器显式指定公网域名）
      1) 数据库 settings.site_url（管理员在「系统设置」填写）
      2) 请求实际到达的主机头（经 ProxyFix 识别 X-Forwarded，自动适配隧道/域名/Railway）
      3) 局域网 IP 兜底（仅本机 localhost 访问时用于同网段扫码）
    关键：任何「私有/内网 IP」（含 10.255.254.20 这类容器虚拟 IP）一律被拒绝，
          绝不会拼进填写/分享/二维码链接。
    """
    # 0) 运维环境变量（最高优先级，便于容器直接指定公网域名）
    env_base = (os.environ.get('BASE_URL') or os.environ.get('SITE_URL') or '').strip()
    if env_base:
        return env_base.rstrip('/')

    # 1) 数据库显式设置的站点地址（拒绝内网 IP）
    try:
        from .db import get_db
        db = get_db()
        row = db.execute("SELECT value FROM settings WHERE key = 'site_url'").fetchone()
        if row and row['value'] and not _is_private_host(row['value']):
            return row['value'].rstrip('/')
    except Exception:
        pass

    # 2) 请求实际到达的主机——自动反映客户端真正使用的地址
    from flask import request, has_request_context
    if has_request_context():
        host = (request.host or '').lower()
        # 仅当 host 是「公网域名或公网 IP」时才采用，内网/私有地址一律拒绝
        if host and not _is_private_host(host):
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
