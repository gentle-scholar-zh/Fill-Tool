# -*- coding: utf-8 -*-
"""数据库层：连接管理、表结构初始化、通用工具。"""
import sqlite3
import uuid

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
    db.commit()
    db.close()


def row_to_dict(row):
    if row is None:
        return None
    return {k: row[k] for k in row.keys()}


def gen_id():
    return str(uuid.uuid4())[:12]
