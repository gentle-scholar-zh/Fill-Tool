// frontend/admin/js/option-sets.js —— 下拉选项模板管理
import { api, initShell, toast, Modal, confirmDialog, esc, fmtDate } from './common.js';

initShell('option-sets');
const content = document.getElementById('content');
let OS_DATA = [];

async function load() {
  content.innerHTML = '<div class="card"><div class="card-body muted">加载中…</div></div>';
  try {
    const res = await api.getOptionSets();
    const list = res.data || [];
    OS_DATA = list;
    content.innerHTML = `
      <div class="toolbar">
        <button class="btn btn--primary" id="btn-add">+ 新建选项模板</button>
        <button class="btn btn--sm" id="btn-upload">⬆ 上传 Excel</button>
        <span class="muted">共 ${list.length} 个选项模板 · 量大时用「上传 Excel」批量导入，填写页支持搜索</span>
      </div>
      <div class="card"><div class="card-body" style="padding:0">
        ${list.length ? `<table class="table"><thead><tr>
          <th>名称</th><th>选项数量</th><th>预览</th><th>创建时间</th><th class="actions">操作</th>
        </tr></thead><tbody>${list.map(c => rowHtml(c)).join('')}</tbody></table>`
        : '<div class="empty"><span class="ico">⌗</span>暂无选项模板，点击「新建选项模板」或上传 Excel</div>'}
      </div></div>`;
    bind(list);
  } catch (e) {
    content.innerHTML = `<div class="card"><div class="card-body" style="color:var(--danger)">加载失败：${esc(e.message)}</div></div>`;
  }
}

function rowHtml(c) {
  const preview = (c.options || []).slice(0, 6).map(esc).join('、');
  return `<tr data-id="${c.id}">
    <td><b>${esc(c.name)}</b></td>
    <td><span class="badge badge--brand">${c.count || 0} 项</span></td>
    <td class="muted">${preview}${(c.options || []).length > 6 ? '…' : ''}</td>
    <td class="muted">${fmtDate(c.created_at)}</td>
    <td class="actions">
      <button class="btn btn--xs" data-act="edit">编辑</button>
      <button class="btn btn--xs btn--danger" data-act="del">删除</button>
    </td>
  </tr>`;
}

function bind(list) {
  content.querySelector('#btn-add').addEventListener('click', () => openEditor());
  content.querySelector('#btn-upload').addEventListener('click', () => openUpload());
  content.querySelectorAll('tbody tr').forEach(tr => {
    const id = tr.dataset.id;
    tr.querySelector('[data-act="edit"]').addEventListener('click', () => openEditor(id));
    tr.querySelector('[data-act="del"]').addEventListener('click', () => {
      confirmDialog('确定删除该选项模板？已关联的字段将回退为手动输入。', async () => {
        await api.deleteOptionSet(id); toast('已删除', 'ok'); load();
      });
    });
  });
}

function openEditor(id) {
  let name = '', options = [];
  if (id) {
    const row = content.querySelector(`tr[data-id="${id}"]`);
    name = (row.querySelector('td b') || {}).textContent || '';
    const cur = OS_DATA.find(o => o.id === id);
    if (cur) options = cur.options || [];
  }
  const modal = new Modal({
    title: id ? '编辑选项模板' : '新建选项模板', confirmText: id ? '保存' : '创建',
    width: 520,
    content: `
      <div class="field"><label>模板名称<span class="req">*</span></label>
        <input class="input" id="os-name" value="${esc(name)}" placeholder="如：学院列表"></div>
      <div class="field"><label>选项内容（每行一个，或逗号分隔）</label>
        <textarea class="input" id="os-opts" rows="8" placeholder="计算机学院&#10;软件学院&#10;数学学院">${esc(options.join('\n'))}</textarea>
        <div class="muted mt">共 <b id="os-count">${options.length}</b> 项（自动去重）</div>
      </div>`,
    onConfirm: async () => {
      const nm = document.getElementById('os-name').value.trim();
      if (!nm) throw new Error('名称不能为空');
      const raw = document.getElementById('os-opts').value;
      const opts = raw.split(/[\n,，]/).map(s => s.trim()).filter(Boolean);
      if (!opts.length) throw new Error('请至少输入一个选项');
      const r = id ? await api.updateOptionSet(id, { name: nm, options: opts })
                  : await api.createOptionSet({ name: nm, options: opts });
      if (r.code !== 0) throw new Error(r.message || '操作失败');
      toast('已保存', 'ok');
    },
  });
  modal.render();
  const ta = modal._el.querySelector('#os-opts');
  const cnt = modal._el.querySelector('#os-count');
  ta.addEventListener('input', () => {
    cnt.textContent = ta.value.split(/[\n,，]/).map(s => s.trim()).filter(Boolean).length;
  });
}

function openUpload() {
  const modal = new Modal({
    title: '上传选项模板（Excel）', width: 460, confirmText: '上传',
    content: `
      <div class="field"><label>模板名称</label>
        <input class="input" id="up-name" placeholder="如：全校学生名单"></div>
      <div class="field"><label>Excel 文件（.xlsx / .xls，单列或第一行起逐格为选项）</label>
        <input type="file" id="up-file" accept=".xlsx,.xls" class="input"></div>
      <p class="muted">系统提取所有非空单元格作为选项（自动去重），适合大量数据。</p>`,
    onConfirm: async () => {
      const file = document.getElementById('up-file').files[0];
      if (!file) throw new Error('请选择文件');
      const name = document.getElementById('up-name').value.trim();
      const r = await api.uploadOptionSet(file, name);
      if (r.code !== 0) throw new Error(r.message || '上传失败');
      toast(`已导入 ${r.data.options.length} 项`, 'ok');
    },
  });
  modal.render();
}

// 缓存数据供编辑时使用
load();
