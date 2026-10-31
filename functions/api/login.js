export async function onRequestPost({ request, env }) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return Response.json({ error: '邮箱和密码不能为空' }, { status: 400 });
  }

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? AND password = ?')
    .bind(email, password).first();

  if (!user) {
    return Response.json({ error: '邮箱或密码错误' }, { status: 401 });
  }

  // 生成简单 token
  const token = btoa(user.id + ':' + Date.now());
  await env.DB.prepare('UPDATE users SET token = ? WHERE id = ?')
    .bind(token, user.id).run();

  return Response.json({ ok: true, token, msg: '登录成功' });
}
