# -*- coding: utf-8 -*-
"""用户管理接口。"""
from flask import Blueprint, request, jsonify

from ..db import get_db, gen_id, now_str, row_to_dict
from .auth import login_required

bp = Blueprint('users', __name__)


@bp.route('/api/users', methods=['GET'])
@login_required(roles=('admin',))
def api_list_users():
    db = get_db()
    rows = db.execute('SELECT * FROM users ORDER BY created_at DESC').fetchall()
    return jsonify({'code': 0, 'data': [row_to_dict(r) for r in rows]})


@bp.route('/api/users', methods=['POST'])
@login_required(roles=('admin',))
def api_create_user():
    data = request.get_json() or {}
    db = get_db()
    username = (data.get('username') or data.get('phone') or data.get('email') or '').strip()
    if not username:
        # 兼容：用手机号/邮箱兜底唯一用户名
        username = (data.get('phone') or data.get('email') or gen_id()).strip()
    uid = gen_id()
    db.execute('''INSERT INTO users (id, name, username, role, email, phone, status, last_login, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
               (uid, data.get('name', ''), username, data.get('role', 'student'),
                data.get('email', ''), data.get('phone', ''), data.get('status', 'active'),
                data.get('lastLogin', ''), now_str()))
    db.commit()
    row = db.execute('SELECT * FROM users WHERE id = ?', (uid,)).fetchone()
    return jsonify({'code': 0, 'data': row_to_dict(row)})


@bp.route('/api/users/<uid>', methods=['PUT'])
@login_required(roles=('admin',))
def api_update_user(uid):
    data = request.get_json() or {}
    db = get_db()
    db.execute('''UPDATE users SET
                    name = COALESCE(?, name), role = COALESCE(?, role),
                    email = COALESCE(?, email), status = COALESCE(?, status)
                  WHERE id = ?''',
               (data.get('name'), data.get('role'), data.get('email'),
                data.get('status'), uid))
    db.commit()
    row = db.execute('SELECT * FROM users WHERE id = ?', (uid,)).fetchone()
    return jsonify({'code': 0, 'data': row_to_dict(row)})
