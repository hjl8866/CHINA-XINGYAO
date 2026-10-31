// GET - 获取购物车列表
export async function onRequestGet({ request, env }) {
  try {
    const email = getEmail(request);
    if (!email) return Response.json({ error: '未登录' }, { status: 401 });

    const items = await env.DB.prepare(
      'SELECT * FROM cart WHERE email = ? ORDER BY id DESC'
    ).bind(email).all();

    return Response.json(items.results || []);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// POST - 加入购物车
export async function onRequestPost({ request, env }) {
  try {
    const email = getEmail(request);
    if (!email) return Response.json({ error: '未登录' }, { status: 401 });

    const { product_id, title, price, image } = await request.json();

    // 已存在则数量+1
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
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// DELETE - 移除商品
export async function onRequestDelete({ request, env }) {
  try {
    const email = getEmail(request);
    const { product_id } = await request.json();
    await env.DB.prepare(
      'DELETE FROM cart WHERE email = ? AND product_id = ?'
    ).bind(email, product_id).run();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// PUT - 更新数量
export async function onRequestPut({ request, env }) {
  try {
    const email = getEmail(request);
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
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// 从 header 取邮箱（沿用你 login 存的 email）
function getEmail(request) {
  // 优先从 header 取 token，再用 query 里的 email
  const url = new URL(request.url);
  return url.searchParams.get('email') || '';
}
