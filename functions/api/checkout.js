export async function onRequestPost({ request, env }) {
  // 1. 先测试最基础的返回
  if (!env.DB) {
    return Response.json({ error: "DB未绑定！请检查Settings" }, { status: 500 });
  }
  
  return Response.json({ 
    ok: true, 
    msg: "函数活了，DB已绑定",
    db_exists: !!env.DB,
    resend_exists: !!env.RESEND_API_KEY
  });
}
