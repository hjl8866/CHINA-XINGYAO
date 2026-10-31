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

    // 1. 先尝试建表（单行，防截断）
    await env.DB.exec("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, items TEXT, total INTEGER, created_at TEXT)");
    
    // 2. 兼容旧表：尝试插入测试，若缺列则重建（不用 PRAGMA，防红叉）
    try {
      await env.DB.prepare("INSERT INTO orders (email, items, total, created_at) VALUES ('__test__', '[]', 0, '')").run();
      await env.DB.prepare("DELETE FROM orders WHERE email='__test__'").run();
    } catch(e) {
      if (e.message.includes('no column named') || e.message.includes('has no column')) {
        await env.DB.exec("DROP TABLE orders");
        await env.DB.exec("CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, items TEXT, total INTEGER, created_at TEXT)");
      } else {
        throw e;
      }
    }

    const orderNo = 'XY' + Date.now();

    // 3. 正式写入订单
    await env.DB.prepare("INSERT INTO orders (email, items, total, created_at) VALUES (?, ?, ?, ?)")
      .bind(email, JSON.stringify(items), total, new Date().toISOString()).run();

    // 4. 清空购物车
    await env.DB.prepare("DELETE FROM cart WHERE email = ?").bind(email).run();

    // 5. 发邮件（独立 try）
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

    // 6. 返回成功
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
