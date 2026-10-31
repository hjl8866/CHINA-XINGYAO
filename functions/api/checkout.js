import { getUserByToken } from './auth.js';

export async function onRequestPost({ request, env }) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
  const user = await getUserByToken(env, token);
  if (!user) return Response.json({ error: '未登录' }, { status: 401 });

  const { items, total } = await request.json();

  // 生成订单
  await env.DB.prepare('INSERT INTO orders (user_id, items, total) VALUES (?, ?, ?)')
    .bind(user.id, JSON.stringify(items), total).run();

  // 清空购物车
  await env.DB.prepare('DELETE FROM carts WHERE user_id = ?').bind(user.id).run();

  // 发邮件通知
  try {
    const itemList = items.map(i => `${i.product_name} × ${i.qty}`).join('<br>');
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: user.email,
        subject: '订单结算成功 - 星耀商城',
        html: '<h2>订单结算成功！</h2><p>感谢你的购买，以下是订单详情：</p><p><strong>商品：</strong><br>' + itemList + '</p><p><strong>合计：¥' + total + '</strong></p><p>我们会尽快为你发货</p>'
      })
    });
  } catch (e) {
    console.log('邮件发送失败:', e);
  }

  return Response.json({ ok: true, msg: '结算成功' });
}
