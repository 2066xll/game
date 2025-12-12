/**
 * 测试端点
 */
export async function onRequest(context) {
  return new Response(JSON.stringify({
    success: true,
    message: 'Pages Functions is working!',
    timestamp: new Date().toISOString()
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    status: 200
  });
}
