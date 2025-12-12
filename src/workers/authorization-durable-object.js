/**
 * 授权Durable Object类
 * 负责用户认证、会话管理和频道管理
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import ValidationUtils from '../utils/validationUtils';

class AuthorizationDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.app = new Hono();
    this.connections = new Map(); // 存储WebSocket连接
    this.setup();
  }

  async setup() {
    this.setupRoutes();
  }

  setupRoutes() {
    this.app.use('*', async (c, next) => {
      const path = new URL(c.req.url).pathname;
      
      // Skip CORS for WebSocket routes
      if (path === '/ws') {
        return next();
      }
      
      // Apply CORS for other routes
      return cors()(c, next);
    });
    
    // 用户认证相关路由
    this.app.post('/login', async (c) => {
      const { email, password } = await c.req.json();
      
      if (!email || !password) {
        return c.json({ success: false, error: 'Email and password are required' }, 400);
      }

      try {
        const db = this.env.DB;
        const [user] = await db.prepare(
          'SELECT id, email, password_hash, first_name, last_name, avatar_url FROM users WHERE email = ?'
        ).bind(email).all();

        if (!user) {
          return c.json({ success: false, error: 'Invalid email or password' }, 401);
        }

        // 验证密码
        const isValidPassword = await this.verifyPassword(password, user.password_hash);
        if (!isValidPassword) {
          return c.json({ success: false, error: 'Invalid email or password' }, 401);
        }

        // 创建会话
        const sessionId = crypto.randomUUID();
        const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30天
        const token = crypto.randomUUID();
        const tokenHash = await this.hashString(token);

        await db.prepare(
          'INSERT INTO sessions (id, user_id, token, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(sessionId, user.id, token, tokenHash, expiresAt).run();

        return c.json({ 
          success: true, 
          user: {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            avatar_url: user.avatar_url
          },
          session: {
            id: sessionId,
            token,
            expires_at: expiresAt
          }
        });
      } catch (error) {
        console.error('Login error:', error);
        return c.json({ success: false, error: 'Failed to login' }, 500);
      }
    });

    // 获取用户频道列表
    this.app.get('/channels', async (c) => {
      const sessionId = c.req.header('X-Session-Id');
      
      if (!sessionId) {
        return c.json({ success: false, error: 'Session ID is required' }, 401);
      }

      try {
        const db = this.env.DB;
        const [session] = await db.prepare(
          'SELECT user_id FROM sessions WHERE id = ? AND status = ? AND expires_at > unixepoch()'
        ).bind(sessionId, 'active').all();

        if (!session) {
          return c.json({ success: false, error: 'Invalid or expired session' }, 401);
        }

        const channels = await db.prepare(
          `SELECT c.*, COUNT(DISTINCT cu2.user_id) as member_count, GROUP_CONCAT(cu2.user_id) as member_ids
           FROM chat_groups c
           INNER JOIN user_groups cu ON c.id = cu.group_id
           LEFT JOIN user_groups cu2 ON c.id = cu2.group_id
           WHERE cu.user_id = ?
           GROUP BY c.id
           ORDER BY c.created_at DESC`
        ).bind(session.user_id).all();

        const channelsWithMemberArray = channels.map(channel => ({
          ...channel,
          member_ids: channel.member_ids ? channel.member_ids.split(',') : []
        }));

        return c.json({ success: true, channels: channelsWithMemberArray });
      } catch (error) {
        console.error('Get channels error:', error);
        return c.json({ success: false, error: 'Failed to get channels' }, 500);
      }
    });

    // 创建频道
    this.app.post('/channels', async (c) => {
      const sessionId = c.req.header('X-Session-Id');
      const { name, description, is_private, member_ids } = await c.req.json();
      
      if (!sessionId) {
        return c.json({ success: false, error: 'Session ID is required' }, 401);
      }

      if (!name?.trim()) {
        return c.json({ success: false, error: 'Channel name is required' }, 400);
      }

      try {
        const db = this.env.DB;
        const [session] = await db.prepare(
          'SELECT user_id FROM sessions WHERE id = ? AND status = ? AND expires_at > unixepoch()'
        ).bind(sessionId, 'active').all();

        if (!session) {
          return c.json({ success: false, error: 'Invalid or expired session' }, 401);
        }

        const channelId = crypto.randomUUID();

        // 创建频道
        await db.prepare(
          'INSERT INTO chat_groups (id, name, description, creator_id, is_private) VALUES (?, ?, ?, ?, ?)'
        ).bind(channelId, name, description || null, session.user_id, is_private ? 1 : 0).run();

        // 添加创建者为成员
        await db.prepare(
          'INSERT INTO user_groups (id, group_id, user_id) VALUES (?, ?, ?)'
        ).bind(crypto.randomUUID(), channelId, session.user_id).run();

        // 添加其他成员
        if (member_ids && Array.isArray(member_ids) && member_ids.length > 0) {
          const memberValues = member_ids
            .filter(memberId => memberId !== session.user_id) // 跳过创建者
            .map(memberId => `(?, ?, ?)`).join(',');
          
          const memberParams = member_ids
            .filter(memberId => memberId !== session.user_id)
            .flatMap(memberId => [
              crypto.randomUUID(),
              channelId,
              memberId
            ]);

          if (memberParams.length > 0) {
            await db.prepare(
              `INSERT INTO user_groups (id, group_id, user_id) VALUES ${memberValues}`
            ).bind(...memberParams).run();
          }
        }

        // 获取创建的频道信息
        const [channel] = await db.prepare(
          `SELECT c.*, COUNT(DISTINCT cu2.user_id) as member_count, GROUP_CONCAT(cu2.user_id) as member_ids
           FROM chat_groups c
           LEFT JOIN user_groups cu2 ON c.id = cu2.group_id
           WHERE c.id = ?
           GROUP BY c.id`
        ).bind(channelId).all();

        const formattedChannel = {
          ...channel,
          member_ids: channel.member_ids ? channel.member_ids.split(',') : []
        };

        // 通知所有成员
        for (const memberId of formattedChannel.member_ids) {
          const connection = this.connections.get(memberId);
          if (connection && connection.readyState === 1) {
            try {
              connection.send(JSON.stringify({
                type: 'NEW_CHANNEL',
                channel: formattedChannel
              }));
            } catch (error) {
              console.error('Failed to notify user about new channel:', error);
              this.connections.delete(memberId);
            }
          }
        }

        return c.json({ success: true, channel: formattedChannel });
      } catch (error) {
        console.error('Create channel error:', error);
        return c.json({ success: false, error: 'Failed to create channel' }, 500);
      }
    });

    // 邀请用户到频道
    this.app.post('/channels/:channelId/invite', async (c) => {
      const sessionId = c.req.header('X-Session-Id');
      const channelId = c.req.param('channelId');
      const { userIds } = await c.req.json();
      
      if (!sessionId) {
        return c.json({ success: false, error: 'Session ID is required' }, 401);
      }

      try {
        const db = this.env.DB;
        const [session] = await db.prepare(
          'SELECT user_id FROM sessions WHERE id = ? AND status = ? AND expires_at > unixepoch()'
        ).bind(sessionId, 'active').all();

        if (!session) {
          return c.json({ success: false, error: 'Invalid or expired session' }, 401);
        }

        // 验证邀请者是频道成员
        const [membership] = await db.prepare(
          'SELECT 1 FROM user_groups WHERE group_id = ? AND user_id = ?'
        ).bind(channelId, session.user_id).all();

        if (!membership) {
          return c.json({ success: false, error: 'Not a member of this channel' }, 403);
        }

        // 添加新成员
        const memberValues = userIds.map(() => `(?, ?, ?)`).join(',');
        const memberParams = userIds.flatMap(userId => [
          crypto.randomUUID(),
          channelId,
          userId
        ]);

        await db.prepare(
          `INSERT OR IGNORE INTO user_groups (id, group_id, user_id) VALUES ${memberValues}`
        ).bind(...memberParams).run();

        // 获取更新后的频道信息
        const [channel] = await db.prepare(
          `SELECT c.*, COUNT(DISTINCT cu2.user_id) as member_count, GROUP_CONCAT(cu2.user_id) as member_ids
           FROM chat_groups c
           LEFT JOIN user_groups cu2 ON c.id = cu2.group_id
           WHERE c.id = ?
           GROUP BY c.id`
        ).bind(channelId).all();

        const formattedChannel = {
          ...channel,
          member_ids: channel.member_ids ? channel.member_ids.split(',') : []
        };

        // 通知所有成员
        for (const memberId of formattedChannel.member_ids) {
          const connection = this.connections.get(memberId);
          if (connection && connection.readyState === 1) {
            try {
              connection.send(JSON.stringify({
                type: 'CHANNEL_UPDATED',
                channel: formattedChannel
              }));
            } catch (error) {
              console.error('Failed to notify user about channel update:', error);
              this.connections.delete(memberId);
            }
          }
        }

        return c.json({ success: true, channel: formattedChannel });
      } catch (error) {
        console.error('Invite users error:', error);
        return c.json({ success: false, error: 'Failed to invite users' }, 500);
      }
    });

    // 离开频道
    this.app.post('/channels/:channelId/leave', async (c) => {
      const sessionId = c.req.header('X-Session-Id');
      const channelId = c.req.param('channelId');
      
      if (!sessionId) {
        return c.json({ success: false, error: 'Session ID is required' }, 401);
      }

      try {
        const db = this.env.DB;
        const [session] = await db.prepare(
          'SELECT user_id FROM sessions WHERE id = ? AND status = ? AND expires_at > unixepoch()'
        ).bind(sessionId, 'active').all();

        if (!session) {
          return c.json({ success: false, error: 'Invalid or expired session' }, 401);
        }

        // 从频道移除用户
        await db.prepare(
          'DELETE FROM user_groups WHERE group_id = ? AND user_id = ?'
        ).bind(channelId, session.user_id).run();

        // 检查频道是否为空
        const [memberCount] = await db.prepare(
          'SELECT COUNT(*) as count FROM user_groups WHERE group_id = ?'
        ).bind(channelId).all();

        // 如果频道为空，删除它
        if (memberCount.count === 0) {
          await db.prepare(
            'DELETE FROM chat_groups WHERE id = ?'
          ).bind(channelId).run();

          return c.json({ success: true, deleted: true });
        }

        // 获取更新后的频道信息
        const [channel] = await db.prepare(
          `SELECT c.*, COUNT(DISTINCT cu2.user_id) as member_count, GROUP_CONCAT(cu2.user_id) as member_ids
           FROM chat_groups c
           LEFT JOIN user_groups cu2 ON c.id = cu2.group_id
           WHERE c.id = ?
           GROUP BY c.id`
        ).bind(channelId).all();

        const formattedChannel = {
          ...channel,
          member_ids: channel.member_ids ? channel.member_ids.split(',') : []
        };

        // 通知剩余成员
        for (const memberId of formattedChannel.member_ids) {
          const connection = this.connections.get(memberId);
          if (connection && connection.readyState === 1) {
            try {
              connection.send(JSON.stringify({
                type: 'CHANNEL_UPDATED',
                channel: formattedChannel
              }));
            } catch (error) {
              console.error('Failed to notify user about channel update:', error);
              this.connections.delete(memberId);
            }
          }
        }

        // 通知离开的用户
        const leavingUserConnection = this.connections.get(session.user_id);
        if (leavingUserConnection && leavingUserConnection.readyState === 1) {
          try {
            leavingUserConnection.send(JSON.stringify({
              type: 'CHANNEL_LEFT',
              channelId
            }));
          } catch (error) {
            console.error('Failed to notify leaving user:', error);
            this.connections.delete(session.user_id);
          }
        }

        return c.json({ success: true, deleted: false, channel: formattedChannel });
      } catch (error) {
        console.error('Leave channel error:', error);
        return c.json({ success: false, error: 'Failed to leave channel' }, 500);
      }
    });
  }

  async clientConnected(sessionId) {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    
    if (!sessionId) {
      server.close(1008, 'Session ID is required');
      return new Response('Session ID is required', { status: 400 });
    }

    try {
      const db = this.env.DB;
      const [session] = await db.prepare(
        `SELECT s.*, u.id as user_id, u.first_name, u.last_name, u.avatar_url
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.id = ? AND s.status = ? AND s.expires_at > unixepoch()
         LIMIT 1`
      ).bind(sessionId, 'active').all();

      if (!session) {
        server.close(1008, 'Invalid or expired session');
        return new Response('Invalid session', { status: 401 });
      }

      const userId = session.user_id;

      // 存储WebSocket连接
      this.connections.set(userId, server);

      // 通知其他用户
      await this.broadcastUserPresence(userId, true);

      // 配置WebSocket
      server.accept();

      server.addEventListener('message', async (msg) => {
        await this.handleWebSocketMessage(server, msg.data, userId);
      });

      server.addEventListener('close', async () => {
        this.connections.delete(userId);
        await this.broadcastUserPresence(userId, false);
      });

      server.addEventListener('error', async (err) => {
        console.error(`WebSocket error for user ${userId}:`, err);
        this.connections.delete(userId);
        await this.broadcastUserPresence(userId, false);
      });

      return new Response(null, { status: 101, webSocket: client });
    } catch (error) {
      console.error('Client connected error:', error);
      server.close(1011, 'Internal server error');
      return new Response('Internal server error', { status: 500 });
    }
  }

  async broadcastUserPresence(userId, isOnline) {
    const notification = JSON.stringify({
      type: isOnline ? 'USER_CONNECTED' : 'USER_DISCONNECTED',
      userId
    });

    // 广播给所有连接的用户
    for (const [connectedUserId, socket] of this.connections.entries()) {
      if (connectedUserId !== userId && socket.readyState === 1) {
        try {
          socket.send(notification);
        } catch (error) {
          console.error('Failed to send presence notification:', error);
          this.connections.delete(connectedUserId);
        }
      }
    }
  }

  async handleWebSocketMessage(ws, message, userId) {
    try {
      const parsedMessage = JSON.parse(message);
      // 处理WebSocket消息
      switch (parsedMessage.type) {
        case 'typing':
          // 处理输入状态
          this.broadcastTypingStatus(userId, parsedMessage.data.isTyping, parsedMessage.data.channelId);
          break;
        case 'read_receipt':
          // 处理已读回执
          this.handleReadReceipt(userId, parsedMessage.data.messageId, parsedMessage.data.channelId);
          break;
        default:
          console.warn(`Unknown message type: ${parsedMessage.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  broadcastTypingStatus(userId, isTyping, channelId) {
    const notification = JSON.stringify({
      type: 'TYPING',
      data: {
        channelId,
        userId,
        isTyping
      }
    });

    // 获取频道成员
    const db = this.env.DB;
    db.prepare(
      'SELECT user_id FROM user_groups WHERE group_id = ?'
    ).bind(channelId).all()
      .then(users => {
        for (const { user_id } of users) {
          const socket = this.connections.get(user_id);
          if (socket && socket.readyState === 1) {
            try {
              socket.send(notification);
            } catch (error) {
              console.error('Failed to send typing status:', error);
              this.connections.delete(user_id);
            }
          }
        }
      })
      .catch(error => {
        console.error('Failed to get channel users:', error);
      });
  }

  handleReadReceipt(userId, messageId, channelId) {
    // 存储已读状态
    const db = this.env.DB;
    db.prepare(
      'INSERT OR IGNORE INTO message_read_status (message_id, user_id, read_at) VALUES (?, ?, unixepoch())'
    ).bind(messageId, userId).run()
      .catch(error => {
        console.error('Failed to update read receipt:', error);
      });

    // 通知其他用户
    const notification = JSON.stringify({
      type: 'MESSAGE_READ',
      data: {
        messageId,
        userId,
        channelId
      }
    });

    // 获取频道成员
    db.prepare(
      'SELECT user_id FROM user_groups WHERE group_id = ?'
    ).bind(channelId).all()
      .then(users => {
        for (const { user_id } of users) {
          const socket = this.connections.get(user_id);
          if (socket && socket.readyState === 1) {
            try {
              socket.send(notification);
            } catch (error) {
              console.error('Failed to send read receipt:', error);
              this.connections.delete(user_id);
            }
          }
        }
      })
      .catch(error => {
        console.error('Failed to get channel users:', error);
      });
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') === 'websocket') {
        const sessionId = url.searchParams.get('sessionId') || '';
        return this.clientConnected(sessionId);
      }
      return new Response('Expected WebSocket', { status: 400 });
    }

    return this.app.fetch(request);
  }

  // 密码哈希和验证方法
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async verifyPassword(password, hash) {
    const encodedPassword = await this.hashPassword(password);
    return encodedPassword === hash;
  }

  async hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // 检查用户是否有权限访问频道
  async checkChannelAccess(sessionId, channelId) {
    try {
      const db = this.env.DB;
      const [session] = await db.prepare(
        'SELECT user_id FROM sessions WHERE id = ? AND status = ? AND expires_at > unixepoch()'
      ).bind(sessionId, 'active').all();

      if (!session) {
        return false;
      }
      
      const [access] = await db.prepare(
        'SELECT 1 FROM user_groups WHERE group_id = ? AND user_id = ?'
      ).bind(channelId, session.user_id).all();
      
      return !!access;
    } catch (error) {
      console.error('Check channel access error:', error);
      return false;
    }
  }

  // 通知频道更新
  async notifyChannelUpdate(channelId, message) {
    const notification = JSON.stringify({
      type: 'NEW_MESSAGE',
      channelId,
      message
    });

    // 获取频道成员
    const db = this.env.DB;
    const users = await db.prepare(
      'SELECT user_id FROM user_groups WHERE group_id = ?'
    ).bind(channelId).all();

    for (const { user_id } of users) {
      const socket = this.connections.get(user_id);
      if (socket && socket.readyState === 1) {
        try {
          socket.send(notification);
        } catch (error) {
          console.error('Failed to notify channel update:', error);
          this.connections.delete(user_id);
        }
      }
    }
  }
}

export default AuthorizationDurableObject;