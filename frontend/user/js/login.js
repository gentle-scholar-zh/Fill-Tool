// frontend/user/js/login.js
import { api, setCurrentUser, toast, renderChangelog } from '/admin/js/common.js';

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

renderChangelog(document.getElementById('changelog'));
