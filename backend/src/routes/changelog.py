# -*- coding: utf-8 -*-
"""更新日志接口：列表（公开可读）/ 管理员新增、编辑、删除。"""
import json

from flask import Blueprint, request, jsonify

from ..db import get_db, gen_id, now_str, row_to_dict
from .auth import login_required

bp = Blueprint('changelog', __name__)


@bp.route('/api/changelog', methods=['GET'])
def api_list_changelog():
    """列出全部更新日志，按日期倒序。前台底部折叠区调用。"""
    db = get_db()
    rows = db.execute('SELECT * FROM changelog ORDER BY date DESC, created_at DESC').fetchall()
    out = []
    for r in rows:
        d = row_to_dict(r)
        try:
            d['content'] = json.loads(d.get('content_json') or '[]')
        except Exception:
            d['content'] = []
        out.append(d)
    return jsonify({'code': 0, 'data': out})


@bp.route('/api/changelog', methods=['POST'])
@login_required(roles=('admin',))
def api_create_changelog():
    data = request.get_json() or {}
    version = (data.get('version') or '').strip()
    date = (data.get('date') or now_str()[:10]).strip()
    content = data.get('content') or []
    if isinstance(content, str):
        content = [c.strip() for c in content.split('\n') if c.strip()]
    if not version:
        return jsonify({'code': 1, 'message': '版本号不能为空'}), 400
    db = get_db()
    cid = gen_id()
    db.execute('INSERT INTO changelog (id, version, date, content_json, created_at) VALUES (?, ?, ?, ?, ?)',
               (cid, version, date, json.dumps(content, ensure_ascii=False), now_str()))
    db.commit()
    row = db.execute('SELECT * FROM changelog WHERE id = ?', (cid,)).fetchone()
    return jsonify({'code': 0, 'data': row_to_dict(row)})


@bp.route('/api/changelog/<cid>', methods=['PUT'])
@login_required(roles=('admin',))
def api_update_changelog(cid):
    data = request.get_json() or {}
    db = get_db()
    row = db.execute('SELECT * FROM changelog WHERE id = ?', (cid,)).fetchone()
    if not row:
        return jsonify({'code': 1, 'message': '记录不存在'}), 404
    version = (data.get('version') or row['version'])
    date = (data.get('date') or row['date'])
    content = data.get('content', json.loads(row['content_json']))
    if isinstance(content, str):
        content = [c.strip() for c in content.split('\n') if c.strip()]
    db.execute('UPDATE changelog SET version = ?, date = ?, content_json = ? WHERE id = ?',
               (version, date, json.dumps(content, ensure_ascii=False), cid))
    db.commit()
    row = db.execute('SELECT * FROM changelog WHERE id = ?', (cid,)).fetchone()
    return jsonify({'code': 0, 'data': row_to_dict(row)})


@bp.route('/api/changelog/<cid>', methods=['DELETE'])
@login_required(roles=('admin',))
def api_delete_changelog(cid):
    db = get_db()
    db.execute('DELETE FROM changelog WHERE id = ?', (cid,))
    db.commit()
    return jsonify({'code': 0, 'data': True})
