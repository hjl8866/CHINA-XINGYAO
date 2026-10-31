export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');

    if (!email) {
      return Response.json({ error: '未登录' }, { status: 401 });
    }

    const orders = await env.DB.prepare(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC'
    ).bind(email).all();

    return Response.json(orders.results || []);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
