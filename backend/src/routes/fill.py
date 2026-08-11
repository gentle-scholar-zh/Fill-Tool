# -*- coding: utf-8 -*-
"""用户端填写：模板数据接口、传统表单提交（兜底）。"""
import os
import json

from flask import Blueprint, request, jsonify, send_file

from ..db import get_db, now_str
from ..utils import build_filename_from_fields
from ..render import render_docx

bp = Blueprint('fill', __name__)


@bp.route('/api/fill/<tid>', methods=['GET'])
def api_fill_data(tid):
    """供 fill.html 异步获取模板字段数据 + 名单验证信息。"""
    db = get_db()
    tpl = db.execute('SELECT * FROM templates WHERE id = ?', (tid,)).fetchone()
    if not tpl:
        return jsonify({'code': 1, 'message': '模板不存在'}), 404

    # 下架检测：草稿状态不允许填写
    if tpl['status'] != 'published':
        return jsonify({'code': 2, 'message': '模板已下架', 'data': {
            'id': tpl['id'], 'name': tpl['name'], 'status': tpl['status'],
        }})

    fields = json.loads(tpl['fields_json'])
    # 如果字段关联了下拉选项模板，将选项注入字段数据
    for f in fields:
        osid = f.get('option_set_id')
        if osid:
            os_row = db.execute('SELECT * FROM option_sets WHERE id = ?', (osid,)).fetchone()
            if os_row:
                try:
                    f['options'] = json.loads(os_row['options_json'])
                except Exception:
                    pass
    link = db.execute('SELECT * FROM template_roster WHERE template_id = ?', (tid,)).fetchone()
    roster_info = None
    if link:
        roster = db.execute('SELECT * FROM rosters WHERE id = ?', (link['roster_id'],)).fetchone()
        if roster:
            roster_info = {
                'roster_id': roster['id'],
                'roster_name': roster['name'],
                'roster_total': roster['total'],
                'id_field': link['id_field'],
                'name_field': link['name_field'],
                'award_field': link['award_field'] or '',
                'require_verify': True,
            }
    return jsonify({'code': 0, 'data': {
        'id': tpl['id'],
        'name': tpl['name'],
        'fields': fields,
        'status': tpl['status'],
        'roster': roster_info,
    }})


@bp.route('/submit_fill/<tid>', methods=['POST'])
def submit_fill(tid):
    """传统表单提交（兜底）。"""
    db = get_db()
    tpl = db.execute('SELECT * FROM templates WHERE id = ?', (tid,)).fetchone()
    if not tpl:
        return '模板不存在', 404
    fields = json.loads(tpl['fields_json'])
    form_data = {f['name']: (request.form.get(f['name']) or '').strip() for f in fields}
    for f in fields:
        if f.get('required') and not form_data.get(f['name']):
            return f"字段 {f['name']} 不能为空", 400
    cur = db.execute('''INSERT INTO submissions (template_id, data_json, submitted_at, submitter, ip)
                        VALUES (?, ?, ?, ?, ?)''',
                     (tid, json.dumps(form_data, ensure_ascii=False), now_str(),
                      form_data.get('姓名', '匿名'), request.remote_addr or ''))
    db.commit()
    sub_id = cur.lastrowid
    out = render_docx(tpl, form_data, sub_id)
    if out and os.path.exists(out):
        dl_name = build_filename_from_fields(tpl, form_data, sub_id)
        return send_file(out, as_attachment=True, download_name=dl_name,
                         mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    return f'<p style="text-align:center;margin-top:40px">提交成功，记录号: {sub_id}</p>'
