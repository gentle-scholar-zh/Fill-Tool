# -*- coding: utf-8 -*-
"""名单分类接口。"""
import sqlite3

from flask import Blueprint, request, jsonify

from ..db import get_db, gen_id, now_str, row_to_dict

bp = Blueprint('categories', __name__)


@bp.route('/api/categories', methods=['GET'])
def api_list_categories():
    db = get_db()
    rows = db.execute('SELECT * FROM categories ORDER BY created_at').fetchall()
    return jsonify({'code': 0, 'data': [row_to_dict(r) for r in rows]})


@bp.route('/api/categories', methods=['POST'])
def api_create_category():
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'code': 1, 'message': '名称不能为空'}), 400
    db = get_db()
    cid = gen_id()
    try:
        db.execute('INSERT INTO categories (id, name, count, created_at) VALUES (?, ?, ?, ?)',
                   (cid, name, 0, now_str()))
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({'code': 1, 'message': '分类已存在'}), 400
    row = db.execute('SELECT * FROM categories WHERE id = ?', (cid,)).fetchone()
    return jsonify({'code': 0, 'data': row_to_dict(row)})


@bp.route('/api/categories/<cid>', methods=['PUT'])
def api_update_category(cid):
    data = request.get_json() or {}
    db = get_db()
    db.execute('UPDATE categories SET name = ? WHERE id = ?', (data.get('name', '').strip(), cid))
    db.commit()
    row = db.execute('SELECT * FROM categories WHERE id = ?', (cid,)).fetchone()
    return jsonify({'code': 0, 'data': row_to_dict(row)})


@bp.route('/api/categories/<cid>', methods=['DELETE'])
def api_delete_category(cid):
    db = get_db()
    db.execute('DELETE FROM categories WHERE id = ?', (cid,))
    db.commit()
    return jsonify({'code': 0, 'data': True})
