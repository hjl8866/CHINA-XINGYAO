export async function onRequestPost({ request, env }) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    if (!email) return Response.json({ error: '未登录' }, { status: 401 });

    let body = {};
    try { body = await request.json(); } catch(e) {}

    const items = body.items || [];
    const total = body.total || 0;
    if (!items.length) return Response.json({ error: '购物车为空' }, { status: 400 });

    // 确保表存在
    await env.DB.exec("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, items TEXT, total INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");

    const orderNo = 'XY' + Date.now();

    // 写订单
    await env.DB.prepare("INSERT INTO orders (email, items, total) VALUES (?, ?, ?)")
      .bind(email, JSON.stringify(items), total).run();

    // 清空购物车
    await env.DB.prepare("DELETE FROM cart WHERE email = ?").bind(email).run();

    // 邮件（非致命）
    if (env.RESEND_API_KEY) {
      try {
        const itemList = items.map(i => `${i.title || '商品'} × ${i.quantity || 1}`).join('<br>');
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: "onboarding@resend.dev", to: email,
            subject: '订单结算成功 - 星耀商城',
            html: '<h2>订单结算成功！</h2><p>订单号：<strong>' + orderNo + '</strong></p><p>商品：<br>' + itemList + '</p><p><strong>合计：¥' + total + '</strong></p><p>我们会尽快为你发货</p>'
          })
        });
      } catch(e) { console.log('邮件失败', e.message); }
    }

    // ✅ 关键：返回订单号
    return Response.json({ ok: true, order_no: orderNo });
  } catch (err) {
    return Response.json({ error: "后端异常: " + err.message }, { status: 500 });
  }
}
