// ChatRoomDurableObject专用worker入口文件
import ChatRoomDurableObject from './chatRoomDurableObject.js';

// 基本的fetch处理程序，满足Cloudflare Worker的要求
async function fetch(request, env) {
  return new Response('ChatRoomDurableObject Worker is running', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain'
    }
  });
}

// 导出Durable Object类和fetch处理程序
export { ChatRoomDurableObject };
export default { fetch };
