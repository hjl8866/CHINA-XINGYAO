export async function onRequestPost({ request, env }) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    if (!email) return Response.json({ error: '未登录' }, { status: 401 });

    let body = {};
    try { body = await request.json(); } catch(e) {}

    const items = body.items || [];
    const total = body.total || 0;
    const buyerName = body.buyer_name || email.split('@')[0];
    if (!items.length) return Response.json({ error: '购物车为空' }, { status: 400 });

    // 1. 建表
    await env.DB.exec("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, buyer_name TEXT, items TEXT, total INTEGER, created_at TEXT)");
    
    // 2. 兼容旧表
    try {
      await env.DB.prepare("INSERT INTO orders (email, buyer_name, items, total, created_at) VALUES ('__test__', 't', '[]', 0, '')").run();
      await env.DB.prepare("DELETE FROM orders WHERE email='__test__'").run();
    } catch(e) {
      if (e.message.includes('no column named')) {
        await env.DB.exec("DROP TABLE orders");
        await env.DB.exec("CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, buyer_name TEXT, items TEXT, total INTEGER, created_at TEXT)");
      } else {
        throw e;
      }
    }

    const orderNo = 'XY' + Date.now();

    // 3. 写入订单
    await env.DB.prepare("INSERT INTO orders (email, buyer_name, items, total, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(email, buyerName, JSON.stringify(items), total, new Date().toISOString()).run();

    // 4. 清空购物车
    await env.DB.prepare("DELETE FROM cart WHERE email = ?").bind(email).run();

    // 5. 邮件
    if (env.RESEND_API_KEY) {
      const itemText = items.map(function(i) {
        return (i.title || '商品') + ' × ' + (i.quantity || 1) + ' (¥' + ((i.price||0)*(i.quantity||1)) + ')';
      }).join('<br>');

      // 买家邮件
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + env.RESEND_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'onboarding@resend.dev',
            to: email,
            subject: '订单结算成功 - 星耀商城',
            html: '<h3>下单成功！</h3><p>订单号：' + orderNo + '</p><p>姓名：' + buyerName + '</p><p>商品：<br>' + itemText + '</p><p>合计：¥' + total + '</p>'
          })
        });
      } catch(e) { console.log('buyer mail failed: ' + e.message); }

      // 商家邮件（你的）
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + env.RESEND_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'onboarding@resend.dev',
            to: 'xingyao9110119@163.com',
            subject: '【新订单】' + orderNo + ' - ¥' + total,
            html: '<h3>🔥 新订单！</h3>' +
                  '<p><b>订单号：</b>' + orderNo + '</p>' +
                  '<p><b>买家姓名：</b>' + buyerName + '</p>' +
                  '<p><b>买家邮箱：</b>' + email + '</p>' +
                  '<p><b>商品：</b><br>' + itemText + '</p>' +
                  '<p><b>合计：</b>¥' + total + '</p>' +
                  '<p><b>时间：</b>' + new Date().toLocaleString() + '</p>'
          })
        });
      } catch(e) { console.log('admin mail failed: ' + e.message); }
    }

    return new Response(JSON.stringify({ ok: true, order_no: orderNo }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: '异常: ' + err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
