# -*- coding: utf-8 -*-
"""路由包：注册所有蓝图到 Flask 应用。"""
from .templates import bp as templates_bp
from .submissions import bp as submissions_bp
from .roster import bp as roster_bp
from .categories import bp as categories_bp
from .users import bp as users_bp
from .notifications import bp as notifications_bp
from .recycle import bp as recycle_bp
from .share import bp as share_bp
from .settings import bp as settings_bp
from .fill import bp as fill_bp
from .pages import bp as pages_bp
from .option_sets import bp as option_sets_bp

ALL_BLUEPRINTS = [
    templates_bp, submissions_bp, roster_bp, categories_bp,
    users_bp, notifications_bp, recycle_bp, share_bp,
    settings_bp, fill_bp, pages_bp, option_sets_bp,
]


def register_routes(app):
    for bp in ALL_BLUEPRINTS:
        app.register_blueprint(bp)
