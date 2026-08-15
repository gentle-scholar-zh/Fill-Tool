// frontend/user/js/register.js
import { api, toast, renderChangelog } from '/admin/js/common.js';

const form = document.getElementById('regForm');
const btn = document.getElementById('submitBtn');
const roleSel = document.getElementById('role');
const sidReq = document.getElementById('sidReq');

// 学号必填标记随角色变化
function syncSid() {
  sidReq.style.visibility = roleSel.value === 'student' ? 'visible' : 'hidden';
}
roleSel.addEventListener('change', syncSid);
syncSid();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const role = roleSel.value;
  const payload = {
    role,
    name: document.getElementById('name').value.trim(),
    email: document.getElementById('email').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    class_name: document.getElementById('class_name').value.trim(),
    student_id: document.getElementById('student_id').value.trim(),
    password: document.getElementById('pwd').value,
    confirm_password: document.getElementById('pwd2').value,
  };
  if (!payload.name) { toast('请填写姓名', 'err'); return; }
  if (!payload.phone && !payload.email) { toast('手机号或邮箱至少填写一项', 'err'); return; }
  if (role === 'student' && !payload.student_id) { toast('学生必须填写学号', 'err'); return; }
  if (payload.password.length < 6) { toast('密码至少 6 位', 'err'); return; }
  if (payload.password !== payload.confirm_password) { toast('两次密码不一致', 'err'); return; }

  btn.disabled = true; btn.textContent = '注册中…';
  try {
    const r = await api.register(payload);
    toast('注册成功，请登录', 'ok');
    setTimeout(() => { window.location.href = '/user/login.html'; }, 600);
  } catch (err) {
    toast(err.message || '注册失败', 'err');
    btn.disabled = false; btn.textContent = '注 册';
  }
});

renderChangelog(document.getElementById('changelog'));
