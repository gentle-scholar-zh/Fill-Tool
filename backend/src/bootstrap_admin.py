# -*- coding: utf-8 -*-
"""初始化 / 重置超级管理员（CLI）。

用法（在 backend/ 目录下）：
    venv/Scripts/python.exe -m src.bootstrap_admin \\
        --name "超级管理员" \\
        --phone 13800000000 \\
        --email admin@filltool.local \\
        --password "YourStrongPass!"

行为：
    - 若数据库中已存在 is_super=1 的超级管理员：默认拒绝（除非显式 --force，会把
      现有超级管理员的密码重置，并保留它/提升指定账号）。
    - 若数据库中没有任何管理员：直接创建一个超级管理员（role=admin, is_super=1）。
    - 若指定 phone/email 已存在但不是超级管理员：拒绝（避免误覆盖别人账号）。
    - 若指定 phone/email 已存在且正好是超级管理员：仅重置其密码。

适合在 Railway 的 Shell 里跑（Settings → Deployments → ⋮ → Open Shell），
也可在本机直接运行，用于本地测试 / 重置超级管理员。
"""
import argparse
import sys

from werkzeug.security import generate_password_hash

from .config import DB_PATH
from .db import get_db, init_db, now_str


def main():
    p = argparse.ArgumentParser(description='初始化 / 重置超级管理员')
    p.add_argument('--name', required=True, help='姓名')
    p.add_argument('--phone', default='', help='手机号（登录 ident）')
    p.add_argument('--email', default='', help='邮箱（登录 ident）')
    p.add_argument('--password', required=True, help='明文密码（>=6 位）')
    p.add_argument('--force', action='store_true', help='已存在超级管理员时仍重置密码')
    args = p.parse_args()

    if not args.phone and not args.email:
        print('❌ 必须至少提供 --phone 或 --email 之一', file=sys.stderr)
        sys.exit(2)
    if len(args.password) < 6:
        print('❌ 密码至少 6 位', file=sys.stderr)
        sys.exit(2)

    # 确保表结构存在
    init_db()
    db = get_db()
    ident = args.phone or args.email

    existing_super = db.execute('SELECT * FROM users WHERE is_super = 1').fetchone()
    if existing_super and not args.force:
        print(f'⚠️ 已存在超级管理员：{existing_super["name"]} ({existing_super["phone"] or existing_super["email"]})')
        print('   如需重置其密码，请加 --force。')
        sys.exit(3)

    # 查找目标账号（按 phone/email）
    target = None
    if args.phone:
        target = db.execute('SELECT * FROM users WHERE phone = ?', (args.phone,)).fetchone()
    if not target and args.email:
        target = db.execute('SELECT * FROM users WHERE email = ?', (args.email,)).fetchone()

    password_hash = generate_password_hash(args.password)
    if target:
        # 重置该账号为超级管理员（提升或保持）
        db.execute('''UPDATE users SET name = ?, role = 'admin', is_super = 1,
                      password_hash = ?, status = 'active' WHERE id = ?''',
                   (args.name, password_hash, target['id']))
        db.commit()
        print(f'✅ 已将账号 {target["phone"] or target["email"]} 提升/重置为超级管理员')
    else:
        from .db import gen_id
        uid = gen_id()
        username = args.phone or args.email
        db.execute('''INSERT INTO users (id, name, username, role, email, phone,
                      class_name, student_id, password_hash, status, is_super, created_at)
                      VALUES (?, ?, ?, 'admin', ?, ?, '', '', ?, 'active', 1, ?)''',
                   (uid, args.name, username, args.email, args.phone, password_hash, now_str()))
        db.commit()
        print(f'✅ 已创建超级管理员账号')
    print(f'   姓名：{args.name}')
    print(f'   登录账号（ident）：{args.phone or args.email}')
    print(f'   密码：{args.password}')
    print(f'   数据库：{DB_PATH}')


if __name__ == '__main__':
    main()