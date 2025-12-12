/**
 * WebSocket Worker
 * 处理实时消息通信，路由到对应的Durable Object
 */
import AuthorizationDurableObject from './authorization-durable-object.js';
import ConversationDurableObject from './conversation-durable-object.js';

/**
 * 主fetch处理函数
 * 路由请求到对应的Durable Object
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 处理WebSocket连接
    if (request.headers.get('Upgrade') === 'websocket') {
      // WebSocket连接路由到Authorization Durable Object
      const authId = env.AUTHORIZATION_DURABLE_OBJECT.idFromName('default');
      const authStub = env.AUTHORIZATION_DURABLE_OBJECT.get(authId);
      return authStub.fetch(request);
    }
    
    // 处理HTTP请求
    if (url.pathname.startsWith('/channel/')) {
      // 频道相关请求路由到Conversation Durable Object
      // 这里我们使用频道ID作为Durable Object的名称，确保每个频道有独立的实例
      const channelId = url.pathname.split('/')[2];
      const conversationId = env.CONVERSATION_DURABLE_OBJECT.idFromName(channelId || 'default');
      const conversationStub = env.CONVERSATION_DURABLE_OBJECT.get(conversationId);
      return conversationStub.fetch(request);
    } else {
      // 其他请求路由到Authorization Durable Object
      const authId = env.AUTHORIZATION_DURABLE_OBJECT.idFromName('default');
      const authStub = env.AUTHORIZATION_DURABLE_OBJECT.get(authId);
      return authStub.fetch(request);
    }
  }
};

// 导出Durable Object类，以便在wrangler.toml中引用
export {
  AuthorizationDurableObject,
  ConversationDurableObject
};