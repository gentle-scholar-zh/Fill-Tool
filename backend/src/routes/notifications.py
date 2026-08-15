# -*- coding: utf-8 -*-
"""通知接口。"""
import json

from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash

from ..db import get_db, row_to_dict, now_str
from .auth import login_required

bp = Blueprint('notifications', __name__)


@bp.route('/api/notifications', methods=['GET'])
def api_list_notifications():
    db = get_db()
    rows = db.execute('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').fetchall()
    return jsonify({'code': 0, 'data': [row_to_dict(r) for r in rows]})


@bp.route('/api/notifications/<nid>/read', methods=['PUT'])
def api_mark_read(nid):
    db = get_db()
    db.execute('UPDATE notifications SET read = 1 WHERE id = ?', (nid,))
    db.commit()
    return jsonify({'code': 0, 'data': True})


@bp.route('/api/notifications/read-all', methods=['PUT'])
def api_mark_all_read():
    db = get_db()
    db.execute('UPDATE notifications SET read = 1')
    db.commit()
    return jsonify({'code': 0, 'data': True})


@bp.route('/api/notifications/<nid>/resolve-password', methods=['POST'])
@login_required(roles=('admin',))
def api_resolve_password(nid):
    """管理员批准密码申请：将通知 payload 中的新密码写入用户，并标记通知已处理。"""
    db = get_db()
    n = db.execute('SELECT * FROM notifications WHERE id = ?', (nid,)).fetchone()
    if not n:
        return jsonify({'code': 404, 'message': '通知不存在'}), 404
    n = row_to_dict(n)
    try:
        payload = json.loads(n.get('payload') or '{}')
    except Exception:
        payload = {}
    uid = payload.get('uid')
    new_pwd = (payload.get('new_password') or '').strip()
    if not uid or not new_pwd:
        return jsonify({'code': 1, 'message': '该通知不含可处理的密码申请'}), 400
    user = db.execute('SELECT * FROM users WHERE id = ?', (uid,)).fetchone()
    if not user:
        return jsonify({'code': 1, 'message': '目标用户不存在'}), 404
    db.execute('UPDATE users SET password_hash = ? WHERE id = ?',
               (generate_password_hash(new_pwd), uid))
    resolved = f"已于 {now_str()[:16]} 由管理员重置，新密码：{new_pwd}"
    db.execute("UPDATE notifications SET status = 'done', read = 1, body = ?, payload = ? WHERE id = ?",
               (resolved, json.dumps({**payload, 'resolved': True}, ensure_ascii=False), nid))
    db.commit()
    return jsonify({'code': 0, 'data': {'uid': uid, 'new_password': new_pwd,
                                        'name': user['name']}})
