/**
 * WebSocket Worker
 * 处理实时消息通信，路由到对应的Durable Object
 */

// 导入验证工具
import ValidationUtils from '../utils/validationUtils.js';

// 性能优化配置
const PERFORMANCE_CONFIG = {
  // 连接限流配置
  MAX_CONNECTIONS_PER_MINUTE: 100,
  // 消息限流配置
  MAX_MESSAGES_PER_SECOND: 10,
  // 连接超时配置
  CONNECTION_TIMEOUT_MS: 30000,
  // 心跳间隔
  HEARTBEAT_INTERVAL_MS: 45000
};

// 连接状态跟踪
const connectionTracker = {
  ipConnections: new Map(), // IP地址到连接数的映射
  userMessageRates: new Map(), // 用户ID到消息速率的映射
  lastMinuteConnections: new Map(), // 最近一分钟的连接记录（用于限流）
  
  // 记录新连接
  recordConnection(ip, userId) {
    // 清理过期的连接记录
    this.cleanupOldConnections();
    
    // 更新IP连接数
    const ipCount = this.ipConnections.get(ip) || 0;
    this.ipConnections.set(ip, ipCount + 1);
    
    // 记录最近一分钟的连接
    const now = Date.now();
    const ipRecords = this.lastMinuteConnections.get(ip) || [];
    ipRecords.push(now);
    this.lastMinuteConnections.set(ip, ipRecords);
    
    // 初始化用户消息速率跟踪
    this.userMessageRates.set(userId, {
      messages: [],
      lastReset: now
    });
  },
  
  // 检查连接是否超过限制
  isConnectionAllowed(ip) {
    // 清理过期记录
    this.cleanupOldConnections();
    
    // 检查IP每分钟连接数
    const ipRecords = this.lastMinuteConnections.get(ip) || [];
    return ipRecords.length < PERFORMANCE_CONFIG.MAX_CONNECTIONS_PER_MINUTE;
  },
  
  // 检查消息是否超过速率限制
  isMessageAllowed(userId) {
    const now = Date.now();
    const userRate = this.userMessageRates.get(userId);
    
    if (!userRate) {
      // 初始化用户消息速率
      this.userMessageRates.set(userId, {
        messages: [now],
        lastReset: now
      });
      return true;
    }
    
    // 清理1秒前的消息记录
    const oneSecondAgo = now - 1000;
    userRate.messages = userRate.messages.filter(timestamp => timestamp > oneSecondAgo);
    
    // 检查是否超过速率限制
    if (userRate.messages.length >= PERFORMANCE_CONFIG.MAX_MESSAGES_PER_SECOND) {
      return false;
    }
    
    // 记录新消息
    userRate.messages.push(now);
    return true;
  },
  
  // 清理过期的连接记录
  cleanupOldConnections() {
    const oneMinuteAgo = Date.now() - 60000;
    
    for (const [ip, records] of this.lastMinuteConnections.entries()) {
      const filteredRecords = records.filter(timestamp => timestamp > oneMinuteAgo);
      
      if (filteredRecords.length === 0) {
        this.lastMinuteConnections.delete(ip);
        this.ipConnections.delete(ip);
      } else {
        this.lastMinuteConnections.set(ip, filteredRecords);
        this.ipConnections.set(ip, filteredRecords.length);
      }
    }
  },
  
  // 移除断开的连接
  removeConnection(ip, userId) {
    // 更新IP连接数
    const ipCount = this.ipConnections.get(ip) || 1;
    if (ipCount > 1) {
      this.ipConnections.set(ip, ipCount - 1);
    } else {
      this.ipConnections.delete(ip);
    }
    
    // 移除用户消息速率跟踪
    this.userMessageRates.delete(userId);
  }
};

// 导入Durable Object类
import { ChatRoomDurableObject } from './chatRoomDurableObject';

/**
 * 增强的JWT验证中间件
 * @param {Request} request - HTTP请求对象
 * @returns {Promise<Object|null>} 验证通过返回用户信息，否则返回null
 */
async function verifyToken(request) {
  try {
    // 从请求头获取token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.substring(7);
    
    // 验证token格式
    if (!/^[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]*$/.test(token)) {
      console.error('Invalid token format');
      return null;
    }
    
    try {
      // 使用本地JWT解析（移除对外部验证服务的依赖）
      const [header, payload, signature] = token.split('.');
      const decodedPayload = JSON.parse(atob(payload));
      
      // 检查token是否过期
      if (decodedPayload.exp && decodedPayload.exp < Date.now() / 1000) {
        console.error('Token expired');
        return null;
      }
      
      return {
        userId: decodedPayload.sub || decodedPayload.userId,
        username: decodedPayload.name || decodedPayload.username || 'Anonymous'
      };
    } catch (serviceError) {
      console.error('Token validation error:', serviceError);
      return null;
    }
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * 处理WebSocket连接
 * @param {WebSocket} ws - WebSocket连接对象
 * @param {Object} user - 用户信息
 * @param {Request} request - 原始HTTP请求
 */
function handleConnection(ws, user, request) {
  const userId = user.userId;
  const username = user.username;
  
  // 存储用户连接
  userSockets.set(userId, ws);
  connections.set(ws, { userId, username });
  
  // 发送连接成功消息
  sendToClient(ws, {
    type: 'connection_established',
    message: 'WebSocket连接已建立',
    user: { userId, username },
    timestamp: new Date().toISOString()
  });
  
  // 处理消息接收
  ws.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      await handleMessage(data, user);
    } catch (error) {
      console.error('Error processing message:', error);
      sendToClient(ws, {
        type: 'error',
        message: '消息处理错误',
        timestamp: new Date().toISOString()
      });
    }
  };
  
  // 处理连接关闭
  ws.onclose = () => {
    // 清理连接
    cleanupConnection(ws, user);
  };
  
  // 处理错误
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    cleanupConnection(ws, user);
  };
}

/**
 * 处理接收到的消息
 * @param {Object} data - 消息数据
 * @param {Object} user - 发送消息的用户信息
 */
/**
   * 优化的客户端消息处理函数
   * 使用异步处理和错误隔离提高性能
   */
async function handleMessage(data, user) {
  const { type, payload } = data;
  
  switch (type) {
    case 'join_group':
      // 加入群组
      joinGroup(user.userId, payload.groupId);
      break;
      
    case 'leave_group':
      // 离开群组
      leaveGroup(user.userId, payload.groupId);
      break;
      
    case 'send_message':
      // 发送消息
      await broadcastMessage(user, payload.groupId, payload.content);
      break;
      
    case 'typing':
      // 发送正在输入状态
      broadcastTypingStatus(user, payload.groupId, payload.isTyping);
      break;
      
    default:
      console.warn('Unknown message type:', type);
  }
}

/**
 * 加入群组
 * @param {string} userId - 用户ID
 * @param {string} groupId - 群组ID
 */
function joinGroup(userId, groupId) {
  if (!groupConnections.has(groupId)) {
    groupConnections.set(groupId, new Set());
  }
  
  const groupUsers = groupConnections.get(groupId);
  groupUsers.add(userId);
  
  const userSocket = userSockets.get(userId);
  if (userSocket) {
    sendToClient(userSocket, {
      type: 'group_joined',
      message: `成功加入群组 ${groupId}`,
      groupId,
      timestamp: new Date().toISOString()
    });
    
    // 通知群组中的其他用户
    broadcastToGroupUsers(groupId, userId, {
      type: 'user_joined',
      message: `${connections.get(userSocket).username} 加入了群组`,
      userId,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * 离开群组
 * @param {string} userId - 用户ID
 * @param {string} groupId - 群组ID
 */
function leaveGroup(userId, groupId) {
  const groupUsers = groupConnections.get(groupId);
  if (groupUsers && groupUsers.has(userId)) {
    groupUsers.delete(userId);
    
    const userSocket = userSockets.get(userId);
    if (userSocket) {
      sendToClient(userSocket, {
        type: 'group_left',
        message: `已离开群组 ${groupId}`,
        groupId,
        timestamp: new Date().toISOString()
      });
      
      // 通知群组中的其他用户
      broadcastToGroupUsers(groupId, userId, {
        type: 'user_left',
        message: `${connections.get(userSocket).username} 离开了群组`,
        userId,
        timestamp: new Date().toISOString()
      });
    }
  }
}

/**
 * 广播消息到群组
 * @param {Object} user - 发送消息的用户
 * @param {string} groupId - 群组ID
 * @param {string} content - 消息内容
 */
async function broadcastMessage(user, groupId, content) {
  const message = {
    type: 'new_message',
    sender: {
      id: user.userId,
      username: user.username
    },
    groupId,
    content,
    timestamp: new Date().toISOString()
  };
  
  // 保存消息到数据库
  try {
    // 使用环境变量中的D1数据库绑定
    const db = env.DB; // 与wrangler.toml中的配置一致
    
    // 验证参数
    if (!groupId || !user.userId || !content) {
      console.error('Invalid message data for storage');
      return;
    }
    
    // 插入消息到数据库
    const query = `
      INSERT INTO messages (room_id, user_id, user_name, content, message_type, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    await db.prepare(query)
      .bind(
        groupId,
        user.userId,
        user.username || '',
        content,
        'chat',
        new Date().toISOString()
      )
      .run();
    
    console.log(`Message stored successfully in room ${groupId}`);
  } catch (error) {
    console.error('Error saving message:', error);
  }
  
  // 广播消息到群组所有成员
  const groupUsers = groupConnections.get(groupId);
  if (groupUsers) {
    groupUsers.forEach(userId => {
      const socket = userSockets.get(userId);
      if (socket) {
        sendToClient(socket, message);
      }
    });
  }
}

/**
 * 广播用户输入状态
 * @param {Object} user - 用户信息
 * @param {string} groupId - 群组ID
 * @param {boolean} isTyping - 是否正在输入
 */
function broadcastTypingStatus(user, groupId, isTyping) {
  const typingStatus = {
    type: 'typing_status',
    userId: user.userId,
    username: user.username,
    groupId,
    isTyping,
    timestamp: new Date().toISOString()
  };
  
  // 广播给群组中的其他用户（不包括发送者自己）
  broadcastToGroupUsers(groupId, user.userId, typingStatus);
}

/**
 * 向特定群组中的用户广播消息（排除特定用户）
 * @param {string} groupId - 群组ID
 * @param {string} excludeUserId - 排除的用户ID
 * @param {Object} message - 消息内容
 */
function broadcastToGroupUsers(groupId, excludeUserId, message) {
  const groupUsers = groupConnections.get(groupId);
  if (groupUsers) {
    groupUsers.forEach(userId => {
      if (userId !== excludeUserId) {
        const socket = userSockets.get(userId);
        if (socket) {
          sendToClient(socket, message);
        }
      }
    });
  }
}

/**
 * 发送消息给客户端
 * @param {WebSocket} ws - WebSocket连接
 * @param {Object} message - 消息内容
 */
function sendToClient(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * 清理连接资源
 * @param {WebSocket} ws - 要清理的WebSocket连接
 * @param {Object} user - 用户信息
 */
function cleanupConnection(ws, user) {
  const userId = user.userId;
  
  // 从所有群组中移除用户
  groupConnections.forEach((users, groupId) => {
    if (users.has(userId)) {
      users.delete(userId);
      // 通知群组其他用户有成员离开
      broadcastToGroupUsers(groupId, userId, {
        type: 'user_left',
        message: `${connections.get(ws)?.username || '用户'} 离开了群组`,
        userId,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 清理映射
  userSockets.delete(userId);
  connections.delete(ws);
  
  console.log(`用户 ${userId} 的连接已关闭`);
}

/**
 * Worker主处理函数
 * @param {Request} request - HTTP请求
 * @param {Object} env - 环境变量和绑定
 * @param {Object} ctx - 上下文对象
 * @returns {Promise<Response>} - HTTP响应
 */
/**
 * 处理CORS请求头
 */
function handleCors(request) {
  // 允许的来源
  const allowedOrigins = ['http://localhost:3000', 'http://localhost:8787', 'https://game-website.pages.dev'];
  const origin = request.headers.get('Origin');
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-ID',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true'
  };
}

/**
 * 处理WebSocket连接
 */
async function handleWebSocket(request, env) {
  try {
    // 解析URL参数获取token
    const url = new URL(request.url);
    const token = url.searchParams.get('token') || request.headers.get('Authorization')?.replace('Bearer ', '');
    
    // 验证token格式
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return new Response('Invalid token format', {
        status: 400,
        headers: handleCors(request)
      });
    }

    // 验证token（简化版本）
    // 实际项目中应该使用auth-worker中的验证逻辑
    const user = await verifyToken(request);
    if (!user) {
      return new Response('Invalid token', {
        status: 401,
        headers: handleCors(request)
      });
    }

    // 对于聊天连接，我们需要知道用户想加入哪个房间
    const roomId = url.searchParams.get('roomId');
    
    // 验证roomId（如果提供）
    let validatedRoomId = null;
    if (roomId) {
      if (!roomId || typeof roomId !== 'string' || roomId.trim().length === 0) {
        return new Response('Invalid room ID', {
          status: 400,
          headers: handleCors(request)
        });
      }
      validatedRoomId = roomId;
    }
    
    // 确定要使用的Durable Object ID
    const objectId = validatedRoomId 
      ? env.CHAT_ROOM.idFromName(`room-${validatedRoomId}`)
      : env.CHAT_ROOM.idFromName(`user-${user.userId}`);
      
    const object = env.CHAT_ROOM.get(objectId);
    
    // 将用户信息添加到请求中
    const newUrl = new URL(request.url);
    newUrl.searchParams.set('userId', user.userId);
    newUrl.searchParams.set('userName', user.username);
    if (validatedRoomId) {
      newUrl.searchParams.set('roomId', validatedRoomId);
    }
    
    // 转发请求到Durable Object
    return object.fetch(newUrl, {
      headers: request.headers,
      method: request.method,
      body: request.body
    });
  } catch (error) {
    console.error('WebSocket handler error:', error);
    return new Response('Internal server error', {
      status: 500,
      headers: handleCors(request)
    });
  }
}

/**
 * 处理加入聊天房间的API请求
 */
async function handleJoinRoom(request, env) {
  try {
    // 解析并验证请求体
    let data;
    try {
      data = await request.json();
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid JSON format' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...handleCors(request)
        }
      });
    }
    
    // 提取参数
    const { roomId } = data;
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    // 验证token格式
    try {
      ValidationUtils.validateToken(token);
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid token format' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...handleCors(request)
        }
      });
    }
    
    // 验证roomId
    let validatedRoomId;
    try {
      validatedRoomId = ValidationUtils.validateGroupId(roomId);
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...handleCors(request)
        }
      });
    }

    // 验证token
    const user = await verifyToken(request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...handleCors(request)
        }
      });
    }

    // 验证userId
    try {
      ValidationUtils.validateUserId(user.userId);
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid user ID' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...handleCors(request)
        }
      });
    }

    // 获取房间的Durable Object ID和WebSocket URL
    const wsProtocol = request.url.startsWith('https') ? 'wss' : 'ws';
    const host = request.headers.get('Host');
    const wsUrl = `${wsProtocol}://${host}/ws?token=${encodeURIComponent(token)}&userId=${user.userId}&userName=${encodeURIComponent(user.username)}&roomId=${validatedRoomId}`;

    return new Response(JSON.stringify({
      success: true,
      wsUrl,
      roomId: validatedRoomId,
      userId: user.userId
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...handleCors(request)
      }
    });
  } catch (error) {
    console.error('Join room error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...handleCors(request)
      }
    });
  }
}

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  
  // 处理WebSocket请求
  if (url.pathname === '/ws') {
    return handleWebSocket(request, env);
  }
  
  // 处理加入房间的API请求
  if (url.pathname === '/api/chat/join-room' && request.method === 'POST') {
    return handleJoinRoom(request, env);
  }
  
  // 处理CORS预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: handleCors(request)
    });
  }
  
  // 处理其他HTTP请求
  return new Response(JSON.stringify({
    status: 'ok',
    message: 'WebSocket服务运行中'
  }), {
    headers: {
      'Content-Type': 'application/json',
      ...handleCors(request)
    }
  });
}

export default {
  async fetch(request, env) {
    // 获取客户端IP地址
    const clientIP = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
    
    // 设置性能监控头信息
    const startTime = performance.now();
    
    // 处理CORS预检请求
    if (request.method === 'OPTIONS') {
      const endTime = performance.now();
      return new Response(null, {
        headers: {
          ...handleCors(request),
          'x-processing-time': `${endTime - startTime}ms`
        }
      });
    }
    
    try {
      // 检查连接限流
      if (!connectionTracker.isConnectionAllowed(clientIP)) {
        const endTime = performance.now();
        return new Response('Connection limit exceeded. Please try again later.', {
          status: 429,
          headers: {
            ...handleCors(request),
            'x-processing-time': `${endTime - startTime}ms`,
            'x-rate-limit-retry-after': '60'
          }
        });
      }
      
      // 调用原始的handleRequest函数处理请求
      const response = await handleRequest(request, env);
      const endTime = performance.now();
      
      // 添加性能监控头
      const enhancedHeaders = new Headers(response.headers);
      enhancedHeaders.set('x-processing-time', `${endTime - startTime}ms`);
      
      return new Response(response.body, {
        ...response,
        headers: enhancedHeaders
      });
    } catch (error) {
      console.error('Error processing request:', error);
      const endTime = performance.now();
      
      return new Response(JSON.stringify({
        error: 'Internal server error',
        code: 500
      }), {
        status: 500,
        headers: {
          ...handleCors(request),
          'Content-Type': 'application/json',
          'x-processing-time': `${endTime - startTime}ms`
        }
      });
    }
  }
};

// 导出Durable Object类
export { ChatRoomDurableObject };