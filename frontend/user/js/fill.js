// frontend/user/js/fill.js —— 用户端填写页逻辑
// 支持：下载、重新编辑、同一人多个名额连续填写、可搜索下拉、无名单直接填写、下架提示
const API = location.origin + '/api';
const app = document.getElementById('app');
let tid = location.pathname.split('/').filter(Boolean).pop();
if (tid && tid.endsWith('.html')) tid = '';

function esc(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' toast--' + type : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }, 2600);
}

let TMPL = null;       // 模板数据
let ROSTER = null;     // 关联名单信息
let VERIFIED = null;   // 验证结果（含 slots）

async function boot() {
  if (!tid || tid === 'fill') { app.innerHTML = '<div class="center">链接无效</div>'; return; }
  try {
    const res = await fetch(API + '/fill/' + tid).then(r => r.json());
    // code=2 表示模板已下架
    if (res.code === 2) throw new Error('模板已下架', );
    if (res.code !== 0) throw new Error(res.message || '加载失败');
    TMPL = res.data;
    ROSTER = TMPL.roster;
    renderVerifyOrSlots();
  } catch (e) {
    const isClosed = e.message === '模板已下架';
    app.innerHTML = `<div class="card center">
      <div class="closed-ico">⛔</div>
      <h2>${isClosed ? '模板已下架' : '⚠️ ' + esc(e.message)}</h2>
      <p class="muted mt">${isClosed ? '该模板已停止收集，无法继续填写。请联系管理员。' : '请确认链接是否正确或稍后重试。'}</p>
    </div>`;
  }
}

function renderVerifyOrSlots() {
  if (ROSTER && ROSTER.require_verify && !VERIFIED) {
    renderVerify();
  } else if (ROSTER && ROSTER.require_verify && VERIFIED) {
    renderSlots();
  } else {
    // 未关联名单：直接渲染填写表单（无名额概念）
    renderSingleForm();
  }
}

// ========== 身份验证 ==========
function renderVerify() {
  app.innerHTML = `
    <div class="card">
      <div class="head"><h1>🏅 ${esc(TMPL.name)}</h1><p>请先验证身份（${esc(ROSTER.roster_name)}）</p></div>
      <div class="verify-box">
        <div class="field"><label>${esc(ROSTER.id_field)}<span class="req">*</span></label>
          <input id="v-id" placeholder="请输入${esc(ROSTER.id_field)}"></div>
        <div class="field"><label>${esc(ROSTER.name_field)}<span class="req">*</span></label>
          <input id="v-name" placeholder="请输入${esc(ROSTER.name_field)}"></div>
        <button class="btn" id="v-btn">验证并填写</button>
      </div>
    </div>`;
  document.getElementById('v-btn').addEventListener('click', doVerify);
}

async function doVerify() {
  const sid = document.getElementById('v-id').value.trim();
  const sname = document.getElementById('v-name').value.trim();
  if (!sid || !sname) { toast('请填写完整信息', 'err'); return; }
  const btn = document.getElementById('v-btn');
  btn.disabled = true; btn.textContent = '验证中…';
  try {
    const r = await fetch(API + '/roster/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: tid, student_id: sid, student_name: sname }),
    }).then(x => x.json());
    if (r.code !== 0) throw new Error(r.message || '验证失败');
    VERIFIED = r.data;
    toast(`验证通过，共 ${VERIFIED.slot_count} 个名额`, 'ok');
    renderSlots();
  } catch (e) {
    toast(e.message, 'err');
    btn.disabled = false; btn.textContent = '验证并填写';
  }
}

// ========== 名额列表 ==========
function renderSlots() {
  const slots = VERIFIED.slots || [];
  const filled = slots.filter(s => s.submitted).length;
  const cards = slots.map((s, i) => {
    const d = s.roster_data || {};
    const award = d['奖项'] || d['备注'] || d['说明'] || `名额 ${i + 1}`;
    const status = s.submitted
      ? (s.edit_count > 0 ? `<span class="badge badge--ok">已提交 · 修改 ${s.edit_count} 次</span>` : '<span class="badge badge--ok">已提交</span>')
      : '<span class="badge">待填写</span>';
    const act = s.submitted
      ? `<button class="btn btn--sm" data-act="view" data-rid="${esc(s.row_id)}">查看/修改</button>
         <button class="btn btn--sm btn--ghost" data-act="dl" data-sid="${s.sub_id}">下载</button>`
      : `<button class="btn btn--sm btn--primary" data-act="fill" data-rid="${esc(s.row_id)}">填写</button>`;
    return `<div class="slot-card">
        <div class="slot-hd"><b>${esc(award)}</b>${status}</div>
        <div class="slot-bd">${esc((ROSTER.name_field || '姓名') + '：' + (d[ROSTER.name_field] || ''))}</div>
        <div class="slot-ft">${act}</div>
      </div>`;
  }).join('');

  app.innerHTML = `
    <div class="card">
      <div class="head">
        <h1>🏅 ${esc(TMPL.name)}</h1>
        <p>已验证：${esc(VERIFIED.student_name)}（${esc(VERIFIED.student_id)}）· 进度 ${filled}/${slots.length}</p>
      </div>
      <div class="slots">${cards}</div>
      <div class="muted" style="text-align:center;margin-top:14px">同一人多个奖项请分别填写，每份表单独立保存</div>
    </div>`;

  app.querySelectorAll('[data-act="fill"]').forEach(b =>
    b.addEventListener('click', () => renderForm(b.dataset.rid)));
  app.querySelectorAll('[data-act="view"]').forEach(b =>
    b.addEventListener('click', () => renderForm(b.dataset.rid, true)));
  app.querySelectorAll('[data-act="dl"]').forEach(b =>
    b.addEventListener('click', () => downloadSub(b.dataset.sid)));
}

// ========== 表单字段渲染 ==========
function renderFieldsHtml(fields, prefill, isEdit) {
  return fields.map((f) => {
    const name = f.name;
    const raw = f.raw_type || 'text';
    const req = f.required ? 'required' : '';
    const val = prefill[name] != null ? prefill[name] : '';
    const star = f.required ? '<span class="req">*</span>' : '';
    const hint = f.hint ? `<div class="hint">${esc(f.hint)}</div>` : '';
    // 下拉选项：超过 8 项渲染为可搜索下拉
    const opts = f.options ? (Array.isArray(f.options) ? f.options : String(f.options).split(',').map(s => s.trim()).filter(Boolean)) : [];
    if (raw === 'select' && opts.length > 8) {
      const optHtml = opts.map(o => `<div class="combo-item" data-val="${esc(o)}">${esc(o)}</div>`).join('');
      const input = `<div class="combo" ${req ? 'data-req="1"' : ''}>
        <input type="hidden" name="${esc(name)}" value="${esc(val)}">
        <input class="input combo-input" value="${esc(val)}" placeholder="点击或输入搜索选择…" autocomplete="off" readonly>
        <div class="combo-panel hidden">
          <div class="combo-search"><input class="input" placeholder="🔍 搜索…" autocomplete="off"></div>
          <div class="combo-list">${optHtml}</div>
          <div class="combo-empty hidden">无匹配项</div>
        </div>
      </div>`;
      return `<div class="field"><label>${esc(name)}${star}</label>${input}${hint}</div>`;
    }
    let input;
    if (raw === 'select') {
      const optHtml = ['<option value="">请选择</option>']
        .concat(opts.map(o => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(o)}</option>`)).join('');
      input = `<select name="${esc(name)}" ${req}>${optHtml}</select>`;
    } else if (raw === 'textarea') {
      input = `<textarea name="${esc(name)}" rows="4" ${req} placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea>`;
    } else if (raw === 'number') {
      input = `<input type="number" name="${esc(name)}" ${req} value="${esc(val)}" placeholder="${esc(f.placeholder || '')}">`;
    } else if (raw === 'date') {
      input = `<input type="date" name="${esc(name)}" ${req} value="${esc(val)}">`;
    } else {
      const pat = f.pattern ? `pattern="${esc(f.pattern)}"` : '';
      input = `<input type="text" name="${esc(name)}" ${req} ${pat} value="${esc(val)}" placeholder="${esc(f.placeholder || '')}">`;
    }
    return `<div class="field"><label>${esc(name)}${star}</label>${input}${hint}</div>`;
  }).join('');
}

function bindCombos() {
  const closeAll = () => document.querySelectorAll('.combo-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.combo').forEach(c => {
    const hidden = c.querySelector('input[type=hidden]');
    const input = c.querySelector('.combo-input');
    const panel = c.querySelector('.combo-panel');
    const search = panel.querySelector('.combo-search input');
    const list = panel.querySelector('.combo-list');
    const empty = panel.querySelector('.combo-empty');
    const items = Array.from(list.querySelectorAll('.combo-item'));
    const filter = (q) => {
      q = (q || '').trim().toLowerCase();
      let n = 0;
      items.forEach(it => {
        const ok = it.dataset.val.toLowerCase().includes(q);
        it.classList.toggle('hidden', !ok);
        if (ok) n++;
      });
      empty.classList.toggle('hidden', n > 0);
    };
    const open = () => { closeAll(); panel.classList.remove('hidden'); search.value = ''; filter(''); search.focus(); };
    input.addEventListener('focus', open);
    input.addEventListener('click', (e) => { e.stopPropagation(); open(); });
    search.addEventListener('input', (e) => filter(e.target.value));
    items.forEach(it => {
      it.addEventListener('click', (e) => {
        e.stopPropagation();
        input.value = it.dataset.val;
        hidden.value = it.dataset.val;
        closeAll();
      });
    });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.combo')) {
      document.querySelectorAll('.combo-panel').forEach(p => p.classList.add('hidden'));
    }
  });
}

// ========== 表单（名额模式） ==========
function renderForm(rowId, isEdit) {
  const slot = (VERIFIED.slots || []).find(s => s.row_id === rowId);
  if (!slot) { toast('名额不存在', 'err'); return; }
  const prefill = isEdit && slot.data ? slot.data : (slot.roster_data || {});
  const fieldsHtml = renderFieldsHtml(TMPL.fields || [], prefill, isEdit);

  const award = (slot.roster_data || {})['奖项'] || (slot.roster_data || {})['备注'] || '';
  app.innerHTML = `
    <div class="card">
      <div class="head"><h1>🏅 ${esc(TMPL.name)}</h1><p>${esc(award ? '奖项：' + award : '填写表单')}${isEdit ? ' · 修改已提交内容' : ''}</p></div>
      <form id="form">${fieldsHtml}
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" id="back">返回名单</button>
          <button type="submit" class="btn btn--primary">${isEdit ? '保存修改' : '✓ 提交'}</button>
        </div>
      </form>
    </div>`;
  bindCombos();
  document.getElementById('back').addEventListener('click', renderSlots);
  document.getElementById('form').addEventListener('submit', (e) => {
    e.preventDefault();
    submit(rowId);
  });
}

// ========== 表单（无名单直接填写） ==========
function renderSingleForm() {
  const fieldsHtml = renderFieldsHtml(TMPL.fields || [], {}, false);
  app.innerHTML = `
    <div class="card">
      <div class="head"><h1>🏅 ${esc(TMPL.name)}</h1><p>请填写以下表单</p></div>
      <form id="form">${fieldsHtml}
        <div class="form-actions">
          <button type="submit" class="btn btn--primary">✓ 提交</button>
        </div>
      </form>
    </div>`;
  bindCombos();
  document.getElementById('form').addEventListener('submit', (e) => {
    e.preventDefault();
    submitSingle();
  });
}

function collectFormData(fields) {
  const data = {};
  for (const f of fields) {
    const el = document.querySelector(`[name="${CSS.escape(f.name)}"]`);
    const v = el ? el.value.trim() : '';
    data[f.name] = v;
    if (f.required && !v) {
      toast(`「${f.name}」不能为空`, 'err');
      if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); }
      return null;
    }
  }
  return data;
}

async function submit(rowId) {
  const data = collectFormData(TMPL.fields || []);
  if (!data) return;
  const btn = document.querySelector('#form button[type=submit]');
  btn.disabled = true; btn.textContent = '提交中…';
  try {
    const r = await fetch(API + '/submissions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: tid, data,
        student_id: VERIFIED.student_id,
        student_name: VERIFIED.student_name,
        roster_row_id: rowId,
      }),
    }).then(x => x.json());
    if (r.code !== 0) throw new Error(r.message || '提交失败');
    const slot = (VERIFIED.slots || []).find(s => s.row_id === rowId);
    if (slot) {
      slot.submitted = true;
      slot.sub_id = r.data.id;
      slot.data = r.data.data;
      slot.version = r.data.version;
      slot.edit_count = r.data.edit_count;
    }
    renderSuccess(r.data);
  } catch (e) {
    toast(e.message, 'err');
    btn.disabled = false; btn.textContent = '✓ 提交';
  }
}

async function submitSingle() {
  const data = collectFormData(TMPL.fields || []);
  if (!data) return;
  const btn = document.querySelector('#form button[type=submit]');
  btn.disabled = true; btn.textContent = '提交中…';
  try {
    const r = await fetch(API + '/submissions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: tid, data,
        student_id: '', student_name: '', roster_row_id: '',
      }),
    }).then(x => x.json());
    if (r.code !== 0) throw new Error(r.message || '提交失败');
    renderSuccess(r.data, true);
  } catch (e) {
    toast(e.message, 'err');
    btn.disabled = false; btn.textContent = '✓ 提交';
  }
}

// ========== 成功页（下载 / 重新编辑） ==========
function renderSuccess(d, isSingle) {
  const remaining = (VERIFIED.slots || []).filter(s => !s.submitted);
  const nextAct = (!isSingle && remaining.length)
    ? `<button class="btn btn--primary" id="next">继续填写下一个（剩 ${remaining.length} 份）</button>`
    : '';
  app.innerHTML = `
    <div class="card center">
      <h2>✅ 提交成功</h2>
      <p class="muted mt">${d.edit_count > 0 ? `已保存为第 ${d.version} 版（修改 ${d.edit_count} 次）` : '文档已生成'}</p>
      <div class="success-actions">
        <button class="btn btn--primary" id="dl">⬇ 下载本地（docx）</button>
        ${isSingle ? '' : '<button class="btn btn--ghost" id="edit">重新编辑</button>'}
        ${nextAct}
        <button class="btn btn--ghost" id="back">返回名单列表</button>
      </div>
    </div>`;
  document.getElementById('dl').addEventListener('click', () => downloadSub(d.id));
  if (!isSingle) document.getElementById('edit').addEventListener('click', () => renderForm(d.roster_row_id, true));
  document.getElementById('back').addEventListener('click', renderSlots);
  if (remaining.length && !isSingle) document.getElementById('next').addEventListener('click', renderSlots);
}

function downloadSub(sid) {
  if (!sid) { toast('记录不存在', 'err'); return; }
  const a = document.createElement('a');
  a.href = API + '/submissions/' + sid + '/download';
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast('开始下载', 'ok');
}

boot();
