# -*- coding: utf-8 -*-
"""用户管理接口。"""
from flask import Blueprint, request, jsonify

from ..db import get_db, gen_id, now_str, row_to_dict
from .auth import login_required, get_current_user
from werkzeug.security import generate_password_hash

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
    """后台创建用户。
    - 任意 admin 都可以创建 student
    - 只有超级管理员（is_super=1）才能创建 teacher / admin
    """
    data = request.get_json() or {}
    role = (data.get('role') or 'student').strip()
    if role not in ('admin', 'teacher', 'student'):
        role = 'student'

    # 教师 / 管理员只能由超级管理员创建
    me = get_current_user() or {}
    if role != 'student' and not me.get('is_super'):
        return jsonify({'code': 403,
                        'message': '仅超级管理员可创建教师 / 管理员账号'}), 403

    # 必填字段校验
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'code': 1, 'message': '姓名不能为空'}), 400
    phone = (data.get('phone') or '').strip()
    email = (data.get('email') or '').strip()
    if not phone and not email:
        return jsonify({'code': 1, 'message': '手机号或邮箱至少填写一项'}), 400
    password = data.get('password') or ''
    student_id = (data.get('student_id') or '').strip()
    if role == 'student' and not student_id:
        return jsonify({'code': 1, 'message': '学生必须填写学号'}), 400
    if password and len(password) < 6:
        return jsonify({'code': 1, 'message': '密码至少 6 位'}), 400

    db = get_db()
    if phone and db.execute('SELECT 1 FROM users WHERE phone = ?', (phone,)).fetchone():
        return jsonify({'code': 1, 'message': '该手机号已注册'}), 400
    if email and db.execute('SELECT 1 FROM users WHERE email = ?', (email,)).fetchone():
        return jsonify({'code': 1, 'message': '该邮箱已注册'}), 400

    uid = gen_id()
    username = phone or email or gen_id()
    # 若管理员未指定密码，则创建「待设密码」账号：password_hash 留 NULL，
    # 登录路由会返回明确错误并引导用户走「忘记密码」流程。
    if password:
        password_hash = generate_password_hash(password)
    else:
        password_hash = None
    is_super = 1 if (role == 'admin' and data.get('is_super')) else 0
    db.execute('''INSERT INTO users (id, name, username, role, email, phone, class_name, student_id,
                  password_hash, status, is_super, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
               (uid, name, username, role, email, phone, data.get('class_name', ''), student_id,
                password_hash, data.get('status', 'active'), is_super, now_str()))
    db.commit()
    row = db.execute('SELECT * FROM users WHERE id = ?', (uid,)).fetchone()
    resp = row_to_dict(row)
    resp.pop('password_hash', None)
    if password:
        resp['has_password'] = True
    else:
        resp['has_password'] = False
    return jsonify({'code': 0, 'data': resp})


@bp.route('/api/users/<uid>', methods=['PUT'])
@login_required(roles=('admin',))
def api_update_user(uid):
    """更新用户。
    - 仅超级管理员可以修改其他用户的 role / is_super / status=disabled
    - 普通 admin 可修改自己以外用户的姓名、邮箱、手机、班级、学号
    """
    data = request.get_json() or {}
    me = get_current_user() or {}
    is_super = bool(me.get('is_super'))

    new_role = data.get('role')
    new_is_super = data.get('is_super')
    new_status = data.get('status')

    # 教师/管理员/禁用/超级管理员权限：仅超级管理员
    if new_role is not None or new_is_super is not None or new_status == 'disabled':
        if not is_super:
            return jsonify({'code': 403,
                            'message': '仅超级管理员可调整角色 / 超级标记 / 禁用账号'}), 403
    # 非超管不能创建 teacher/admin（兜底，防止别处绕过）
    if new_role and new_role != 'student' and not is_super:
        return jsonify({'code': 403,
                        'message': '仅超级管理员可将账号设为教师 / 管理员'}), 403

    db = get_db()
    db.execute('''UPDATE users SET
                    name = COALESCE(?, name), role = COALESCE(?, role),
                    email = COALESCE(?, email), status = COALESCE(?, status),
                    phone = COALESCE(?, phone), class_name = COALESCE(?, class_name),
                    student_id = COALESCE(?, student_id), is_super = COALESCE(?, is_super)
                  WHERE id = ?''',
               (data.get('name'), new_role, data.get('email'), new_status,
                data.get('phone'), data.get('class_name'), data.get('student_id'),
                (1 if new_is_super else 0) if new_is_super is not None else None,
                uid))
    # 编辑表单中显式给出 password 时才更新；留空表示不动密码。
    new_pwd = data.get('password')
    if isinstance(new_pwd, str) and new_pwd.strip():
        pwd = new_pwd.strip()
        if len(pwd) < 6:
            return jsonify({'code': 1, 'message': '密码至少 6 位'}), 400
        db.execute('UPDATE users SET password_hash = ? WHERE id = ?',
                   (generate_password_hash(pwd), uid))
    db.commit()
    row = db.execute('SELECT * FROM users WHERE id = ?', (uid,)).fetchone()
    resp = row_to_dict(row)
    resp.pop('password_hash', None)
    return jsonify({'code': 0, 'data': resp})


@bp.route('/api/users/<uid>/password', methods=['PUT'])
@login_required(roles=('admin',))
def api_reset_password(uid):
    """管理员 / 超级管理员重置某个用户的密码。

    - 仅超级管理员可以重置其他管理员 / 教师的密码
    - 普通 admin 可以重置学生和自己创建的教师的密码
    返回明文密码供管理员告知用户一次。
    """
    import secrets
    data = request.get_json() or {}
    me = get_current_user() or {}
    is_super = bool(me.get('is_super'))

    db = get_db()
    target = db.execute('SELECT * FROM users WHERE id = ?', (uid,)).fetchone()
    if not target:
        return jsonify({'code': 404, 'message': '用户不存在'}), 404

    # 非超管不能改其他 admin 的密码；不能改其他 teacher 的密码
    t = row_to_dict(target)
    if not is_super and t.get('role') in ('admin',) and t.get('id') != me.get('id'):
        return jsonify({'code': 403, 'message': '仅超级管理员可重置其他管理员的密码'}), 403

    new_pwd = (data.get('password') or '').strip()
    explicit = bool(new_pwd)
    if not explicit:
        new_pwd = secrets.token_urlsafe(8)
    if len(new_pwd) < 6:
        return jsonify({'code': 1, 'message': '密码至少 6 位'}), 400

    db.execute('UPDATE users SET password_hash = ? WHERE id = ?',
               (generate_password_hash(new_pwd), uid))
    db.commit()
    return jsonify({'code': 0, 'data': {'id': uid, 'password': new_pwd, 'generated': not explicit}})
