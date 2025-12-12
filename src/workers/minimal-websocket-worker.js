/**
 * WebSocket Room Durable Object
 * 管理单个房间内的所有WebSocket连接
 */
class WebSocketRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // 存储房间内的所有WebSocket连接
    this.connections = new Map();
  }
  
  // 必须的fetch方法，用于处理所有发送到Durable Object的请求
  async fetch(request) {
    try {
      // 检查是否是WebSocket升级请求
      if (request.headers.get('Upgrade') === 'websocket') {
        // 创建WebSocket对
        const [client, server] = Object.values(new WebSocketPair());
        
        // 从URL获取用户ID
        const url = new URL(request.url);
        const token = url.searchParams.get('token') || 'anonymous';
        const userId = token.replace('mock-token-', '') || `user-${Date.now()}`;
        
        // 处理WebSocket连接
        this.handleWebSocket(server, userId);
        
        // 返回客户端连接
        return new Response(null, {
          status: 101,
          webSocket: client,
        });
      }
      
      // 非WebSocket请求返回400
      return new Response('Expected WebSocket connection', { status: 400 });
    } catch (error) {
      console.error('WebSocket处理错误:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }

  // 处理WebSocket连接
  async handleWebSocket(webSocket, userId) {
    // 接受WebSocket连接
    webSocket.accept();
    
    // 生成唯一的连接ID
    const connectionId = Date.now().toString();
    
    // 存储连接信息
    this.connections.set(connectionId, {
      id: connectionId,
      userId,
      ws: webSocket
    });
    
    // 发送欢迎消息
    try {
      webSocket.send(JSON.stringify({
        type: 'welcome',
        message: `欢迎加入聊天室！`,
        userId,
        connectionId,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error(`发送欢迎消息失败: ${e.message}`);
    }
    
    // 配置事件处理器
    webSocket.onmessage = async (event) => {
      try {
        // 异步处理消息，确保不会阻塞其他事件
        await this.handleMessage(connectionId, event.data, userId);
      } catch (e) {
        console.error(`处理消息事件失败: ${e.message}`, e.stack);
        // 尝试发送错误消息给客户端
        try {
          webSocket.send(JSON.stringify({
            type: 'error',
            message: '消息处理失败',
            error: e.message
          }));
        } catch (sendError) {
          console.error(`发送错误消息失败: ${sendError.message}`);
        }
      }
    };
    
    webSocket.onclose = () => {
      try {
        // 安全地删除连接，不尝试广播
        console.log(`连接 ${connectionId} 关闭`);
        this.connections.delete(connectionId);
      } catch (e) {
        console.error(`处理关闭事件失败: ${e.message}`);
      }
    };
    
    webSocket.onerror = (error) => {
      try {
        console.error(`WebSocket错误 - 连接ID: ${connectionId}: ${error.message}`);
        this.connections.delete(connectionId);
      } catch (e) {
        console.error(`处理错误事件失败: ${e.message}`);
      }
    };
  }

  // 处理接收到的消息
  async handleMessage(connectionId, message, userId) {
    try {
      // 解析消息
      let parsedMessage;
      try {
        parsedMessage = JSON.parse(message);
      } catch {
        parsedMessage = { content: message };
      }
      
      // 创建消息对象
      const chatMessage = {
        type: 'chat_message',
        senderId: userId,
        content: parsedMessage.content || message,
        timestamp: Date.now(),
        messageId: parsedMessage.messageId || Date.now(),
        roomId: this.roomId || 'default',
        sequenceId: this._getNextSequenceId()
      };
      
      // 确保连接仍然有效
      const connection = this.connections.get(connectionId);
      if (!connection || !connection.ws) {
        console.log(`连接 ${connectionId} 不再有效`);
        return;
      }
      
      // 回显消息确认给发送者
      await this._safeSend(connection.ws, {
        type: 'message_ack',
        messageId: chatMessage.messageId,
        timestamp: Date.now(),
        sequenceId: chatMessage.sequenceId
      });
      
      console.log(`消息确认已发送给用户 ${userId}`);
      
      // 实现更可靠的广播功能
      await this._broadcastMessage(chatMessage);
      
    } catch (error) {
      console.error(`处理消息错误: ${error.message}`, error.stack);
      // 尝试发送错误通知
      try {
        const connection = this.connections.get(connectionId);
        if (connection && connection.ws) {
          connection.ws.send(JSON.stringify({
            type: 'error',
            message: '处理消息时发生错误',
            error: error.message
          }));
        }
      } catch (e) {
        console.error(`发送错误通知失败: ${e.message}`);
      }
    }
  }
  
  // 安全地发送消息（带重试机制）
  async _safeSend(ws, message, maxRetries = 2) {
    const messageString = JSON.stringify(message);
    let retries = 0;
    
    while (retries <= maxRetries) {
      try {
        ws.send(messageString);
        return true;
      } catch (error) {
        retries++;
        if (retries > maxRetries) {
          console.error(`发送消息失败（已重试${maxRetries}次）:`, error.message);
          throw error;
        }
        console.warn(`发送消息失败，尝试重试 (${retries}/${maxRetries})...`);
        // 指数退避
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retries - 1)));
      }
    }
    return false;
  }
  
  // 可靠的消息广播实现
  async _broadcastMessage(chatMessage) {
    // 存储连接状态，避免在迭代过程中修改映射
    const currentConnections = new Map(this.connections.entries());
    const messageString = JSON.stringify(chatMessage);
    const successfulSends = [];
    const failedSends = [];
    
    // 并行发送消息给所有连接，使用Promise.allSettled确保不会因单个失败而中断
    const sendPromises = [];
    
    for (const [connId, conn] of currentConnections.entries()) {
      sendPromises.push(
        this._safeSend(conn.ws, chatMessage)
          .then(() => {
            successfulSends.push(connId);
            return { connId, success: true };
          })
          .catch(error => {
            console.error(`广播消息给连接 ${connId} 失败:`, error.message);
            failedSends.push(connId);
            return { connId, success: false, error: error.message };
          })
      );
    }
    
    // 等待所有发送操作完成
    await Promise.allSettled(sendPromises);
    
    // 清理断开的连接
    for (const connId of failedSends) {
      this.connections.delete(connId);
      console.log(`清理断开的连接: ${connId}`);
    }
    
    // 记录广播结果
    console.log(`广播消息完成: 成功=${successfulSends.length}, 失败=${failedSends.length}, 房间当前连接数=${this.connections.size}`);
    
    // 如果是本地开发环境，可以发送广播状态报告
    if (!this.env || !this.env.CHAT_ROOM) {
      console.log(`本地环境广播统计: 消息ID=${chatMessage.messageId}, 房间=${chatMessage.roomId}`);
    }
  }
  
  // 获取下一个序列号（用于消息排序和追踪）
  _getNextSequenceId() {
    if (!this._sequenceCounter) {
      this._sequenceCounter = 0;
    }
    return ++this._sequenceCounter;
  }
}

// 本地开发环境的房间实例缓存，用于共享相同房间ID的连接
const roomInstances = new Map();

/**
 * 主Worker入口
 */
async function handleRequest(request, env) {
  // 解析URL获取房间ID
  const url = new URL(request.url);
  const roomId = url.searchParams.get('roomId') || 'default';
  const token = url.searchParams.get('token') || 'anonymous';
  
  // 从token中提取用户ID
  const userId = token.replace('mock-token-', '') || `user-${Date.now()}`;
  
  // 检查是否是WebSocket升级请求
  if (request.headers.get('Upgrade') === 'websocket') {
    try {
      // 尝试使用Durable Object（生产环境）
      if (env && env.CHAT_ROOM) {
        // 获取Durable Object实例
        const roomObject = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(roomId));
        
        // 将请求转发给Durable Object
        return roomObject.fetch(request);
      } else {
        // 本地开发环境的fallback：使用共享的房间实例
        console.log(`用户 ${userId} 尝试连接到房间 ${roomId}`);
        
        // 创建WebSocket对
        const [client, server] = Object.values(new WebSocketPair());
        
        // 获取或创建房间实例
        let roomInstance;
        if (roomInstances.has(roomId)) {
          roomInstance = roomInstances.get(roomId);
          console.log(`使用现有房间实例 ${roomId}`);
        } else {
          // 创建模拟的Durable Object状态和环境
          const mockState = {
            blockConcurrencyWhile: async (fn) => await fn(),
            storage: new Map()
          };
          
          // 创建新的WebSocketRoom实例
          roomInstance = new WebSocketRoom(mockState, {});
          roomInstances.set(roomId, roomInstance);
          console.log(`创建新房间实例 ${roomId}`);
        }
        
        // 处理WebSocket连接
        roomInstance.handleWebSocket(server, userId);
        
        // 返回客户端连接
        return new Response(null, {
          status: 101,
          webSocket: client,
        });
      }
    } catch (error) {
      console.error('WebSocket升级失败:', error);
      return new Response('WebSocket upgrade failed', { status: 500 });
    }
  }
  
  // 健康检查端点
  if (url.pathname === '/health') {
    return new Response(JSON.stringify({
      status: 'ok',
      timestamp: Date.now()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response('WebSocket Server is running', { status: 200 });
}

// 导出Durable Object类和主处理函数
export default {
  fetch: handleRequest
};
export { WebSocketRoom };
