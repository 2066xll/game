/**
 * WebSocket Worker
 * 处理实时消息通信，路由到对应的Durable Object
 */

// 验证工具类
const ValidationUtils = {
  /**
   * 验证房间/群组ID格式
   * @param {string} roomId - 房间ID
   * @returns {string} - 验证通过的房间ID
   * @throws {Error} - 验证失败时抛出错误
   */
  validateGroupId(roomId) {
    // 检查类型
    if (typeof roomId !== 'string') {
      throw new Error('房间ID必须是字符串');
    }
    
    // 检查空值
    const trimmedId = roomId.trim();
    if (!trimmedId) {
      throw new Error('房间ID不能为空');
    }
    
    // 检查长度
    if (trimmedId.length < 3 || trimmedId.length > 32) {
      throw new Error('房间ID长度必须在3-32个字符之间');
    }
    
    // 检查格式 - 只允许字母、数字、下划线、连字符
    const validFormatRegex = /^[a-zA-Z0-9_-]+$/;
    if (!validFormatRegex.test(trimmedId)) {
      throw new Error('房间ID只能包含字母、数字、下划线和连字符');
    }
    
    // 防止路径遍历攻击
    if (trimmedId.includes('../') || trimmedId.includes('..\\')) {
      throw new Error('房间ID包含无效字符');
    }
    
    return trimmedId;
  },
  
  /**
   * 验证消息内容
   * @param {string} content - 消息内容
   * @returns {string} - 验证通过的消息内容
   * @throws {Error} - 验证失败时抛出错误
   */
  validateMessageContent(content) {
    if (typeof content !== 'string') {
      throw new Error('消息内容必须是字符串');
    }
    
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      throw new Error('消息内容不能为空');
    }
    
    if (trimmedContent.length > PERFORMANCE_CONFIG.MAX_MESSAGE_SIZE_BYTES) {
      throw new Error(`消息内容超过最大长度限制 (${PERFORMANCE_CONFIG.MAX_MESSAGE_SIZE_BYTES} 字符)`);
    }
    
    return trimmedContent;
  },
  
  /**
   * 验证用户名格式
   * @param {string} username - 用户名
   * @returns {string} - 验证通过的用户名
   * @throws {Error} - 验证失败时抛出错误
   */
  validateUsername(username) {
    if (typeof username !== 'string') {
      throw new Error('用户名必须是字符串');
    }
    
    const trimmedName = username.trim();
    if (!trimmedName) {
      throw new Error('用户名不能为空');
    }
    
    if (trimmedName.length < 2 || trimmedName.length > 30) {
      throw new Error('用户名长度必须在2-30个字符之间');
    }
    
    // 允许字母、数字、空格和一些常见特殊字符
    const validFormatRegex = /^[a-zA-Z0-9\s._-]+$/;
    if (!validFormatRegex.test(trimmedName)) {
      throw new Error('用户名包含无效字符');
    }
    
    return trimmedName;
  },
  
  /**
   * 验证用户ID格式
   * @param {string} userId - 用户ID
   * @returns {string} - 验证通过的用户ID
   * @throws {Error} - 验证失败时抛出错误
   */
  validateUserId(userId) {
    if (typeof userId !== 'string') {
      throw new Error('用户ID必须是字符串');
    }
    
    const trimmedId = userId.trim();
    if (!trimmedId) {
      throw new Error('用户ID不能为空');
    }
    
    // 检查格式 - 只允许字母、数字、下划线
    const validFormatRegex = /^[a-zA-Z0-9_]+$/;
    if (!validFormatRegex.test(trimmedId)) {
      throw new Error('用户ID只能包含字母、数字和下划线');
    }
    
    return trimmedId;
  },
  
  /**
   * 验证JWT token格式
   * @param {string} token - JWT token
   * @returns {boolean} - 是否有效
   * @throws {Error} - 验证失败时抛出错误
   */
  validateToken(token) {
    if (typeof token !== 'string') {
      throw new Error('Token必须是字符串');
    }
    
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      throw new Error('Token不能为空');
    }
    
    // 检查JWT格式 (header.payload.signature)
    const tokenParts = trimmedToken.split('.');
    if (tokenParts.length !== 3) {
      throw new Error('Token格式无效');
    }
    
    return true;
  }
};

// 存储用户WebSocket连接
const userSockets = new Map(); // 用户ID到WebSocket的映射
const connections = new Map(); // WebSocket到用户信息的映射
const groupConnections = new Map(); // 群组ID到用户ID集合的映射

// 性能优化配置 - 增强版
const PERFORMANCE_CONFIG = {
  // 连接限流配置
  MAX_CONNECTIONS_PER_MINUTE: 100,
  // 消息限流配置
  MAX_MESSAGES_PER_SECOND: 10,
  // 连接超时配置
  CONNECTION_TIMEOUT_MS: 30000,
  // 心跳间隔
  HEARTBEAT_INTERVAL_MS: 45000,
  // 消息大小限制 (50KB)
  MAX_MESSAGE_SIZE_BYTES: 50 * 1024,
  // 最大并发连接数
  MAX_CONCURRENT_CONNECTIONS_PER_IP: 5,
  // 消息缓存大小
  MESSAGE_CACHE_SIZE: 100,
  // 慢请求阈值
  SLOW_REQUEST_THRESHOLD_MS: 500,
  // 环境配置
  ENVIRONMENT: process.env.NODE_ENV || 'development',
  DEBUG_MODE: false
};

/**
 * 清理连接资源的工具函数
 */
function cleanupConnection(ws, userId, clientIP) {
  if (!ws) return;
  
  // 从映射中移除连接
  if (userSockets.has(userId)) {
    userSockets.delete(userId);
  }
  
  if (connections.has(ws)) {
    connections.delete(ws);
  }
  
  // 更新连接跟踪器
  connectionTracker.removeConnection(clientIP, userId);
  
  console.log(`Connection cleaned up: User=${userId}, IP=${clientIP}, Remaining connections=${connections.size}`);
}

/**
 * 设置WebSocket心跳检测
 */
function setupHeartbeat(ws, userId) {
  const HEARTBEAT_INTERVAL = 30000; // 30秒
  
  const heartbeatInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      // 更新心跳时间戳
      const connInfo = connections.get(ws);
      if (connInfo) {
        connInfo.lastHeartbeat = Date.now();
      }
      
      // 发送ping消息
      ws.send(JSON.stringify({ type: 'ping' }));
    } else {
      // 连接已关闭，清理定时器
      clearInterval(heartbeatInterval);
    }
  }, HEARTBEAT_INTERVAL);
  
  // 确保定时器在连接关闭时被清理
  ws.heartbeatInterval = heartbeatInterval;
}

/**
 * 启动全局资源清理定时器
 */
function startGlobalCleanupInterval() {
  // 每5分钟运行一次全局清理
  setInterval(() => {
    performGlobalCleanup();
  }, 300000);
  
  console.log('Global cleanup interval started');
}

/**
 * 执行全局资源清理
 */
function performGlobalCleanup() {
  const now = Date.now();
  const DEAD_CONNECTION_TIMEOUT = 60000; // 60秒没有心跳视为死连接
  let cleanedCount = 0;
  
  // 检查并清理死连接
  for (const [ws, connInfo] of connections.entries()) {
    if (ws.readyState !== WebSocket.OPEN || 
        (connInfo.lastHeartbeat && now - connInfo.lastHeartbeat > DEAD_CONNECTION_TIMEOUT)) {
      
      // 清理连接
      cleanupConnection(ws, connInfo.userId, connInfo.ip);
      cleanedCount++;
      
      // 如果连接仍然打开，关闭它
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.close(1001, 'Resource cleanup');
        } catch (e) {
          // 忽略关闭错误
        }
      }
    }
  }
  
  // 清理过期的用户消息速率数据
  const ONE_HOUR_AGO = now - 3600000;
  for (const [userId, rateInfo] of connectionTracker.userMessageRates.entries()) {
    // 如果用户没有活跃连接且最近没有消息，清理其速率数据
    if (!userSockets.has(userId) && rateInfo.messages.length === 0) {
      connectionTracker.userMessageRates.delete(userId);
    }
  }
  
  // 记录清理统计
  if (cleanedCount > 0) {
    console.log({
      message_type: 'global_cleanup_performed',
      cleaned_connections: cleanedCount,
      remaining_connections: connections.size,
      memory_usage: getMemoryUsageStats(),
      timestamp: now
    });
  }
}

/**
 * 获取内存使用统计信息
 */
function getMemoryUsageStats() {
  try {
    // Cloudflare Workers环境中的内存使用信息
    return {
      heap_usage: 'N/A (Worker environment)',
      connections_count: connections.size,
      user_sockets_count: userSockets.size,
      connection_tracker_size: {
        ip_connections: connectionTracker.ipConnections.size,
        user_message_rates: connectionTracker.userMessageRates.size,
        last_minute_connections: connectionTracker.lastMinuteConnections.size
      }
    };
  } catch (e) {
    return { error: e.message };
  }
}

// 连接状态跟踪 - 增强版
const connectionTracker = {
  ipConnections: new Map(), // IP地址到连接数的映射
  userMessageRates: new Map(), // 用户ID到消息速率的映射
  lastMinuteConnections: new Map(), // 最近一分钟的连接记录（用于限流）
  performanceMetrics: { // 性能指标统计
    totalConnections: 0,
    messageCount: 0,
    avgMessageSize: 0,
    connectionDurations: [],
    lastUpdated: Date.now()
  },
  
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
      lastReset: now,
      firstMessageTime: null,
      totalMessageSize: 0
    });
    
    // 更新性能指标
    this.performanceMetrics.totalConnections++;
    this.performanceMetrics.lastUpdated = now;
    
    console.log(`Connection established: IP=${ip}, User=${userId}, Active connections=${ipCount + 1}`);
  },
  
  // 检查连接是否超过限制
  isConnectionAllowed(ip) {
    // 清理过期记录
    this.cleanupOldConnections();
    
    // 检查IP每分钟连接数
    const ipRecords = this.lastMinuteConnections.get(ip) || [];
    const currentMinuteConnections = ipRecords.length;
    
    // 检查并发连接数
    const currentConcurrentConnections = this.ipConnections.get(ip) || 0;
    
    const allowed = currentMinuteConnections < PERFORMANCE_CONFIG.MAX_CONNECTIONS_PER_MINUTE && 
                   currentConcurrentConnections < PERFORMANCE_CONFIG.MAX_CONCURRENT_CONNECTIONS_PER_IP;
    
    if (!allowed) {
      console.warn(`Connection rejected for IP=${ip}: minute connections=${currentMinuteConnections}, concurrent=${currentConcurrentConnections}`);
    }
    
    return allowed;
  },
  
  // 检查消息是否超过速率限制
  isMessageAllowed(userId, messageSize = 0) {
    const now = Date.now();
    const userRate = this.userMessageRates.get(userId);
    
    if (!userRate) {
      // 初始化用户消息速率
      this.userMessageRates.set(userId, {
        messages: [now],
        lastReset: now,
        firstMessageTime: now,
        totalMessageSize: messageSize
      });
      
      // 更新全局消息统计
      this.performanceMetrics.messageCount++;
      this.updateAvgMessageSize(messageSize);
      
      return true;
    }
    
    // 清理1秒前的消息记录
    const oneSecondAgo = now - 1000;
    userRate.messages = userRate.messages.filter(timestamp => timestamp > oneSecondAgo);
    
    // 检查是否超过速率限制
    if (userRate.messages.length >= PERFORMANCE_CONFIG.MAX_MESSAGES_PER_SECOND) {
      console.warn(`Message rate limit exceeded for user=${userId}: ${userRate.messages.length}/s`);
      return false;
    }
    
    // 检查消息大小限制
    if (messageSize > PERFORMANCE_CONFIG.MAX_MESSAGE_SIZE_BYTES) {
      console.warn(`Message size too large for user=${userId}: ${messageSize} bytes > ${PERFORMANCE_CONFIG.MAX_MESSAGE_SIZE_BYTES} bytes`);
      return false;
    }
    
    // 记录新消息
    userRate.messages.push(now);
    userRate.totalMessageSize += messageSize;
    
    if (!userRate.firstMessageTime) {
      userRate.firstMessageTime = now;
    }
    
    // 更新全局消息统计
    this.performanceMetrics.messageCount++;
    this.updateAvgMessageSize(messageSize);
    
    return true;
  },
  
  // 更新平均消息大小
  updateAvgMessageSize(messageSize) {
    const count = this.performanceMetrics.messageCount;
    const oldAvg = this.performanceMetrics.avgMessageSize;
    this.performanceMetrics.avgMessageSize = ((oldAvg * (count - 1)) + messageSize) / count;
  },
  
  // 记录连接持续时间
  recordConnectionDuration(durationMs) {
    this.performanceMetrics.connectionDurations.push(durationMs);
    // 限制数组大小
    if (this.performanceMetrics.connectionDurations.length > 1000) {
      this.performanceMetrics.connectionDurations.shift();
    }
  },
  
  // 获取性能报告
  getPerformanceReport() {
    const { performanceMetrics } = this;
    const avgDuration = performanceMetrics.connectionDurations.length > 0
      ? performanceMetrics.connectionDurations.reduce((a, b) => a + b, 0) / performanceMetrics.connectionDurations.length
      : 0;
    
    return {
      totalConnections: performanceMetrics.totalConnections,
      activeConnections: Array.from(this.ipConnections.values()).reduce((a, b) => a + b, 0),
      messageCount: performanceMetrics.messageCount,
      avgMessageSize: Math.round(performanceMetrics.avgMessageSize),
      avgConnectionDuration: Math.round(avgDuration),
      lastUpdated: new Date(performanceMetrics.lastUpdated).toISOString()
    };
  },
  
  // 清理过期的连接记录
  cleanupOldConnections() {
    const oneMinuteAgo = Date.now() - 60000;
    let cleanedUpCount = 0;
    
    for (const [ip, records] of this.lastMinuteConnections.entries()) {
      const filteredRecords = records.filter(timestamp => timestamp > oneMinuteAgo);
      
      if (filteredRecords.length === 0) {
        this.lastMinuteConnections.delete(ip);
        this.ipConnections.delete(ip);
        cleanedUpCount++;
      } else {
        this.lastMinuteConnections.set(ip, filteredRecords);
        this.ipConnections.set(ip, filteredRecords.length);
      }
    }
    
    if (cleanedUpCount > 0) {
      console.log(`Cleaned up ${cleanedUpCount} expired connection records`);
    }
  },
  
  // 移除断开的连接
  removeConnection(ip, userId) {
    const now = Date.now();
    
    // 更新IP连接数
    const ipCount = this.ipConnections.get(ip) || 1;
    if (ipCount > 1) {
      this.ipConnections.set(ip, ipCount - 1);
    } else {
      this.ipConnections.delete(ip);
      // 同时移除IP的最近连接记录
      this.lastMinuteConnections.delete(ip);
    }
    
    // 记录连接持续时间（如果有firstMessageTime）
    const userRate = this.userMessageRates.get(userId);
    if (userRate && userRate.firstMessageTime) {
      const durationMs = now - userRate.firstMessageTime;
      this.recordConnectionDuration(durationMs);
    }
    
    // 移除用户消息速率跟踪
    this.userMessageRates.delete(userId);
    
    // 更新性能指标
    this.performanceMetrics.lastUpdated = now;
    
    console.log({
      message_type: 'connection_removed',
      ip,
      userId,
      remaining_connections: Math.max(0, ipCount - 1),
      total_active_connections: Array.from(this.ipConnections.values()).reduce((a, b) => a + b, 0),
      timestamp: now
    });
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
 * 增强的WebSocket连接处理
 * @param {WebSocket} ws - WebSocket连接对象
 * @param {Object} user - 用户信息
 * @param {Request} request - 原始HTTP请求
 * @param {Object} env - 环境变量
 */
function handleConnection(ws, user, request, env) {
  const userId = user.userId;
  const username = user.username;
  const startTime = Date.now();
  const clientIP = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  
  // 存储用户连接
  userSockets.set(userId, ws);
  connections.set(ws, { 
    userId, 
    username, 
    connectedAt: startTime,
    ip: clientIP,
    lastHeartbeat: startTime
  });
  
  // 添加WebSocket关闭事件处理
  ws.onclose = () => {
    // 清理连接资源
    cleanupConnection(ws, userId, clientIP);
  };
  
  // 记录连接到跟踪器
  connectionTracker.recordConnection(clientIP, userId);
  
  // 发送连接成功消息 - 包含性能信息
  sendToClient(ws, {
    type: 'connection_established',
    message: 'WebSocket连接已建立',
    user: { userId, username },
    timestamp: new Date().toISOString(),
    performance: {
      serverTime: Date.now(),
      connectionId: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  });
  
  // 设置心跳检测
  setupHeartbeat(ws, userId);
  
  // 设置连接超时定时器
  const timeoutTimer = setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      console.warn(`Connection timeout for user ${userId}, closing connection`);
      sendToClient(ws, {
        type: 'warning',
        message: '连接超时，即将关闭',
        timestamp: new Date().toISOString()
      });
      
      // 计划关闭连接，给客户端一点时间接收警告消息
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Connection timeout');
        }
      }, 1000);
      ws.close(1008, 'Connection timeout');
    }
  }, PERFORMANCE_CONFIG.CONNECTION_TIMEOUT_MS);
  
  // 处理消息接收
  ws.onmessage = async (event) => {
    try {
      // 重置超时定时器
      clearTimeout(timeoutTimer);
      
      // 更新心跳时间
      const wsInfo = connections.get(ws);
      if (wsInfo) {
        wsInfo.lastHeartbeat = Date.now();
      }
      
      // 检查消息大小
      const messageSize = event.data ? event.data.length : 0;
      if (messageSize > PERFORMANCE_CONFIG.MAX_MESSAGE_SIZE_BYTES) {
        throw new Error(`Message too large: ${messageSize} bytes`);
      }
      
      // 速率限制检查
      if (!connectionTracker.isMessageAllowed(userId, messageSize)) {
        sendToClient(ws, {
          type: 'rate_limit',
          message: '消息发送过于频繁，请稍后再试',
          retryAfter: 1000, // 建议重试时间（毫秒）
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // 解析消息
      const data = JSON.parse(event.data);
      
      // 处理心跳消息
      if (data.type === 'ping') {
        sendToClient(ws, {
          type: 'pong',
          timestamp: new Date().toISOString(),
          serverTime: Date.now()
        });
        return;
      }
      
      // 记录消息处理开始时间
      const messageStartTime = performance.now();
      
      // 异步处理消息
      await handleMessage(data, user, env);
      
      // 记录处理时间
      const processTime = performance.now() - messageStartTime;
      if (processTime > 100) { // 记录慢消息处理
        console.log(`Slow message processing for user ${userId}: ${processTime.toFixed(2)}ms, type: ${data.type}`);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      sendToClient(ws, {
        type: 'error',
        message: '消息处理错误: ' + (error.message || '未知错误'),
        errorCode: 'MESSAGE_PROCESSING_ERROR',
        timestamp: new Date().toISOString()
      });
    } finally {
      // 重新设置超时定时器
      clearTimeout(timeoutTimer);
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          console.warn(`Connection timeout for user ${userId}, closing connection`);
          ws.close(1008, 'Connection timeout');
        }
      }, PERFORMANCE_CONFIG.CONNECTION_TIMEOUT_MS);
    }
  };
  
  // 处理连接关闭
  ws.onclose = (event) => {
    // 清除定时器
    clearTimeout(timeoutTimer);
    
    // 计算连接持续时间
    const durationMs = Date.now() - startTime;
    console.log(`Connection closed for user ${userId}: code=${event.code}, reason=${event.reason}, duration=${durationMs}ms`);
    
    // 清理连接
    cleanupConnection(ws, user, clientIP);
  };
  
  // 处理错误
  ws.onerror = (error) => {
    console.error(`WebSocket error for user ${userId}:`, error);
    
    // 避免重复清理
    if (ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
      cleanupConnection(ws, user, clientIP);
    }
  };
  
  // 定期发送性能报告
  if (env && env.ENVIRONMENT !== 'production') {
    const perfReportInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          const perfReport = connectionTracker.getPerformanceReport();
          sendToClient(ws, {
            type: 'performance_report',
            data: perfReport,
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          console.error('Error sending performance report:', e);
        }
      } else {
        clearInterval(perfReportInterval);
      }
    }, 30000); // 每30秒发送一次
  }
}

/**
 * 增强的消息处理函数
 * @param {Object} data - 消息数据
 * @param {Object} user - 用户信息
 * @param {Object} env - 环境变量（包含数据库和其他绑定）
 */
async function handleMessage(data, user, env) {
  const { type, data: messageData, id } = data; // 添加消息ID用于跟踪
  const { userId, username } = user;
  const startTime = performance.now();
  
  // 日志记录 - 结构化日志
  console.log({
    message_type: 'handle_message_start',
    user_id: userId,
    username: username,
    message_type: type,
    message_id: id || 'unknown',
    timestamp: Date.now()
  });
  
  try {
    switch (type) {
      case 'join_group':
        if (!messageData || !messageData.groupId) {
          throw new Error('Missing required field: groupId');
        }
        joinGroup(userId, messageData.groupId);
        break;
      case 'leave_group':
        if (!messageData || !messageData.groupId) {
          throw new Error('Missing required field: groupId');
        }
        leaveGroup(userId, messageData.groupId);
        break;
      case 'send_message':
        if (!messageData || !messageData.groupId || !messageData.content) {
          throw new Error('Missing required fields: groupId or content');
        }
        // 内容验证
        if (messageData.content.length > 1000) {
          throw new Error('Message content too long (max 1000 characters)');
        }
        await broadcastMessage(user, messageData.groupId, messageData.content);
        break;
      case 'typing_status':
        if (!messageData || typeof messageData.isTyping !== 'boolean' || !messageData.groupId) {
          throw new Error('Missing or invalid required fields: isTyping (boolean) or groupId');
        }
        broadcastTypingStatus(user, messageData.groupId, messageData.isTyping);
        break;
      case 'ping':
        // 心跳消息处理已在onmessage中处理
        break;
      default:
        console.warn(`未知消息类型: ${type}`, { user_id: userId });
        throw new Error(`Unknown message type: ${type}`);
    }
    
    // 记录成功处理
    const processTime = performance.now() - startTime;
    console.log({
      message_type: 'handle_message_success',
      user_id: userId,
      message_type: type,
      message_id: id || 'unknown',
      process_time_ms: processTime.toFixed(2),
      timestamp: Date.now()
    });
    
    // 对于非系统消息，发送确认
    if (type !== 'ping' && type !== 'pong' && id) {
      const ws = userSockets.get(userId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        sendToClient(ws, {
          type: 'message_ack',
          messageId: id,
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    const processTime = performance.now() - startTime;
    console.error({
      message_type: 'handle_message_error',
      user_id: userId,
      message_type: type,
      message_id: id || 'unknown',
      error: error.message,
      process_time_ms: processTime.toFixed(2),
      timestamp: Date.now()
    });
    
    // 发送错误响应 - 避免敏感信息泄露
    const ws = userSockets.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendToClient(ws, {
        type: 'error',
        message: env && env.ENVIRONMENT === 'production' 
          ? `处理${type}消息时出错`
          : `处理${type}消息时出错: ${error.message}`,
        errorCode: error.name || 'UNKNOWN_ERROR',
        messageId: id,
        timestamp: new Date().toISOString()
      });
    }
    
    // 对于生产环境，记录错误但不抛出
    if (env && env.ENVIRONMENT === 'production') {
      // 错误已记录，不继续抛出
    } else {
      // 开发环境下抛出以便调试
      throw error;
    }
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
      INSERT INTO chat_messages (id, room_id, user_id, user_name, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    // 生成消息ID
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await db.prepare(query)
      .bind(
        messageId,
        groupId,
        user.userId,
        user.username || '',
        content,
        Date.now()
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
 * 增强的客户端消息发送函数
 * @param {WebSocket} ws - WebSocket连接
 * @param {Object} message - 消息对象
 * @param {boolean} critical - 是否为关键消息（失败时记录更详细日志）
 */
function sendToClient(ws, message, critical = false) {
  // 参数验证
  if (!ws || !message) {
    console.error('Invalid parameters for sendToClient');
    return false;
  }
  
  // 检查连接状态
  if (ws.readyState !== WebSocket.OPEN) {
    if (critical) {
      console.warn(`Attempting to send message to closed socket (state: ${ws.readyState})`, {
        message_type: message.type,
        user_id: message.user?.userId || 'unknown'
      });
    }
    return false;
  }
  
  try {
    // 序列化消息并计算大小
    const messageStr = JSON.stringify(message);
    const messageSize = messageStr.length;
    
    // 发送前检查消息大小
    if (messageSize > PERFORMANCE_CONFIG.MAX_MESSAGE_SIZE_BYTES) {
      throw new Error(`Message too large: ${messageSize} bytes`);
    }
    
    // 发送消息
    ws.send(messageStr);
    
    // 非关键消息不记录详细日志，减少日志量
    if (critical || (message.type && ['error', 'warning', 'rate_limit'].includes(message.type))) {
      console.log({
        message_type: 'message_sent',
        target_type: message.type,
        size_bytes: messageSize,
        timestamp: Date.now()
      });
    }
    
    return true;
  } catch (error) {
    // 根据消息重要性调整日志级别
    if (critical) {
      console.error({
        message_type: 'send_failed_critical',
        message_type: message.type,
        error: error.message,
        timestamp: Date.now()
      });
    } else {
      console.warn({
        message_type: 'send_failed',
        message_type: message.type,
        error: error.message,
        timestamp: Date.now()
      });
    }
    return false;
  }
}

/**
 * 增强的连接清理函数
 * @param {WebSocket} ws - WebSocket连接
 * @param {Object} user - 用户信息
 * @param {string} clientIP - 客户端IP地址
 */
async function cleanupConnection(ws, user, clientIP) {
  const { userId, username } = user;
  const startTime = performance.now();
  
  try {
    // 从映射中移除连接
    userSockets.delete(userId);
    
    // 获取连接信息，用于后续清理
    const connectionInfo = connections.get(ws);
    connections.delete(ws);
    
    // 从连接跟踪器中移除
    if (clientIP) {
      connectionTracker.removeConnection(clientIP, userId);
    }
    
    // 从所有群组中移除用户
    const leftGroups = [];
    groupConnections.forEach((users, groupId) => {
      if (users.has(userId)) {
        users.delete(userId);
        leftGroups.push(groupId);
        
        // 通知群组其他成员用户离开
        broadcastToGroupUsers(groupId, userId, {
          type: 'user_left',
          message: `${connectionInfo?.username || username || '用户'} 离开了群组`,
          userId,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // 计算连接持续时间
    let durationMs = 0;
    if (connectionInfo && connectionInfo.connectedAt) {
      durationMs = Date.now() - connectionInfo.connectedAt;
    }
    
    // 结构化日志
    console.log({
      message_type: 'connection_closed',
      user_id: userId,
      username: username || connectionInfo?.username,
      ip: clientIP,
      duration_ms: durationMs,
      left_groups: leftGroups,
      timestamp: Date.now()
    });
    
    // 记录处理时间
    const processTime = performance.now() - startTime;
    if (processTime > 100) {
      console.warn(`Slow connection cleanup for user ${userId}: ${processTime.toFixed(2)}ms`);
    }
    
  } catch (error) {
    console.error({
      message_type: 'cleanup_error',
      user_id: userId,
      username: username,
      error: error.message,
      timestamp: Date.now()
    });
    // 错误不会中断清理过程
  }
}

/**
 * Worker主处理函数
 * @param {Request} request - HTTP请求
 * @param {Object} env - 环境变量和绑定
 * @param {Object} ctx - 上下文对象
 * @returns {Promise<Response>} - HTTP响应
 */
/**
 * 处理CORS请求头 - 增强版
 */
function handleCors(request, env = {}) {
  // 从环境变量获取允许的来源，如果没有则使用默认值
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS 
    ? process.env.CORS_ALLOWED_ORIGINS.split(',') 
    : env.CORS_ALLOWED_ORIGINS 
    ? env.CORS_ALLOWED_ORIGINS.split(',')
    : [
        'http://localhost:3000', 
        'http://localhost:8787', 
        'https://game-website.pages.dev'
      ];
  
  // 获取请求的来源
  const origin = request.headers.get('Origin');
  
  // 动态允许的来源 - 生产环境只允许明确列出的来源，开发环境允许所有来源用于调试
  let accessControlAllowOrigin;
  if (PERFORMANCE_CONFIG.ENVIRONMENT === 'production' || env.ENVIRONMENT === 'production') {
    // 生产环境：严格匹配允许的来源列表
    accessControlAllowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  } else {
    // 开发环境：如果没有来源头或来源不在列表中，使用第一个允许的来源作为默认值
    accessControlAllowOrigin = origin || allowedOrigins[0];
  }
  
  // 安全响应头集合
  return {
    // CORS核心头
    'Access-Control-Allow-Origin': accessControlAllowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-ID, X-Requested-With, X-CSRF-Token, X-Client-ID',
    'Access-Control-Max-Age': '86400', // 24小时
    'Access-Control-Allow-Credentials': 'true',
    
    // 安全增强头
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; connect-src 'self' *; script-src 'self'; object-src 'none'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
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
  async fetch(request, env, ctx) {
    // 初始化性能监控
    const startTime = performance.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 获取客户端IP地址 - 增强版
    const clientIP = request.headers.get('cf-connecting-ip') 
      || request.headers.get('x-forwarded-for') 
      || request.headers.get('x-real-ip') 
      || request.headers.get('true-client-ip')
      || 'unknown';
    
    // 结构化日志记录请求开始
    const logContext = {
      request_id: requestId,
      method: request.method,
      path: new URL(request.url).pathname,
      ip: clientIP,
      user_agent: request.headers.get('user-agent'),
      timestamp: Date.now()
    };
    
    console.log({ message_type: 'request_start', ...logContext });
    
    // 添加请求到连接跟踪器
    connectionTracker.trackRequest(clientIP);
    
    try {
      // 安全检查：防止请求走私攻击
      if (request.headers.has('content-length') && request.headers.has('transfer-encoding')) {
        return respondWithError(400, 'Invalid request headers', request, startTime, requestId, logContext);
      }
      
      // 获取URL对象
      const url = new URL(request.url);
      
      // 处理CORS预检请求 - 增强版
      if (request.method === 'OPTIONS') {
        const endTime = performance.now();
        const response = new Response(null, {
          headers: {
            ...handleCors(request, env),
            'x-processing-time': `${endTime - startTime}ms`,
            'x-request-id': requestId,
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block'
          }
        });
        
        logResponse(requestId, request, response, startTime, logContext);
        return response;
      }
      
      // 增强的连接限流检查
      if (!connectionTracker.isConnectionAllowed(clientIP)) {
        // 记录超限信息
        console.warn({ 
          message_type: 'rate_limit_exceeded', 
          ip: clientIP,
          request_id: requestId,
          timestamp: Date.now()
        });
        
        return respondWithError(429, '连接过于频繁，请稍后再试', request, startTime, requestId, logContext, {
          'Retry-After': '60',
          'X-RateLimit-Limit': PERFORMANCE_CONFIG.MAX_CONNECTIONS_PER_MINUTE,
          'X-RateLimit-Retry-After': '60'
        });
      }
      
      // WebSocket 连接请求 - 增强处理
      if (url.pathname.startsWith('/ws/') && request.headers.get('Upgrade') === 'websocket') {
        return processWebSocketRequest(request, env, ctx, clientIP, startTime, requestId, logContext);
      }
      
      // 新增API端点：获取性能报告
      if (url.pathname === '/api/performance' && request.method === 'GET') {
        return processPerformanceReportRequest(request, env, clientIP, startTime, requestId, logContext);
      }
      
      // 新增API端点：健康检查
      if (url.pathname === '/api/health' && request.method === 'GET') {
        return processHealthCheckRequest(request, clientIP, startTime, requestId, logContext);
      }
      
      // 调用原始的handleRequest函数处理请求
      const response = await handleRequest(request, env);
      const endTime = performance.now();
      
      // 增强响应头
      const enhancedHeaders = new Headers(response.headers);
      enhancedHeaders.set('x-processing-time', `${endTime - startTime}ms`);
      enhancedHeaders.set('x-request-id', requestId);
      enhancedHeaders.set('X-Content-Type-Options', 'nosniff');
      
      // 记录响应
      logResponse(requestId, request, response, startTime, logContext);
      
      return new Response(response.body, {
        ...response,
        headers: enhancedHeaders
      });
    } catch (error) {
      // 结构化错误日志
      console.error({
        message_type: 'unexpected_error',
        error: error.stack || error.message,
        ...logContext,
        timestamp: Date.now()
      });
      
      // 返回安全的错误响应
      return respondWithError(500, '服务器内部错误', request, startTime, requestId, logContext);
    }
  }
};

/**
 * Durable Object 连接池管理器
 */
class DurableObjectPool {
  constructor() {
    this.pool = new Map(); // roomId -> { instance, lastUsed, healthCheck }
    this.maxPoolSize = 100; // 最大连接池大小
    this.connectionTimeout = 60000; // 连接超时时间（毫秒）
    this.healthCheckInterval = 30000; // 健康检查间隔
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 100,
      maxDelay: 2000,
      exponentialBackoff: true
    };
    
    // 启动定期清理过期连接
    this.startCleanupInterval();
  }
  
  /**
   * 从连接池获取Durable Object实例
   */
  getInstance(env, roomId) {
    const poolKey = `room-${roomId}`;
    
    // 检查连接池是否已存在该实例
    if (this.pool.has(poolKey)) {
      const connectionInfo = this.pool.get(poolKey);
      
      // 更新最后使用时间
      connectionInfo.lastUsed = Date.now();
      
      // 验证连接健康状态
      if (connectionInfo.healthCheck && !connectionInfo.healthCheck.isHealthy) {
        console.warn({ message_type: 'durable_object_unhealthy', roomId, timestamp: Date.now() });
        // 移除不健康的连接
        this.pool.delete(poolKey);
        return this.createNewInstance(env, roomId, poolKey);
      }
      
      return connectionInfo.instance;
    }
    
    // 限制连接池大小
    if (this.pool.size >= this.maxPoolSize) {
      this.evictOldestConnection();
    }
    
    // 创建新实例
    return this.createNewInstance(env, roomId, poolKey);
  }
  
  /**
   * 创建新的Durable Object实例并添加到连接池
   */
  createNewInstance(env, roomId, poolKey) {
    // 为房间创建Durable Object ID
    const id = env.CHAT_ROOM.idFromName(poolKey);
    // 获取Durable Object实例
    const instance = env.CHAT_ROOM.get(id);
    
    // 设置健康检查状态
    const healthCheck = {
      isHealthy: true,
      lastCheck: Date.now()
    };
    
    // 添加到连接池
    this.pool.set(poolKey, {
      instance,
      lastUsed: Date.now(),
      healthCheck
    });
    
    return instance;
  }
  
  /**
   * 标记连接为不健康
   */
  markAsUnhealthy(roomId) {
    const poolKey = `room-${roomId}`;
    if (this.pool.has(poolKey)) {
      const connectionInfo = this.pool.get(poolKey);
      connectionInfo.healthCheck.isHealthy = false;
      connectionInfo.healthCheck.lastCheck = Date.now();
      
      console.warn({ message_type: 'marking_durable_object_unhealthy', roomId, timestamp: Date.now() });
    }
  }
  
  /**
   * 执行带重试的Durable Object请求
   */
  async executeWithRetry(roomId, requestFn) {
    const { maxRetries, baseDelay, maxDelay, exponentialBackoff } = this.retryConfig;
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 执行请求
        const result = await requestFn();
        
        // 如果之前标记为不健康，现在恢复健康状态
        if (attempt > 0) {
          const poolKey = `room-${roomId}`;
          if (this.pool.has(poolKey)) {
            const connectionInfo = this.pool.get(poolKey);
            connectionInfo.healthCheck.isHealthy = true;
            connectionInfo.healthCheck.lastCheck = Date.now();
          }
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // 记录错误
        console.error({
          message_type: 'durable_object_request_failed',
          roomId,
          attempt,
          maxRetries,
          error: error.message,
          timestamp: Date.now()
        });
        
        // 判断是否需要重试
        if (attempt >= maxRetries || !this.shouldRetry(error)) {
          // 标记连接为不健康
          this.markAsUnhealthy(roomId);
          throw error;
        }
        
        // 计算重试延迟
        const delay = exponentialBackoff
          ? Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
          : baseDelay;
          
        // 添加随机抖动以防止雪崩效应
        const jitter = delay * 0.1 * (Math.random() - 0.5);
        const actualDelay = delay + jitter;
        
        console.log({
          message_type: 'durable_object_retrying',
          roomId,
          attempt,
          delay: actualDelay.toFixed(0),
          timestamp: Date.now()
        });
        
        // 等待重试延迟
        await new Promise(resolve => setTimeout(resolve, actualDelay));
      }
    }
    
    throw lastError;
  }
  
  /**
   * 判断是否应该重试请求
   */
  shouldRetry(error) {
    // 可重试的错误类型
    const retryableErrors = [
      'Connection reset',
      'Network error',
      'Timeout',
      'Internal Server Error',
      'Service Unavailable',
      'Too Many Requests'
    ];
    
    // 检查错误消息是否包含可重试的模式
    const errorMessage = error.message || '';
    return retryableErrors.some(retryable => 
      errorMessage.toLowerCase().includes(retryable.toLowerCase())
    ) || 
    // 检查HTTP状态码
    (error.status && [500, 502, 503, 504, 429].includes(error.status));
  }
  
  /**
   * 启动定期清理过期连接
   */
  startCleanupInterval() {
    // 每5分钟清理一次过期连接
    setInterval(() => {
      this.cleanupExpiredConnections();
    }, 300000);
  }
  
  /**
   * 清理过期连接
   */
  cleanupExpiredConnections() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [poolKey, connectionInfo] of this.pool.entries()) {
      // 清理长时间未使用的连接
      if (now - connectionInfo.lastUsed > this.connectionTimeout) {
        this.pool.delete(poolKey);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log({
        message_type: 'durable_object_pool_cleanup',
        cleanedCount,
        remainingCount: this.pool.size,
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * 驱逐最旧的连接
   */
  evictOldestConnection() {
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (const [poolKey, connectionInfo] of this.pool.entries()) {
      if (connectionInfo.lastUsed < oldestTime) {
        oldestTime = connectionInfo.lastUsed;
        oldestKey = poolKey;
      }
    }
    
    if (oldestKey) {
      this.pool.delete(oldestKey);
      console.log({
        message_type: 'durable_object_evicted',
        roomId: oldestKey.replace('room-', ''),
        poolSize: this.pool.size,
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * 获取连接池状态
   */
  getStatus() {
    return {
      poolSize: this.pool.size,
      maxPoolSize: this.maxPoolSize,
      connectionTimeout: this.connectionTimeout,
      retryConfig: this.retryConfig,
      activeConnections: Array.from(this.pool.keys()).map(key => key.replace('room-', ''))
    };
  }
}

// 创建全局连接池实例
const durableObjectPool = new DurableObjectPool();

// 启动全局资源清理
startGlobalCleanupInterval();

/**
 * 处理WebSocket请求
 */
async function processWebSocketRequest(request, env, ctx, clientIP, startTime, requestId, logContext) {
  // 从URL中提取房间ID
  const url = new URL(request.url);
  const roomId = url.pathname.split('/')[2];
  
  if (!roomId || typeof roomId !== 'string' || roomId.trim().length === 0) {
    return respondWithError(400, '房间ID不能为空', request, startTime, requestId, logContext);
  }
  
  // 验证JWT token
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return respondWithError(401, '未提供认证token', request, startTime, requestId, logContext);
  }
  
  try {
    // 增强的token验证
    const user = await verifyToken(request, env.JWT_SECRET, env);
    
    if (!user) {
      return respondWithError(401, '无效的认证token', request, startTime, requestId, logContext);
    }
    
    // 检查用户状态
    if (user.status !== 'active') {
      return respondWithError(403, '用户账号已被禁用', request, startTime, requestId, logContext);
    }
    
    // 验证房间ID格式
    try {
      const validatedRoomId = ValidationUtils.validateGroupId(roomId);
      
      // 将用户信息添加到请求中
      const newUrl = new URL(request.url);
      newUrl.searchParams.set('userId', user.userId);
      newUrl.searchParams.set('userName', user.username);
      newUrl.searchParams.set('roomId', validatedRoomId);
      
      // 使用连接池获取Durable Object实例并执行带重试的请求
      const response = await durableObjectPool.executeWithRetry(validatedRoomId, async () => {
        // 从连接池获取Durable Object实例
        const chatRoom = durableObjectPool.getInstance(env, validatedRoomId);
        
        // 将请求转发给Durable Object
        return await chatRoom.fetch(newUrl, {
          headers: request.headers,
          method: request.method,
        body: request.body
      });
      
      const endTime = performance.now();
      const enhancedHeaders = new Headers(response.headers);
      enhancedHeaders.set('x-processing-time', `${endTime - startTime}ms`);
      enhancedHeaders.set('x-request-id', requestId);
      
      // 记录连接开始
      console.log({
        message_type: 'websocket_connection_established',
        user_id: user.userId,
        username: user.username,
        room_id: validatedRoomId,
        ...logContext,
        timestamp: Date.now()
      });
      
      // 添加连接到跟踪器
      connectionTracker.addConnection(clientIP, user.userId, {
        roomId: validatedRoomId,
        username: user.username,
        connectedAt: Date.now()
      });
      
      return new Response(response.body, {
        ...response,
        headers: enhancedHeaders
      });
    } catch (validationError) {
      return respondWithError(400, validationError.message, request, startTime, requestId, logContext);
    }
  } catch (error) {
    console.error({
      message_type: 'websocket_authentication_error',
      error: error.message,
      ...logContext,
      timestamp: Date.now()
    });
    
    return respondWithError(401, '认证失败', request, startTime, requestId, logContext);
  }
}

/**
 * 处理性能报告请求 - 增强版
 */
async function processPerformanceReportRequest(request, env, clientIP, startTime, requestId, logContext) {
  // 验证是否有权限访问性能数据
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return respondWithError(401, '未授权', request, startTime, requestId, logContext);
  }
  
  try {
    const token = authHeader.split(' ')[1];
    const user = await verifyToken(token, env.JWT_SECRET, env);
    
    // 增强的权限检查
    if (!user || !user.roles || !user.roles.includes('admin') && !user.roles.includes('monitor')) {
      return respondWithError(403, '没有权限访问此资源', request, startTime, requestId, logContext);
    }
    
    // 解析请求参数
    const url = new URL(request.url);
    const timeRange = url.searchParams.get('timeRange') || '1h'; // 默认1小时
    const includeHistorical = url.searchParams.get('includeHistorical') === 'true';
    const includeAlerts = url.searchParams.get('includeAlerts') === 'true';
    const includeRecommendations = url.searchParams.get('includeRecommendations') === 'true';
    
    // 获取当前性能数据
    const currentPerformanceData = connectionTracker.getPerformanceReport();
    
    // 准备响应数据
    const responseData = {
      success: true,
      timestamp: new Date().toISOString(),
      request_id: requestId,
      current: currentPerformanceData,
      query: {
        timeRange,
        includeHistorical,
        includeAlerts,
        includeRecommendations
      }
    };
    
    // 处理历史数据查询
    if (includeHistorical) {
      try {
        const historicalData = await getHistoricalPerformanceData(env, timeRange);
        responseData.historical = historicalData;
        
        // 执行性能趋势分析
        if (historicalData && historicalData.length > 1) {
          responseData.trends = analyzePerformanceTrends(historicalData, currentPerformanceData);
        }
      } catch (historicalError) {
        console.warn({
          message_type: 'historical_data_error',
          error: historicalError.message,
          ...logContext,
          timestamp: Date.now()
        });
        responseData.historical_error = '无法获取历史数据: ' + historicalError.message;
      }
    }
    
    // 生成性能告警
    if (includeAlerts) {
      responseData.alerts = generatePerformanceAlerts(currentPerformanceData, responseData.trends);
    }
    
    // 生成性能优化建议
    if (includeRecommendations) {
      responseData.recommendations = generatePerformanceRecommendations(
        currentPerformanceData,
        responseData.trends,
        responseData.alerts
      );
    }
    
    const endTime = performance.now();
    const response = new Response(JSON.stringify(responseData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        ...handleCors(request, env),
        'x-processing-time': `${endTime - startTime}ms`,
        'x-request-id': requestId,
        'Cache-Control': 'no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    logResponse(requestId, request, response, startTime, logContext);
    return response;
  } catch (error) {
    console.error({
      message_type: 'performance_report_error',
      error: error.stack || error.message,
      ...logContext,
      timestamp: Date.now()
    });
    
    return respondWithError(500, '获取性能报告失败', request, startTime, requestId, logContext);
  }
}

/**
 * 获取历史性能数据
 */
async function getHistoricalPerformanceData(env, timeRange) {
  // 这里应该从KV存储或数据库中获取历史性能数据
  // 为了演示，我们生成一些模拟数据
  const historicalData = [];
  const now = Date.now();
  let pointsCount;
  let interval;
  
  // 根据时间范围确定数据点数量和间隔
  switch (timeRange) {
    case '1h':
      pointsCount = 60;
      interval = 60000; // 1分钟
      break;
    case '6h':
      pointsCount = 36;
      interval = 600000; // 10分钟
      break;
    case '24h':
      pointsCount = 24;
      interval = 3600000; // 1小时
      break;
    case '7d':
      pointsCount = 7;
      interval = 86400000; // 1天
      break;
    default:
      pointsCount = 60;
      interval = 60000; // 默认1小时，每分钟一个点
  }
  
  // 生成模拟历史数据
  for (let i = pointsCount - 1; i >= 0; i--) {
    const timestamp = now - (i * interval);
    const avgConnections = Math.floor(Math.random() * 50) + 10;
    const avgResponseTime = Math.floor(Math.random() * 100) + 50;
    const errorRate = Math.random() * 0.05; // 最多5%的错误率
    
    historicalData.push({
      timestamp: new Date(timestamp).toISOString(),
      connections: {
        active: avgConnections,
        peak: Math.floor(avgConnections * (1 + Math.random() * 0.2)),
        total: Math.floor(avgConnections * 24 * 3600 / interval)
      },
      response_times: {
        avg: avgResponseTime,
        p95: Math.floor(avgResponseTime * 1.5),
        p99: Math.floor(avgResponseTime * 2)
      },
      error_rates: {
        request: errorRate,
        websocket: errorRate * 0.5
      },
      throughput: {
        messages: Math.floor(Math.random() * 1000) + 100,
        requests: Math.floor(Math.random() * 10000) + 1000
      }
    });
  }
  
  return historicalData;
}

/**
 * 分析性能趋势
 */
function analyzePerformanceTrends(historicalData, currentData) {
  if (!historicalData || historicalData.length < 2) {
    return null;
  }
  
  const trends = {};
  const recentHistory = historicalData.slice(-10); // 使用最近10个数据点
  
  // 分析连接趋势
  const connectionTrend = determineOverallTrend(recentHistory.map(d => d.connections.active), currentData.connections.active);
  trends.connections = {
    trend: connectionTrend,
    direction: connectionTrend > 0 ? 'increasing' : connectionTrend < 0 ? 'decreasing' : 'stable',
    percentage: Math.abs(connectionTrend) * 100
  };
  
  // 分析响应时间趋势
  const responseTimeTrend = determineOverallTrend(recentHistory.map(d => d.response_times.avg), currentData.response_times.avg);
  trends.response_time = {
    trend: responseTimeTrend,
    direction: responseTimeTrend > 0 ? 'increasing' : responseTimeTrend < 0 ? 'decreasing' : 'stable',
    percentage: Math.abs(responseTimeTrend) * 100,
    severity: responseTimeTrend > 0.1 ? 'high' : responseTimeTrend > 0.05 ? 'medium' : 'low'
  };
  
  // 分析错误率趋势
  const errorRateTrend = determineOverallTrend(recentHistory.map(d => d.error_rates.request), currentData.error_rates.request);
  trends.error_rate = {
    trend: errorRateTrend,
    direction: errorRateTrend > 0 ? 'increasing' : errorRateTrend < 0 ? 'decreasing' : 'stable',
    percentage: Math.abs(errorRateTrend) * 100,
    severity: errorRateTrend > 0.2 ? 'high' : errorRateTrend > 0.1 ? 'medium' : 'low'
  };
  
  return trends;
}

/**
 * 确定整体趋势
 */
function determineOverallTrend(historicalValues, currentValue) {
  if (!historicalValues || historicalValues.length === 0) return 0;
  
  // 计算最近历史数据的平均值
  const avgHistorical = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length;
  
  // 计算变化百分比
  const changePercentage = ((currentValue - avgHistorical) / avgHistorical) || 0;
  
  // 限制在合理范围内
  return Math.max(-1, Math.min(1, changePercentage));
}

/**
 * 生成性能告警
 */
function generatePerformanceAlerts(currentData, trends) {
  const alerts = [];
  
  // 检查连接数
  if (currentData.connections.active > PERFORMANCE_CONFIG.MAX_ACTIVE_CONNECTIONS * 0.8) {
    alerts.push({
      type: 'connection_high',
      severity: 'warning',
      message: `当前活跃连接数(${currentData.connections.active})接近最大限制(${PERFORMANCE_CONFIG.MAX_ACTIVE_CONNECTIONS})`,
      timestamp: new Date().toISOString(),
      data: {
        current: currentData.connections.active,
        max: PERFORMANCE_CONFIG.MAX_ACTIVE_CONNECTIONS,
        percentage: (currentData.connections.active / PERFORMANCE_CONFIG.MAX_ACTIVE_CONNECTIONS) * 100
      }
    });
  }
  
  // 检查响应时间
  if (currentData.response_times.p95 > PERFORMANCE_CONFIG.SLOW_REQUEST_THRESHOLD) {
    alerts.push({
      type: 'response_time_high',
      severity: 'warning',
      message: `P95响应时间(${currentData.response_times.p95}ms)超过阈值(${PERFORMANCE_CONFIG.SLOW_REQUEST_THRESHOLD}ms)`,
      timestamp: new Date().toISOString(),
      data: {
        p95: currentData.response_times.p95,
        threshold: PERFORMANCE_CONFIG.SLOW_REQUEST_THRESHOLD
      }
    });
  }
  
  // 检查错误率
  if (currentData.error_rates.request > 0.05) { // 5% 错误率
    alerts.push({
      type: 'error_rate_high',
      severity: 'critical',
      message: `请求错误率(${currentData.error_rates.request.toFixed(2)}%)超过5%阈值`,
      timestamp: new Date().toISOString(),
      data: {
        current: currentData.error_rates.request,
        threshold: 0.05
      }
    });
  }
  
  // 根据趋势添加告警
  if (trends) {
    if (trends.error_rate.severity === 'high' && trends.error_rate.direction === 'increasing') {
      alerts.push({
        type: 'error_rate_increasing',
        severity: 'critical',
        message: `错误率正在快速增加(${trends.error_rate.percentage.toFixed(1)}%)，请立即检查系统`,
        timestamp: new Date().toISOString(),
        data: trends.error_rate
      });
    }
    
    if (trends.response_time.severity === 'high' && trends.response_time.direction === 'increasing') {
      alerts.push({
        type: 'response_time_degrading',
        severity: 'warning',
        message: `系统响应时间正在严重下降(${trends.response_time.percentage.toFixed(1)}%)`,
        timestamp: new Date().toISOString(),
        data: trends.response_time
      });
    }
  }
  
  return alerts;
}

/**
 * 生成性能优化建议
 */
function generatePerformanceRecommendations(currentData, trends, alerts) {
  const recommendations = [];
  
  // 基于连接数的建议
  if (currentData.connections.active > PERFORMANCE_CONFIG.MAX_ACTIVE_CONNECTIONS * 0.7) {
    recommendations.push({
      type: 'scaling',
      priority: 'medium',
      message: '考虑增加服务器资源或启用自动扩展以应对高连接负载',
      impact: '高',
      implementation: '中等难度'
    });
  }
  
  // 基于响应时间的建议
  if (currentData.response_times.avg > 100) {
    recommendations.push({
      type: 'optimization',
      priority: 'high',
      message: `优化响应时间，当前平均值为${currentData.response_times.avg}ms`,
      details: [
        '检查数据库查询性能',
        '优化Durable Object通信',
        '考虑添加缓存层'
      ],
      impact: '高',
      implementation: '高难度'
    });
  }
  
  // 基于错误率的建议
  if (currentData.error_rates.request > 0.02) { // 2% 错误率
    recommendations.push({
      type: 'reliability',
      priority: 'critical',
      message: '调查并修复错误根源，当前错误率过高',
      details: [
        '检查日志中的错误模式',
        '实现更健壮的错误处理',
        '添加更多的监控点'
      ],
      impact: '极高',
      implementation: '中高难度'
    });
  }
  
  // 基于趋势的建议
  if (trends && trends.response_time.direction === 'increasing') {
    recommendations.push({
      type: 'performance_trend',
      priority: trends.response_time.severity === 'high' ? 'high' : 'medium',
      message: `响应时间呈上升趋势(${trends.response_time.percentage.toFixed(1)}%)，建议提前进行性能优化`,
      impact: '高',
      implementation: '中等难度'
    });
  }
  
  // 常规建议
  recommendations.push({
    type: 'general',
    priority: 'low',
    message: '定期检查和清理WebSocket连接，防止内存泄漏',
    impact: '中等',
    implementation: '低难度'
  });
  
  // 按优先级排序
  return recommendations.sort((a, b) => {
    const priorityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * 处理健康检查请求 - 增强版
 */
async function processHealthCheckRequest(request, clientIP, startTime, requestId, logContext) {
  const endTime = performance.now();
  
  try {
    // 获取系统状态信息
    const uptime = connectionTracker.getUptime() || Math.round((Date.now() - startTime) / 1000);
    const activeConnections = connectionTracker.getConnectionCount();
    const messageQueueSize = connectionTracker.getMessageQueueSize();
    
    // 检查系统资源状态
    const resourceStatus = checkSystemResources();
    
    // 检查关键服务状态
    const serviceStatus = await checkServiceHealth();
    
    // 计算整体健康状态
    const isHealthy = resourceStatus.cpu.status === 'normal' && 
                     resourceStatus.memory.status === 'normal' &&
                     serviceStatus.durable_objects.available &&
                     serviceStatus.database.available;
    
    // 生成详细的健康检查报告
    const healthReport = {
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      request_id: requestId,
      uptime: {
        seconds: uptime,
        readable: formatUptime(uptime)
      },
      connections: {
        active: activeConnections,
        max_allowed: PERFORMANCE_CONFIG.MAX_ACTIVE_CONNECTIONS_PER_USER * 100, // 估算值
        percentage_used: activeConnections > 0 ? 
          Math.round((activeConnections / (PERFORMANCE_CONFIG.MAX_ACTIVE_CONNECTIONS_PER_USER * 100)) * 100) : 0
      },
      message_queue: {
        size: messageQueueSize,
        status: messageQueueSize < 1000 ? 'normal' : 'high'
      },
      resources: resourceStatus,
      services: serviceStatus,
      performance: {
        response_time_ms: parseFloat((endTime - startTime).toFixed(2)),
        request_processing_status: (endTime - startTime) < 100 ? 'fast' : 
                                  (endTime - startTime) < 500 ? 'normal' : 'slow'
      }
    };
    
    const response = new Response(JSON.stringify(healthReport, null, 2), {
      status: isHealthy ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'x-processing-time': `${endTime - startTime}ms`,
        'x-request-id': requestId,
        'x-health-status': isHealthy ? 'healthy' : 'degraded'
      }
    });
    
    // 记录健康检查结果
    console.log({
      message_type: 'health_check_result',
      request_id: requestId,
      status: healthReport.status,
      connections: activeConnections,
      response_time_ms: parseFloat((endTime - startTime).toFixed(2)),
      timestamp: Date.now()
    });
    
    logResponse(requestId, request, response, startTime, logContext);
    return response;
  } catch (error) {
    console.error({
      message_type: 'health_check_error',
      error: error.message,
      request_id: requestId,
      timestamp: Date.now()
    });
    
    // 即使健康检查本身失败，也要返回一个基本的响应
    return respondWithError(500, '健康检查失败', request, startTime, requestId, logContext);
  }
}

/**
 * 检查系统资源状态
 */
function checkSystemResources() {
  // 模拟系统资源检查
  // 在真实环境中，这可能会使用Cloudflare Worker的可用API或外部监控
  return {
    cpu: {
      usage_percent: Math.floor(Math.random() * 30) + 5, // 模拟5-35%的CPU使用率
      status: 'normal' // 简化的状态判断
    },
    memory: {
      usage_mb: Math.floor(Math.random() * 50) + 10, // 模拟10-60MB的内存使用
      status: 'normal'
    },
    network: {
      throughput_kbps: Math.floor(Math.random() * 1000) + 100, // 模拟100-1100 kbps
      latency_ms: Math.floor(Math.random() * 50) + 10, // 模拟10-60 ms
      status: 'normal'
    }
  };
}

/**
 * 检查服务健康状态
 */
async function checkServiceHealth() {
  try {
    // 检查Durable Objects健康状态
    const durableObjectsStatus = {
      available: true,
      latency_ms: Math.floor(Math.random() * 100) + 5, // 模拟5-105 ms
      last_check: new Date().toISOString()
    };
    
    // 检查数据库健康状态
    const databaseStatus = {
      available: true,
      latency_ms: Math.floor(Math.random() * 200) + 10, // 模拟10-210 ms
      last_check: new Date().toISOString()
    };
    
    return {
      durable_objects: durableObjectsStatus,
      database: databaseStatus,
      cache: {
        available: true,
        hit_rate_percent: Math.floor(Math.random() * 30) + 70, // 模拟70-100%命中率
        last_check: new Date().toISOString()
      },
      external_services: {
        authentication: {
          available: true,
          last_check: new Date().toISOString()
        },
        notifications: {
          available: true,
          last_check: new Date().toISOString()
        }
      }
    };
  } catch (error) {
    console.error({
      message_type: 'service_health_check_error',
      error: error.message,
      timestamp: Date.now()
    });
    
    // 即使部分服务检查失败，也返回尽可能多的信息
    return {
      durable_objects: {
        available: false,
        error: error.message,
        last_check: new Date().toISOString()
      },
      database: {
        available: false,
        error: '无法连接',
        last_check: new Date().toISOString()
      }
    };
  }
}

/**
 * 格式化运行时间为可读格式
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const remainingSeconds = seconds % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0) parts.push(`${minutes}分钟`);
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}秒`);
  
  return parts.join(', ');
}

/**
 * 统一错误响应处理
 */
function respondWithError(status, message, request, startTime, requestId, logContext, additionalHeaders = {}) {
  const endTime = performance.now();
  
  // 构建错误响应体
  let body = message;
  let contentType = 'text/plain';
  
  // 对于API错误，返回JSON格式
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    body = JSON.stringify({ error: message, code: status });
    contentType = 'application/json';
  }
  
  const response = new Response(body, {
    status,
    headers: {
      'Content-Type': contentType,
      ...handleCors(request),
      'x-processing-time': `${endTime - startTime}ms`,
      'x-request-id': requestId,
      'X-Content-Type-Options': 'nosniff',
      ...additionalHeaders
    }
  });
  
  // 记录错误响应
  logResponse(requestId, request, response, startTime, logContext);
  
  return response;
}

/**
 * 响应日志记录函数
 */
function logResponse(requestId, request, response, startTime, logContext) {
  const endTime = performance.now();
  const processingTime = endTime - startTime;
  
  // 构建日志对象
  const logData = {
    message_type: 'request_complete',
    request_id: requestId,
    status: response.status,
    processing_time_ms: processingTime.toFixed(2),
    timestamp: Date.now()
  };
  
  // 只记录错误响应或慢请求的详细日志
  if (response.status >= 400 || processingTime > PERFORMANCE_CONFIG.SLOW_REQUEST_THRESHOLD_MS) {
    console.log({ ...logData, ...logContext, is_slow: processingTime > PERFORMANCE_CONFIG.SLOW_REQUEST_THRESHOLD_MS });
  }
  // 调试模式下记录所有请求
  else if (PERFORMANCE_CONFIG.DEBUG_MODE) {
    console.log({ ...logData, path: logContext.path, status: response.status });
  }
}

// 导出Durable Object类
export { ChatRoomDurableObject };