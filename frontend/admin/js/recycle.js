// frontend/admin/js/recycle.js
import { api, initShell, toast, confirmDialog, esc } from './common.js';

initShell('recycle');
const content = document.getElementById('content');

async function load() {
  content.innerHTML = '<div class="card"><div class="card-body muted">加载中…</div></div>';
  try {
    const res = await api.getRecycle();
    const list = res.data || [];
    content.innerHTML = `
      <div class="toolbar">
        <button class="btn btn--primary" id="btn-restore-all">全部还原</button>
        <button class="btn btn--danger" id="btn-empty">清空回收站</button>
        <span class="muted">共 ${list.length} 项</span>
      </div>
      <div class="card"><div class="card-body" style="padding:0">
        ${list.length ? `<table class="table"><thead><tr><th>名称</th><th>类型</th><th>删除时间</th><th>剩余</th><th style="width:200px">操作</th></tr></thead>
          <tbody>${list.map(r => rowHtml(r)).join('')}</tbody></table>`
        : '<div class="empty">回收站为空</div>'}
      </div></div>`;
    bind(list);
  } catch (e) {
    content.innerHTML = `<div class="card"><div class="card-body" style="color:var(--danger)">加载失败：${esc(e.message)}</div></div>`;
  }
}

function rowHtml(r) {
  const typeMap = { template: '模板' };
  return `<tr data-id="${r.id}">
    <td><b>${esc(r.item_name)}</b></td>
    <td>${typeMap[r.item_type] || r.item_type}</td>
    <td class="muted">${esc(r.deleted_at)}</td>
    <td class="muted">${r.expire_in} 天</td>
    <td>
      <button class="btn btn--sm" data-act="restore">还原</button>
      <button class="btn btn--sm btn--danger" data-act="del">彻底删除</button>
    </td></tr>`;
}

function bind(list) {
  content.querySelector('#btn-restore-all').addEventListener('click', () => {
    confirmDialog('确定还原回收站全部项目？', async () => { await api.restoreAll(); toast('已还原', 'ok'); load(); });
  });
  content.querySelector('#btn-empty').addEventListener('click', () => {
    confirmDialog('确定永久清空回收站？此操作不可恢复。', async () => { await api.emptyRecycle(); toast('已清空', 'ok'); load(); });
  });
  content.querySelectorAll('tbody tr').forEach(tr => {
    const id = tr.dataset.id;
    tr.querySelector('[data-act="restore"]').addEventListener('click', async () => {
      await api.restoreItem(id); toast('已还原', 'ok'); load();
    });
    tr.querySelector('[data-act="del"]').addEventListener('click', () => {
      confirmDialog('确定永久删除？', async () => { await api.deletePermanent(id); toast('已删除', 'ok'); load(); });
    });
  });
}

load();
