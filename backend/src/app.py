# -*- coding: utf-8 -*-
"""应用工厂：创建 Flask 应用、配置 CORS、注册路由与数据库钩子。"""
import os

from flask import Flask, request, Response, g, session
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

    @app.after_request
    def _no_cache_frontend(resp):
        """前端页面/静态资源（HTML/JS/CSS）与关键只读 API（fill/templates/submissions/roster 等）
        禁止被 Cloudflare 边缘或浏览器长期缓存，否则部署后旧代码/旧数据要等数小时才生效，
        用户还会遇到『改了模板填写页还是旧的』这类诡异现象。"""
        path = request.path
        is_frontend = (path.startswith('/admin') or path.startswith('/user')
                       or path.startswith('/fill') or path in ('/', '/admin/', '/user/'))
        # 只读 API：GET 且不是生成型（qrcode 图片允许缓存，其余 JSON 一律 no-cache）
        is_read_api = (request.method == 'GET' and path.startswith('/api/')
                       and not path.endswith('/qrcode'))
        if is_frontend or is_read_api:
            resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            resp.headers['Pragma'] = 'no-cache'
            resp.headers['Expires'] = '0'
        return resp

    register_routes(app)

    # 每个请求把当前登录用户注入 g.current_user（无登录态则为 None），
    # 供各接口做角色权限校验（login_required 装饰器内部同样从 session 取）。
    from .routes.auth import get_current_user
    @app.before_request
    def _inject_current_user():
        g.current_user = get_current_user()

    # 微信公众号「业务域名」校验文件：微信后台要求根路径可访问特定文件以证明域名所有权。
    # 注意：业务域名验证仅去除网页底部"此网页由 xxx 提供"灰条，不解决微信对动态DNS域名的风控拦截。
    # 若未来为其他域名（如已购 .com）配置业务域名，把新的 文件名->内容 加入此字典即可。
    _WECHAT_VERIFY_FILES = {
        '405a55ceab4b4143f5221d996024d361.txt': '047b4a152f2926bafc60193a25800cc3a311d1a0',
    }

    def _make_wechat_verify_view(content: str):
        def _view():
            return Response(content, mimetype='text/plain; charset=utf-8')
        return _view

    for _fn, _ct in _WECHAT_VERIFY_FILES.items():
        app.add_url_rule('/' + _fn, view_func=_make_wechat_verify_view(_ct),
                         endpoint='wechat_verify_' + _fn.replace('.', '_'))

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
