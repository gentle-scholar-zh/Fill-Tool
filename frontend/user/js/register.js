// frontend/user/js/register.js
// 公共注册仅允许学生角色；teacher/admin 由超级管理员在后台创建
import { api, toast, renderChangelog } from '/admin/js/common.js';

const form = document.getElementById('regForm');
const btn = document.getElementById('submitBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    // role 字段前端不再需要传；后端强制为 student（防御客户端伪造）
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
  if (!payload.student_id) { toast('学生必须填写学号', 'err'); return; }
  if (payload.password.length < 6) { toast('密码至少 6 位', 'err'); return; }
  if (payload.password !== payload.confirm_password) { toast('两次密码不一致', 'err'); return; }

  btn.disabled = true; btn.textContent = '注册中…';
  try {
    await api.register(payload);
    toast('注册成功，请登录', 'ok');
    setTimeout(() => { window.location.href = '/user/login.html'; }, 600);
  } catch (err) {
    toast(err.message || '注册失败', 'err');
    btn.disabled = false; btn.textContent = '注 册';
  }
});

renderChangelog(document.getElementById('changelog'));
