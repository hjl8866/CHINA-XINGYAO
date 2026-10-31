export async function onRequestPost({ request, env }) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json({ error: '邮箱和密码不能为空' }, { status: 400 });
    }

    // 查用户
    const user = await env.DB.prepare(
      'SELECT id, email, password FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      return Response.json({ error: '账号不存在' }, { status: 404 });
    }

    if (user.password !== password) {
      return Response.json({ error: '密码错误' }, { status: 401 });
    }

    // 生成 token（简单随机串，够用了）
    const token = crypto.randomUUID();

    // 存 token 到数据库
    await env.DB.prepare(
      'UPDATE users SET token = ? WHERE email = ?'
    ).bind(token, email).run();

    return Response.json({
      ok: true,
      msg: '登录成功',
      token: token,
      email: email
    });

  } catch (e) {
    return Response.json({ error: '服务器异常: ' + e.message }, { status: 500 });
  }
}
