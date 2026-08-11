# -*- coding: utf-8 -*-
"""文档渲染：使用 docxtpl 渲染模板为提交 docx；服务端兜底渲染填写页 HTML。"""
import os
import json

from docxtpl import DocxTemplate
from .config import SUB_DIR, TPL_DIR
from .utils import safe_filename, build_filename_from_fields


def render_docx(tpl_row, data, sub_id):
    """使用 docxtpl 渲染模板，保存到 submissions_storage。失败返回 None。

    路径解析做多重兜底：优先用 file_path，其次按 {id}_{file_name}、
    {file_name} 在 TPL_DIR 中查找，兼容重构前后不同的存储路径。
    """
    # 归一化：sqlite3.Row 没有 .get()，统一转 dict 以便后续处理
    if not isinstance(tpl_row, dict):
        tpl_row = dict(tpl_row)
    candidates = []
    fp = tpl_row.get('file_path') or ''
    if fp:
        candidates.append(fp)
    tid = tpl_row.get('id', '') or ''
    fn = tpl_row.get('file_name') or ''
    if tid and fn:
        candidates.append(os.path.join(TPL_DIR, f'{tid}_{safe_filename(fn)}'))
    if fn:
        candidates.append(os.path.join(TPL_DIR, fn))
    file_path = None
    for c in candidates:
        if c and os.path.exists(c):
            file_path = c
            break
    if not file_path:
        print('[render_docx] 未找到模板文件，候选:', candidates)
        return None
    out_name = build_filename_from_fields(tpl_row, data, sub_id)
    out_path = os.path.join(SUB_DIR, out_name)
    try:
        doc = DocxTemplate(file_path)
        render_data = {}
        for k, v in data.items():
            if isinstance(v, str) and '\n' in v:
                render_data[k] = v.replace('\n', '<w:br/>')
            else:
                render_data[k] = v
        doc.render(render_data)
        doc.save(out_path)
        return out_path
    except Exception as e:
        print('渲染失败:', e)
        return None


def render_fill_html(name, fields, tid):
    """服务端渲染填写页（兜底方案），主方案由前端 fill.html 客户端渲染。"""
    field_html = ''
    for f in fields:
        n = f.get('name', '')
        t = f.get('raw_type', 'text')
        req = 'required' if f.get('required') else ''
        ph = f.get('placeholder', '') or ''
        hint = f.get('hint', '') or ''
        star = ' <span style="color:#c53727">*</span>' if f.get('required') else ''
        if t == 'select':
            opts = f.get('options', '') or ''
            opt_list = [o.strip() for o in opts.split(',') if o.strip()] or ['选项1', '选项2']
            options = ''.join(f'<option value="{o}">{o}</option>' for o in opt_list)
            input_el = f'<select name="{n}" {req} style="width:100%;padding:12px;border:1.5px solid #d5dee8;border-radius:12px;font-size:15px;background:#fff"><option value="">请选择</option>{options}</select>'
        elif t == 'date':
            input_el = f'<input type="date" name="{n}" {req} style="width:100%;padding:12px;border:1.5px solid #d5dee8;border-radius:12px;font-size:15px">'
        elif t == 'textarea':
            input_el = f'<textarea name="{n}" rows="4" {req} placeholder="{ph}" style="width:100%;padding:12px;border:1.5px solid #d5dee8;border-radius:12px;font-size:15px;resize:vertical"></textarea>'
        elif t == 'number':
            input_el = f'<input type="number" name="{n}" {req} placeholder="{ph}" style="width:100%;padding:12px;border:1.5px solid #d5dee8;border-radius:12px;font-size:15px">'
        else:
            pat = f.get('pattern', '') or ''
            pattern_attr = f'pattern="{pat}"' if pat else ''
            input_el = f'<input type="text" name="{n}" {req} {pattern_attr} placeholder="{ph}" style="width:100%;padding:12px;border:1.5px solid #d5dee8;border-radius:12px;font-size:15px">'
        hint_html = f'<div style="font-size:12px;color:#7a8a9e;margin-top:4px">{hint}</div>' if hint else ''
        field_html += f'<div style="margin-bottom:18px"><label style="display:block;font-weight:600;margin-bottom:6px;font-size:14px">{n}{star}</label>{input_el}{hint_html}</div>'

    return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>{name} - 填写</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}}
body{{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;background:#f0f4f9;color:#1a2634;min-height:100vh;padding:20px 16px 100px}}
.wrap{{max-width:480px;margin:0 auto;background:#fff;border-radius:24px;box-shadow:0 4px 20px rgba(0,0,0,.06);padding:28px 24px}}
.head{{text-align:center;padding-bottom:20px;border-bottom:1px solid #eef2f6;margin-bottom:24px}}
.head h1{{font-size:20px;font-weight:700}}
.head p{{font-size:13px;color:#5a6a7e;margin-top:6px}}
button[type=submit]{{width:100%;padding:14px;background:linear-gradient(135deg,#4A6CF7,#3b5de0);color:#fff;border:none;border-radius:40px;font-size:16px;font-weight:600;cursor:pointer;margin-top:8px;box-shadow:0 4px 14px rgba(74,108,247,.3)}}
.tip{{text-align:center;margin-top:16px;font-size:12px;color:#7a8a9e}}
</style>
</head>
<body>
<div class="wrap">
  <div class="head"><h1>🏅 {name}</h1><p>请如实填写以下信息</p></div>
  <form method="post" action="/submit_fill/{tid}">
    {field_html}
    <button type="submit">✓ 提交申请</button>
  </form>
  <div class="tip">已开启防重校验 · 重复提交将覆盖原数据</div>
</div>
</body>
</html>'''
