export async function onRequestPost({ request, env }) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');

    if (!email) {
      return Response.json({ error: '未登录' }, { status: 401 });
    }

    // 检查 DB 是否绑定
    if (!env.DB) {
      return Response.json({ error: '数据库未绑定(DB缺失)' }, { status: 500 });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      body = {};
    }

    const items = body.items || [];
    const total = body.total || 0;

    if (!items.length) {
      return Response.json({ error: '购物车为空' }, { status: 400 });
    }

    // 建表
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT,
        items TEXT,
        total INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ).run();

    const orderNo = 'XY' + Date.now();

    // 写订单
    await env.DB.prepare(
      'INSERT INTO orders (email, items, total) VALUES (?, ?, ?)'
    ).bind(email, JSON.stringify(items), total).run();

    // 清空购物车
    await env.DB.prepare(
      'DELETE FROM cart WHERE email = ?'
    ).bind(email).run();

    // 发邮件
    if (env.RESEND_API_KEY) {
      try {
        const itemList = items.map(i => `${i.title || '商品'} × ${i.quantity || 1}`).join('<br>');
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + env.RESEND_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: "onboarding@resend.dev",
            to: email,
            subject: '订单结算成功 - 星耀商城',
            html: '<h2>订单结算成功！</h2><p>订单号：<strong>' + orderNo + '</strong></p><p>商品：<br>' + itemList + '</p><p><strong>合计：¥' + total + '</strong></p>'
          })
        });
      } catch (e) {
        console.log('邮件失败:', e.message);
      }
    }

    return Response.json({ ok: true, order_no: orderNo });
  } catch (err) {
    // 关键：把真实错误返回给前端
    return Response.json({ error: '后端报错: ' + err.message }, { status: 500 });
  }
}
