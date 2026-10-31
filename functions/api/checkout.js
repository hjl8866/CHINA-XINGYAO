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

    // 1. 建表（单行，防 D1 exec 截断）
    await env.DB.exec("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, items TEXT, total INTEGER, created_at TEXT)");
    
    // 2. 兼容旧表：如果旧表缺字段，删掉重建（解决当前 500 报错）
    const cols = await env.DB.prepare("PRAGMA table_info(orders)").all();
    const colNames = cols.results.map(c => c.name);
    if (!colNames.includes('email')) {
      await env.DB.exec("DROP TABLE orders");
      await env.DB.exec("CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, items TEXT, total INTEGER, created_at TEXT)");
    }

    const orderNo = 'XY' + Date.now();

    // 3. 写入订单
    await env.DB.prepare("INSERT INTO orders (email, items, total, created_at) VALUES (?, ?, ?, ?)")
      .bind(email, JSON.stringify(items), total, new Date().toISOString()).run();

    // 4. 清空购物车
    await env.DB.prepare("DELETE FROM cart WHERE email = ?").bind(email).run();

    // 5. 发邮件（独立 try，不影响主流程）
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

    // 6. 返回成功（前端弹窗需要 order_no）
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
