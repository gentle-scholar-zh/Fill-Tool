# -*- coding: utf-8 -*-
"""通知接口。"""
from flask import Blueprint, request, jsonify

from ..db import get_db, row_to_dict

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
