// frontend/admin/js/common.js
// ============== 管理端共享模块 ==============
// 提供：API 客户端、Toast 提示、Modal 弹窗（已修复保存按钮绑定）、
// 侧边栏导航、XSS 转义、字段类型推断等通用能力。

// 同域部署，apiBaseUrl 取当前源即可（后端由本服务直接提供）。
const apiBaseUrl = window.location.origin;

// -------------------- 请求封装 --------------------
async function _fetch(path, options = {}) {
  const url = apiBaseUrl + path;
  let res;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
  } catch (e) {
    throw new Error('无法连接到后端，请确认服务已启动（' + apiBaseUrl + '）');
  }
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; }
  catch (e) { throw new Error('后端返回非 JSON 数据，请检查服务'); }
  if (!res.ok) throw new Error(data.message || ('HTTP ' + res.status));
  return data;
}

// -------------------- API 接口 --------------------
export const api = {
  _fetch,
  getTemplates: () => _fetch('/api/templates'),
  getTemplate: (id) => _fetch('/api/templates/' + id),
  createTemplate: (p) => _fetch('/api/templates', { method: 'POST', body: JSON.stringify(p) }),
  updateTemplate: (id, d) => _fetch('/api/templates/' + id, { method: 'PUT', body: JSON.stringify(d) }),
  deleteTemplate: (id) => _fetch('/api/templates/' + id, { method: 'DELETE' }),
  publishTemplate: (id) => _fetch('/api/templates/' + id + '/publish', { method: 'POST' }),
  getTemplateQrcode: (id) => _fetch('/api/templates/' + id + '/qrcode'),
  getTemplateRoster: (id) => _fetch('/api/templates/' + id + '/roster'),
  getRosterProgress: (id) => _fetch('/api/templates/' + id + '/roster-progress'),
  linkRoster: (tid, rid, idField, nameField) =>
    _fetch('/api/templates/' + tid + '/link-roster', { method: 'POST', body: JSON.stringify({ roster_id: rid, id_field: idField, name_field: nameField }) }),

  getSubmissions: (tid) => _fetch('/api/submissions' + (tid ? '?template_id=' + tid : '')),
  createSubmission: (p) => _fetch('/api/submissions', { method: 'POST', body: JSON.stringify(p) }),
  getExportFields: (tid) => _fetch('/api/submissions/export-fields' + (tid ? '?template_id=' + tid : '')),
  exportSubmissions: async (params) => {
    const res = await fetch(apiBaseUrl + '/api/submissions/export', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params || {}),
    });
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.message || ('HTTP ' + res.status)); }
    const blob = await res.blob();
    downloadBlob(blob, `批量导出_${new Date().toISOString().slice(0, 10)}.zip`);
    return { code: 0 };
  },
  downloadSubmission: async (id) => {
    const res = await fetch(apiBaseUrl + '/api/submissions/' + id + '/download');
    if (!res.ok) throw new Error('下载失败');
    downloadBlob(await res.blob(), `记录_${id}.docx`);
  },
  deleteSubmission: (id) => _fetch('/api/submissions/' + id, { method: 'DELETE' }),
  batchDeleteSubmissions: (p) => _fetch('/api/submissions/batch', { method: 'DELETE', body: JSON.stringify(p || {}) }),

  getRoster: () => _fetch('/api/roster'),
  getRosterDetail: (id) => _fetch('/api/roster/' + id),
  uploadRoster: (file, name) => {
    const fd = new FormData();
    fd.append('file', file);
    if (name) fd.append('name', name);
    return fetch(apiBaseUrl + '/api/roster/upload', { method: 'POST', body: fd }).then(r => r.json());
  },
  deleteRoster: (id) => _fetch('/api/roster/' + id, { method: 'DELETE' }),
  updateRoster: (id, d) => _fetch('/api/roster/' + id, { method: 'PUT', body: JSON.stringify(d) }),

  getCategories: () => _fetch('/api/categories'),
  createCategory: (name) => _fetch('/api/categories', { method: 'POST', body: JSON.stringify({ name }) }),
  updateCategory: (id, name) => _fetch('/api/categories/' + id, { method: 'PUT', body: JSON.stringify({ name }) }),
  deleteCategory: (id) => _fetch('/api/categories/' + id, { method: 'DELETE' }),

  getOptionSets: () => _fetch('/api/option-sets'),
  createOptionSet: (p) => _fetch('/api/option-sets', { method: 'POST', body: JSON.stringify(p) }),
  uploadOptionSet: (file, name) => {
    const fd = new FormData();
    fd.append('file', file);
    if (name) fd.append('name', name);
    return fetch(apiBaseUrl + '/api/option-sets', { method: 'POST', body: fd }).then(r => r.json());
  },
  updateOptionSet: (id, d) => _fetch('/api/option-sets/' + id, { method: 'PUT', body: JSON.stringify(d) }),
  deleteOptionSet: (id) => _fetch('/api/option-sets/' + id, { method: 'DELETE' }),

  getUsers: () => _fetch('/api/users'),
  createUser: (d) => _fetch('/api/users', { method: 'POST', body: JSON.stringify(d) }),
  updateUser: (id, d) => _fetch('/api/users/' + id, { method: 'PUT', body: JSON.stringify(d) }),

  getNotifications: () => _fetch('/api/notifications'),
  markRead: (id) => _fetch('/api/notifications/' + id + '/read', { method: 'PUT' }),
  markAllRead: () => _fetch('/api/notifications/read-all', { method: 'PUT' }),

  getRecycle: () => _fetch('/api/recycle'),
  restoreItem: (id) => _fetch('/api/recycle/' + id + '/restore', { method: 'POST' }),
  restoreAll: () => _fetch('/api/recycle/restore-all', { method: 'POST' }),
  deletePermanent: (id) => _fetch('/api/recycle/' + id, { method: 'DELETE' }),
  emptyRecycle: () => _fetch('/api/recycle', { method: 'DELETE' }),

  getShareLink: () => _fetch('/api/share'),
  createQrCode: (url) => _fetch('/api/share/qrcode', { method: 'POST', body: JSON.stringify({ url }) }),
  setShare: (d) => _fetch('/api/share', { method: 'PUT', body: JSON.stringify(d) }),

  getSettings: () => _fetch('/api/settings'),
  getSiteUrl: () => _fetch('/api/settings/site-url'),
  setSiteUrl: (url) => _fetch('/api/settings/site-url', { method: 'PUT', body: JSON.stringify({ url }) }),
  updateRetention: (days) => _fetch('/api/settings/retention', { method: 'PUT', body: JSON.stringify({ days }) }),
};

// -------------------- 通用工具 --------------------
export function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts.replace(/-/g, '/'));
  if (isNaN(d)) return ts;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// 字段类型推断（与后端 infer_type 保持一致）
export function inferFieldType(name) {
  name = (name || '').trim();
  const map = {
    '性别': 'select', 'sex': 'select', '生日': 'date', '出生日期': 'date', 'birthday': 'date',
  };
  if (map[name]) return map[name];
  if (['手机号', '电话', 'mobile', 'phone'].some(k => name.includes(k))) return 'text';
  if (['身份证', 'idcard'].some(k => name.toLowerCase().includes(k))) return 'text';
  if (['邮箱', 'email', 'mail'].some(k => name.toLowerCase().includes(k))) return 'text';
  if (['学号', '工号', '编号'].some(k => name.includes(k))) return 'text';
  if (['年龄', 'age'].some(k => name.toLowerCase().includes(k))) return 'number';
  if (['金额', '价格', 'price', 'amount', 'money'].some(k => name.includes(k))) return 'number';
  if (['理由', '说明', '描述', 'remark', 'reason', 'description'].some(k => name.includes(k))) return 'textarea';
  return 'text';
}

// -------------------- Toast --------------------
export function toast(msg, type = '') {
  let root = document.getElementById('toast-root');
  if (!root) { root = document.createElement('div'); root.id = 'toast-root'; root.className = 'toast-wrap'; document.body.appendChild(root); }
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' toast--' + type : '');
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }, 2600);
}

// -------------------- Modal（修复版） --------------------
export class Modal {
  constructor(opts = {}) {
    this.title = opts.title || '';
    this.content = opts.content || '';
    this.width = opts.width || 520;
    this.confirmText = opts.confirmText || '保存';
    this.onConfirm = opts.onConfirm || null;   // (modal) => Promise|void
    this.showClose = opts.showClose !== false;
    this._el = null;
  }
  render() {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <div class="modal" style="width:${this.width}px">
        <div class="modal-header">
          <h3 class="modal-title">${esc(this.title)}</h3>
          ${this.showClose ? '<button class="modal-close" data-modal="close">&times;</button>' : ''}
        </div>
        <div class="modal-body">${this.content}</div>
        <div class="modal-actions">
          <button class="btn btn--ghost" data-modal="close">取消</button>
          ${this.onConfirm ? `<button class="btn btn--primary" data-modal="save">${esc(this.confirmText)}</button>` : ''}
        </div>
      </div>`;
    document.body.appendChild(wrap);
    this._el = wrap;

    wrap.querySelector('[data-modal="close"]')?.addEventListener('click', () => this.close());
    wrap.querySelector('[data-modal="backdrop"]');
    wrap.addEventListener('click', (e) => { if (e.target === wrap) this.close(); });
    const onKey = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', onKey);
    this._onKey = onKey;

    const saveBtn = wrap.querySelector('[data-modal="save"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        if (saveBtn.disabled) return;
        saveBtn.disabled = true;
        try {
          await this.onConfirm(this);
          this.close();
        } catch (e) {
          toast(e.message || '操作失败', 'err');
          saveBtn.disabled = false;
        }
      });
    }
    requestAnimationFrame(() => wrap.classList.add('show'));
    return wrap;
  }
  close() {
    if (!this._el) return;
    const el = this._el;
    this._el = null;
    if (this._onKey) document.removeEventListener('keydown', this._onKey);
    el.classList.remove('show');
    setTimeout(() => el.remove(), 200);
  }
}

export function confirmDialog(message, onConfirm, confirmText = '确定') {
  const modal = new Modal({
    title: '确认操作', width: 380, confirmText,
    content: `<p>${esc(message)}</p>`,
    onConfirm: async () => { await onConfirm(); },
  });
  modal.render();
}

// -------------------- 侧边栏 / 顶栏 --------------------
const NAV = [
  { key: 'dashboard', label: '仪表盘', ico: '◆', href: 'index.html' },
  { key: 'templates', label: '模板管理', ico: '▤', href: 'templates.html' },
  { key: 'submissions', label: '提交记录', ico: '▦', href: 'submissions.html' },
  { key: 'roster', label: '名单管理', ico: '▥', href: 'roster.html' },
  { key: 'option-sets', label: '选项模板', ico: '⌗', href: 'option-sets.html' },
  { key: 'roster-categories', label: '分组管理', ico: '▦', href: 'roster-categories.html' },
  { key: 'users', label: '用户管理', ico: '◍', href: 'users.html' },
  { key: 'notifications', label: '通知', ico: '✉', href: 'notifications.html' },
  { key: 'recycle', label: '回收站', ico: '♻', href: 'recycle.html' },
  { key: 'settings', label: '设置', ico: '⚙', href: 'settings.html' },
];

export function initShell(active) {
  const sidebar = document.getElementById('sidebar');
  const topbar = document.getElementById('topbar');
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="brand">填表管理系统</div>
      <nav class="nav">
        ${NAV.map(n => `<a href="${n.href}" class="${n.key === active ? 'active' : ''}"><span class="ico">${n.ico}</span>${n.label}</a>`).join('')}
      </nav>
      <div class="foot">本地服务 · 端口 5000</div>`;
  }
  if (topbar) {
    const cur = NAV.find(n => n.key === active);
    topbar.innerHTML = `
      <h1>${cur ? cur.label : '管理端'}</h1>
      <div class="right"><span id="clock"></span></div>`;
    const clock = document.getElementById('clock');
    const tick = () => { if (clock) clock.textContent = new Date().toLocaleString('zh-CN'); };
    tick(); setInterval(tick, 1000);
  }
}
