# -*- coding: utf-8 -*-
"""数据库层：连接管理、表结构初始化、通用工具。"""
import sqlite3
import uuid
import json

from flask import g
from .config import DB_PATH, now_str


def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH, check_same_thread=False)
        g.db.row_factory = sqlite3.Row
    return g.db


def close_db(error):
    db = g.pop('db', None)
    if db:
        db.close()


def init_db():
    """初始化数据库结构（幂等，兼容旧表自动加列）。"""
    db = sqlite3.connect(DB_PATH)
    db.execute('PRAGMA journal_mode=WAL')
    db.executescript('''
    CREATE TABLE IF NOT EXISTS templates (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        category    TEXT DEFAULT '未分类',
        file_name   TEXT NOT NULL,
        file_path   TEXT NOT NULL,
        fields_json TEXT NOT NULL,
        status      TEXT DEFAULT 'draft',
        deleted     INTEGER DEFAULT 0,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        published_at TEXT
    );

    CREATE TABLE IF NOT EXISTS submissions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id TEXT NOT NULL,
        data_json   TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        submitter   TEXT,
        ip          TEXT,
        roster_row_id TEXT,
        version     INTEGER DEFAULT 1,
        edit_count  INTEGER DEFAULT 0,
        FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        username    TEXT UNIQUE NOT NULL,
        role        TEXT NOT NULL,
        status      TEXT DEFAULT 'active',
        email       TEXT,
        last_login  TEXT,
        created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
        id          TEXT PRIMARY KEY,
        name        TEXT UNIQUE NOT NULL,
        count       INTEGER DEFAULT 0,
        created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        body        TEXT,
        type        TEXT DEFAULT 'info',
        icon        TEXT DEFAULT 'bell',
        read        INTEGER DEFAULT 0,
        created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recycle (
        id          TEXT PRIMARY KEY,
        item_type   TEXT NOT NULL,
        item_id     TEXT NOT NULL,
        item_name   TEXT NOT NULL,
        deleted_at  TEXT NOT NULL,
        expire_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS share (
        id              INTEGER PRIMARY KEY CHECK (id = 1),
        template_id     TEXT,
        url             TEXT,
        qr_image        TEXT,
        enabled         INTEGER DEFAULT 1,
        expiry          TEXT,
        password        TEXT,
        updated_at      TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
        key         TEXT PRIMARY KEY,
        value       TEXT,
        updated_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS rosters (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        file_name   TEXT NOT NULL,
        file_path   TEXT NOT NULL,
        total       INTEGER DEFAULT 0,
        headers_json TEXT,
        rows_json   TEXT,
        category_id TEXT,
        created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS template_roster (
        template_id TEXT NOT NULL,
        roster_id   TEXT NOT NULL,
        id_field    TEXT DEFAULT '学号',
        name_field  TEXT DEFAULT '姓名',
        linked_at   TEXT NOT NULL,
        PRIMARY KEY (template_id, roster_id),
        FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
        FOREIGN KEY (roster_id) REFERENCES rosters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS option_sets (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        options_json TEXT NOT NULL,
        created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS changelog (
        id          TEXT PRIMARY KEY,
        version     TEXT NOT NULL,
        date        TEXT NOT NULL,
        content_json TEXT NOT NULL,
        created_at  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_submissions_template ON submissions(template_id);
    CREATE INDEX IF NOT EXISTS idx_recycle_expire ON recycle(expire_at);
    CREATE INDEX IF NOT EXISTS idx_template_roster ON template_roster(template_id);
    ''')
    try:
        db.execute('ALTER TABLE templates ADD COLUMN deleted INTEGER DEFAULT 0')
    except Exception:
        pass
    try:
        db.execute('ALTER TABLE rosters ADD COLUMN category_id TEXT')
    except Exception:
        pass
    try:
        db.execute('ALTER TABLE submissions ADD COLUMN roster_row_id TEXT')
    except Exception:
        pass
    try:
        db.execute('ALTER TABLE submissions ADD COLUMN version INTEGER DEFAULT 1')
    except Exception:
        pass
    try:
        db.execute('ALTER TABLE submissions ADD COLUMN edit_count INTEGER DEFAULT 0')
    except Exception:
        pass
    try:
        db.execute('ALTER TABLE template_roster ADD COLUMN award_field TEXT')
    except Exception:
        pass
    # ---- PRD V2.0 扩展列（幂等） ----
    for col, sql in [
        ('users', 'ALTER TABLE users ADD COLUMN password_hash TEXT'),
        ('users', 'ALTER TABLE users ADD COLUMN phone TEXT'),
        ('users', 'ALTER TABLE users ADD COLUMN class_name TEXT'),
        ('users', 'ALTER TABLE users ADD COLUMN student_id TEXT'),
        ('templates', 'ALTER TABLE templates ADD COLUMN is_public INTEGER DEFAULT 0'),
        ('templates', 'ALTER TABLE templates ADD COLUMN owner_id TEXT'),
        ('submissions', 'ALTER TABLE submissions ADD COLUMN user_id TEXT'),
        ('users', 'ALTER TABLE users ADD COLUMN is_super INTEGER DEFAULT 0'),
    ]:
        try:
            db.execute(sql)
        except Exception:
            pass
    # ---- PRD V2.1：自动把历史最老的 admin 升为超级管理员（幂等） ----
    try:
        existing = db.execute('SELECT id FROM users WHERE is_super = 1 LIMIT 1').fetchone()
        if not existing:
            # 没有现役超级管理员 → 找最老的 admin 提升（init_db 用的是裸连接，
            # fetchone() 返回的是 tuple 而非 sqlite3.Row，故用索引取 id）
            row = db.execute(
                "SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC, rowid ASC LIMIT 1"
            ).fetchone()
            if row:
                admin_id = row[0] if not isinstance(row, dict) else row['id']
                db.execute('UPDATE users SET is_super = 1 WHERE id = ?', (admin_id,))
    except Exception:
        pass
    # ---- PRD V2.1 P2：密码申请通知扩展列（幂等） ----
    for sql in [
        "ALTER TABLE notifications ADD COLUMN payload TEXT DEFAULT '{}'",
        "ALTER TABLE notifications ADD COLUMN status TEXT DEFAULT 'open'",
    ]:
        try:
            db.execute(sql)
        except Exception:
            pass
    # ---- PRD V2.1：首次启动写入真实更新日志（仅当为空） ----
    try:
        if not db.execute('SELECT 1 FROM changelog').fetchone():
            db.execute(
                'INSERT INTO changelog (id, version, date, content_json, created_at) VALUES (?,?,?,?,?)',
                ('v21', 'V2.1.0', '2026-08-16',
                 json.dumps([
                    '用户体系：自助注册仅限学生；教师 / 管理员仅由超级管理员在后台创建',
                    '密码安全：支持登录后自助改密；后台可一键重置任意用户密码；登录页「忘记密码」可申请，管理员在通知中心批准后生效',
                    '账号管理：后台支持启用 / 禁用用户',
                    '数据持久化：部署可挂载数据卷（Railway Volume + DATA_DIR），重启不再丢失数据',
                    '公开模板池：后台新增「公开模板池」入口；公共池页面提供「我的」一键进入个人中心',
                    '界面升级：全站改用黑白线条图标，重设计后台 / 用户端，空状态统一为单行样式',
                    '角色选择：新建 / 编辑用户按「前台用户 / 后台用户」分组',
                 ], ensure_ascii=False),
                 now_str())
            )
    except Exception:
        pass
    db.commit()
    db.close()


def row_to_dict(row):
    if row is None:
        return None
    return {k: row[k] for k in row.keys()}


def gen_id():
    return str(uuid.uuid4())[:12]
