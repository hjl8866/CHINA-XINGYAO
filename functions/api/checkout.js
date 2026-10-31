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

    // ✅ 单行建表（D1 exec 必须单行，否则 incomplete input）
    await env.DB.exec("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, items TEXT, total INTEGER, created_at TEXT)");

    const orderNo = 'XY' + Date.now();

    await env.DB.prepare("INSERT INTO orders (email, items, total, created_at) VALUES (?, ?, ?, ?)")
      .bind(email, JSON.stringify(items), total, new Date().toISOString()).run();

    await env.DB.prepare("DELETE FROM cart WHERE email = ?").bind(email).run();

    if (env.RESEND_API_KEY) {
      try {
        const itemText = items.map(function(i) {
          return (i.title || '商品') + ' × ' + (i.quantity || 1);
        }).join(', ');
        
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + env.RESEND_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'onboarding@resend.dev',
            to: email,
            subject: '订单结算成功',
            html: '<p>订单号：' + orderNo + '</p><p>商品：' + itemText + '</p><p>合计：¥' + total + '</p>'
          })
        });
      } catch (mailErr) {
        console.log('mail failed: ' + mailErr.message);
      }
    }

    return new Response(JSON.stringify({ ok: true, order_no: orderNo }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ 
      error: '异常: ' + err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
