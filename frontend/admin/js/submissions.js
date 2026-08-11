// frontend/admin/js/submissions.js
import { api, initShell, toast, Modal, confirmDialog, esc, fmtDate } from './common.js';

initShell('submissions');
const content = document.getElementById('content');

let allSubs = [];
let allTpls = [];
let curTid = '';

async function load() {
  content.innerHTML = '<div class="card"><div class="card-body muted">加载中…</div></div>';
  try {
    const [tres, sres] = await Promise.all([api.getTemplates(), api.getSubmissions()]);
    allTpls = tres.data || [];
    allSubs = sres.data || [];
    render();
  } catch (e) {
    content.innerHTML = `<div class="card"><div class="card-body" style="color:var(--danger)">加载失败：${esc(e.message)}</div></div>`;
  }
}

function render() {
  const list = curTid ? allSubs.filter(s => s.template_id === curTid) : allSubs;
  const tplName = (tid) => (allTpls.find(t => t.id === tid) || {}).name || tid;
  content.innerHTML = `
    <div class="toolbar">
      <select class="select" id="f-tpl" style="width:240px">
        <option value="">全部模板</option>
        ${allTpls.map(t => `<option value="${t.id}" ${t.id === curTid ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
      </select>
      <button class="btn btn--primary" id="btn-export">批量导出(zip)</button>
      <button class="btn btn--danger" id="btn-clear">清空全部</button>
      <span class="muted">共 ${list.length} 条</span>
    </div>
    <div class="card"><div class="card-body" style="padding:0">
      ${list.length ? `<table class="table"><thead><tr>
        <th style="width:36px"><input type="checkbox" id="chk-all"></th>
        <th>提交人</th><th>所属模板</th><th>提交时间</th><th>内容摘要</th><th style="width:160px">操作</th>
      </tr></thead><tbody>${list.map(s => rowHtml(s, tplName)).join('')}</tbody></table>`
      : '<div class="empty">暂无提交记录</div>'}
    </div></div>`;
  bind(list);
}

function rowHtml(s, tplName) {
  const data = s.data || {};
  const summary = Object.entries(data).slice(0, 3).map(([k, v]) => `${esc(k)}:${esc(v)}`).join('，');
  return `<tr data-id="${s.id}" data-tid="${s.template_id}">
    <td><input type="checkbox" class="chk" value="${s.id}"></td>
    <td><b>${esc(s.submitter || '匿名')}</b></td>
    <td class="muted">${esc(tplName(s.template_id))}</td>
    <td class="muted">${fmtDate(s.submitted_at)}</td>
    <td class="muted">${summary}</td>
    <td>
      <button class="btn btn--sm" data-act="dl">下载</button>
      <button class="btn btn--sm btn--danger" data-act="del">删除</button>
    </td></tr>`;
}

function bind(list) {
  content.querySelector('#f-tpl').addEventListener('change', (e) => { curTid = e.target.value; render(); });
  content.querySelector('#btn-clear').addEventListener('click', () => {
    confirmDialog('确定清空全部提交记录？此操作不可恢复。', async () => {
      await api.batchDeleteSubmissions({});
      toast('已清空', 'ok'); load();
    });
  });
  content.querySelector('#btn-export').addEventListener('click', () => openExport(list));
  content.querySelector('#chk-all')?.addEventListener('change', (e) => {
    content.querySelectorAll('.chk').forEach(c => c.checked = e.target.checked);
  });
  content.querySelectorAll('tbody tr').forEach(tr => {
    const id = +tr.dataset.id;
    tr.querySelector('[data-act="dl"]').addEventListener('click', () => api.downloadSubmission(id));
    tr.querySelector('[data-act="del"]').addEventListener('click', () => {
      confirmDialog('确定删除该记录？', async () => { await api.deleteSubmission(id); toast('已删除', 'ok'); load(); });
    });
  });
}

function openExport(list) {
  const ids = [...content.querySelectorAll('.chk:checked')].map(c => +c.value);
  const exportList = ids.length ? list.filter(s => ids.includes(s.id)) : list;
  if (!exportList.length) { toast('没有可导出的记录', 'err'); return; }
  api.getExportFields(curTid).then(r => {
    const fields = r.data || [];
    const modal = new Modal({
      title: '批量导出', width: 460, confirmText: '导出 zip',
      content: `
        <p class="muted">将导出 ${exportList.length} 条记录为 docx 压缩包。</p>
        <div class="field"><label>按字段分文件夹（可选）</label>
          <select class="select" id="exp-field"><option value="">不分类（平铺）</option>${fields.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('')}</select>
        </div>`,
      onConfirm: async () => {
        const split = document.getElementById('exp-field').value;
        const body = { ids: exportList.map(s => s.id) };
        if (split) body.splitField = split;
        await api.exportSubmissions(body);
        toast('导出完成', 'ok');
      },
    });
    modal.render();
  });
}

load();
