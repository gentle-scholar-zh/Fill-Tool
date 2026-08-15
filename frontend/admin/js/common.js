// frontend/admin/js/common.js
// ============== 管理端共享模块 ==============
// 提供：API 客户端、Toast 提示、Modal 弹窗（已修复保存按钮绑定）、
// 侧边栏导航、XSS 转义、字段类型推断等通用能力。

// 同域部署，apiBaseUrl 取当前源即可（后端由本服务直接提供）。
const apiBaseUrl = window.location.origin;

// -------------------- 线条黑白矢量图标系统 --------------------
// 统一 24x24 stroke 图标，currentColor 着色，替换所有彩色 emoji / 符号。
// 用法：icon('check') → 返回 <svg> 字符串；icon('copy', 18) → 指定尺寸。
const ICONS = {
  dashboard: '<path d="M3 13h8V3H3z"/><path d="M3 21h8v-6H3z"/><path d="M13 21h8V11h-8z"/><path d="M13 3v6h8V3z"/>',
  templates: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16"/><path d="M9 9v11"/>',
  submissions: '<path d="M8 6h11M8 12h11M8 18h11"/><path d="M3.6 6h.01M3.6 12h.01M3.6 18h.01"/>',
  roster: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  'option-sets': '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="7" cy="6" r="1.6"/><circle cx="16" cy="12" r="1.6"/><circle cx="16" cy="18" r="1.6"/>',
  'roster-categories': '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5.8M16.5 20a5.2 5.2 0 0 0-2.5-4.4"/>',
  notifications: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  recycle: '<path d="M7 8l-2 3 2 3M17 8l2 3-2 3M9 19h6"/><path d="M5 11l3-6h8l3 6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.5 12h-3M22.5 12h-3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  'alert': '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  'arrow-left': '<path d="M15 5l-7 7 7 7"/><path d="M9 12h11"/>',
  'arrow-right': '<path d="M9 5l7 7-7 7"/><path d="M13 12H2"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v7h-7v-3M17 17h.01"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M5 7h14M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="2.6"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 12H3M7 8l-4 4 4 4"/>',
  share: '<circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8.1 10.9l7.8-3.8M8.1 13.1l7.8 3.8"/>',
  link: '<path d="M10 14a4 4 0 0 0 6 .5l2-2a4 4 0 0 0-6-6l-1 1"/><path d="M14 10a4 4 0 0 0-6-.5l-2 2a4 4 0 0 0 6 6l1-1"/>',
  download: '<path d="M12 3v12M7 11l5 5 5-5M5 21h14"/>',
  upload: '<path d="M12 21V9M7 13l5-5 5 5M5 3h14"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-4M4 13a8 8 0 0 0 14 4"/><path d="M4 4v5h5M20 20v-5h-5"/>',
  home: '<path d="M4 11l8-7 8 7M6 10v10h12V10"/>',
  clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 11h6M9 15h6M9 19h4"/>',
  send: '<path d="M21 3L3 11l7 3 3 7 8-18z"/><path d="M10 14l4-4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  'eye-off': '<path d="M3 3l18 18M10.5 5.2A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.7M6.5 6.5A17 17 0 0 0 2 12s4 7 10 7a10 10 0 0 0 3.4-.6"/>',
};

export function icon(name, size = 20, cls = '') {
  const path = ICONS[name] || ICONS.info;
  return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

// 生成「图标按钮」：<button class="icon-btn">icon</button>
export function iconBtn(name, opts = {}) {
  const { size = 18, title = '', cls = '', onClick = null } = opts;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'icon-btn ' + cls;
  btn.innerHTML = icon(name, size);
  if (title) btn.title = title;
  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}

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
  if (!res.ok) {
    if (res.status === 401 && window.location.pathname.startsWith('/admin/')) {
      localStorage.removeItem('ft_user');
      window.location.replace('/user/login.html');
      return;
    }
    throw new Error(data.message || ('HTTP ' + res.status));
  }
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
  linkRoster: (tid, rid, idField, nameField, awardField) =>
    _fetch('/api/templates/' + tid + '/link-roster', {
      method: 'POST',
      body: JSON.stringify({
        roster_id: rid, id_field: idField, name_field: nameField,
        award_field: awardField || '',
      }),
    }),

  getSubmissions: (tid) => _fetch('/api/submissions' + (tid ? '?template_id=' + tid : '')),
  getSubmissionsMine: () => _fetch('/api/submissions/mine'),
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

  // ---- PRD V2.0：认证与公共池、更新日志 ----
  authCheck: () => _fetch('/api/auth/check'),
  register: (d) => _fetch('/api/auth/register', { method: 'POST', body: JSON.stringify(d) }),
  login: (d) => _fetch('/api/auth/login', { method: 'POST', body: JSON.stringify(d) }),
  logout: () => _fetch('/api/auth/logout', { method: 'POST' }),
  getPublicTemplates: () => _fetch('/api/templates/public'),
  getChangelog: () => _fetch('/api/changelog'),
  createChangelog: (d) => _fetch('/api/changelog', { method: 'POST', body: JSON.stringify(d) }),
  updateChangelog: (id, d) => _fetch('/api/changelog/' + id, { method: 'PUT', body: JSON.stringify(d) }),
  deleteChangelog: (id) => _fetch('/api/changelog/' + id, { method: 'DELETE' }),
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

// -------------------- 登录态 / 角色 --------------------
export let currentUser = null;

export function setCurrentUser(u) {
  currentUser = u;
  if (u) localStorage.setItem('ft_user', JSON.stringify(u));
  else localStorage.removeItem('ft_user');
}

export function logout() {
  setCurrentUser(null);
  api.logout().catch(() => {});
  window.location.replace('/user/login.html');
}

// -------------------- 侧边栏 / 顶栏（角色动态菜单 + 强制登录） --------------------
const NAV = [
  { key: 'dashboard', label: '仪表盘', icon: 'dashboard', href: 'index.html', roles: ['admin', 'teacher'] },
  { key: 'templates', label: '模板管理', icon: 'templates', href: 'templates.html', roles: ['admin', 'teacher'] },
  { key: 'submissions', label: '提交记录', icon: 'submissions', href: 'submissions.html', roles: ['admin', 'teacher'] },
  { key: 'roster', label: '名单管理', icon: 'roster', href: 'roster.html', roles: ['admin', 'teacher'] },
  { key: 'option-sets', label: '选项模板', icon: 'option-sets', href: 'option-sets.html', roles: ['admin', 'teacher'] },
  { key: 'roster-categories', label: '分组管理', icon: 'roster-categories', href: 'roster-categories.html', roles: ['admin', 'teacher'] },
  { key: 'users', label: '用户管理', icon: 'users', href: 'users.html', roles: ['admin'] },
  { key: 'notifications', label: '通知', icon: 'notifications', href: 'notifications.html', roles: ['admin', 'teacher'] },
  { key: 'recycle', label: '回收站', icon: 'recycle', href: 'recycle.html', roles: ['admin'] },
  { key: 'settings', label: '设置', icon: 'settings', href: 'settings.html', roles: ['admin', 'teacher'] },
];

export function initShell(active) {
  // 同步读取本地登录态即可决定跳转（服务端仍为真源，API 401 时 _fetch 会再跳登录）
  let u = null;
  try { u = JSON.parse(localStorage.getItem('ft_user') || 'null'); } catch (_) {}
  currentUser = u;
  if (!u) {
    window.location.replace('/user/login.html');
    return false;
  }
  if (u.role === 'student') {
    // 学生无后台权限，回到公共池
    window.location.replace('/user/pool.html');
    return false;
  }
  const role = u.role;
  const sidebar = document.getElementById('sidebar');
  const topbar = document.getElementById('topbar');
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="brand">填表管理系统</div>
      <nav class="nav">
        ${NAV.filter(n => n.roles.includes(role)).map(n => `<a href="${n.href}" class="${n.key === active ? 'active' : ''}">${icon(n.icon, 18)}<span>${n.label}</span></a>`).join('')}
      </nav>
      <div class="foot">本地服务 · 端口 5000</div>`;
  }
  if (topbar) {
    const cur = NAV.find(n => n.key === active);
    const roleLabel = role === 'admin' ? '管理员' : role === 'teacher' ? '教师' : '学生';
    topbar.innerHTML = `
      <h1>${cur ? cur.label : '管理端'}</h1>
      <div class="right">
        <span class="who">${esc(u.name)} · ${roleLabel}</span>
        <button class="btn btn--ghost btn--sm" id="btn-logout">退出</button>
      </div>`;
    topbar.querySelector('#btn-logout')?.addEventListener('click', logout);
  }
  return true;
}

// -------------------- 更新日志折叠组件（前台底部） --------------------
export async function renderChangelog(el) {
  if (!el) return;
  try {
    const r = await api.getChangelog();
    const list = (r.data || []).filter(c => (c.content || []).length);
    if (!list.length) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <div class="changelog">
        <button class="cl-toggle" id="cl-toggle" type="button">${icon('info', 16)} 更新日志（${list.length}）</button>
        <div class="cl-panel" id="cl-panel" style="display:none">
          ${list.map(c => `<div class="cl-item">
            <div class="cl-head"><b>${esc(c.version)}</b><span class="cl-date">${esc(c.date || '')}</span></div>
            <ul>${c.content.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          </div>`).join('')}
        </div>
      </div>`;
    el.querySelector('#cl-toggle').addEventListener('click', () => {
      const p = el.querySelector('#cl-panel');
      p.style.display = p.style.display === 'none' ? 'block' : 'none';
    });
  } catch (_) {
    el.innerHTML = '';
  }
}
