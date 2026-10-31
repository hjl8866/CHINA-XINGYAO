export async function onRequestPost({ request, env }) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return Response.json({ error: '邮箱和密码不能为空' }, { status: 400 });
  }

  // 检查用户是否已存在
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email).first();
  if (existing) {
    return Response.json({ error: '该邮箱已注册' }, { status: 409 });
  }

  // 插入新用户（密码明文存储，测试期够用）
  const result = await env.DB.prepare('INSERT INTO users (email, password, token) VALUES (?, ?, ?)')
    .bind(email, password, null).run();

  return Response.json({ ok: true, msg: '注册成功' });
}
