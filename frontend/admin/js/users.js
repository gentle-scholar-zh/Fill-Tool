// frontend/admin/js/users.js
import { api, initShell, toast, Modal, confirmDialog, esc, fmtDate } from './common.js';

initShell('users');
const content = document.getElementById('content');

async function load() {
  content.innerHTML = '<div class="card"><div class="card-body muted">加载中…</div></div>';
  try {
    const res = await api.getUsers();
    const list = res.data || [];
    content.innerHTML = `
      <div class="toolbar"><button class="btn btn--primary" id="btn-add">+ 新建用户</button>
        <span class="muted">共 ${list.length} 人</span></div>
      <div class="card"><div class="card-body" style="padding:0">
        ${list.length ? `<table class="table"><thead><tr><th>姓名</th><th>用户名</th><th>角色</th><th>状态</th><th>创建时间</th><th style="width:140px">操作</th></tr></thead>
          <tbody>${list.map(u => rowHtml(u)).join('')}</tbody></table>`
        : '<div class="empty">暂无用户</div>'}
      </div></div>`;
    bind(list);
  } catch (e) {
    content.innerHTML = `<div class="card"><div class="card-body" style="color:var(--danger)">加载失败：${esc(e.message)}</div></div>`;
  }
}

function rowHtml(u) {
  return `<tr data-id="${u.id}">
    <td><b>${esc(u.name)}</b></td><td>${esc(u.username)}</td>
    <td>${esc(u.role)}</td>
    <td>${u.status === 'active' ? '<span class="badge badge--ok">启用</span>' : '<span class="badge badge--danger">禁用</span>'}</td>
    <td class="muted">${fmtDate(u.created_at)}</td>
    <td><button class="btn btn--sm" data-act="edit">编辑</button></td></tr>`;
}

function bind(list) {
  content.querySelector('#btn-add').addEventListener('click', () => openEditor());
  content.querySelectorAll('tbody tr').forEach(tr => {
    tr.querySelector('[data-act="edit"]').addEventListener('click', () => openEditor(tr.dataset.id));
  });
}

function openEditor(id) {
  let u = {};
  if (id) {
    const row = content.querySelector(`tr[data-id="${id}"]`);
    u = { name: row.querySelector('td b').textContent, username: row.children[1].textContent,
          role: row.children[2].textContent, status: row.children[3].textContent.includes('启用') ? 'active' : 'disabled' };
  }
  const modal = new Modal({
    title: id ? '编辑用户' : '新建用户', confirmText: id ? '保存' : '创建',
    content: `
      <div class="row">
        <div class="field"><label>姓名</label><input class="input" id="u-name" value="${esc(u.name || '')}"></div>
        <div class="field"><label>用户名</label><input class="input" id="u-user" value="${esc(u.username || '')}"></div>
      </div>
      <div class="row">
        <div class="field"><label>角色</label><input class="input" id="u-role" value="${esc(u.role || '学生')}"></div>
        <div class="field"><label>状态</label><select class="select" id="u-status">
          <option value="active" ${u.status !== 'disabled' ? 'selected' : ''}>启用</option>
          <option value="disabled" ${u.status === 'disabled' ? 'selected' : ''}>禁用</option></select></div>
      </div>`,
    onConfirm: async () => {
      const data = {
        name: document.getElementById('u-name').value.trim(),
        username: document.getElementById('u-user').value.trim(),
        role: document.getElementById('u-role').value.trim() || '学生',
        status: document.getElementById('u-status').value,
      };
      if (!data.name || !data.username) throw new Error('姓名和用户名必填');
      const r = id ? await api.updateUser(id, data) : await api.createUser(data);
      if (r.code !== 0) throw new Error(r.message || '操作失败');
      toast('已保存', 'ok');
    },
  });
  modal.render();
}

load();
