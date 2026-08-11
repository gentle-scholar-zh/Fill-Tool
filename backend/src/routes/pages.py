# -*- coding: utf-8 -*-
"""页面路由：管理端静态页、用户填写页、健康检查。"""
import os
import json

from flask import Blueprint, send_file, abort, jsonify

from ..config import ADMIN_DIR, USER_DIR
from ..db import get_db, now_str
from ..render import render_fill_html

bp = Blueprint('pages', __name__)


def _safe_path(base: str, filename: str) -> str:
    """将 URL 文件名安全映射到 base 目录下，阻止目录穿越。"""
    full = os.path.normpath(os.path.join(base, filename))
    if not full.startswith(os.path.normpath(base)):
        abort(404)
    return full


@bp.route('/')
@bp.route('/admin')
@bp.route('/admin/')
def admin_index():
    return send_file(os.path.join(ADMIN_DIR, 'index.html'))


@bp.route('/admin/<path:filename>')
def admin_assets(filename):
    """提供管理端 HTML / CSS / JS 等静态资源。"""
    full = _safe_path(ADMIN_DIR, filename)
    if os.path.isdir(full) or not os.path.exists(full):
        candidate = full + '.html'
        if os.path.isfile(candidate):
            full = candidate
        else:
            abort(404)
    return send_file(full)


@bp.route('/fill/<tid>')
def user_fill(tid):
    """返回用户填表页面 — 优先使用前端 user/fill.html，兜底服务端渲染。"""
    db = get_db()
    tpl = db.execute('SELECT * FROM templates WHERE id = ?', (tid,)).fetchone()
    if not tpl:
        return '模板不存在或已删除', 404
    fill_html_path = os.path.join(USER_DIR, 'fill.html')
    if os.path.exists(fill_html_path):
        return send_file(fill_html_path, mimetype='text/html')
    fields = json.loads(tpl['fields_json'])
    return render_fill_html(tpl['name'], fields, tid)


@bp.route('/user/<path:filename>')
def user_assets(filename):
    """提供用户端 CSS / JS 等静态资源。"""
    full = _safe_path(USER_DIR, filename)
    if os.path.isdir(full) or not os.path.exists(full):
        abort(404)
    return send_file(full)


@bp.route('/api/health')
def health():
    return jsonify({'code': 0, 'status': 'ok', 'time': now_str()})


@bp.route('/favicon.ico')
def favicon():
    return '', 204
