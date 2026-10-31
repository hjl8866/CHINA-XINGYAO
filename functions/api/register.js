export async function onRequestPost({ request, env }) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json({ error: '邮箱和密码不能为空' }, { status: 400 });
    }

    // 检查是否已注册
    const exist = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (exist) {
      return Response.json({ error: '该邮箱已注册' }, { status: 409 });
    }

    // 插入新用户
    await env.DB.prepare(
      'INSERT INTO users (email, password, token) VALUES (?, ?, ?)'
    ).bind(email, password, null).run();

    return Response.json({ ok: true, msg: '注册成功' });

  } catch (e) {
    return Response.json({ error: '服务器异常: ' + e.message }, { status: 500 });
  }
}
