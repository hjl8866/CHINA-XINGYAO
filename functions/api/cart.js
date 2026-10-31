export async function onRequest({ request, env }) {
  const method = request.method;
  const url = new URL(request.url);
  const email = url.searchParams.get('email');

  if (!email) {
    return Response.json({ error: '未登录' }, { status: 401 });
  }

  // 确保表存在
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      product_id TEXT,
      title TEXT,
      price INTEGER,
      image TEXT,
      quantity INTEGER DEFAULT 1
    )`
  ).run();

  // GET - 获取购物车列表
  if (method === 'GET') {
    const items = await env.DB.prepare(
      'SELECT * FROM cart WHERE email = ? ORDER BY id DESC'
    ).bind(email).all();
    return Response.json(items.results || []);
  }

  // POST - 加入购物车
  if (method === 'POST') {
    const { product_id, title, price, image } = await request.json();

    const exist = await env.DB.prepare(
      'SELECT id, quantity FROM cart WHERE email = ? AND product_id = ?'
    ).bind(email, product_id).first();

    if (exist) {
      await env.DB.prepare(
        'UPDATE cart SET quantity = quantity + 1 WHERE id = ?'
      ).bind(exist.id).run();
    } else {
      await env.DB.prepare(
        'INSERT INTO cart (email, product_id, title, price, image, quantity) VALUES (?, ?, ?, ?, ?, 1)'
      ).bind(email, product_id, title, price, image || '').run();
    }

    return Response.json({ ok: true, msg: '已加入购物车' });
  }

  // PUT - 更新数量
  if (method === 'PUT') {
    const { product_id, quantity } = await request.json();

    if (quantity <= 0) {
      await env.DB.prepare(
        'DELETE FROM cart WHERE email = ? AND product_id = ?'
      ).bind(email, product_id).run();
    } else {
      await env.DB.prepare(
        'UPDATE cart SET quantity = ? WHERE email = ? AND product_id = ?'
      ).bind(quantity, email, product_id).run();
    }

    return Response.json({ ok: true });
  }

  // DELETE - 删除商品
  if (method === 'DELETE') {
    const { product_id } = await request.json();
    await env.DB.prepare(
      'DELETE FROM cart WHERE email = ? AND product_id = ?'
    ).bind(email, product_id).run();
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
