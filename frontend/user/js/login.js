// frontend/user/js/login.js
import { api, setCurrentUser, toast, Modal } from '/admin/js/common.js';

const form = document.getElementById('loginForm');
const btn = document.getElementById('submitBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const ident = document.getElementById('ident').value.trim();
  const password = document.getElementById('pwd').value;
  if (!ident || !password) { toast('请输入账号和密码', 'err'); return; }
  btn.disabled = true; btn.textContent = '登录中…';
  try {
    const r = await api.login({ ident, password });
    setCurrentUser(r.data);
    toast('登录成功', 'ok');
    setTimeout(() => { window.location.href = r.data.home || '/user/pool.html'; }, 350);
  } catch (err) {
    toast(err.message || '登录失败', 'err');
    btn.disabled = false; btn.textContent = '登 录';
  }
});

// 忘记密码：提交改密申请（公开接口）
const forgotLink = document.getElementById('forgotLink');
if (forgotLink) {
  forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    const m = new Modal({
      title: '忘记密码', confirmText: '提交申请',
      content: `
        <div class="field"><label>账号（手机号或邮箱）</label><input class="input" id="fp-ident" placeholder="请输入注册时的手机号 / 邮箱"></div>
        <div class="field"><label>想要设置的新密码（选填）</label><input class="input" id="fp-pwd" type="password" placeholder="不填则由系统生成临时密码"></div>
        <div class="field"><label>备注（选填）</label><input class="input" id="fp-note" placeholder="可说明情况，方便管理员核实"></div>
        <div class="auth-note">提交后管理员会在「通知」中收到申请，批准后新密码即刻生效，并以站内通知告知。</div>`,
      onConfirm: async () => {
        const ident = document.getElementById('fp-ident').value.trim();
        const new_password = document.getElementById('fp-pwd').value;
        const note = document.getElementById('fp-note').value.trim();
        if (!ident) throw new Error('请输入账号');
        if (new_password && new_password.length < 6) throw new Error('新密码至少 6 位');
        const r = await api.requestPasswordReset({ ident, new_password, note });
        if (r.code !== 0) throw new Error(r.message || '提交失败');
        toast('申请已提交，请等待管理员处理', 'ok', 4000);
      },
    });
    m.render();
  });
}
