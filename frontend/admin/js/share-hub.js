// frontend/admin/js/share-hub.js —— 分享中心：公开模板池 + 未公开模板分享链接 / 二维码
import { api, initShell, toast, Modal, esc, fmtDate, icon } from './common.js';

initShell('share-hub');
const content = document.getElementById('content');

let allTemplates = [];   // 全量模板（后台视角）
let qrCache = {};        // {tid: {url, image}}
let filterText = '';     // 搜索关键字
let filterStatus = '';   // 'public' | 'private' | ''

async function load() {
  content.innerHTML = '<div class="card"><div class="card-body muted">加载中…</div></div>';
  try {
    const r = await api.getTemplates();
    allTemplates = r.data || [];
    render();
  } catch (e) {
    content.innerHTML = `<div class="card"><div class="card-body" style="color:var(--danger)">加载失败：${esc(e.message)}</div></div>`;
  }
}

function frontendBase() {
  return (window.location.origin || '').replace(/\/$/, '');
}

function fillUrl(tid) {
  const base = frontendBase();
  return base ? `${base}/fill/${tid}` : `${window.location.origin || ''}/fill/${tid}`;
}

function rowHtml(t) {
  const url = fillUrl(t.id);
  const isPublic = !!t.is_public;
  const isPublished = t.status === 'published';
  const cat = esc(t.category || '未分类');
  const status = isPublished
    ? '<span class="badge badge--ok">已发布</span>'
    : '<span class="badge badge--draft">草稿</span>';
  const pubTag = isPublic
    ? '<span class="badge badge--brand">公开</span>'
    : '<span class="badge">未公开</span>';
  return `<tr data-id="${esc(t.id)}">
    <td><b>${esc(t.name)}</b><div class="muted" style="font-size:11px">ID: ${esc(t.id)}</div></td>
    <td>${cat}</td>
    <td>${status}</td>
    <td>${pubTag}</td>
    <td class="muted" style="font-size:12px;word-break:break-all">${esc(url)}</td>
    <td><div class="actions">
      <button class="btn btn--xs" data-act="open">打开</button>
      <button class="btn btn--xs" data-act="copy">复制链接</button>
      <button class="btn btn--xs" data-act="qr">二维码</button>
    </div></td>
  </tr>`;
}

function matches(t) {
  if (filterStatus === 'public' && !t.is_public) return false;
  if (filterStatus === 'private' && t.is_public) return false;
  if (!filterText) return true;
  const q = filterText.toLowerCase();
  return (t.name || '').toLowerCase().includes(q) ||
         (t.id || '').toLowerCase().includes(q) ||
         (t.category || '').toLowerCase().includes(q);
}

function render() {
  const pubList = allTemplates.filter(t => matches(t) && t.is_public);
  const priList = allTemplates.filter(t => matches(t) && !t.is_public);
  const totalShown = pubList.length + priList.length;
  const totalAll = allTemplates.length;

  content.innerHTML = `
    <div class="filterbar">
      <input class="input" id="sh-q" style="max-width:240px" placeholder="搜索模板名称 / ID / 分类" value="${esc(filterText)}">
      <select id="sh-status" style="max-width:140px">
        <option value="" ${filterStatus === '' ? 'selected' : ''}>全部可见性</option>
        <option value="public" ${filterStatus === 'public' ? 'selected' : ''}>仅公开</option>
        <option value="private" ${filterStatus === 'private' ? 'selected' : ''}>仅未公开</option>
      </select>
      <span class="muted">共 ${totalAll} 个模板，已显示 ${totalShown}</span>
      <div class="spacer"></div>
    </div>

    <div class="card">
      <div class="card-head">
        <h2>${icon('share', 18)} 公开模板池</h2>
        <span class="muted" style="margin-left:8px">访客可通过这些模板直接填写 / 扫码进入</span>
      </div>
      <div class="card-body" style="padding:0">
        ${pubList.length ? `<table class="table"><thead><tr>
          <th>名称</th><th>分类</th><th>状态</th><th>可见性</th><th>填写链接</th><th class="actions">操作</th>
        </tr></thead><tbody>${pubList.map(rowHtml).join('')}</tbody></table>`
        : `<div class="empty">${icon('share', 24)}<div>暂无公开模板 — 在「模板管理」开启某个模板的「公开」开关即可</div></div>`}
      </div>
    </div>

    <div class="card mt">
      <div class="card-head">
        <h2>${icon('lock', 18)} 未公开模板分享链接</h2>
        <span class="muted" style="margin-left:8px">仅后台可见，但持有链接即可填写（适合定向发送）</span>
      </div>
      <div class="card-body" style="padding:0">
        ${priList.length ? `<table class="table"><thead><tr>
          <th>名称</th><th>分类</th><th>状态</th><th>可见性</th><th>填写链接</th><th class="actions">操作</th>
        </tr></thead><tbody>${priList.map(rowHtml).join('')}</tbody></table>`
        : `<div class="empty">${icon('check', 24)}<div>没有未公开模板</div></div>`}
      </div>
    </div>

    <div class="card mt">
      <div class="card-head"><h2>${icon('info', 18)} 指定模板二维码</h2></div>
      <div class="card-body">
        <div class="row" style="align-items:flex-end">
          <div class="field" style="flex:1">
            <label>选择模板</label>
            <select id="sh-pick" class="select">
              <option value="">— 请选择 —</option>
              ${allTemplates.map(t => `<option value="${esc(t.id)}">${esc(t.name)}（${esc(t.category || '未分类')}）</option>`).join('')}
            </select>
          </div>
          <button class="btn btn--primary" id="sh-gen">生成二维码</button>
        </div>
        <div id="sh-qr-area" class="muted" style="margin-top:14px">选定模板后点击「生成二维码」，可下载或复制链接。</div>
      </div>
    </div>
  `;

  // 绑定搜索
  content.querySelector('#sh-q').addEventListener('input', (e) => { filterText = e.target.value; render(); });
  content.querySelector('#sh-status').addEventListener('change', (e) => { filterStatus = e.target.value; render(); });

  // 表格按钮
  content.querySelectorAll('tbody tr').forEach(tr => {
    const id = tr.dataset.id;
    tr.querySelector('[data-act="open"]')?.addEventListener('click', () => window.open(fillUrl(id), '_blank'));
    tr.querySelector('[data-act="copy"]')?.addEventListener('click', () => copyLink(id));
    tr.querySelector('[data-act="qr"]')?.addEventListener('click', () => showQr(id, tr));
  });

  // 指定模板二维码生成
  content.querySelector('#sh-gen').addEventListener('click', async () => {
    const tid = content.querySelector('#sh-pick').value;
    if (!tid) { toast('请先选择模板', 'err'); return; }
    await showQr(tid);
  });
}

async function copyLink(id) {
  const url = fillUrl(id);
  try { await navigator.clipboard.writeText(url); toast('链接已复制', 'ok'); }
  catch (_) { toast('复制失败，请手动选择', 'err'); }
}

async function ensureQr(tid) {
  if (qrCache[tid]) return qrCache[tid];
  const base = frontendBase();
  const url = base ? `/api/templates/${tid}/qrcode?base=${encodeURIComponent(base)}` : `/api/templates/${tid}/qrcode`;
  try {
    const r = await api._fetch(url);
    if (r.code !== 0) throw new Error(r.message || '生成失败');
    qrCache[tid] = r.data;
    return r.data;
  } catch (e) {
    toast('二维码生成失败：' + (e.message || '未知错误'), 'err');
    return null;
  }
}

async function showQr(tid) {
  const url = fillUrl(tid);
  const m = new Modal({
    title: '二维码', width: 460, confirmText: '关闭', onConfirm: null,
    content: `<div style="text-align:center"><div class="muted" style="margin-bottom:10px">生成中…</div></div>`,
  });
  m.render();
  const data = await ensureQr(tid);
  if (!data) { m.close(); return; }
  m._el.querySelector('.modal-body').innerHTML = `
    <div style="text-align:center">
      <img src="${esc(data.image)}" style="width:220px;height:220px;border:1px solid var(--line);border-radius:8px;background:#fff">
      <div style="margin-top:12px;font-size:12px;color:var(--ink-3);word-break:break-all">${esc(data.url)}</div>
      <div style="margin-top:10px;display:flex;gap:8px;justify-content:center">
        <button class="btn btn--sm" id="qr-copy">复制链接</button>
        <a class="btn btn--sm" id="qr-dl" href="${esc(data.image)}" download="qr-${esc(tid)}.png">下载图片</a>
        <a class="btn btn--sm" id="qr-open" href="${esc(data.url)}" target="_blank" rel="noopener">打开链接</a>
      </div>
    </div>`;
  m._el.querySelector('#qr-copy')?.addEventListener('click', () => copyLink(tid));
}

load();
