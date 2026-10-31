function escape(s) { return s.replace(/[^a-zA-Z0-9@._-]/g, ''); }

function hash(pwd) {
  let h = 0;
  for (let i = 0; i < pwd.length; i++) {
    h = ((h << 5) - h) + pwd.charCodeAt(i);
    h |= 0;
  }
  return btoa(h + ':' + pwd);
}

function makeToken(email) {
  return btoa(email + ':' + Date.now() + ':' + Math.random());
}

export async function getUserByToken(env, token) {
  if (!token) return null;
  try {
    const decoded = atob(token);
    const email = decoded.split(':')[0];
    const row = await env.DB.prepare('SELECT * FROM users WHERE email = ? AND session_token = ?')
      .bind(email, token).first();
    return row || null;
  } catch { return null; }
}

export async function onRequestPost({ request, env, params }) {
  const url = new URL(request.url);
  const action = url.pathname.split('/').pop();
  const { email, password } = await request.json();

  if (!email || !password) return Response.json({ error: '邮箱和密码必填' }, { status: 400 });
  const safeEmail = escape(email);

  if (action === 'register') {
    if (password.length < 6) return Response.json({ error: '密码至少6位' }, { status: 400 });
    const exist = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(safeEmail).first();
    if (exist) return Response.json({ error: '该邮箱已注册' }, { status: 409 });
    const token = makeToken(safeEmail);
    await env.DB.prepare('INSERT INTO users (email, password, session_token) VALUES (?, ?, ?)')
      .bind(safeEmail, hash(password), token).run();

    // 注册成功发欢迎邮件
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + env.RESEND_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: env.FROM_EMAIL,
          to: safeEmail,
          subject: '欢迎注册星耀商城',
          html: '<h2>欢迎加入星耀商城 🎉</h2><p>你的账号已注册成功，现在可以登录并同步购物车了。</p>'
        })
      });
    } catch (e) { console.log('邮件发送失败:', e); }

    return Response.json({ ok: true, token, email: safeEmail });
  }

  if (action === 'login') {
    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? AND password = ?')
      .bind(safeEmail, hash(password)).first();
    if (!user) return Response.json({ error: '邮箱或密码错误' }, { status: 401 });
    const token = makeToken(safeEmail);
    await env.DB.prepare('UPDATE users SET session_token = ? WHERE id = ?').bind(token, user.id).run();
    return Response.json({ ok: true, token, email: safeEmail });
  }

  return Response.json({ error: '未知操作' }, { status: 400 });
}
