// frontend/user/js/pool.js —— 公共模板池：选模板 → 动态渲染表单 → 提交 → 修改（PRD 2.2 / 5 / 额外修改按钮）
import { api, esc, toast, renderChangelog } from '/admin/js/common.js';

const me = (() => { try { return JSON.parse(localStorage.getItem('ft_user') || 'null'); } catch (_) { return null; } })();

const tplSelect = document.getElementById('tplSelect');
const banner = document.getElementById('banner');
const formArea = document.getElementById('formArea');
const btnCenter = document.getElementById('btnCenter');

let state = {
  tid: '',
  fields: [],
  editingSid: null,   // 正在修改的提交 id
  existing: null,     // 已存在的提交（mine / sessionStorage）
};

if (me) btnCenter.style.display = '';
btnCenter.addEventListener('click', () => { window.location.href = '/user/center.html'; });

// 免登录模式下，用 sessionStorage 记录本浏览器已提交的 submission id，支持后续修改
function anonSidKey(tid) { return 'pool_sid_' + tid; }

async function boot() {
  // 登录模式开关：若后台要求登录且未登录 → 跳登录
  try {
    const s = await api.getSettings();
    if (s.data && s.data.public_require_login === '1' && !me) {
      window.location.replace('/user/login.html?redirect=' + encodeURIComponent('/user/pool.html'));
      return;
    }
  } catch (_) {}

  // URL 直接进入指定模板（来自「我的提交」修改入口）
  const params = new URLSearchParams(location.search);
  const presetTid = params.get('tid');
  const presetSid = params.get('sid');

  await loadTemplates(presetTid);
  if (presetTid) {
    tplSelect.value = presetTid;
    await onSelectTemplate(presetSid);
  }
}

async function loadTemplates(presetTid) {
  try {
    const r = await api.getPublicTemplates();
    const list = r.data || [];
    if (!list.length) {
      tplSelect.innerHTML = '<option value="">— 暂无可公开填写的模板 —</option>';
      return;
    }
    tplSelect.innerHTML = '<option value="">— 请选择模板 —</option>' +
      list.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    if (presetTid) tplSelect.value = presetTid;
  } catch (e) {
    toast('加载模板失败', 'err');
  }
}

tplSelect.addEventListener('change', () => onSelectTemplate());

async function onSelectTemplate(presetSid) {
  const tid = tplSelect.value;
  state.tid = tid; state.editingSid = null; state.existing = null;
  banner.innerHTML = '';
  if (!tid) { formArea.innerHTML = '<div class="pool-empty">请先在上方选择一个模板</div>'; return; }

  let tpl;
  try {
    const r = await api.getTemplate(tid);
    tpl = r.data;
  } catch (e) { formArea.innerHTML = '<div class="pool-empty">模板加载失败</div>'; return; }
  state.fields = tpl.fields || [];

  // 查已有提交：登录用户看 mine；匿名看 sessionStorage
  let existing = null;
  if (me) {
    try {
      const mine = await api.getSubmissionsMine();
      existing = (mine.data || []).find(s => s.template_id === tid) || null;
    } catch (_) {}
  } else {
    const sid = sessionStorage.getItem(anonSidKey(tid));
    if (sid) {
      try {
        const r = await api._fetch('/api/submissions/' + sid);
        if (r.code === 0) existing = r.data;
      } catch (_) { sessionStorage.removeItem(anonSidKey(tid)); }
    }
  }
  if (presetSid) { try { const r = await api._fetch('/api/submissions/' + presetSid); if (r.code === 0) existing = r.data; } catch (_) {} }

  if (existing) {
    state.existing = existing;
    banner.innerHTML = `<div class="banner">
      <span>你已提交过该模板（${esc(existing.submitted_at || '')}），可随时修改。</span>
      <button class="btn btn--primary" id="btnModify" type="button">修改</button>
    </div>`;
    banner.querySelector('#btnModify').addEventListener('click', () => enterEdit(existing));
    renderSuccess(existing);
  } else {
    renderForm(state.fields, {});
  }
}

function optList(f) {
  let o = f.options;
  if (typeof o === 'string') o = o.split(',').map(s => s.trim()).filter(Boolean);
  return o || [];
}

function fieldHtml(f) {
  const nm = esc(f.name);
  const req = f.required ? '<span class="req">*</span>' : '';
  const hint = f.hint ? `<div class="hint">${esc(f.hint)}</div>` : '';
  if (f.raw_type === 'textarea') {
    return `<div class="field"><label>${nm}${req}</label><textarea class="input" data-name="${nm}" placeholder="${esc(f.placeholder || '')}"></textarea>${hint}</div>`;
  }
  if (f.raw_type === 'number') {
    return `<div class="field"><label>${nm}${req}</label><input class="input" type="number" data-name="${nm}" placeholder="${esc(f.placeholder || '')}">${hint}</div>`;
  }
  if (f.raw_type === 'date') {
    return `<div class="field"><label>${nm}${req}</label><input class="input" type="date" data-name="${nm}">${hint}</div>`;
  }
  if (f.raw_type === 'select') {
    const opts = optList(f);
    if (opts.length > 8) {
      const items = opts.map((o, i) => `<div class="combo-item" data-val="${esc(o)}">${esc(o)}</div>`).join('');
      return `<div class="field"><label>${nm}${req}</label>
        <div class="combo" data-name="${nm}">
          <input class="input combo-input" readonly placeholder="点击选择" data-val="">
          <div class="combo-panel" style="display:none">
            <div class="combo-search"><input placeholder="搜索…"></div>
            <div class="combo-list">${items}</div>
          </div>
        </div>${hint}</div>`;
    }
    const os = opts.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('');
    return `<div class="field"><label>${nm}${req}</label><select class="select" data-name="${nm}"><option value="">— 请选择 —</option>${os}</select>${hint}</div>`;
  }
  return `<div class="field"><label>${nm}${req}</label><input class="input" data-name="${nm}" placeholder="${esc(f.placeholder || '')}">${hint}</div>`;
}

function renderForm(fields, prefill) {
  if (!fields.length) { formArea.innerHTML = '<div class="pool-empty">该模板暂未配置字段</div>'; return; }
  const title = state.editingSid ? '修改提交内容' : '填写内容';
  formArea.innerHTML = `
    <div class="section-title">${title}</div>
    ${fields.map(fieldHtml).join('')}
    <div class="form-actions">
      ${state.editingSid ? '<button class="btn btn--ghost" id="btnCancel" type="button">取消</button>' : ''}
      <button class="btn btn--primary" id="btnSubmit" type="button">${state.editingSid ? '保存修改' : '提交'}</button>
    </div>`;
  // 回填
  for (const f of fields) {
    const v = prefill[f.name];
    if (v == null) continue;
    const el = formArea.querySelector(`[data-name="${cssEscape(f.name)}"]`);
    if (!el) continue;
    if (el.classList.contains('combo')) {
      const inp = el.querySelector('.combo-input');
      inp.value = v; inp.dataset.val = v;
    } else if (el.tagName === 'SELECT') {
      el.value = v;
    } else {
      el.value = v;
    }
  }
  bindCombos();
  formArea.querySelector('#btnSubmit').addEventListener('click', submit);
  formArea.querySelector('#btnCancel')?.addEventListener('click', () => {
    if (state.existing) { renderSuccess(state.existing); } else { renderForm(fields, {}); }
  });
}

function cssEscape(s) {
  return String(s).replace(/"/g, '\\"').replace(/\\/g, '\\\\');
}

function bindCombos() {
  formArea.querySelectorAll('.combo').forEach(combo => {
    const input = combo.querySelector('.combo-input');
    const panel = combo.querySelector('.combo-panel');
    const search = combo.querySelector('.combo-search input');
    const items = combo.querySelectorAll('.combo-item');
    input.addEventListener('click', () => { panel.style.display = panel.style.display === 'none' ? 'flex' : 'none'; });
    search?.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      items.forEach(it => { it.classList.toggle('hidden', q && !it.dataset.val.toLowerCase().includes(q)); });
    });
    items.forEach(it => {
      it.addEventListener('click', () => {
        input.value = it.dataset.val; input.dataset.val = it.dataset.val;
        panel.style.display = 'none';
      });
    });
    document.addEventListener('click', (e) => { if (!combo.contains(e.target)) panel.style.display = 'none'; });
  });
}

function collectData() {
  const data = {};
  let ok = true;
  for (const f of state.fields) {
    const el = formArea.querySelector(`[data-name="${cssEscape(f.name)}"]`);
    let v = '';
    if (el) {
      if (el.classList.contains('combo')) v = el.querySelector('.combo-input').dataset.val || '';
      else v = el.value || '';
    }
    data[f.name] = v;
    if (f.required && !v.trim()) ok = false;
  }
  return { data, ok };
}

async function submit() {
  const { data, ok } = collectData();
  if (!ok) { toast('请填写所有必填项', 'err'); return; }
  const btn = formArea.querySelector('#btnSubmit');
  btn.disabled = true; btn.textContent = '提交中…';
  try {
    const payload = { template_id: state.tid, data };
    if (state.editingSid) payload.submission_id = state.editingSid;
    const r = await api.createSubmission(payload);
    const sub = r.data;
    if (!me) sessionStorage.setItem(anonSidKey(state.tid), String(sub.id));
    state.existing = sub;
    toast(state.editingSid ? '修改已保存' : '提交成功', 'ok');
    state.editingSid = null;
    renderSuccess(sub);
  } catch (e) {
    toast(e.message || '提交失败', 'err');
    btn.disabled = false; btn.textContent = state.editingSid ? '保存修改' : '提交';
  }
}

function renderSuccess(sub) {
  const dl = sub.download_url ? `<a class="btn btn--ghost" href="${sub.download_url}" style="width:100%;margin:0;text-decoration:none;text-align:center">下载我的提交（docx）</a>` : '';
  formArea.innerHTML = `
    <div class="head" style="border:none;margin:0;padding:10px 0 6px">
      <div class="closed-ico">✅</div>
      <h1 style="font-size:18px">提交成功</h1>
      <p>提交时间：${esc(sub.submitted_at || '')} · 版本 v${sub.version || 1}（已修改 ${sub.edit_count || 0} 次）</p>
    </div>
    <div class="success-actions">
      <button class="btn btn--primary" id="btnModify2" type="button">修改提交内容</button>
      ${dl}
    </div>`;
  formArea.querySelector('#btnModify2').addEventListener('click', () => enterEdit(sub));
}

function enterEdit(sub) {
  state.editingSid = sub.id;
  banner.innerHTML = '';
  renderForm(state.fields, sub.data || {});
  formArea.scrollIntoView({ behavior: 'smooth' });
}

boot();
renderChangelog(document.getElementById('changelog'));
