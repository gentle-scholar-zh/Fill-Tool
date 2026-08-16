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
    # ---- PRD V2.1：首次启动写入 / 升级更新日志（仅当为空或与最新规范化版本不一致时覆盖） ----
    try:
        v21_content = json.dumps({
            'new': [
                '公共模板池：访客可填写已发布的公开模板（默认免登录，可在「设置 → 公共填写访问控制」中切换为登录后填写）',
                '用户账号体系：自助注册仅限学生；教师 / 管理员账号仅由超级管理员在后台创建',
                '找回密码流程：登录页提交申请 → 管理员在「通知中心」审批 → 通过后新密码立即生效并通知申请人',
                '后台一键重置密码：管理员可生成临时密码并通知用户首次登录后修改',
                '账号启用 / 禁用：管理员可在后台切换用户状态，被禁用户登录时返回明确错误',
                '角色分组下拉：新建 / 编辑用户按「前台用户 / 后台用户」分组，避免误选角色',
            ],
            'improve': [
                '后台与公共模板池界面升级：统一黑白线条图标与紧凑按钮样式',
                '空状态统一为单行展示并保留左侧留白，便于快速定位入口',
                '模板管理「分类」筛选改为基于模板自身的分类字段，不再混入名单分组',
                '公共模板池右上「我的」入口改为右下角浮动设置按钮，更不打扰浏览',
                '登录页标题改为「Fill Tool」；登录按钮下方居中放置「找回密码 / 立即注册」链接，去除装饰图标与下划线',
                '公共填写访问控制新增切换状态即时提示，明确当前生效模式',
            ],
            'fix': [
                '部署后数据丢失：补齐数据卷挂载（DATA_DIR）支持，避免容器重启清空 SQLite',
                '后台编辑用户表单整合密码字段与重置按钮，修复原「行内按钮生成临时密码」在创建用户时的不合理行为',
                '更新日志从页面边角移入「设置」页底部卡片，并新增后台侧栏「更新日志」管理入口',
            ],
        }, ensure_ascii=False)
        cur = db.execute('SELECT id, version, content_json FROM changelog WHERE id = ?', ('v21',)).fetchone()
        if not cur:
            db.execute(
                'INSERT INTO changelog (id, version, date, content_json, created_at) VALUES (?,?,?,?,?)',
                ('v21', 'V2.1.0', '2026-08-16', v21_content, now_str())
            )
        else:
            # 已存在：对齐规范化版本（仅当结构不一致时覆盖）
            try:
                parsed = json.loads(cur['content_json'] or '{}')
                if not isinstance(parsed, dict) or 'new' not in parsed:
                    db.execute('UPDATE changelog SET content_json = ?, date = ? WHERE id = ?',
                               (v21_content, '2026-08-16', 'v21'))
            except Exception:
                db.execute('UPDATE changelog SET content_json = ?, date = ? WHERE id = ?',
                           (v21_content, '2026-08-16', 'v21'))
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
