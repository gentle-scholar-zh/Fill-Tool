// frontend/admin/js/templates.js
import { api, initShell, toast, Modal, confirmDialog, esc, fmtDate, inferFieldType } from './common.js';

initShell('templates');
const content = document.getElementById('content');

const TYPE_OPTIONS = [
  { raw: 'text', label: '单行文本' },
  { raw: 'textarea', label: '多行文本' },
  { raw: 'number', label: '数字' },
  { raw: 'date', label: '日期选择' },
  { raw: 'select', label: '下拉选择' },
];
const typeLabel = (raw) => (TYPE_OPTIONS.find(t => t.raw === raw) || TYPE_OPTIONS[0]).label;
const typeOptionsHtml = (sel) => TYPE_OPTIONS.map(t => `<option value="${t.raw}" ${t.raw === sel ? 'selected' : ''}>${t.label}</option>`).join('');

let editorFields = [];
let optionSets = [];
let pendingFileBase64 = '';
let pendingFileName = '';

// ============ 列表 ============
async function load() {
  content.innerHTML = '<div class="card"><div class="card-body muted">加载中…</div></div>';
  try {
    const [tRes, rRes] = await Promise.all([api.getTemplates(), api.getRoster()]);
    const list = tRes.data || [];
    const rosters = rRes.data || [];
    const rosterById = {};
    rosters.forEach(r => { rosterById[r.id] = r; });

    // 并发取每个模板的进度（关联名单时）
    const progressMap = {};
    const rosterInfoMap = {};
    await Promise.all(list.map(async (t) => {
      try {
        const p = await api.getRosterProgress(t.id);
        progressMap[t.id] = p.data;
      } catch (_) {}
      try {
        const ri = await api.getTemplateRoster(t.id);
        rosterInfoMap[t.id] = ri.data;
      } catch (_) {}
    }));

    content.innerHTML = `
      <div class="toolbar">
        <button class="btn btn--primary" id="btn-new">+ 新建模板</button>
        <span class="muted">共 ${list.length} 个模板</span>
        <div class="spacer"></div>
      </div>
      <div class="card">
        <div class="card-body" style="padding:0">
          ${list.length ? `<table class="table"><thead><tr>
            <th>名称</th><th>分类</th><th>字段数</th><th>状态</th><th>关联</th><th>填写进度</th><th>更新时间</th><th class="actions">操作</th>
          </tr></thead><tbody>${list.map(t => rowHtml(t, progressMap[t.id], rosterInfoMap[t.id])).join('')}</tbody></table>`
          : '<div class="empty"><span class="ico">▤</span>暂无模板，点击「新建模板」开始</div>'}
        </div>
      </div>`;
    bindList();
  } catch (e) {
    content.innerHTML = `<div class="card"><div class="card-body" style="color:var(--danger)">加载失败：${esc(e.message)}</div></div>`;
  }
}

function rowHtml(t, prog, linked) {
  const n = (t.fields || []).length;
  // 关联信息：名单 / 分组 / 选项模板
  let linkCell = '<span class="dim">未关联</span>';
  if (linked) {
    const parts = [];
    if (linked.roster_name) parts.push(`<span class="badge badge--brand">名单：${esc(linked.roster_name)}</span>`);
    linkCell = parts.length ? parts.join(' ') : '<span class="dim">未关联</span>';
  }
  let progCell = '<span class="muted">—</span>';
  if (prog && prog.total > 0) {
    const pct = Math.round((prog.submitted / prog.total) * 100);
    const cls = prog.submitted >= prog.total ? 'fill--ok' : '';
    progCell = `
      <div class="progress" style="min-width:140px">
        <div class="bar"><div class="fill ${cls}" style="width:${pct}%"></div></div>
        <span class="txt">${prog.submitted}/${prog.total}</span>
      </div>`;
  } else if (linked && linked.roster_name) {
    progCell = '<span class="dim">未获取</span>';
  }
  const isPublished = t.status === 'published';
  return `<tr data-id="${t.id}">
    <td><b>${esc(t.name)}</b></td>
    <td>${esc(t.category || '未分类')}</td>
    <td>${n}</td>
    <td>${isPublished ? '<span class="badge badge--ok">已发布</span>' : '<span class="badge badge--draft">草稿</span>'}</td>
    <td>${linkCell}</td>
    <td>${progCell}</td>
    <td class="muted">${fmtDate(t.updated_at)}</td>
    <td class="actions">
      <button class="btn btn--xs" data-act="edit">编辑</button>
      <button class="btn btn--xs" data-act="link">关联</button>
      <button class="btn btn--xs" data-act="share">分享/二维码</button>
      <button class="btn btn--xs" data-act="publish">${isPublished ? '下架' : '发布'}</button>
      <button class="btn btn--xs btn--danger" data-act="del">删除</button>
    </td>
  </tr>`;
}

function bindList() {
  content.querySelector('#btn-new')?.addEventListener('click', () => openEditor());
  content.querySelectorAll('tbody tr').forEach(tr => {
    const id = tr.dataset.id;
    tr.querySelector('[data-act="edit"]')?.addEventListener('click', () => openEditor(id));
    tr.querySelector('[data-act="publish"]')?.addEventListener('click', async () => {
      await api.publishTemplate(id); toast('已切换发布状态', 'ok'); load();
    });
    tr.querySelector('[data-act="link"]')?.addEventListener('click', () => openLinkRoster(id));
    tr.querySelector('[data-act="share"]')?.addEventListener('click', () => openShareAndQr(id));
    tr.querySelector('[data-act="del"]')?.addEventListener('click', () => {
      confirmDialog('确定删除该模板？将移入回收站（30 天后永久删除）。', async () => {
        await api.deleteTemplate(id); toast('已删除', 'ok'); load();
      });
    });
  });
}

// ============ 编辑器 ============
function fieldRowHtml(f, idx) {
  const raw = f.raw_type || inferFieldType(f.name);
  const isSelect = raw === 'select';
  const optMode = f.option_set_id ? 'set' : 'manual';
  const optVal = (Array.isArray(f.options) ? f.options.join(',') : (f.options || ''));
  return `<div class="field-row" data-idx="${idx}">
    <div class="fr-line">
      <input class="input f-name" style="flex:2.2" value="${esc(f.name)}" placeholder="字段名">
      <select class="select f-type" style="flex:1.3">${typeOptionsHtml(raw)}</select>
      <label style="white-space:nowrap"><input type="checkbox" class="f-req" ${f.required ? 'checked' : ''}> 必填</label>
      <button class="btn btn--sm btn--danger f-del" title="删除字段">×</button>
    </div>
    <div class="fr-opt ${isSelect ? '' : 'hidden'}" data-for="select">
      <div class="opt-mode">
        <label><input type="radio" name="optmode_${idx}" value="manual" ${optMode === 'manual' ? 'checked' : ''}> 手动输入</label>
        <label><input type="radio" name="optmode_${idx}" value="set" ${optMode === 'set' ? 'checked' : ''}> 关联选项模板</label>
        <span class="dim ml">下拉选项过多时建议关联「选项模板」并在填写页支持搜索</span>
      </div>
      <input class="input f-opt-manual" value="${esc(optMode === 'manual' ? optVal : '')}" placeholder="选项（逗号分隔，如下：男,女,其他）" ${optMode === 'manual' ? '' : 'disabled'}>
      <select class="select f-opt-set" ${optMode === 'set' ? '' : 'disabled'}>
        <option value="">— 选择选项模板 —</option>
        ${optionSets.map(o => `<option value="${o.id}" ${f.option_set_id === o.id ? 'selected' : ''}>${esc(o.name)}（${o.count} 项）</option>`).join('')}
      </select>
    </div>
  </div>`;
}

function renderFields() {
  const box = document.getElementById('field-list');
  if (!box) return;
  box.innerHTML = editorFields.map((f, i) => fieldRowHtml(f, i)).join('') ||
    '<div class="muted" id="no-fields">尚未添加字段，可上传 docx 自动解析或手动添加。</div>';
  box.querySelectorAll('.field-row').forEach(row => {
    const idx = +row.dataset.idx;
    row.querySelector('.f-type').addEventListener('change', (e) => {
      const opt = row.querySelector('.f-opt');
      const frOpt = row.querySelector('.fr-opt');
      const isSel = e.target.value === 'select';
      frOpt.classList.toggle('hidden', !isSel);
    });
    // 选项模式切换
    row.querySelectorAll('input[name^="optmode_"]').forEach(r => {
      r.addEventListener('change', () => {
        const manual = row.querySelector('.f-opt-manual');
        const set = row.querySelector('.f-opt-set');
        const useSet = row.querySelector('input[name^="optmode_"]:checked').value === 'set';
        manual.disabled = useSet; set.disabled = !useSet;
      });
    });
    row.querySelector('.f-del').addEventListener('click', () => {
      editorFields.splice(idx, 1);
      renderFields();
    });
  });
}

function collectFields() {
  const rows = document.querySelectorAll('#field-list .field-row');
  const out = [];
  rows.forEach(row => {
    const name = row.querySelector('.f-name').value.trim();
    const raw = row.querySelector('.f-type').value;
    if (!name) return;
    const field = {
      name, raw_type: raw, type: typeLabel(raw),
      pattern: '', placeholder: '', hint: '',
      required: row.querySelector('.f-req').checked, unique: false,
    };
    if (raw === 'select') {
      const useSet = row.querySelector('input[name^="optmode_"]:checked').value === 'set';
      if (useSet) {
        field.option_set_id = row.querySelector('.f-opt-set').value || '';
        field.options = '';
      } else {
        field.options = row.querySelector('.f-opt-manual').value.trim();
        field.option_set_id = '';
      }
    }
    out.push(field);
  });
  return out;
}

async function openEditor(id) {
  editorFields = [];
  let name = '', category = '未分类', fileName = '';
  // 预先加载选项模板列表
  try { const os = await api.getOptionSets(); optionSets = os.data || []; } catch (_) { optionSets = []; }
  if (id) {
    const t = await api.getTemplate(id);
    const d = t.data;
    name = d.name; category = d.category || '未分类';
    fileName = d.file_name || '';
    editorFields = (d.fields || []).map(f => ({
      name: f.name, raw_type: f.raw_type || inferFieldType(f.name),
      options: f.options || '', option_set_id: f.option_set_id || '',
      required: !!f.required,
    }));
  }
  const modal = new Modal({
    title: id ? '编辑模板' : '新建模板', width: 720, confirmText: id ? '保存' : '创建',
    content: `
      <div class="field"><label>模板名称<span class="req">*</span></label>
        <input class="input" id="t-name" value="${esc(name)}" placeholder="如：奖学金申请表"></div>
      <div class="field"><label>分类</label>
        <input class="input" id="t-cat" value="${esc(category)}" placeholder="未分类"></div>
      <div class="field">
        <label>Word 模板文件（.docx，含 {{字段名}} 占位符，可选）</label>
        <div class="dropzone" id="t-drop">
          <input type="file" id="t-file" accept=".docx" hidden>
          <div class="dz-inner">
            <div class="dz-ico">⬆</div>
            <div class="dz-main"><b>点击选择</b> 或拖拽 Word 文件到此处</div>
            <div class="dz-sub">支持 .docx 格式，上传后自动解析字段；也可不上传直接手动添加字段</div>
            <div class="dz-file" id="dz-file"></div>
          </div>
        </div>
        <div class="muted mt">当前文件：${fileName ? esc(fileName) : '<span class="dim">未上传</span>'}</div>
      </div>
      <div class="toolbar" style="margin-bottom:8px"><b>字段</b>
        <button class="btn btn--sm" id="t-add">+ 添加字段</button>
        <button class="btn btn--sm" id="t-parse" style="display:none">解析已选文件</button></div>
      <div id="field-list"></div>`,
    onConfirm: async () => {
      const nm = document.getElementById('t-name').value.trim();
      if (!nm) throw new Error('模板名称不能为空');
      const fields = collectFields();
      if (!fields.length) throw new Error('请至少添加一个字段');
      if (!id) {
        const r = await api.createTemplate({
          name: nm, category: document.getElementById('t-cat').value.trim() || '未分类',
          file_base64: pendingFileBase64 || undefined,
          file_name: pendingFileName || '未上传文件.docx',
          fields,
        });
        if (r.code !== 0) throw new Error(r.message || '创建失败');
        toast('模板已创建', 'ok');
      } else {
        const r = await api.updateTemplate(id, { name: nm, category: document.getElementById('t-cat').value.trim() || '未分类', fields });
        if (r.code !== 0) throw new Error(r.message || '保存失败');
        toast('已保存', 'ok');
      }
      load();
    },
  });
  modal.render();
  renderFields();

  // 拖拽上传区
  const drop = document.getElementById('t-drop');
  const fileInput = document.getElementById('t-file');
  const fileLabel = document.getElementById('dz-file');
  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); drop.classList.remove('drag');
    const f = e.dataTransfer.files[0];
    if (f) { fileInput.files = e.dataTransfer.files; onFilePicked(f); }
  });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    if (f) onFilePicked(f);
  });
  function onFilePicked(f) {
    if (!f.name.toLowerCase().endsWith('.docx')) { toast('请选择 .docx 文件', 'err'); return; }
    fileName = f.name;
    pendingFileName = f.name;
    pendingFileBase64 = '';
    fileLabel.innerHTML = '已选择：<b>' + esc(f.name) + '</b> <span class="dim">（点击下方「解析」提取字段）</span>';
    document.getElementById('t-parse').style.display = '';
  }

  document.getElementById('t-add').addEventListener('click', () => {
    editorFields.push({ name: '', raw_type: 'text', options: '', option_set_id: '', required: true });
    renderFields();
  });
  document.getElementById('t-parse').addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) { toast('请先选择文件', 'err'); return; }
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch(window.location.origin + '/api/templates/parse', { method: 'POST', body: fd }).then(x => x.json());
    if (r.code !== 0 || !r.data.fields.length) { toast('未解析到字段', 'err'); return; }
    pendingFileBase64 = await fileToBase64(file);
    editorFields = r.data.fields.map(f => ({ name: f.name, raw_type: f.raw_type || 'text', options: f.options || '', option_set_id: '', required: f.required !== false }));
    renderFields();
    toast('已解析 ' + editorFields.length + ' 个字段', 'ok');
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result.split(',')[1]);
    fr.onerror = reject; fr.readAsDataURL(file);
  });
}

// ============ 分享 + 二维码（合并弹窗） ============
async function openShareAndQr(id) {
  // 强制用"用户当前访问的域名"作为 base，覆盖后端拼出的任何地址。
  // 详情：见后端 get_fill_base_url() 与 ?base= 参数；这里前端再兜底一层。
  const frontendBase = (window.location.origin || '').replace(/\/$/, '');
  const qrUrl = frontendBase
    ? `/api/templates/${id}/qrcode?base=${encodeURIComponent(frontendBase)}`
    : `/api/templates/${id}/qrcode`;
  const [qc, rinfo] = await Promise.all([
    fetch(qrUrl).then(r => r.json()),
    api.getTemplateRoster(id),
  ]);
  const d = qc.data || {};
  const linked = rinfo.data;
  const safeUrl = frontendBase ? `${frontendBase}/fill/${id}` : (d.url || '');
  const modal = new Modal({
    title: '分享与二维码', width: 520, showClose: true, confirmText: '关闭', onConfirm: null,
    content: `
      <div class="share-grid">
        <div class="share-left">
          <div class="field"><label>填写页地址</label>
            <div class="copy-box"><input class="input" id="share-url" value="${esc(safeUrl)}" readonly>
              <button class="btn btn--sm" id="btn-copy">复制</button></div></div>
          <div class="field"><label>短链 ID</label>
            <input class="input" value="${esc(id)}" readonly></div>
          ${linked ? `<div class="badge badge--ok">已关联名单：${esc(linked.roster_name)}（${linked.roster_total} 人）</div>`
                   : '<div class="muted">未关联名单，开放填写时无法校验身份</div>'}
          <button class="btn btn--primary mt" id="btn-link" style="width:100%">${linked ? '重新关联名单' : '关联名单'}</button>
        </div>
        <div class="share-right">
          ${d.image ? `<img src="${d.image}" class="qr-img" alt="二维码">` : '<div class="muted">二维码生成失败</div>'}
          <p class="muted" style="text-align:center">微信 / 浏览器扫码填写</p>
        </div>
      </div>`,
  });
  modal.render();
  modal._el.querySelector('#btn-link').addEventListener('click', () => {
    modal.close();
    openLinkRoster(id, linked);
  });
  modal._el.querySelector('#btn-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(safeUrl); toast('已复制', 'ok'); }
    catch (_) { toast('复制失败，请手动选择', 'err'); }
  });
}

// ============ 关联名单 ============
async function openLinkRoster(id, current) {
  const rosters = await api.getRoster();
  const list = rosters.data || [];
  const modal = new Modal({
    title: '关联名单', width: 480, confirmText: '关联',
    content: `
      <div class="field"><label>选择名单</label>
        <select class="select" id="lk-rid">${list.map(r => `<option value="${r.id}" ${current && current.roster_id == r.id ? 'selected' : ''}>${esc(r.name)}（${r.total}人）</option>`).join('') || '<option value="">暂无名单</option>'}</select></div>
      <div class="row">
        <div class="field"><label>学号字段</label><input class="input" id="lk-id" value="${esc(current ? current.id_field : '学号')}"></div>
        <div class="field"><label>姓名字段</label><input class="input" id="lk-name" value="${esc(current ? current.name_field : '姓名')}"></div>
      </div>
      <p class="muted">关联后，填写页将校验学号+姓名，未在名单中者无法提交；可在「提交记录」查看每位名单成员的填写进度。</p>`,
    onConfirm: async () => {
      const rid = document.getElementById('lk-rid').value;
      if (!rid) throw new Error('请先创建名单');
      await api.linkRoster(id, rid, document.getElementById('lk-id').value.trim(), document.getElementById('lk-name').value.trim());
      toast('已关联', 'ok');
      load();
    },
  });
  modal.render();
}

load();
