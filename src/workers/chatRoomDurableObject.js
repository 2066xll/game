/**
 * 聊天房间Durable Object类
 * 负责管理特定聊天群组的所有WebSocket连接和消息广播
 */
import { ValidationUtils } from '../utils/validationUtils';
export class ChatRoomDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    
    // 存储该聊天房间的所有WebSocket连接
    this.connections = new Map();
    
    // 存储用户输入状态
    this.typingUsers = new Set();
    
    // 消息历史缓存（限制数量以节省内存）
    this.messageHistory = [];
    this.maxHistoryLength = 50; // 减少内存使用
    
    // 消息批处理队列
    this.messageBatchQueue = [];
    this.batchInterval = null;
    this.maxBatchSize = 50;
    this.batchDelayMs = 50;
    
    // 房间元数据
    this.roomInfo = null;
  }

  /**
   * 处理WebSocket连接
   */
  async fetch(request) {
    try {
      // 检查是否为WebSocket升级请求
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 400 });
      }

      // 解析URL参数
      const url = new URL(request.url);
      const roomId = url.searchParams.get('roomId');
      const userId = url.searchParams.get('userId');
      const userName = url.searchParams.get('userName');
      const token = url.searchParams.get('token');

      // 验证参数有效性
      if (!ValidationUtils.validateGroupId(roomId) ||
      !ValidationUtils.validateUserId(userId) ||
      !ValidationUtils.validateUserName(userName) ||
      !ValidationUtils.validateToken(token)) {
        return new Response('Invalid parameters', { status: 400 });
      }

      // 获取数据库连接
      const db = this.env.DB;

      // 验证用户是否有权限加入该房间
      const userGroupCheck = await db.prepare(
        'SELECT * FROM user_groups WHERE user_id = ? AND group_id = ?'
      ).bind(userId, roomId).first();

      if (!userGroupCheck) {
        return new Response('User not authorized to access this room', { status: 403 });
      }

      // 获取房间信息
      this.roomInfo = await db.prepare(
        'SELECT * FROM chat_groups WHERE id = ?'
      ).bind(roomId).first();

      if (!this.roomInfo) {
        return new Response('Room not found', { status: 404 });
      }

      // 创建WebSocket对
      const { 0: client, 1: server } = new WebSocketPair();

      // 设置WebSocket连接
      await this.setupWebSocket(server, { userId, userName, roomId });

      // 加载最近的消息历史
      await this.loadMessageHistory(db, roomId);

      // 通知其他用户有新用户加入（使用即时发送）
      this.broadcastMessageImmediate({
        type: 'user_joined',
        data: {
          roomId,
          user: {
            id: userId,
            name: userName
          },
          timestamp: Date.now()
        }
      }, [userId]); // 不发送给刚加入的用户

      // 返回客户端WebSocket
      return new Response(null, {
        status: 101,
        webSocket: client
      });
    } catch (error) {
      console.error('Chat room DO fetch error:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }

  /**
   * 设置WebSocket连接和事件处理
   */
  async setupWebSocket(webSocket, userInfo) {
    // 启动消息批处理机制（如果还没有启动）
    if (!this.batchInterval) {
      this.startBatchProcessing();
    }
    const { userId, userName, roomId } = userInfo;
    // 使用清理后的用户名
    const sanitizedUserName = ValidationUtils.sanitizeInput(userName);

    // 设置WebSocket
    webSocket.accept();

    // 添加连接到连接映射
    this.connections.set(userId, {
      socket: webSocket,
      userName: sanitizedUserName,
      roomId
    });

    // 发送欢迎消息和历史消息
    webSocket.send(JSON.stringify({
      type: 'welcome',
      data: {
        roomId,
        roomName: this.roomInfo?.name,
        messageHistory: this.messageHistory,
        connectedUsers: Array.from(this.connections.entries()).map(([id, conn]) => ({
          id,
          name: conn.userName
        })),
        timestamp: Date.now()
      }
    }));

    // 消息处理
    webSocket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        await this.handleClientMessage(message, userId, userName, roomId);
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        webSocket.send(JSON.stringify({
          type: 'error',
          data: {
            message: 'Failed to process message',
            timestamp: Date.now()
          }
        }));
      }
    };

    // 连接关闭处理
    webSocket.onclose = () => {
      // 从连接映射中移除
      this.connections.delete(userId);
      this.typingUsers.delete(userId);
      
      // 通知其他用户有用户离开（使用即时发送）
      this.broadcastMessageImmediate({
        type: 'user_left',
        data: {
          roomId,
          user: {
            id: userId,
            name: sanitizedUserName
          },
          timestamp: Date.now()
        }
      });
    };

    // 错误处理
    webSocket.onerror = (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
      // 从连接映射中移除
      this.connections.delete(userId);
      this.typingUsers.delete(userId);
    };
  }

  /**
   * 处理客户端消息 - 优化版本
   * 使用批处理和错误隔离提高性能
   */
  async handleClientMessage(message, userId, userName, roomId) {
    try {
      // 参数验证
      if (!message || !message.type) {
        console.error('Invalid message format');
        return;
      }

      const db = this.env.DB;
      const sanitizedUserName = ValidationUtils.sanitizeInput(userName);

      // 根据消息类型处理
      switch (message.type) {
        case 'message': {
          // 验证和清理消息内容
          if (!message.data || typeof message.data.content !== 'string') {
            console.error('Invalid message data');
            return;
          }

          const sanitizedContent = ValidationUtils.sanitizeInput(message.data.content);
          const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const timestamp = Date.now();

          // 创建消息对象
          const chatMessage = {
            id: messageId,
            roomId,
            userId,
            userName: sanitizedUserName,
            content: sanitizedContent,
            timestamp
          };

          // 将消息添加到批处理队列
          this.messageBatchQueue.push({
            type: 'message',
            data: chatMessage
          });

          // 存储消息到数据库（异步，不阻塞）
          this.bulkStoreMessages(db, [chatMessage]);

          // 添加到消息历史缓存
          this.messageHistory.push(chatMessage);
          // 清理消息历史缓存
          this.cleanupMessageHistory();

          // 通知其他用户消息已读状态（通过批处理）
          if (message.data.readReceipts) {
            for (const readReceipt of message.data.readReceipts) {
              if (ValidationUtils.validateMessageId(readReceipt.messageId)) {
                this.messageBatchQueue.push({
                  type: 'message_read',
                  data: {
                    messageId: readReceipt.messageId,
                    userId,
                    timestamp
                  }
                });
              }
            }
          }
          break;
        }

        case 'typing': {
          // 更新输入状态
          if (message.data && message.data.isTyping) {
            this.typingUsers.add(userId);
          } else {
            this.typingUsers.delete(userId);
          }

          // 通过批处理发送输入状态更新
          this.messageBatchQueue.push({
            type: 'typing',
            data: {
              roomId,
              userId,
              userName: sanitizedUserName,
              isTyping: this.typingUsers.has(userId),
              timestamp: Date.now()
            }
          });
          break;
        }

        case 'read_receipt': {
          // 处理已读回执
          if (message.data && ValidationUtils.validateMessageId(message.data.messageId)) {
            const timestamp = Date.now();
            this.messageBatchQueue.push({
              type: 'message_read',
              data: {
                messageId: message.data.messageId,
                userId,
                timestamp
              }
            });

            // 异步更新数据库中的已读状态
            try {
              await db.prepare(
                'INSERT OR IGNORE INTO message_read_status (message_id, user_id, read_at) VALUES (?, ?, ?)'
              ).bind(message.data.messageId, userId, timestamp).run();
            } catch (error) {
              console.error('Failed to update read receipt:', error);
            }
          }
          break;
        }

        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`Failed to handle client message:`, error);
      // 错误隔离，不影响其他消息处理
    }
  }

  /**
   * 启动消息批处理机制
   */
  startBatchProcessing() {
    // 清理现有的定时器
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
    }

    // 设置新的批处理定时器
    this.batchInterval = setInterval(() => {
      this.processMessageBatch();
    }, this.batchDelayMs);
  }

  /**
   * 处理消息批处理队列
   */
  processMessageBatch() {
    if (this.messageBatchQueue.length === 0) return;

    // 获取当前批处理的消息
    const batch = this.messageBatchQueue.splice(0, this.maxBatchSize);

    // 根据消息类型分组，以便更高效地发送
    const messageGroups = new Map();
    for (const message of batch) {
      if (!messageGroups.has(message.type)) {
        messageGroups.set(message.type, []);
      }
      messageGroups.get(message.type).push(message);
    }

    // 向所有连接的用户广播消息
    for (const [userId, connection] of this.connections.entries()) {
      try {
        if (connection.socket.readyState === WebSocket.OPEN) {
          // 根据消息类型分组发送，减少发送次数
          for (const [messageType, messages] of messageGroups.entries()) {
            // 对于输入状态，发送完整的状态而不是单个更新
            if (messageType === 'typing') {
              connection.socket.send(JSON.stringify({
                type: 'typing_status',
                data: {
                  roomId: messages[0].data.roomId,
                  typingUsers: Array.from(this.typingUsers).map(id => ({
                    id,
                    name: this.connections.get(id)?.userName || 'Unknown'
                  })),
                  timestamp: Date.now()
                }
              }));
            } else {
              // 发送其他类型的消息
              for (const message of messages) {
                connection.socket.send(JSON.stringify(message));
              }
            }
          }
        } else {
          // 清理无效连接
          this.connections.delete(userId);
          this.typingUsers.delete(userId);
        }
      } catch (error) {
        console.error(`Error sending batch message to user ${userId}:`, error);
        this.connections.delete(userId);
        this.typingUsers.delete(userId);
      }
    }
  }

  /**
   * 即时发送消息（不通过批处理队列）
   * 用于重要消息如用户加入/离开通知
   */
  broadcastMessageImmediate(message, excludeUsers = []) {
    const messageString = JSON.stringify(message);
    
    for (const [userId, connection] of this.connections.entries()) {
      // 跳过要排除的用户
      if (excludeUsers.includes(userId)) {
        continue;
      }

      try {
        // 检查连接是否仍然有效
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.send(messageString);
        } else {
          // 清理无效连接
          this.connections.delete(userId);
          this.typingUsers.delete(userId);
        }
      } catch (error) {
        console.error(`Error sending immediate message to user ${userId}:`, error);
        this.connections.delete(userId);
        this.typingUsers.delete(userId);
      }
    }
  }

  /**
   * 批量存储消息到数据库
   */
  async bulkStoreMessages(db, messages) {
    try {
      // 使用事务提高性能
      await db.batch(
        messages.map(msg => 
          db.prepare(
            'INSERT INTO chat_messages (id, room_id, user_id, user_name, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(msg.id, msg.roomId, msg.userId, msg.userName, msg.content, msg.timestamp)
        )
      );
    } catch (error) {
      console.error('Failed to bulk store messages:', error);
      // 尝试单个存储作为备选
      for (const msg of messages) {
        try {
          await db.prepare(
            'INSERT INTO chat_messages (id, room_id, user_id, user_name, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(msg.id, msg.roomId, msg.userId, msg.userName, msg.content, msg.timestamp).run();
        } catch (singleError) {
          console.error(`Failed to store individual message ${msg.id}:`, singleError);
        }
      }
    }
  }

  /**
   * 加载消息历史 - 优化版本
   */
  async loadMessageHistory(db, roomId) {
    try {
      // 添加索引提示，使用预编译语句和参数绑定
      const result = await db.prepare(
        'SELECT id, room_id as roomId, user_id as userId, user_name as userName, content, created_at as timestamp FROM chat_messages WHERE room_id = ? ORDER BY created_at DESC LIMIT ?'
      ).bind(roomId, this.maxHistoryLength).all();

      // 反转结果以获得正确的时间顺序，并进行映射
      const messages = (result.results || []).reverse().map(row => ({
        id: row.id,
        roomId: row.roomId,
        userId: row.userId,
        userName: row.userName,
        content: row.content,
        timestamp: row.timestamp
      }));

      // 更新消息历史缓存
      this.messageHistory = messages;
    } catch (error) {
      console.error('Failed to load message history:', error);
      // 使用空数组作为备用
      this.messageHistory = [];
    }
  }

  /**
   * 更新用户输入状态
   */
  updateTypingStatus(userId, isTyping) {
    if (isTyping) {
      this.typingUsers.add(userId);
    } else {
      this.typingUsers.delete(userId);
    }
  }

  /**
   * 生命周期方法 - 定期清理资源
   */
  async alarm() {
    try {
      // 清理过期消息
      const db = this.env.DB;
      const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
      
      // 分步骤执行清理，避免长时间阻塞
      const batchSize = 100;
      let deletedCount = 0;
      let hasMore = true;

      // 添加索引提示，限制每次删除的数量
      while (hasMore) {
        const result = await db.prepare(
          'DELETE FROM chat_messages WHERE created_at < ? LIMIT ? RETURNING id'
        ).bind(twentyFourHoursAgo, batchSize).run();
        
        const deletedIds = (result.results || []).map(row => row.id);
        deletedCount += deletedIds.length;
        
        // 如果删除的行数少于batchSize，说明没有更多记录了
        if (deletedIds.length < batchSize) {
          hasMore = false;
        }
        
        // 短暂暂停，避免长时间占用数据库
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      console.log(`Cleaned up ${deletedCount} expired messages`);

      // 清理消息历史缓存
      this.cleanupMessageHistory();

      // 重启批处理定时器，确保它继续运行
      this.startBatchProcessing();

      // 安排下次清理
      this.state.storage.setAlarm(Date.now() + (60 * 60 * 1000)); // 1小时后再次清理
    } catch (error) {
      console.error('Alarm handler error:', error);
    }
  }

  /**
   * 清理消息历史缓存
   */
  cleanupMessageHistory() {
    try {
      // 仅保留最近的消息
      if (this.messageHistory.length > this.maxHistoryLength) {
        // 使用splice代替shift，减少数组重排序次数
        const removeCount = Math.max(10, this.messageHistory.length - this.maxHistoryLength);
        this.messageHistory.splice(0, removeCount);
      }
    } catch (error) {
      console.error('Error cleaning up message history:', error);
      // 作为最后手段，重置历史记录
      if (this.messageHistory.length > this.maxHistoryLength * 2) {
        this.messageHistory = this.messageHistory.slice(-this.maxHistoryLength);
      }
    }
  }
}
