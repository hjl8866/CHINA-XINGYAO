export async function onRequest() {
  return new Response(JSON.stringify({ok:true,msg:"pong"}), {
    headers:{"Content-Type":"application/json"}
  });
}
