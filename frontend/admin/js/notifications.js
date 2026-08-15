// frontend/admin/js/notifications.js
import { api, initShell, toast, Modal, confirmDialog, icon, esc, fmtDate } from './common.js';

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
        ${list.length ? list.map(n => itemHtml(n)).join('') : '<div class="empty">' + icon('notifications', 22) + '<div>暂无通知</div></div>'}
      </div></div>`;
    content.querySelector('#btn-all')?.addEventListener('click', async () => {
      await api.markAllRead(); toast('已全部标为已读', 'ok'); load();
    });
    content.querySelectorAll('[data-act="approve"]').forEach(b => {
      b.addEventListener('click', () => approve(b.dataset.nid));
    });
  } catch (e) {
    content.innerHTML = `<div class="card"><div class="card-body" style="color:var(--danger)">加载失败：${esc(e.message)}</div></div>`;
  }
}

function itemHtml(n) {
  if (n.type === 'password_request') {
    const done = n.status === 'done';
    return `<div class="between" style="padding:14px 0;border-bottom:1px solid var(--line)">
      <div>
        <b style="color:var(--brand)">${esc(n.title)}</b>
        <div class="muted">${esc(n.body || '')}</div>
        <div class="muted" style="font-size:12px">${fmtDate(n.created_at)}</div>
      </div>
      ${done
        ? '<span class="badge badge--ok">已处理</span>'
        : '<button class="btn btn--sm btn--primary" data-act="approve" data-nid="' + n.id + '">批准重置</button>'}
    </div>`;
  }
  return `<div class="between" style="padding:12px 0;border-bottom:1px solid var(--line)">
    <div><b style="${n.read ? '' : 'color:var(--brand)'}">${esc(n.title)}</b>
      <div class="muted">${esc(n.body || '')}</div>
      <div class="muted" style="font-size:12px">${fmtDate(n.created_at)}</div></div>
    ${n.read ? '<span class="badge badge--draft">已读</span>' : '<span class="badge badge--ok">未读</span>'}
  </div>`;
}

function approve(nid) {
  confirmDialog('确认批准该密码申请并重置用户密码？', async () => {
    const r = await api.resolvePasswordRequest(nid);
    if (r.code !== 0) { toast(r.message || '操作失败', 'err'); return; }
    const m = new Modal({
      title: '密码已重置', confirmText: '知道了',
      content: `<p style="margin:0 0 10px">已为 <b>${esc(r.data.name || '')}</b> 重置密码，请通过其他方式告知对方新密码：</p>
        <div class="auth-note" style="font-size:14px;letter-spacing:1px"><b>${esc(r.data.new_password || '')}</b></div>`,
    });
    m.render();
    load();
  });
}

load();
