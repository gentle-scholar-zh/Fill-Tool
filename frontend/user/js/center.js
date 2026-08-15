// frontend/user/js/center.js —— 学生个人中心：我的提交历史 + 修改入口
import { api, esc, toast, logout as doLogout, icon } from '/admin/js/common.js';

const me = (() => { try { return JSON.parse(localStorage.getItem('ft_user') || 'null'); } catch (_) { return null; } })();
if (!me) { window.location.replace('/user/login.html?redirect=' + encodeURIComponent('/user/center.html')); }

document.getElementById('who').textContent = (me ? me.name : '') + ' · ' + (me && me.role === 'teacher' ? '教师' : me && me.role === 'admin' ? '管理员' : '学生');
document.getElementById('logout').addEventListener('click', doLogout);
document.getElementById('btnBack').addEventListener('click', () => { window.location.href = '/user/pool.html'; });

const list = document.getElementById('list');

(async function boot() {
  try {
    const r = await api.getSubmissionsMine();
    const items = r.data || [];
    if (!items.length) {
      list.innerHTML = `<div class="pool-empty">你还没有提交过任何模板。<a href="/user/pool.html" style="color:var(--brand)">去填写 ${icon('arrow-right',16)}</a></div>`;
      return;
    }
    list.innerHTML = items.map(it => `
      <div class="center-item" data-id="${it.id}" data-tid="${it.template_id}">
        <div class="ci-hd"><b>${esc(it.template_name || '未命名模板')}</b><span class="badge badge--ok">v${it.version || 1}</span></div>
        <div class="ci-sub">提交时间：${esc(it.submitted_at || '')} · 已修改 ${it.edit_count || 0} 次</div>
        <div class="ci-ft">
          <button class="btn btn--primary" data-act="edit" type="button">修改</button>
          ${it.download_url ? `<a class="btn btn--ghost" href="${it.download_url}" style="width:auto;margin:0;text-decoration:none;text-align:center">下载</a>` : ''}
        </div>
      </div>`).join('');
    list.querySelectorAll('.center-item').forEach(card => {
      card.querySelector('[data-act="edit"]').addEventListener('click', () => {
        window.location.href = `/user/pool.html?tid=${card.dataset.tid}&sid=${card.dataset.id}`;
      });
    });
  } catch (e) {
    if (e.message && e.message.includes('401')) { window.location.replace('/user/login.html'); return; }
    list.innerHTML = '<div class="pool-empty">加载失败：' + esc(e.message) + '</div>';
  }
})();
