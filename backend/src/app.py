# -*- coding: utf-8 -*-
"""应用工厂：创建 Flask 应用、配置 CORS、注册路由与数据库钩子。"""
import os

from flask import Flask
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

from .config import PROJECT_ROOT
from .db import init_db, close_db
from .routes import register_routes


def create_app() -> Flask:
    app = Flask(__name__, static_folder=None)
    app.secret_key = 'tool-backend-secret-2026'

    # 信任反向代理（Cloudflare Tunnel / Cloudflare CDN / Railway / Nginx）转发的头，
    # 使 request.scheme / request.host 反映真实公网值，避免分享/二维码链接被拼成内网地址。
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)

    # 同源部署：前端由本服务直接提供，CORS 仅作为本地开发便利保留。
    # 可通过环境变量 CORS_ORIGINS=domain1,domain2 追加允许的跨域来源。
    allowed = {'http://localhost:5000', 'http://127.0.0.1:5000'}
    env_origins = os.environ.get('CORS_ORIGINS', '')
    if env_origins:
        allowed.update(o.strip() for o in env_origins.split(',') if o.strip())
    CORS(app, resources={r"/api/*": {
        "origins": list(allowed),
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
        "supports_credentials": False,
    }})

    app.teardown_appcontext(close_db)
    register_routes(app)
    return app


app = create_app()


if __name__ == '__main__':
    init_db()
    print('\n' + '=' * 60)
    print('  Tool 后端服务 已启动')
    print('  管理端:  http://127.0.0.1:5000')
    print('  数据库:  ' + os.path.join(PROJECT_ROOT, 'data', 'tool.db'))
    print('=' * 60 + '\n')
    app.run(host='0.0.0.0', port=5000, debug=False)
