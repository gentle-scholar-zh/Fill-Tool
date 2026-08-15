// frontend/admin/js/changelog.js —— 更新日志管理（仅管理员）
import { api, initShell, toast, Modal, confirmDialog, esc, fmtDate } from './common.js';

if (!initShell('changelog')) { /* 未登录会跳转 */ }

const content = document.getElementById('content');
let curList = [];

async function load() {
  content.innerHTML = '<div class="card"><div class="card-body muted">加载中…</div></div>';
  try {
    const r = await api.getChangelog();
    curList = r.data || [];
    const list = curList;
    content.innerHTML = `
      <div class="toolbar">
        <button class="btn btn--primary" id="btn-new">+ 新增日志</button>
        <span class="muted">共 ${list.length} 条</span>
      </div>
      <div class="card">
        <div class="card-body" style="padding:0">
          ${list.length ? `<div class="cg-list">${list.map(c => itemHtml(c)).join('')}</div>`
            : '<div class="empty"><span class="ico">📰</span>暂无更新日志</div>'}
        </div>
      </div>`;
    content.querySelector('#btn-new')?.addEventListener('click', () => openEditor());
    content.querySelectorAll('[data-act="edit"]').forEach(b => b.addEventListener('click', () => openEditor(b.dataset.id)));
    content.querySelectorAll('[data-act="del"]').forEach(b => b.addEventListener('click', () => {
      confirmDialog('确定删除该条更新日志？', async () => { await api.deleteChangelog(b.dataset.id); toast('已删除', 'ok'); load(); });
    }));
  } catch (e) {
    content.innerHTML = `<div class="card"><div class="card-body" style="color:var(--danger)">加载失败：${esc(e.message)}</div></div>`;
  }
}

function itemHtml(c) {
  const content = (c.content || []).map(x => `<li>${esc(x)}</li>`).join('') || '<li class="dim">（无内容）</li>';
  return `<div class="cg-item" data-id="${c.id}">
    <div class="cg-top">
      <b>${esc(c.version)}</b><span class="cg-date">${esc(c.date || '')}</span>
      <div class="spacer"></div>
      <button class="btn btn--xs" data-act="edit" data-id="${c.id}">编辑</button>
      <button class="btn btn--xs btn--danger" data-act="del" data-id="${c.id}">删除</button>
    </div>
    <ul>${content}</ul>
  </div>`;
}

function openEditor(id) {
  const item = id ? curList.find(c => c.id === id) : null;
  const version = item ? item.version : '';
  const date = item ? (item.date || new Date().toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10);
  const contentText = item ? (item.content || []).join('\n') : '';
  const modal = new Modal({
    title: id ? '编辑更新日志' : '新增更新日志', width: 560, confirmText: id ? '保存' : '创建',
    content: `
      <div class="cg-row" style="grid-template-columns:1fr 1fr">
        <div class="field"><label>版本号</label><input class="input" id="cg-ver" value="${esc(version)}" placeholder="如 V2.1.0"></div>
        <div class="field"><label>发布日期</label><input class="input" id="cg-date" type="date" value="${esc(date)}"></div>
      </div>
      <div class="field"><label>更新内容（每行一条）</label>
        <textarea class="cg-content" id="cg-content" placeholder="新增公共模板池&#10;优化移动端样式&#10;修复提交失败问题">${esc(contentText)}</textarea></div>`,
    onConfirm: async () => {
      const ver = document.getElementById('cg-ver').value.trim();
      const dt = document.getElementById('cg-date').value.trim();
      const ct = document.getElementById('cg-content').value.split('\n').map(s => s.trim()).filter(Boolean);
      if (!ver) throw new Error('版本号不能为空');
      if (id) {
        await api.updateChangelog(id, { version: ver, date: dt, content: ct });
        toast('已保存', 'ok');
      } else {
        await api.createChangelog({ version: ver, date: dt, content: ct });
        toast('已添加', 'ok');
      }
      load();
    },
  });
  modal.render();
}

load();
