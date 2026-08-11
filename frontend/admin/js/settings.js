// frontend/admin/js/settings.js
import { api, initShell, toast, esc } from './common.js';

initShell('settings');
const content = document.getElementById('content');

// 内网穿透域名特征：识别后自动清空（用户明确要求删除无用配置）
const PENETRATION_RE = /(lhr\.life|ihl\.life|frp|ngrok|cpolar|oray|peanut|localhost\.run|serveo|tunnel\.|cloudflare\.com\/.*tunnel)/i;

async function load() {
  content.innerHTML = '<div class="card"><div class="card-body muted">加载中…</div></div>';
  try {
    const [su, set] = await Promise.all([api.getSiteUrl(), api.getSettings()]);
    const d = su.data || {};
    const settings = set.data || {};

    // 自动清理残留的内网穿透地址
    if (d.site_url && PENETRATION_RE.test(d.site_url)) {
      await api.setSiteUrl('');
      d.site_url = '';
      toast('已自动清空残留的内网穿透地址', 'ok');
    }

    content.innerHTML = `
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(360px,1fr))">
        <div class="card">
          <div class="card-head"><h2>站点访问地址</h2></div>
          <div class="card-body">
            <p class="muted mb">默认通过本机局域网 IP 自动生成填写页地址；如需绑定固定域名，可在此设置。</p>
            <div class="row">
              <div class="field" style="flex:1"><label>固定域名（可选，留空则用自动地址）</label>
                <input class="input" id="site-url" value="${esc(d.site_url || '')}" placeholder="例如 http://fill.local:5000"></div>
              <div class="field" style="flex:0;align-self:flex-end">
                <button class="btn btn--primary" id="btn-save-url">保存</button></div>
            </div>
            <div class="between mt" style="padding:10px 12px;background:var(--bg-2);border-radius:var(--radius-sm)">
              <span class="muted">当前自动地址</span>
              <b style="font-size:13px">${esc(d.current || '-')}</b>
            </div>
            <div class="muted mt" style="font-size:12px">本机局域网 IP：<b>${esc(d.lan_ip || '未检测到')}</b></div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h2>数据保留策略</h2></div>
          <div class="card-body">
            <p class="muted mb">回收站中的模板与提交记录，超过设定天数后将自动永久删除。</p>
            <div class="row">
              <div class="field" style="flex:1"><label>回收站保留天数</label>
                <input class="input" id="retention" type="number" min="1" max="365" value="${esc(settings.retention_days || 30)}"></div>
              <div class="field" style="flex:0;align-self:flex-end">
                <button class="btn btn--primary" id="btn-save-ret">保存</button></div>
            </div>
          </div>
        </div>
      </div>
      <div class="card mt">
        <div class="card-head"><h2>系统信息</h2></div>
        <div class="card-body">
          <div class="row" style="font-size:13px">
            <div><span class="muted">服务地址：</span><b>${esc(window.location.origin)}</b></div>
            <div><span class="muted">版本：</span><b>v2.0</b></div>
            <div><span class="muted">数据库：</span><b>本地 SQLite</b></div>
          </div>
        </div>
      </div>`;
    content.querySelector('#btn-save-url').addEventListener('click', async () => {
      const v = document.getElementById('site-url').value.trim();
      await api.setSiteUrl(v);
      toast('已保存', 'ok'); load();
    });
    content.querySelector('#btn-save-ret').addEventListener('click', async () => {
      const days = +document.getElementById('retention').value || 30;
      await api.updateRetention(days);
      toast('已保存', 'ok');
    });
  } catch (e) {
    content.innerHTML = `<div class="card"><div class="card-body" style="color:var(--danger)">加载失败：${esc(e.message)}</div></div>`;
  }
}

load();