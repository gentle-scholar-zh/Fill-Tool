# -*- coding: utf-8 -*-
"""Railway / 通用 WSGI 入口。

部署形态：仓库根目录作为 Railway 的 Root Directory，
本文件把 backend/ 加入 Python 路径后暴露 Flask 实例 `app` 给 gunicorn。
- 前端 frontend/ 与后端 backend/ 同处仓库根，路径无需大改。
- gunicorn 不会执行 __main__，因此这里显式调用 init_db() 建表。
"""
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
if os.path.join(ROOT, 'backend') not in sys.path:
    sys.path.insert(0, os.path.join(ROOT, 'backend'))

from app import app              # backend/app.py -> Flask 实例
from src.db import init_db       # 确保数据库表在启动时初始化


init_db()


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port)
