# -*- coding: utf-8 -*-
"""回收站接口：列表、还原、永久删除、清空。"""
from datetime import datetime

from flask import Blueprint, request, jsonify

from ..db import get_db
from .auth import login_required

bp = Blueprint('recycle', __name__)


@bp.route('/api/recycle', methods=['GET'])
@login_required(roles=('admin',))
def api_list_recycle():
    db = get_db()
    rows = db.execute('SELECT * FROM recycle ORDER BY deleted_at DESC').fetchall()
    result = []
    for r in rows:
        d = dict(r)
        try:
            expire_dt = datetime.strptime(d['expire_at'], '%Y-%m-%d %H:%M:%S')
            d['expire_in'] = max(0, (expire_dt - datetime.now()).days)
        except Exception:
            d['expire_in'] = 0
        result.append(d)
    return jsonify({'code': 0, 'data': result})


@bp.route('/api/recycle/<rid>/restore', methods=['POST'])
@login_required(roles=('admin',))
def api_restore_recycle(rid):
    db = get_db()
    item = db.execute('SELECT * FROM recycle WHERE id = ?', (rid,)).fetchone()
    if not item:
        return jsonify({'code': 1, 'message': '回收站项不存在'}), 404
    if item['item_type'] == 'template':
        db.execute('UPDATE templates SET deleted = 0 WHERE id = ?', (item['item_id'],))
    db.execute('DELETE FROM recycle WHERE id = ?', (rid,))
    db.commit()
    return jsonify({'code': 0, 'data': True})


@bp.route('/api/recycle/restore-all', methods=['POST'])
@login_required(roles=('admin',))
def api_restore_all_recycle():
    db = get_db()
    items = db.execute('SELECT * FROM recycle').fetchall()
    for item in items:
        if item['item_type'] == 'template':
            db.execute('UPDATE templates SET deleted = 0 WHERE id = ?', (item['item_id'],))
    db.execute('DELETE FROM recycle')
    db.commit()
    return jsonify({'code': 0, 'data': True})


@bp.route('/api/recycle/<rid>', methods=['DELETE'])
@login_required(roles=('admin',))
def api_permanent_delete_recycle(rid):
    db = get_db()
    item = db.execute('SELECT * FROM recycle WHERE id = ?', (rid,)).fetchone()
    if not item:
        return jsonify({'code': 1, 'message': '回收站项不存在'}), 404
    if item['item_type'] == 'template':
        db.execute('DELETE FROM templates WHERE id = ?', (item['item_id'],))
    db.execute('DELETE FROM recycle WHERE id = ?', (rid,))
    db.commit()
    return jsonify({'code': 0, 'data': True})


@bp.route('/api/recycle', methods=['DELETE'])
@login_required(roles=('admin',))
def api_empty_recycle():
    db = get_db()
    items = db.execute('SELECT * FROM recycle').fetchall()
    for item in items:
        if item['item_type'] == 'template':
            db.execute('DELETE FROM templates WHERE id = ?', (item['item_id'],))
    db.execute('DELETE FROM recycle')
    db.commit()
    return jsonify({'code': 0, 'data': True})
