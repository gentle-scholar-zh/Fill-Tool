// frontend/admin/js/notifications.js
import { api, initShell, toast, esc, fmtDate } from './common.js';

initShell('notifications');
const content = document.getElementById('content');

async function load() {
  content.innerHTML = '<div class="card"><div class="card-body muted">加载中…</div></div>';
  try {
    const res = await api.getNotifications();
    const list = res.data || [];
    const unread = list.filter(n => !n.read).length;
    content.innerHTML = `
      <div class="toolbar">
        <button class="btn" id="btn-all">全部标为已读</button>
        <span class="muted">共 ${list.length} 条，未读 ${unread}</span>
      </div>
      <div class="card"><div class="card-body">
        ${list.length ? list.map(n => `
          <div class="between" style="padding:12px 0;border-bottom:1px solid var(--line)">
            <div><b style="${n.read ? '' : 'color:var(--brand)'}">${esc(n.title)}</b>
              <div class="muted">${esc(n.body || '')}</div>
              <div class="muted" style="font-size:12px">${fmtDate(n.created_at)}</div></div>
            ${n.read ? '<span class="badge badge--draft">已读</span>' : '<span class="badge badge--ok">未读</span>'}
          </div>`).join('')
        : '<div class="empty">暂无通知</div>'}
      </div></div>`;
    content.querySelector('#btn-all')?.addEventListener('click', async () => {
      await api.markAllRead(); toast('已全部标为已读', 'ok'); load();
    });
  } catch (e) {
    content.innerHTML = `<div class="card"><div class="card-body" style="color:var(--danger)">加载失败：${esc(e.message)}</div></div>`;
  }
}

load();
