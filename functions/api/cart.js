import { getUserByToken } from './auth.js';

export async function onRequest({ request, env }) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
  const user = await getUserByToken(env, token);
  if (!user) return Response.json({ error: '未登录' }, { status: 401 });

  const method = request.method;

  if (method === 'GET') {
    const items = await env.DB.prepare('SELECT * FROM carts WHERE user_id = ?').bind(user.id).all();
    return Response.json({ ok: true, data: items.results });
  }

  if (method === 'POST') {
    const { name, img, price, qty } = await request.json();
    const exist = await env.DB.prepare('SELECT * FROM carts WHERE user_id = ? AND product_name = ?')
      .bind(user.id, name).first();
    if (exist) {
      await env.DB.prepare('UPDATE carts SET qty = qty + ? WHERE id = ?').bind(qty || 1, exist.id).run();
    } else {
      await env.DB.prepare('INSERT INTO carts (user_id, product_name, product_img, price, qty) VALUES (?,?,?,?,?)')
        .bind(user.id, name, img, price, qty || 1).run();
    }
    return Response.json({ ok: true });
  }

  if (method === 'PUT') {
    const { id, qty } = await request.json();
    if (qty <= 0) {
      await env.DB.prepare('DELETE FROM carts WHERE id = ? AND user_id = ?').bind(id, user.id).run();
    } else {
      await env.DB.prepare('UPDATE carts SET qty = ? WHERE id = ? AND user_id = ?').bind(qty, id, user.id).run();
    }
    return Response.json({ ok: true });
  }

  if (method === 'DELETE') {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    await env.DB.prepare('DELETE FROM carts WHERE id = ? AND user_id = ?').bind(id, user.id).run();
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
