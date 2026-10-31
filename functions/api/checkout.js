export async function onRequestPost({ request, env }) {
  try {
    // 1. 拿 email
    const url = new URL(request.url);
    const email = url.searchParams.get('email');

    if (!email) {
      return new Response(JSON.stringify({ error: '未登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. 拿请求体
    let items = [];
    let total = 0;
    try {
      const body = await request.json();
      items = body.items || [];
      total = body.total || 0;
    } catch (e) {
      return new Response(JSON.stringify({ error: '请求格式错误' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!items.length) {
      return new Response(JSON.stringify({ error: '购物车为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. 检查 DB 绑定
    if (!env.DB) {
      return new Response(JSON.stringify({ error: 'DB未绑定' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. 建 orders 表（用 exec，不用 prepare）
    await env.DB.exec(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      items TEXT,
      total INTEGER,
      created_at TEXT
    )`);

    // 5. 生成订单号
    const orderNo = 'XY' + Date.now();

    // 6. 写入订单
    await env.DB.prepare(
      'INSERT INTO orders (email, items, total, created_at) VALUES (?, ?, ?, ?)'
    ).bind(email, JSON.stringify(items), total, new Date().toISOString()).run();

    // 7. 清空购物车
    await env.DB.prepare(
      'DELETE FROM cart WHERE email = ?'
    ).bind(email).run();

    // 8. 发邮件（完全独立 try，绝不影响主流程）
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
        // 邮件失败不影响下单
        console.log('mail failed: ' + mailErr.message);
      }
    }

    // 9. 返回成功
    return new Response(JSON.stringify({ ok: true, order_no: orderNo }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    // 任何未捕获的异常，返回具体错误信息
    return new Response(JSON.stringify({ 
      error: '异常: ' + err.message,
      hint: '请检查D1表结构或联系开发者'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
