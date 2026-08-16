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
        ${list.length ? `<table class="table"><thead><tr><th>姓名</th><th>账号</th><th>角色</th><th>密码</th><th>状态</th><th>创建时间</th><th style="width:160px">操作</th></tr></thead>
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
  const pwdTag = u.has_password === false
    ? '<span class="badge badge--draft">待设</span>'
    : '<span class="badge badge--ok">已设</span>';
  return `<tr data-id="${u.id}">
    <td><b>${esc(u.name)}</b></td>
    <td class="muted">${esc(u.phone || u.email || u.username || '')}</td>
    <td>${roleLabel(u.role)}</td>
    <td>${pwdTag}</td>
    <td>${isActive ? '<span class="badge badge--ok">启用</span>' : '<span class="badge badge--danger">禁用</span>'}</td>
    <td class="muted">${fmtDate(u.created_at)}</td>
    <td><div class="actions">
      <button class="btn btn--sm" data-act="edit">编辑</button>
      <button class="btn btn--sm ${isActive ? 'btn--danger' : 'btn--primary'}" data-act="toggle">${isActive ? '禁用' : '启用'}</button>
    </div></td></tr>`;
}

function bind(list) {
  content.querySelector('#btn-add').addEventListener('click', () => openEditor());
  content.querySelectorAll('tbody tr').forEach(tr => {
    const id = tr.dataset.id;
    tr.querySelector('[data-act="edit"]').addEventListener('click', () => openEditor(id));
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
  let u = { role: 'student', status: 'active', has_password: true };
  if (id) {
    // 重新拉一次详情，确保拿到 has_password 等真实字段
    api.getUsers().then(r => {
      const fresh = (r.data || []).find(x => x.id === id);
      if (fresh) {
        ['name','phone','email','student_id','role','status','has_password'].forEach(k => {
          if (fresh[k] !== undefined) u[k] = fresh[k];
        });
        const pwdInput = document.getElementById('u-pwd');
        const hint = document.getElementById('u-pwd-hint');
        if (pwdInput && hint && u.has_password === false) {
          hint.textContent = '当前未设密码；填入新密码后将立即生效。';
          hint.style.display = '';
        }
      }
    });
    const tr = content.querySelector(`tr[data-id="${id}"]`);
    u = {
      name: tr.querySelector('td b').textContent,
      phone: tr.children[1].textContent.trim(),
      role: (tr.children[2].textContent.trim() === '管理员' ? 'admin'
            : tr.children[2].textContent.trim() === '教师' ? 'teacher' : 'student'),
      status: tr.children[4].textContent.includes('启用') ? 'active' : 'disabled',
    };
  }
  const isEdit = !!id;
  const pwdSectionHelp = isEdit
    ? '<div class="muted" id="u-pwd-hint" style="font-size:12px;margin-top:-6px">留空则不修改密码；填入则立即生效，请通过安全方式告知本人。</div>'
    : '<div class="muted" id="u-pwd-hint" style="font-size:12px;margin-top:-6px">留空则创建「待设密码」账号，对方需通过「忘记密码」流程申请设置。</div>';

  const modal = new Modal({
    title: isEdit ? '编辑用户' : '新建用户',
    width: 600,
    confirmText: isEdit ? '保存' : '创建',
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
      <div class="field">
        <label>密码${isEdit ? '（留空不修改）' : '（选填，留空创建「待设密码」账号）'}</label>
        <input class="input" id="u-pwd" type="password" placeholder="至少 6 位">
        ${pwdSectionHelp}
      </div>`,
    onConfirm: async () => {
      const data = {
        name: document.getElementById('u-name').value.trim(),
        phone: document.getElementById('u-phone').value.trim(),
        email: document.getElementById('u-email').value.trim(),
        student_id: document.getElementById('u-sid').value.trim(),
        role: document.getElementById('u-role').value,
        status: document.getElementById('u-status').value,
        password: document.getElementById('u-pwd').value,
      };
      if (!data.name) throw new Error('姓名必填');
      if (!data.phone && !data.email) throw new Error('手机号或邮箱至少填写一项');
      if (data.password && data.password.length < 6) throw new Error('密码至少 6 位');
      const r = isEdit ? await api.updateUser(id, data) : await api.createUser(data);
      if (r.code !== 0) throw new Error(r.message || '操作失败');
      toast(isEdit ? '已保存' : (data.password ? '已创建' : '已创建，等待用户通过「忘记密码」设置密码'), 'ok');
    },
  });
  modal.render();

  // 编辑用户弹窗底部添加「重置密码」按钮（贴在确认按钮左侧）
  if (isEdit && modal._el) {
    const actions = modal._el.querySelector('.modal-actions');
    if (actions) {
      const resetBtn = document.createElement('button');
      resetBtn.className = 'btn btn--ghost btn--sm';
      resetBtn.type = 'button';
      resetBtn.textContent = '重置密码';
      // 把「重置密码」放到 footer 最左侧，剩下的按钮右对齐
      actions.style.justifyContent = 'space-between';
      resetBtn.addEventListener('click', async () => { await resetPwd(id); });
      // 把 cancel + save 包成一个右侧分组
      const right = document.createElement('div');
      right.style.display = 'flex';
      right.style.gap = '8px';
      const cancel = actions.querySelector('[data-modal="close"]');
      const save = actions.querySelector('[data-modal="save"]');
      actions.innerHTML = '';
      actions.appendChild(resetBtn);
      actions.appendChild(right);
      if (cancel) right.appendChild(cancel);
      if (save) right.appendChild(save);
    }
  }
}

async function resetPwd(id) {
  // 让管理员设置新密码（不强制生成临时密码）
  const m = new Modal({
    title: '重置密码', width: 460, confirmText: '重置',
    content: `
      <div class="field"><label>新密码</label><input class="input" id="rp-pwd" type="password" placeholder="至少 6 位，建议使用密码管理器"></div>
      <div class="row">
        <div class="field"><label><input type="checkbox" id="rp-auto" checked> 生成临时密码</label></div>
      </div>
      <div class="muted" style="font-size:12px">新密码生效后将无法找回，请通过安全方式告知本人。</div>`,
    onConfirm: async () => {
      const useAuto = document.getElementById('rp-auto').checked;
      let pwd = document.getElementById('rp-pwd').value;
      if (!useAuto) {
        if (!pwd || pwd.length < 6) throw new Error('请输入至少 6 位的新密码');
      } else {
        pwd = '';
      }
      const r = await api.resetPassword(id, { password: pwd });
      if (r.code !== 0) throw new Error(r.message || '重置失败');
      const newPwd = r.data && r.data.password;
      const m2 = new Modal({
        title: '重置成功', confirmText: '知道了', onConfirm: null,
        content: `<p>已为该用户设置新密码，请通过安全方式告知对方：</p>
          <div class="auth-note" style="font-size:14px;letter-spacing:1px"><b>${esc(newPwd || '')}</b></div>
          <p class="muted" style="margin-top:10px">用户首次登录后请前往「修改密码」改为个人密码。</p>`,
      });
      m2.render();
    },
  });
  m.render();
  // 自动切换是否禁用密码输入
  const sync = () => {
    const auto = document.getElementById('rp-auto').checked;
    const inp = document.getElementById('rp-pwd');
    if (!inp) return;
    inp.disabled = auto;
    inp.value = '';
  };
  m._el.querySelector('#rp-auto')?.addEventListener('change', sync);
  sync();
}

async function toggleStatus(id, tr) {
  const isActive = tr.children[4].textContent.includes('启用');
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
