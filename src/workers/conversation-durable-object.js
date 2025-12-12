/**
 * 会话Durable Object类
 * 负责消息处理、存储和实时广播
 */
import { Hono } from "hono";
import { cors } from "hono/cors";

class ConversationDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.app = new Hono();
    this.setup();
  }

   async setup() {
    this.setupRoutes();
  }

   setupRoutes() {
    this.app.use('*', cors());

    // 获取频道消息
    this.app.get('/channel/messages', async (c) => {
      const channelId = c.req.header('X-Channel-Id');
      const limit = parseInt(c.req.query('limit') || '50');
      const before = c.req.query('before');
      
      if (!channelId) {
        return c.json({ success: false, error: 'Channel ID is required' }, 400);
      }

      try {
        const db = this.env.DB;
        let query = `
          SELECT m.*, u.first_name, u.last_name, u.avatar_url
          FROM messages m
          JOIN users u ON m.sender_id = u.id
          WHERE m.group_id = ?
        `;
        const params = [channelId];

        if (before) {
          query += ' AND m.created_at < ?';
          params.push(before);
        }

        query += ' ORDER BY m.created_at DESC LIMIT ?';
        params.push(limit);

        const messages = await db.prepare(query).bind(...params).all();

        return c.json({ 
          success: true, 
          messages: messages.reverse(), // 按时间升序返回
          hasMore: messages.length === limit 
        });
      } catch (error) {
        console.error('Get messages error:', error);
        return c.json({ success: false, error: 'Failed to get messages' }, 500);
      }
    });

    // 发送消息
    this.app.post('/channel/messages', async (c) => {
      const channelId = c.req.header('X-Channel-Id');
      const sessionId = c.req.header('X-Session-Id');
      
      if (!channelId || !sessionId) {
        return c.json({ success: false, error: 'Channel ID and Session ID are required' }, 400);
      }

      try {
        const db = this.env.DB;
        const authId = this.env.AUTHORIZATION_DURABLE_OBJECT.idFromName('default');
        const authStub = this.env.AUTHORIZATION_DURABLE_OBJECT.get(authId);
        
        // 验证会话和频道访问权限
        const [session] = await db.prepare(
          'SELECT user_id FROM sessions WHERE id = ? AND status = ? AND expires_at > unixepoch()'
        ).bind(sessionId, 'active').all();

        if (!session) {
          return c.json({ success: false, error: 'Invalid or expired session' }, 401);
        }

        const hasAccess = await authStub.checkChannelAccess(sessionId, channelId);
        if (!hasAccess) {
          return c.json({ success: false, error: 'Access denied' }, 403);
        }

        const { content, assets } = await c.req.json();
        
        if (!content?.trim()) {
          return c.json({ success: false, error: 'Message content is required' }, 400);
        }

        const messageId = crypto.randomUUID();
        const assetsJson = JSON.stringify(assets || []);
        const timestamp = Math.floor(Date.now() / 1000);

        // 存储消息
        await db.prepare(
          `INSERT INTO messages (id, group_id, sender_id, content, assets, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(messageId, channelId, session.user_id, content, assetsJson, timestamp).run();

        // 获取完整的消息对象，包括发送者信息
        const [message] = await db.prepare(
          `SELECT m.*, u.first_name, u.last_name, u.avatar_url
           FROM messages m
           JOIN users u ON m.sender_id = u.id
           WHERE m.id = ?`
        ).bind(messageId).all();

        // 通知频道成员
        await authStub.notifyChannelUpdate(channelId, message);
        
        return c.json({ 
          success: true, 
          message 
        });
      } catch (error) {
        console.error('Send message error:', error);
        return c.json({ success: false, error: 'Failed to send message' }, 500);
      }
    });

    // 上传消息附件
    this.app.post('/channel/upload', async (c) => {
      const channelId = c.req.header('X-Channel-Id');
      const sessionId = c.req.header('X-Session-Id');
      
      if (!channelId || !sessionId) {
        return c.json({ success: false, error: 'Channel ID and Session ID are required' }, 400);
      }

      try {
        const db = this.env.DB;
        const authId = this.env.AUTHORIZATION_DURABLE_OBJECT.idFromName('default');
        const authStub = this.env.AUTHORIZATION_DURABLE_OBJECT.get(authId);
        
        // 验证会话和频道访问权限
        const [session] = await db.prepare(
          'SELECT user_id FROM sessions WHERE id = ? AND status = ? AND expires_at > unixepoch()'
        ).bind(sessionId, 'active').all();

        if (!session) {
          return c.json({ success: false, error: 'Invalid or expired session' }, 401);
        }

        const hasAccess = await authStub.checkChannelAccess(sessionId, channelId);
        if (!hasAccess) {
          return c.json({ success: false, error: 'Access denied' }, 403);
        }

        // 获取文件
        const formData = await c.req.formData();
        const file = formData.get('file');
        
        if (!file) {
          return c.json({ success: false, error: 'No file provided' }, 400);
        }

        // 生成唯一文件名
        const fileExtension = file.name.split('.').pop();
        const uniqueFilename = `${channelId}/${crypto.randomUUID()}.${fileExtension}`;

        // 上传到R2存储
        try {
          await this.env.MESSAGE_ASSETS.put(uniqueFilename, file, {
            httpMetadata: {
              contentType: file.type,
            }
          });

          // 生成访问URL
          const assetUrl = `https://pub-b8600d78cd7444e0b66bf753906f5370.r2.dev/${uniqueFilename}`;

          return c.json({ 
            success: true, 
            url: assetUrl
          });
        } catch (error) {
          console.error('File upload error:', error);
          return c.json({ 
            success: false, 
            error: 'Failed to upload file' 
          }, 500);
        }
      } catch (error) {
        console.error('Upload error:', error);
        return c.json({ success: false, error: 'Failed to upload file' }, 500);
      }
    });
  }

  // 24小时消息清理
  async alarm() {
    try {
      const db = this.env.DB;
      const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
      
      // 分批次删除过期消息，避免长时间阻塞
      const batchSize = 100;
      let deletedCount = 0;
      let hasMore = true;

      while (hasMore) {
        const result = await db.prepare(
          'DELETE FROM messages WHERE created_at < ? LIMIT ? RETURNING id'
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

      // 安排下次清理
      this.state.storage.setAlarm(Math.floor(Date.now() / 1000) + (60 * 60)); // 1小时后再次清理
    } catch (error) {
      console.error('Alarm handler error:', error);
    }
  }

  async fetch(request) {
    return this.app.fetch(request);
  }

  // 批量存储消息
   async bulkStoreMessages(db, messages) {
    try {
      await db.batch(
        messages.map(msg => 
          db.prepare(
            `INSERT INTO messages (id, group_id, sender_id, content, assets, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(msg.id, msg.roomId, msg.userId, msg.content, JSON.stringify(msg.attachments || []), msg.timestamp)
        )
      );
    } catch (error) {
      console.error('Failed to bulk store messages:', error);
      // 尝试单个存储作为备选
      for (const msg of messages) {
        try {
          await db.prepare(
            `INSERT INTO messages (id, group_id, sender_id, content, assets, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(msg.id, msg.roomId, msg.userId, msg.content, JSON.stringify(msg.attachments || []), msg.timestamp).run();
        } catch (singleError) {
          console.error(`Failed to store individual message ${msg.id}:`, singleError);
        }
      }
    }
  }
}

export default ConversationDurableObject;