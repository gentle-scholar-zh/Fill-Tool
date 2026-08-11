// frontend/admin/js/roster-categories.js —— 分组管理（管理端名词：分组 / 组）
import { api, initShell, toast, Modal, confirmDialog, esc } from './common.js';

initShell('roster-categories');
const content = document.getElementById('content');

async function load() {
  content.innerHTML = '<div class="card"><div class="card-body muted">加载中…</div></div>';
  try {
    const [cRes, rRes] = await Promise.all([api.getCategories(), api.getRoster()]);
    const cats = cRes.data || [];
    const rosters = rRes.data || [];
    // 按 category_id 归类名单
    const byCat = {};
    rosters.forEach(r => {
      const cid = r.category_id || '__none';
      (byCat[cid] = byCat[cid] || []).push(r);
    });
    window.__rosterByCat = byCat;
    window.__allRosters = rosters;

    content.innerHTML = `
      <div class="toolbar"><button class="btn btn--primary" id="btn-add">+ 新建分组</button>
        <span class="muted">共 ${cats.length} 个分组 · 用于归类名单，便于模板统一关联</span></div>
      <div class="card"><div class="card-body" style="padding:0">
        ${cats.length ? `<table class="table"><thead><tr><th>分组名称</th><th>关联名单数</th><th>已关联名单</th><th style="width:180px">操作</th></tr></thead>
          <tbody>${cats.map(c => rowHtml(c, byCat[c.id] || [])).join('')}</tbody></table>`
        : '<div class="empty"><span class="ico">▦</span>暂无分组，点击「新建分组」开始归类名单</div>'}
      </div></div>`;
    bind(cats, byCat);
  } catch (e) {
    content.innerHTML = `<div class="card"><div class="card-body" style="color:var(--danger)">加载失败：${esc(e.message)}</div></div>`;
  }
}

function rowHtml(c, rosters) {
  const names = rosters.map(r => `<span class="badge badge--brand">${esc(r.name)}</span>`).join(' ');
  return `<tr data-id="${c.id}"><td><b>${esc(c.name)}</b></td><td>${c.count || 0}</td>
    <td class="muted">${names || '<span class="dim">未关联名单</span>'}</td>
    <td class="actions">
      <button class="btn btn--xs" data-act="edit">重命名</button>
      <button class="btn btn--xs" data-act="link">管理名单</button>
      <button class="btn btn--xs btn--danger" data-act="del">删除</button>
    </td></tr>`;
}

function bind(cats, byCat) {
  content.querySelector('#btn-add').addEventListener('click', () => openEditor());
  content.querySelectorAll('tbody tr').forEach(tr => {
    const id = tr.dataset.id;
    tr.querySelector('[data-act="edit"]').addEventListener('click', () => openEditor(id));
    tr.querySelector('[data-act="link"]').addEventListener('click', () => openLinkRosters(id));
    tr.querySelector('[data-act="del"]').addEventListener('click', () => {
      confirmDialog('确定删除该分组？名单会自动变为「未分组」。', async () => {
        await api.deleteCategory(id); toast('已删除', 'ok'); load();
      });
    });
  });
}

function openEditor(id) {
  let name = '';
  if (id) name = (content.querySelector(`tr[data-id="${id}"] td b`) || {}).textContent || '';
  const modal = new Modal({
    title: id ? '重命名分组' : '新建分组', confirmText: id ? '保存' : '创建',
    content: `<div class="field"><label>分组名称</label><input class="input" id="c-name" value="${esc(name)}" placeholder="如：2024级"></div>`,
    onConfirm: async () => {
      const nm = document.getElementById('c-name').value.trim();
      if (!nm) throw new Error('名称不能为空');
      const r = id ? await api.updateCategory(id, nm) : await api.createCategory(nm);
      if (r.code !== 0) throw new Error(r.message || '操作失败');
      toast('已保存', 'ok');
    },
  });
  modal.render();
}

async function openLinkRosters(catId) {
  const all = window.__allRosters || [];
  const inCat = (window.__rosterByCat[catId] || []).map(r => r.id);
  const modal = new Modal({
    title: '管理分组名单', width: 480, confirmText: '保存',
    content: `
      <p class="muted">勾选要归入该分组的名单（取消勾选即移出）。每行右侧「关联模板」可将该名单绑定到填写模板——绑定后填写页会先校验学号/姓名，仅名单内人员可填写。</p>
      <div style="max-height:50vh;overflow:auto">
        ${all.length ? all.map(r => `<div class="roster-row">
            <label class="chk-row" style="flex:1;margin:0"><input type="checkbox" class="r-chk" value="${r.id}" ${inCat.includes(r.id) ? 'checked' : ''}> ${esc(r.name)}（${r.total}人）</label>
            <button class="btn btn--xs btn--ghost js-link" data-rid="${r.id}">关联模板</button>
          </div>`).join('')
        : '<div class="muted">暂无名单，请先到「名单管理」上传</div>'}
      </div>`,
    onConfirm: async () => {
      const checked = Array.from(modal._el.querySelectorAll('.r-chk:checked')).map(c => c.value);
      const toAdd = checked.filter(id => !inCat.includes(id));
      const toRemove = inCat.filter(id => !checked.includes(id));
      for (const rid of toAdd) await api.updateRoster(rid, { category_id: catId });
      for (const rid of toRemove) await api.updateRoster(rid, { category_id: '' });
      toast('已更新名单分组', 'ok');
      load();
    },
  });
  modal.render();
  modal._el.querySelectorAll('.js-link').forEach(b =>
    b.addEventListener('click', () => openLinkToTemplateInCat(b.dataset.rid, () => { modal.close(); load(); })));
}

async function openLinkToTemplateInCat(rosterId, after) {
  const tRes = await api.getTemplates();
  const templates = (tRes.data || []).filter(t => t.status === 'published');
  if (!templates.length) { toast('暂无可关联的已发布模板', 'err'); return; }
  const modal = new Modal({
    title: '关联名单到模板', width: 480, confirmText: '关联',
    content: `
      <div class="field"><label>选择模板</label>
        <select class="select" id="lk-tid">${templates.map(t => `<option value="${t.id}">${esc(t.name)}（${(t.fields || []).length} 字段）</option>`).join('')}</select></div>
      <div class="row">
        <div class="field"><label>学号字段</label><input class="input" id="lk-id" value="学号"></div>
        <div class="field"><label>姓名字段</label><input class="input" id="lk-name" value="姓名"></div>
      </div>
      <p class="muted">关联后，模板填写页将先要求输入学号+姓名核验身份，仅名单内人员可填写；重复姓名会生成多个独立名额。字段名需与名单表头完全一致。</p>`,
    onConfirm: async () => {
      const tid = document.getElementById('lk-tid').value;
      if (!tid) throw new Error('请选择模板');
      const idf = document.getElementById('lk-id').value.trim();
      const nmf = document.getElementById('lk-name').value.trim();
      if (!idf || !nmf) throw new Error('请填写学号/姓名字段名');
      await api.linkRoster(tid, rosterId, idf, nmf);
      toast('已关联，填写页将校验身份', 'ok');
      modal.close();
      if (after) after();
    },
  });
  modal.render();
}

load();
