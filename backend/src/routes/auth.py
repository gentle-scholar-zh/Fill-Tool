# -*- coding: utf-8 -*-
"""认证与账户接口：注册、登录、登出、当前用户、角色权限校验。

登录态基于 Flask session（secret_key 由 app.py 提供），同源部署下 cookie 自动随请求携带。
角色：admin（管理员）/ teacher（教师）/ student（学生）。
前端在后台页面加载时调用 /api/auth/check 判断登录态与角色，未登录跳登录页；
登录模式下填写提交时由后端从 session 取 user_id 绑定到 submission。
"""
import functools
import json

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
    """用户自助注册（公共接口，仅允许注册学生）。

    字段：name / email / phone / class_name / student_id / password / confirm_password
    - 学生必须填学号
    - 手机号、邮箱不可与已有用户重复
    - **公共注册一律强制为 student 角色**，即使客户端伪造 role 字段也会被服务端覆盖。
      教师 / 管理员 / 超级管理员账号只能由超级管理员在后台「用户管理」创建，
      或通过 `bootstrap_admin.py` CLI 脚本初始化。
    """
    data = request.get_json() or {}
    # 公共注册硬编码为学生；忽略客户端传入的 role 字段
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
    if not student_id:
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
    db.execute('''INSERT INTO users (id, name, username, role, email, phone, class_name, student_id, password_hash, status, is_super, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)''',
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


@bp.route('/api/auth/password', methods=['PUT'])
def api_change_password():
    """已登录用户自助修改自己的密码：old_password + new_password。
    若忘记原密码，须联系管理员 / 超级管理员通过 /api/users/<uid>/password 重置。
    """
    u = get_current_user()
    if not u:
        return jsonify({'code': 401, 'message': '请先登录'}), 401
    data = request.get_json() or {}
    old_pwd = data.get('old_password') or ''
    new_pwd = data.get('new_password') or ''
    if not old_pwd or not new_pwd:
        return jsonify({'code': 1, 'message': '请输入原密码和新密码'}), 400
    if len(new_pwd) < 6:
        return jsonify({'code': 1, 'message': '新密码至少 6 位'}), 400
    db = get_db()
    row = db.execute('SELECT * FROM users WHERE id = ?', (u['id'],)).fetchone()
    if not row or not check_password_hash(row['password_hash'] or '', old_pwd):
        return jsonify({'code': 1, 'message': '原密码错误'}), 400
    db.execute('UPDATE users SET password_hash = ? WHERE id = ?',
               (generate_password_hash(new_pwd), u['id']))
    db.commit()
    return jsonify({'code': 0, 'data': True})


@bp.route('/api/auth/password-request', methods=['POST'])
def api_password_request():
    """用户忘记密码：提交改密申请（公开接口，无需登录）。

    流程：用户填账号 + 想要的新密码（选填）→ 落一条 type='password_request' 的通知
    → 管理员在「通知」中心看到并点击「批准重置」→ 新密码写入该用户账户。
    若用户未填新密码，则生成一个临时密码，待批准后生效（管理员可在通知中查看）。
    """
    import secrets
    data = request.get_json() or {}
    ident = (data.get('ident') or '').strip()
    new_pwd = (data.get('new_password') or '').strip()
    note = (data.get('note') or '').strip()
    if not ident:
        return jsonify({'code': 1, 'message': '请输入账号（手机号或邮箱）'}), 400
    if new_pwd and len(new_pwd) < 6:
        return jsonify({'code': 1, 'message': '新密码至少 6 位'}), 400

    db = get_db()
    row = db.execute('SELECT * FROM users WHERE phone = ? OR email = ?',
                     (ident, ident)).fetchone()
    if not row:
        return jsonify({'code': 1, 'message': '未找到该账号，请检查手机号或邮箱'}), 404
    user = row_to_dict(row)
    if user.get('status') == 'disabled':
        return jsonify({'code': 1, 'message': '该账号已被禁用，请联系管理员'}), 403

    # 未提供新密码则生成一个临时密码，待管理员批准后生效
    if not new_pwd:
        new_pwd = secrets.token_urlsafe(8)
    payload = json.dumps({'uid': user['id'], 'new_password': new_pwd, 'note': note},
                         ensure_ascii=False)
    db.execute('''INSERT INTO notifications (id, title, body, type, icon, payload, status, created_at)
                  VALUES (?, ?, ?, 'password_request', 'lock', ?, 'open', ?)''',
               (gen_id(), '用户申请修改密码',
                f"{user['name']}（{ident}）申请重置密码" + (f"：{note}" if note else ''),
                payload, now_str()))
    db.commit()
    return jsonify({'code': 0,
                    'message': '申请已提交，请等待管理员处理；处理后将以站内通知告知新密码'})


# ============================================================================
# 一次性超管初始化 HTTP 端点（无需 SSH/CLI，浏览器 POST 即可）
# ----------------------------------------------------------------------------
# 用途：Railway 等无 SSH/Shell 环境下，部署首次启动后用此端点创建首个超级管理员。
# 安全性：
#   1. 仅当数据库中没有 is_super=1 的用户时才生效（已存在 → 403）
#   2. POST 请求体 { name, phone, password }
#   3. phone 不可重复（已存在 → 400）
#   4. 密码长度 < 6 → 400
#   5. 初始化成功后自动返回账号信息（含明文密码一次，供管理员记录）
# 部署顺序：
#   1. Settings → Volumes 挂 /data（Mount Path = /data）
#   2. Variables 加 DATA_DIR = /data
#   3. Redeploy（触发拉新代码 + 挂卷）
#   4. curl -X POST https://huanhuan.dpdns.org/api/bootstrap/super-admin \
#        -H "Content-Type: application/json" \
#        -d '{"name":"超级管理员","phone":"13800000000","password":"你的强密码"}'
# ============================================================================
@bp.route('/api/bootstrap/super-admin', methods=['POST'])
def api_bootstrap_super_admin():
    data = request.get_json() or {}
    name = (data.get('name') or '超级管理员').strip()
    phone = (data.get('phone') or '').strip()
    password = data.get('password') or ''

    if not phone:
        return jsonify({'code': 1, 'message': '缺少手机号'}), 400
    if not phone.isdigit() or len(phone) < 7:
        return jsonify({'code': 1, 'message': '手机号格式不正确'}), 400
    if len(password) < 6:
        return jsonify({'code': 1, 'message': '密码至少 6 位'}), 400

    db = get_db()
    # 安全检查 1：已存在超级管理员 → 拒绝
    if db.execute('SELECT 1 FROM users WHERE is_super = 1').fetchone():
        return jsonify({'code': 1, 'message': '系统已存在超级管理员，禁止重复初始化'}), 403
    # 安全检查 2：手机号重复 → 拒绝
    if db.execute('SELECT 1 FROM users WHERE phone = ?', (phone,)).fetchone():
        return jsonify({'code': 1, 'message': '该手机号已注册'}), 400

    uid = gen_id()
    username = phone
    db.execute('''INSERT INTO users (id, name, username, role, email, phone, password_hash, is_super, status, created_at)
                  VALUES (?, ?, ?, 'admin', '', ?, ?, 1, 'active', ?)''',
               (uid, name, username, phone, generate_password_hash(password), now_str()))
    db.commit()
    return jsonify({
        'code': 0,
        'message': '超级管理员创建成功，请使用下方账号登录',
        'data': {
            'id': uid,
            'name': name,
            'phone': phone,
            'role': 'admin',
            'is_super': True,
            'password': password,  # 仅初始化时返回一次，管理员自行记录
            'login_url': '/user/login.html',
            'note': '为安全起见，登录后请尽快修改密码',
        }
    })
