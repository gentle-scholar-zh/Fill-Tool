# -*- coding: utf-8 -*-
"""系统设置接口：通用键值、站点地址、留存策略。"""
from flask import Blueprint, request, jsonify

from ..config import get_lan_ip, get_fill_base_url
from ..db import get_db, now_str

bp = Blueprint('settings', __name__)


@bp.route('/api/settings', methods=['GET'])
def api_get_settings():
    db = get_db()
    rows = db.execute('SELECT * FROM settings').fetchall()
    return jsonify({'code': 0, 'data': {r['key']: r['value'] for r in rows}})


@bp.route('/api/settings', methods=['PUT'])
def api_update_settings():
    data = request.get_json() or {}
    db = get_db()
    for k, v in data.items():
        db.execute('''INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)''',
                   (k, str(v), now_str()))
    db.commit()
    return jsonify({'code': 0, 'data': True})


@bp.route('/api/settings/site-url', methods=['GET'])
def api_get_site_url():
    """获取当前站点公开访问地址 + 自动检测的局域网 IP。"""
    db = get_db()
    row = db.execute("SELECT value FROM settings WHERE key = 'site_url'").fetchone()
    site_url = row['value'] if row else ''
    lan_ip = get_lan_ip()
    current = get_fill_base_url()
    return jsonify({'code': 0, 'data': {
        'site_url': site_url,
        'lan_ip': lan_ip,
        'current': current,
        'lan_url': f'http://{lan_ip}:5000' if lan_ip else '',
    }})


@bp.route('/api/settings/site-url', methods=['PUT'])
def api_set_site_url():
    """设置站点公开访问地址。"""
    data = request.get_json() or {}
    url = (data.get('url') or '').strip().rstrip('/')
    db = get_db()
    if url:
        db.execute('''INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('site_url', ?, ?)''',
                   (url, now_str()))
    else:
        db.execute("DELETE FROM settings WHERE key = 'site_url'")
    db.commit()
    return jsonify({'code': 0, 'data': get_fill_base_url()})


@bp.route('/api/settings/retention', methods=['PUT'])
def api_update_retention():
    data = request.get_json() or {}
    days = data.get('days', 30)
    db = get_db()
    db.execute('''INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('retention_days', ?, ?)''',
               (str(days), now_str()))
    db.commit()
    return jsonify({'code': 0, 'data': True})
