// frontend/admin/js/dashboard.js
import { api, initShell, toast, esc, fmtDate, icon } from './common.js';

initShell('dashboard');
const content = document.getElementById('content');

async function load() {
  content.innerHTML = '<div class="card"><div class="card-body muted">加载中…</div></div>';
  try {
    const [tpls, subs, users, rosters] = await Promise.all([
      api.getTemplates(), api.getSubmissions(), api.getUsers(), api.getRoster(),
    ]);
    const tList = tpls.data || [];
    const sList = subs.data || [];
    const uList = users.data || [];
    const rList = rosters.data || [];
    const tplName = {};
    tList.forEach(t => { tplName[t.id] = t.name; });

    // 统计今日新增提交
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = sList.filter(s => (s.created_at || '').startsWith(today)).length;

    content.innerHTML = `
      <div class="stat-grid">
        ${statCard(tList.length, '模板总数', 'templates', 'brand')}
        ${statCard(sList.length, '提交记录', 'submissions', 'ok')}
        ${statCard(todayCount, '今日提交', 'edit', 'warn')}
        ${statCard(rList.length, '名单数', 'roster', '')}
      </div>

      <div class="card mt">
        <div class="card-head"><h2>快速操作</h2></div>
        <div class="card-body">
          <div class="quick-grid">
            <a class="quick" href="templates.html">${icon('plus', 18)}<div><div class="t">新建模板</div><div class="d">创建 / 上传 docx 解析</div></div></a>
            <a class="quick" href="roster.html">${icon('upload', 18)}<div><div class="t">上传名单</div><div class="d">导入 Excel 自动去重</div></div></a>
            <a class="quick" href="submissions.html">${icon('download', 18)}<div><div class="t">导出记录</div><div class="d">批量导出为 zip</div></div></a>
            <a class="quick" href="settings.html">${icon('settings', 18)}<div><div class="t">站点设置</div><div class="d">域名 · 保留策略</div></div></a>
          </div>
        </div>
      </div>

      <div class="grid mt" style="grid-template-columns:repeat(auto-fit,minmax(380px,1fr))">
        <div class="card">
          <div class="card-head"><h2>最近模板</h2><a class="link" href="templates.html">查看全部 ${icon('arrow-right',16)}</a></div>
          <div class="card-body" style="padding:0">
            ${tList.length ? `<table class="table"><thead><tr><th>名称</th><th>分类</th><th>状态</th><th>更新时间</th></tr></thead>
              <tbody>${tList.slice(0, 5).map(t => `<tr>
                <td><b>${esc(t.name)}</b></td>
                <td>${esc(t.category || '未分类')}</td>
                <td>${statusBadge(t.status)}</td>
                <td class="muted">${fmtDate(t.updated_at)}</td></tr>`).join('')}</tbody></table>`
            : `<div class="empty">${icon('templates', 30)}<div>暂无模板，请前往「模板管理」创建</div></div>`}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h2>最近提交</h2><a class="link" href="submissions.html">查看全部 ${icon('arrow-right',16)}</a></div>
          <div class="card-body" style="padding:0">
            ${sList.length ? `<table class="table"><thead><tr><th>提交人</th><th>模板</th><th>时间</th></tr></thead>
              <tbody>${sList.slice(0, 5).map(s => `<tr>
                <td><b>${esc(s.submitter || s.submitter_id || '匿名')}</b></td>
                <td class="muted">${esc(tplName[s.template_id] || '-')}</td>
                <td class="muted">${fmtDate(s.created_at)}</td></tr>`).join('')}</tbody></table>`
            : `<div class="empty">${icon('submissions', 30)}<div>暂无提交记录</div></div>`}
          </div>
        </div>
      </div>`;
  } catch (e) {
    content.innerHTML = `<div class="card"><div class="card-body" style="color:var(--danger)">加载失败：${esc(e.message)}</div></div>`;
  }
}

function statCard(num, label, ic, variant) {
  const v = variant ? ' stat--' + variant : '';
  return `<div class="card stat${v}">${icon(ic, 22)}<div><div class="num">${num}</div><div class="lbl">${label}</div></div></div>`;
}
function statusBadge(s) {
  if (s === 'published') return '<span class="badge badge--ok">已发布</span>';
  return '<span class="badge badge--draft">草稿</span>';
}

load();