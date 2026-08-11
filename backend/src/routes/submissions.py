# -*- coding: utf-8 -*-
"""提交记录接口：列表、创建（用户提交）、下载、删除、批量删除、导出。"""
import os
import json
import zipfile as zf
from datetime import datetime

from flask import Blueprint, request, jsonify, send_file

from ..config import SUB_DIR
from ..db import get_db, gen_id, now_str, close_db
from ..utils import safe_filename, tpl_to_dict, sub_to_dict, build_filename_from_fields, infer_type
from ..render import render_docx

bp = Blueprint('submissions', __name__)


@bp.route('/api/submissions', methods=['GET'])
def api_list_submissions():
    tid = request.args.get('template_id')
    db = get_db()
    if tid:
        rows = db.execute('SELECT * FROM submissions WHERE template_id = ? ORDER BY submitted_at DESC', (tid,)).fetchall()
    else:
        rows = db.execute('SELECT * FROM submissions ORDER BY submitted_at DESC').fetchall()
    return jsonify({'code': 0, 'data': [sub_to_dict(r) for r in rows]})


@bp.route('/api/submissions/export-fields', methods=['GET'])
def api_export_fields():
    """从提交数据 + 关联名单字段中提取可用拆分字段。"""
    tid = request.args.get('template_id')
    db = get_db()
    field_set, field_order = set(), []

    if tid:
        rows = db.execute('SELECT data_json FROM submissions WHERE template_id = ?', (tid,)).fetchall()
    else:
        rows = db.execute('SELECT data_json FROM submissions').fetchall()
    for r in rows:
        try:
            for k in json.loads(r['data_json']).keys():
                if k not in field_set:
                    field_set.add(k)
                    field_order.append(k)
        except Exception:
            pass

    if tid:
        tpl = db.execute('SELECT fields_json FROM templates WHERE id = ?', (tid,)).fetchone()
    else:
        tpl = db.execute('SELECT fields_json FROM templates WHERE deleted = 0').fetchone()
    if tpl:
        try:
            for f in json.loads(tpl['fields_json']):
                fn = f.get('name') or f.get('label') or ''
                if fn and fn not in field_set:
                    field_set.add(fn)
                    field_order.append(fn)
        except Exception:
            pass

    if tid:
        links = db.execute('SELECT roster_id FROM template_roster WHERE template_id = ?', (tid,)).fetchall()
    else:
        links = db.execute('SELECT DISTINCT roster_id FROM template_roster').fetchall()
    for lk in links:
        ros = db.execute('SELECT headers_json FROM rosters WHERE id = ?', (lk['roster_id'],)).fetchone()
        if ros:
            try:
                for h in json.loads(ros['headers_json']):
                    if h and h not in field_set:
                        field_set.add(h)
                        field_order.append(h)
            except Exception:
                pass
    return jsonify({'code': 0, 'data': field_order})


@bp.route('/api/submissions', methods=['POST'])
def api_create_submission():
    """用户端提交数据。"""
    data = request.get_json() or {}
    tid = data.get('template_id')
    if not tid:
        return jsonify({'code': 1, 'message': '缺少 template_id'}), 400
    db = get_db()
    tpl = db.execute('SELECT * FROM templates WHERE id = ?', (tid,)).fetchone()
    if not tpl:
        return jsonify({'code': 1, 'message': '模板不存在'}), 404

    form_data = data.get('data') or {}
    verified_id = data.get('student_id', '')
    verified_name = data.get('student_name', '')
    link = db.execute('SELECT * FROM template_roster WHERE template_id = ?', (tid,)).fetchone()
    if link:
        form_data[link['name_field']] = verified_name
        form_data[link['id_field']] = verified_id

    fields = json.loads(tpl['fields_json'])
    errors = []
    for f in fields:
        if f.get('required') and not (form_data.get(f['name']) or '').strip():
            errors.append(f"字段「{f['name']}」不能为空")
    if errors:
        return jsonify({'code': 1, 'message': '\n'.join(errors)}), 400

    ip = request.headers.get('X-Forwarded-For', request.remote_addr or '')
    submitter = verified_name or form_data.get('姓名') or form_data.get('name') or '匿名'
    roster_row_id = (data.get('roster_row_id') or '').strip()

    # 定位已有记录：
    # 1) 有名单时，严格按「模板 + 名额行」定位 —— 同一人多个名额各自独立；
    # 2) 无名单时（roster_row_id 为空），退化为按提交人定位（保持旧行为，重复提交即覆盖）。
    existing = None
    if roster_row_id:
        existing = db.execute('SELECT * FROM submissions WHERE template_id = ? AND roster_row_id = ?',
                               (tid, roster_row_id)).fetchone()
    if existing is None and not roster_row_id:
        existing = db.execute('SELECT * FROM submissions WHERE template_id = ? AND submitter = ?',
                              (tid, submitter)).fetchone()

    if existing:
        new_version = (existing['version'] or 1) + 1
        new_edit = (existing['edit_count'] or 0) + 1
        db.execute('''UPDATE submissions
                      SET data_json = ?, submitted_at = ?, ip = ?, version = ?, edit_count = ?, roster_row_id = ?
                      WHERE id = ?''',
                   (json.dumps(form_data, ensure_ascii=False), now_str(), ip, new_version, new_edit,
                    roster_row_id or existing['roster_row_id'] or None, existing['id']))
        sub_id = existing['id']
    else:
        cur = db.execute('''INSERT INTO submissions (template_id, data_json, submitted_at, submitter, ip, roster_row_id, version, edit_count)
                            VALUES (?, ?, ?, ?, ?, ?, 1, 0)''',
                         (tid, json.dumps(form_data, ensure_ascii=False), now_str(), submitter, ip, roster_row_id or None))
        sub_id = cur.lastrowid
    db.commit()

    rendered_path = None
    try:
        rendered_path = render_docx(tpl, form_data, sub_id)
    except Exception as e:
        print('docx 渲染失败:', e)
    final = db.execute('SELECT version, edit_count FROM submissions WHERE id = ?', (sub_id,)).fetchone()
    return jsonify({'code': 0, 'data': {
        'id': sub_id,
        'template_id': tid,
        'data': form_data,
        'submitted_at': now_str(),
        'submitter': submitter,
        'roster_row_id': roster_row_id,
        'version': final['version'] if final else 1,
        'edit_count': final['edit_count'] if final else 0,
        'rendered': bool(rendered_path),
        'download_url': f'/api/submissions/{sub_id}/download',
    }})


@bp.route('/api/submissions/<int:sid>/download', methods=['GET'])
def api_download_submission(sid):
    db = get_db()
    row = db.execute('SELECT * FROM submissions WHERE id = ?', (sid,)).fetchone()
    if not row:
        return jsonify({'code': 1, 'message': '记录不存在'}), 404
    tpl = db.execute('SELECT * FROM templates WHERE id = ?', (row['template_id'],)).fetchone()
    if not tpl:
        return jsonify({'code': 1, 'message': '模板已删除'}), 404
    data = json.loads(row['data_json'])
    out = render_docx(tpl, data, sid)
    if not out or not os.path.exists(out):
        return jsonify({'code': 1, 'message': '文件生成失败'}), 500
    dl_name = build_filename_from_fields(tpl, data, sid)
    return send_file(out, as_attachment=True, download_name=dl_name,
                     mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document')


@bp.route('/api/submissions/<int:sid>', methods=['DELETE'])
def api_delete_submission(sid):
    db = get_db()
    row = db.execute('SELECT * FROM submissions WHERE id = ?', (sid,)).fetchone()
    if not row:
        return jsonify({'code': 1, 'message': '记录不存在'}), 404
    db.execute('DELETE FROM submissions WHERE id = ?', (sid,))
    db.commit()
    try:
        d = json.loads(row['data_json'])
        tpl = db.execute('SELECT * FROM templates WHERE id = ?', (row['template_id'],)).fetchone()
        fname = build_filename_from_fields(tpl, d, sid) if tpl else f"{safe_filename(d.get('姓名', sid))}_{sid}.docx"
        old_path = os.path.join(SUB_DIR, fname)
        if os.path.exists(old_path):
            os.remove(old_path)
    except Exception:
        pass
    return jsonify({'code': 0, 'data': True})


@bp.route('/api/submissions/batch', methods=['DELETE'])
def api_batch_delete_submissions():
    """批量删除（{ids:[...]} 或 {template_id} 或 {} 清空全部）。"""
    data = request.get_json() or {}
    ids = data.get('ids') or []
    template_id = data.get('template_id')
    db = get_db()
    if ids:
        placeholders = ','.join('?' * len(ids))
        rows = db.execute(f'SELECT * FROM submissions WHERE id IN ({placeholders})', ids).fetchall()
        db.execute(f'DELETE FROM submissions WHERE id IN ({placeholders})', ids)
    elif template_id:
        rows = db.execute('SELECT * FROM submissions WHERE template_id = ?', (template_id,)).fetchall()
        db.execute('DELETE FROM submissions WHERE template_id = ?', (template_id,))
    else:
        rows = db.execute('SELECT * FROM submissions').fetchall()
        db.execute('DELETE FROM submissions')
    db.commit()

    tpl_cache = {}
    for r in rows:
        try:
            d = json.loads(r['data_json'])
            tpl = tpl_cache.get(r['template_id'])
            if not tpl:
                tpl = db.execute('SELECT * FROM templates WHERE id = ?', (r['template_id'],)).fetchone()
                tpl_cache[r['template_id']] = tpl
            fname = build_filename_from_fields(tpl, d, r['id']) if tpl else f"{safe_filename(d.get('姓名', r['id']))}_{r['id']}.docx"
            fpath = os.path.join(SUB_DIR, fname)
            if os.path.exists(fpath):
                os.remove(fpath)
        except Exception:
            pass
    return jsonify({'code': 0, 'data': {'deleted': len(rows)}})


@bp.route('/api/submissions/export', methods=['POST'])
def api_export_submissions():
    """批量导出：按 splitField 分文件夹，返回 zip。"""
    data = request.get_json() or {}
    ids = data.get('ids') or []
    split_field = data.get('splitField') or ''
    db = get_db()
    if ids:
        placeholders = ','.join('?' * len(ids))
        rows = db.execute(f'SELECT * FROM submissions WHERE id IN ({placeholders})', ids).fetchall()
    else:
        rows = db.execute('SELECT * FROM submissions ORDER BY submitted_at DESC').fetchall()
    if not rows:
        return jsonify({'code': 1, 'message': '无可导出记录'}), 400

    tpl_cache = {}
    zip_path = os.path.join(SUB_DIR, f'export_{int(datetime.now().timestamp())}.zip')
    file_count = 0
    with zf.ZipFile(zip_path, 'w', zf.ZIP_DEFLATED) as z:
        for r in rows:
            tpl = tpl_cache.get(r['template_id'])
            if not tpl:
                tp = db.execute('SELECT * FROM templates WHERE id = ? AND deleted = 0', (r['template_id'],)).fetchone()
                if not tp:
                    tp = db.execute('SELECT * FROM templates WHERE id = ?', (r['template_id'],)).fetchone()
                if not tp:
                    continue
                tpl_cache[r['template_id']] = tp
                tpl = tp
            d = json.loads(r['data_json'])
            try:
                out = render_docx(tpl, d, r['id'])
                if out and os.path.exists(out):
                    if split_field:
                        folder_val = str(d.get(split_field, '未分类')).strip() or '未分类'
                        arc_name = f"{safe_filename(folder_val)}/{os.path.basename(out)}"
                    else:
                        arc_name = os.path.basename(out)
                    z.write(out, arc_name)
                    file_count += 1
            except Exception as e:
                print('导出失败:', e)
    if file_count == 0:
        if os.path.exists(zip_path):
            os.remove(zip_path)
        return jsonify({'code': 1, 'message': '导出失败：无法渲染任何文件，请检查模板文件是否存在'}), 400
    return send_file(zip_path, as_attachment=True,
                     download_name=f'批量导出_{datetime.now().strftime("%Y%m%d_%H%M%S")}.zip')
