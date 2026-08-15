# -*- coding: utf-8 -*-
"""认证与账户接口：注册、登录、登出、当前用户、角色权限校验。

登录态基于 Flask session（secret_key 由 app.py 提供），同源部署下 cookie 自动随请求携带。
角色：admin（管理员）/ teacher（教师）/ student（学生）。
前端在后台页面加载时调用 /api/auth/check 判断登录态与角色，未登录跳登录页；
登录模式下填写提交时由后端从 session 取 user_id 绑定到 submission。
"""
import functools

from flask import Blueprint, request, jsonify, session

from ..db import get_db, gen_id, now_str, row_to_dict
from werkzeug.security import generate_password_hash, check_password_hash

bp = Blueprint('auth', __name__)

ROLES = ('admin', 'teacher', 'student')
# 角色默认登录后落地页
ROLE_HOME = {
    'admin': '/admin/',
    'teacher': '/admin/templates.html',
    'student': '/user/pool.html',
}


def get_current_user():
    """从 session 取当前登录用户（dict），未登录返回 None。"""
    uid = session.get('user_id')
    if not uid:
        return None
    db = get_db()
    row = db.execute('SELECT * FROM users WHERE id = ?', (uid,)).fetchone()
    return row_to_dict(row) if row else None


def login_required(roles=None):
    """视图装饰器：校验登录态，可选校验角色。

    roles 为元组/集合，命中其一即可；不传则仅校验已登录。
    返回 JSON 错误（401 未登录 / 403 无权限），由前端统一处理跳转。
    """
    def decorator(view):
        @functools.wraps(view)
        def wrapper(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({'code': 401, 'message': '未登录或登录已过期'}), 401
            if roles and user.get('role') not in roles:
                return jsonify({'code': 403, 'message': '无权限执行该操作'}), 403
            return view(*args, **kwargs)
        return wrapper
    return decorator


def _public_user(u):
    """剔除敏感字段后返回用户字典。"""
    if not u:
        return None
    u = dict(u)
    u.pop('password_hash', None)
    return u


@bp.route('/api/auth/register', methods=['POST'])
def api_register():
    """用户自助注册。

    字段：role / name / email / phone / class_name / student_id / password / confirm_password
    - 学生必须填学号；教师/管理员学号选填
    - 手机号、邮箱不可与已有用户重复
    """
    data = request.get_json() or {}
    role = data.get('role') or 'student'
    if role not in ROLES:
        role = 'student'
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip()
    phone = (data.get('phone') or '').strip()
    class_name = (data.get('class_name') or '').strip()
    student_id = (data.get('student_id') or '').strip()
    password = data.get('password') or ''
    confirm = data.get('confirm_password') or ''

    if not name:
        return jsonify({'code': 1, 'message': '姓名不能为空'}), 400
    if not phone and not email:
        return jsonify({'code': 1, 'message': '手机号或邮箱至少填写一项'}), 400
    if role == 'student' and not student_id:
        return jsonify({'code': 1, 'message': '学生必须填写学号'}), 400
    if len(password) < 6:
        return jsonify({'code': 1, 'message': '密码至少 6 位'}), 400
    if password != confirm:
        return jsonify({'code': 1, 'message': '两次输入的密码不一致'}), 400

    db = get_db()
    if phone and db.execute('SELECT 1 FROM users WHERE phone = ?', (phone,)).fetchone():
        return jsonify({'code': 1, 'message': '该手机号已注册'}), 400
    if email and db.execute('SELECT 1 FROM users WHERE email = ?', (email,)).fetchone():
        return jsonify({'code': 1, 'message': '该邮箱已注册'}), 400

    uid = gen_id()
    username = phone or email  # 兼容旧表 username 唯一约束
    db.execute('''INSERT INTO users (id, name, username, role, email, phone, class_name, student_id, password_hash, status, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
               (uid, name, username, role, email, phone, class_name, student_id,
                generate_password_hash(password), 'active', now_str()))
    db.commit()
    row = db.execute('SELECT * FROM users WHERE id = ?', (uid,)).fetchone()
    return jsonify({'code': 0, 'data': _public_user(row_to_dict(row))})


@bp.route('/api/auth/login', methods=['POST'])
def api_login():
    """登录：ident 为手机号或邮箱，password 明文。成功后写 session。"""
    data = request.get_json() or {}
    ident = (data.get('ident') or '').strip()
    password = data.get('password') or ''
    if not ident or not password:
        return jsonify({'code': 1, 'message': '请输入账号和密码'}), 400

    db = get_db()
    row = db.execute('SELECT * FROM users WHERE phone = ? OR email = ?',
                      (ident, ident)).fetchone()
    if not row:
        return jsonify({'code': 1, 'message': '账号或密码错误'}), 401
    user = row_to_dict(row)
    if not user['password_hash'] or not check_password_hash(user['password_hash'], password):
        return jsonify({'code': 1, 'message': '账号或密码错误'}), 401
    if user.get('status') == 'disabled':
        return jsonify({'code': 1, 'message': '账号已被禁用'}), 403

    session['user_id'] = user['id']
    session.permanent = True
    db.execute('UPDATE users SET last_login = ? WHERE id = ?', (now_str(), user['id']))
    db.commit()
    u = _public_user(row_to_dict(user))
    u['home'] = ROLE_HOME.get(u['role'], '/user/pool.html')
    return jsonify({'code': 0, 'data': u})


@bp.route('/api/auth/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'code': 0, 'data': True})


@bp.route('/api/auth/me', methods=['GET'])
def api_me():
    return jsonify({'code': 0, 'data': _public_user(get_current_user())})


@bp.route('/api/auth/check', methods=['GET'])
def api_check():
    u = get_current_user()
    pu = _public_user(u)
    if pu:
        pu['home'] = ROLE_HOME.get(pu['role'], '/user/pool.html')
    return jsonify({'code': 0, 'logged_in': bool(u), 'data': pu})
