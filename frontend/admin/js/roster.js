// frontend/admin/js/roster.js
import { api, initShell, toast, Modal, confirmDialog, esc, fmtDate, icon } from './common.js';

initShell('roster');
const content = document.getElementById('content');

async function load() {
  content.innerHTML = '<div class="card"><div class="card-body muted">加载中…</div></div>';
  try {
    const [rRes, tRes] = await Promise.all([api.getRoster(), api.getTemplates()]);
    const list = rRes.data || [];
    const templates = tRes.data || [];

    // 计算每个名单关联到的模板数量
    const linkedCount = {};
    await Promise.all(templates.map(async (t) => {
      try {
        const ri = await api.getTemplateRoster(t.id);
        if (ri.data && ri.data.roster_id) {
          linkedCount[ri.data.roster_id] = (linkedCount[ri.data.roster_id] || 0) + 1;
        }
      } catch (_) {}
    }));

    content.innerHTML = `
      <div class="toolbar">
        <button class="btn btn--primary" id="btn-up">+ 上传名单</button>
        <span class="muted">共 ${list.length} 个名单 · 关联模板 ${Object.values(linkedCount).reduce((a,b)=>a+b,0)} 处</span>
        <div class="spacer"></div>
        <span class="dim">支持 .xlsx / .xls · 自动识别表头并去重</span>
      </div>
      <div class="card"><div class="card-body" style="padding:0">
        ${list.length ? `<table class="table"><thead><tr>
          <th>名称</th><th>人数</th><th>表头</th><th>关联模板</th><th>上传时间</th><th class="actions">操作</th>
        </tr></thead><tbody>${list.map(r => rowHtml(r, linkedCount[r.id] || 0)).join('')}</tbody></table>`
        : `<div class="empty">${icon('roster', 30)}<div>暂无名单，点击「上传名单」导入 Excel</div></div>`}
      </div></div>`;
    bind(list);
  } catch (e) {
    content.innerHTML = `<div class="card"><div class="card-body" style="color:var(--danger)">加载失败：${esc(e.message)}</div></div>`;
  }
}

function rowHtml(r, linkedN) {
  const headers = (r.headers || []).slice(0, 6).map(esc).join('、');
  return `<tr data-id="${r.id}">
    <td><b>${esc(r.name)}</b></td>
    <td><span class="badge badge--brand">${r.total} 人</span></td>
    <td class="muted">${headers}${(r.headers || []).length > 6 ? '…' : ''}</td>
    <td>${linkedN > 0 ? `<span class="badge badge--ok">${linkedN} 个模板</span>` : '<span class="dim">未关联</span>'}</td>
    <td class="muted">${fmtDate(r.created_at)}</td>
    <td class="actions">
      <button class="btn btn--xs" data-act="view">查看</button>
      <button class="btn btn--xs" data-act="link">关联模板</button>
      <button class="btn btn--xs btn--danger" data-act="del">删除</button>
    </td>
  </tr>`;
}

function bind(list) {
  content.querySelector('#btn-up').addEventListener('click', openUpload);
  content.querySelectorAll('tbody tr').forEach(tr => {
    const id = tr.dataset.id;
    tr.querySelector('[data-act="view"]').addEventListener('click', () => openDetail(id));
    tr.querySelector('[data-act="link"]').addEventListener('click', () => openLinkToTemplate(id));
    tr.querySelector('[data-act="del"]').addEventListener('click', () => {
      confirmDialog('确定删除该名单？已关联模板的身份校验将失效。', async () => {
        await api.deleteRoster(id); toast('已删除', 'ok'); load();
      });
    });
  });
}

function openUpload() {
  const modal = new Modal({
    title: '上传名单', width: 460, confirmText: '上传并解析',
    content: `
      <div class="field"><label>名单名称</label>
        <input class="input" id="up-name" placeholder="如：2024级计算机1班"></div>
      <div class="field"><label>Excel 文件（.xlsx / .xls）</label>
        <input type="file" id="up-file" accept=".xlsx,.xls" class="input"></div>
      <p class="muted">系统会自动检测表头行、识别学号/姓名字段并去重。</p>`,
    onConfirm: async () => {
      const file = document.getElementById('up-file').files[0];
      if (!file) throw new Error('请选择文件');
      const name = document.getElementById('up-name').value.trim();
      const r = await api.uploadRoster(file, name);
      if (r.code !== 0) throw new Error(r.message || '上传失败');
      toast(`解析成功：${r.data.total} 人（去重 ${r.data.dedupRemoved}）`, 'ok');
      load();
    },
  });
  modal.render();
}

async function openDetail(id) {
  const res = await api.getRosterDetail(id);
  const d = res.data;
  const headers = d.headers || [];
  const rows = d.rows || [];
  const modal = new Modal({
    title: d.name + ' · ' + rows.length + ' 人', width: 760, confirmText: '关闭', onConfirm: null,
    content: `
      <div class="between mb">
        <span class="muted">表头：${headers.map(esc).join('、')}</span>
        <button class="btn btn--sm btn--primary" id="btn-link-detail">关联到模板</button>
      </div>
      <div style="max-height:55vh;overflow:auto">
        <table class="table"><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows.slice(0, 200).map(r => `<tr>${headers.map(h => `<td>${esc(r[h])}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        ${rows.length > 200 ? '<div class="muted mt">仅显示前 200 行</div>' : ''}
      </div>`,
  });
  modal.render();
  modal._el.querySelector('#btn-link-detail').addEventListener('click', () => {
    modal.close();
    openLinkToTemplate(id);
  });
}

async function openLinkToTemplate(rosterId) {
  const tRes = await api.getTemplates();
  const templates = (tRes.data || []).filter(t => t.status === 'published');
  if (!templates.length) {
    toast('暂无可关联的已发布模板', 'err'); return;
  }
  const modal = new Modal({
    title: '将名单关联到模板', width: 480, confirmText: '关联',
    content: `
      <div class="field"><label>选择模板</label>
        <select class="select" id="lk-tid">${templates.map(t => `<option value="${t.id}">${esc(t.name)}（${(t.fields||[]).length} 字段）</option>`).join('')}</select></div>
      <div class="row">
        <div class="field"><label>学号字段</label><input class="input" id="lk-id" value="学号"></div>
        <div class="field"><label>姓名字段</label><input class="input" id="lk-name" value="姓名"></div>
      </div>
      <p class="muted">关联后，模板填写页将校验名单身份；提交记录页可查看每位成员的填写进度。</p>`,
    onConfirm: async () => {
      const tid = document.getElementById('lk-tid').value;
      if (!tid) throw new Error('请选择模板');
      await api.linkRoster(tid, rosterId, document.getElementById('lk-id').value.trim(), document.getElementById('lk-name').value.trim());
      toast('已关联', 'ok');
      load();
    },
  });
  modal.render();
}

load();