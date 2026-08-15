// frontend/admin/js/users.js
import { api, initShell, toast, Modal, confirmDialog, icon, esc, fmtDate } from './common.js';

initShell('users');
const content = document.getElementById('content');

const ROLE_LABEL = { student: '学生', teacher: '教师', admin: '管理员' };
const roleLabel = r => ROLE_LABEL[r] || r || '学生';

async function load() {
  content.innerHTML = '<div class="card"><div class="card-body muted">加载中…</div></div>';
  try {
    const res = await api.getUsers();
    const list = res.data || [];
    content.innerHTML = `
      <div class="toolbar"><button class="btn btn--primary" id="btn-add">+ 新建用户</button>
        <span class="muted">共 ${list.length} 人</span></div>
      <div class="card"><div class="card-body" style="padding:0">
        ${list.length ? `<table class="table"><thead><tr><th>姓名</th><th>账号</th><th>角色</th><th>状态</th><th>创建时间</th><th style="width:200px">操作</th></tr></thead>
          <tbody>${list.map(u => rowHtml(u)).join('')}</tbody></table>`
        : '<div class="empty">' + icon('users', 22) + '<div>暂无用户</div></div>'}
      </div></div>`;
    bind(list);
  } catch (e) {
    content.innerHTML = `<div class="card"><div class="card-body" style="color:var(--danger)">加载失败：${esc(e.message)}</div></div>`;
  }
}

function rowHtml(u) {
  const isActive = u.status === 'active';
  return `<tr data-id="${u.id}">
    <td><b>${esc(u.name)}</b></td>
    <td class="muted">${esc(u.phone || u.email || u.username || '')}</td>
    <td>${roleLabel(u.role)}</td>
    <td>${isActive ? '<span class="badge badge--ok">启用</span>' : '<span class="badge badge--danger">禁用</span>'}</td>
    <td class="muted">${fmtDate(u.created_at)}</td>
    <td><div class="actions">
      <button class="btn btn--sm" data-act="edit">编辑</button>
      <button class="btn btn--sm" data-act="reset">重置密码</button>
      <button class="btn btn--sm ${isActive ? 'btn--danger' : 'btn--primary'}" data-act="toggle">${isActive ? '禁用' : '启用'}</button>
    </div></td></tr>`;
}

function bind(list) {
  content.querySelector('#btn-add').addEventListener('click', () => openEditor());
  content.querySelectorAll('tbody tr').forEach(tr => {
    const id = tr.dataset.id;
    tr.querySelector('[data-act="edit"]').addEventListener('click', () => openEditor(id));
    tr.querySelector('[data-act="reset"]').addEventListener('click', () => resetPwd(id));
    tr.querySelector('[data-act="toggle"]').addEventListener('click', () => toggleStatus(id, tr));
  });
}

function roleSelect(current) {
  return `<select class="select" id="u-role">
    <optgroup label="前台用户">
      <option value="student" ${current === 'student' ? 'selected' : ''}>学生</option>
    </optgroup>
    <optgroup label="后台用户">
      <option value="teacher" ${current === 'teacher' ? 'selected' : ''}>教师</option>
      <option value="admin" ${current === 'admin' ? 'selected' : ''}>管理员</option>
    </optgroup>
  </select>`;
}

function openEditor(id) {
  let u = { role: 'student', status: 'active' };
  if (id) {
    const tr = content.querySelector(`tr[data-id="${id}"]`);
    u = {
      name: tr.querySelector('td b').textContent,
      phone: tr.children[1].textContent.trim(),
      role: (tr.children[2].textContent.trim() === '管理员' ? 'admin'
            : tr.children[2].textContent.trim() === '教师' ? 'teacher' : 'student'),
      status: tr.children[3].textContent.includes('启用') ? 'active' : 'disabled',
    };
  }
  const modal = new Modal({
    title: id ? '编辑用户' : '新建用户', confirmText: id ? '保存' : '创建',
    content: `
      <div class="row">
        <div class="field"><label>姓名 <span class="req">*</span></label><input class="input" id="u-name" value="${esc(u.name || '')}"></div>
        <div class="field"><label>手机号</label><input class="input" id="u-phone" value="${esc(u.phone || '')}" placeholder="手机号 / 登录账号"></div>
      </div>
      <div class="row">
        <div class="field"><label>邮箱</label><input class="input" id="u-email" value="${esc(u.email || '')}" placeholder="可选，与手机号二选一"></div>
        <div class="field"><label>学号</label><input class="input" id="u-sid" value="${esc(u.student_id || '')}" placeholder="学生必填"></div>
      </div>
      <div class="row">
        <div class="field"><label>角色</label>${roleSelect(u.role)}</div>
        <div class="field"><label>状态</label><select class="select" id="u-status">
          <option value="active" ${u.status !== 'disabled' ? 'selected' : ''}>启用</option>
          <option value="disabled" ${u.status === 'disabled' ? 'selected' : ''}>禁用</option></select></div>
      </div>
      ${id ? '' : '<div class="auth-note">未填密码时系统自动生成临时密码，创建后可在列表中「重置密码」获取。</div>'}`,
    onConfirm: async () => {
      const data = {
        name: document.getElementById('u-name').value.trim(),
        phone: document.getElementById('u-phone').value.trim(),
        email: document.getElementById('u-email').value.trim(),
        student_id: document.getElementById('u-sid').value.trim(),
        role: document.getElementById('u-role').value,
        status: document.getElementById('u-status').value,
      };
      if (!data.name) throw new Error('姓名必填');
      if (!data.phone && !data.email) throw new Error('手机号或邮箱至少填写一项');
      const r = id ? await api.updateUser(id, data) : await api.createUser(data);
      if (r.code !== 0) throw new Error(r.message || '操作失败');
      if (!id && r.data && r.data.generated_password) {
        toast('已创建，临时密码：' + r.data.generated_password, 'ok', 6000);
      } else {
        toast('已保存', 'ok');
      }
    },
  });
  modal.render();
}

async function resetPwd(id) {
  const r = await api.resetPassword(id, {});
  if (r.code !== 0) { toast(r.message || '重置失败', 'err'); return; }
  const pwd = r.data && r.data.password;
  const m = new Modal({
    title: '重置密码', confirmText: '知道了',
    content: `<p style="margin:0 0 10px">已为该用户生成新密码，请通过其他方式告知对方：</p>
      <div class="auth-note" style="font-size:14px;letter-spacing:1px"><b>${esc(pwd || '')}</b></div>`,
  });
  m.render();
}

async function toggleStatus(id, tr) {
  const isActive = tr.children[3].textContent.includes('启用');
  const next = isActive ? 'disabled' : 'active';
  const label = isActive ? '禁用' : '启用';
  confirmDialog(`确认${label}该用户？`, async () => {
    const r = await api.updateUser(id, { status: next });
    if (r.code !== 0) { toast(r.message || '操作失败', 'err'); return; }
    toast(`已${label}`, 'ok');
    load();
  });
}

load();
