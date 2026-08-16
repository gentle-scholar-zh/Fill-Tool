// frontend/admin/js/changelog.js —— 更新日志管理（仅管理员）
import { api, initShell, toast, Modal, confirmDialog, esc, fmtDate, icon } from './common.js';

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
            : `<div class="empty">${icon('info', 30)}<div>暂无更新日志</div></div>`}
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
  const parsed = parseContent(c.content);
  let content = '';
  if (parsed.sections) {
    // 分类结构（{new, improve, fix}），每类一个分组标题
    content = parsed.sections.map(s => `
      <div class="cg-section">
        <div class="cg-cat cg-cat--${s.key}">${esc(s.label)}</div>
        <ul>${s.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>`).join('');
  } else {
    // 兼容旧数据：纯字符串数组
    content = `<ul>${parsed.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  }
  return `<div class="cg-item" data-id="${c.id}">
    <div class="cg-top">
      <b>${esc(c.version)}</b><span class="cg-date">${esc(c.date || '')}</span>
      <div class="spacer"></div>
      <button class="btn btn--xs" data-act="edit" data-id="${c.id}">编辑</button>
      <button class="btn btn--xs btn--danger" data-act="del" data-id="${c.id}">删除</button>
    </div>
    ${content}
  </div>`;
}

// 把后端 content 字段解析成两种形态之一：
// - { sections: [{key,label,items:[]}] }：分类结构
// - { items: [] }：兼容旧平铺
function parseContent(c) {
  let obj = c;
  if (typeof c === 'string') {
    try { obj = JSON.parse(c); } catch (_) { return { items: [c] }; }
  }
  if (Array.isArray(obj)) return { items: obj };
  if (obj && typeof obj === 'object') {
    const map = { new: '新增', improve: '优化', fix: '修复', feature: '新增', optimize: '优化', fix_: '修复' };
    const sections = Object.keys(obj)
      .filter(k => Array.isArray(obj[k]) && obj[k].length)
      .map(k => ({ key: k, label: map[k] || k, items: obj[k] }));
    if (sections.length) return { sections };
  }
  return { items: [] };
}

function openEditor(id) {
  const item = id ? curList.find(c => c.id === id) : null;
  const version = item ? item.version : '';
  const date = item ? (item.date || new Date().toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10);
  const parsed = item ? parseContent(item.content) : { sections: [] };
  const secHtml = (parsed.sections || [
    { key: 'new', label: '新增', items: [] },
    { key: 'improve', label: '优化', items: [] },
    { key: 'fix', label: '修复', items: [] },
  ]).map(s => `
    <div class="cg-section cg-section--edit" data-key="${s.key}">
      <div class="cg-cat cg-cat--${s.key}">${esc(s.label)}</div>
      <textarea class="cg-content" data-cat="${s.key}" placeholder="每行一条，自动去除空行">${esc((s.items || []).join('\n'))}</textarea>
    </div>`).join('');
  const modal = new Modal({
    title: id ? '编辑更新日志' : '新增更新日志', width: 640, confirmText: id ? '保存' : '创建',
    content: `
      <div class="cg-row" style="grid-template-columns:1fr 1fr">
        <div class="field"><label>版本号</label><input class="input" id="cg-ver" value="${esc(version)}" placeholder="如 V2.1.0"></div>
        <div class="field"><label>发布日期</label><input class="input" id="cg-date" type="date" value="${esc(date)}"></div>
      </div>
      <div class="field">
        <label>更新内容（按「新增 / 优化 / 修复」分组，每行一条）</label>
        <div class="cg-edit">${secHtml}</div>
      </div>
      <div class="muted" style="font-size:12px">留空即视为该分组无内容；保存后将按结构化形式写入，前台自动按组渲染。</div>`,
    onConfirm: async () => {
      const ver = document.getElementById('cg-ver').value.trim();
      const dt = document.getElementById('cg-date').value.trim();
      if (!ver) throw new Error('版本号不能为空');
      const obj = {};
      document.querySelectorAll('.cg-section--edit').forEach(s => {
        const k = s.dataset.key;
        const arr = s.querySelector('textarea').value.split('\n').map(x => x.trim()).filter(Boolean);
        if (arr.length) obj[k] = arr;
      });
      if (id) {
        await api.updateChangelog(id, { version: ver, date: dt, content: obj });
        toast('已保存', 'ok');
      } else {
        await api.createChangelog({ version: ver, date: dt, content: obj });
        toast('已添加', 'ok');
      }
      load();
    },
  });
  modal.render();
}

load();
