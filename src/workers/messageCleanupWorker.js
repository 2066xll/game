/**
 * 消息定时清理Worker
 * 负责定期清理过期消息，优化数据库性能
 */

export default {
  /**
   * 定时触发的主要处理函数
   * 处理Cloudflare Scheduled Event
   */
  async scheduled(event, env, ctx) {
    console.log('Message cleanup scheduled task started');
    
    // 确保异步任务完成
    ctx.waitUntil(this.processCleanup(env));
    
    // 立即返回响应
    return new Response('Message cleanup started', { status: 200 });
  },
  
  /**
   * 处理清理任务的异步函数
   * @param {Object} env - 环境变量和绑定
   */
  async processCleanup(env) {
    try {
      // 验证数据库绑定是否存在
      if (!env.DB) {
        throw new Error('Database binding not found');
      }
      
      // 清理过期消息
      const deletedCount = await this.cleanupExpiredMessages(env.DB);
      console.log(`Message cleanup completed successfully, deleted ${deletedCount} messages`);
    } catch (error) {
      console.error('Error during message cleanup:', error);
      // 记录详细错误信息，包括堆栈跟踪
      console.error('Error stack:', error.stack);
    }
  },
  
  /**
   * 清理过期消息的核心函数
   * @param {Object} db - D1数据库实例
   * @returns {number} 删除的消息总数
   */
  async cleanupExpiredMessages(db) {
    try {
      // 计算24小时前的时间戳
      const now = Date.now();
      const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
      
      console.log(`Cleaning up messages older than ${new Date(twentyFourHoursAgo).toISOString()}`);
      
      // 先检查表是否存在并能正常访问
      try {
        const checkResult = await db.prepare('SELECT 1 FROM messages LIMIT 1').all();
        console.log('Database connection successful');
      } catch (dbError) {
        console.error('Database access error:', dbError);
        // 表可能不存在，尝试创建表（如果权限允许）
        try {
          await this.ensureMessageTableExists(db);
        } catch (createError) {
          console.warn('Could not create messages table:', createError.message);
          // 继续执行删除操作，让数据库错误自然抛出
        }
      }
      
      // 清理活跃消息（未标记为已删除且超过24小时的消息）
      const result = await db.prepare(
        'DELETE FROM messages WHERE created_at < ? AND is_deleted = 0'
      ).bind(twentyFourHoursAgo).run();
      
      const activeDeletedCount = result.meta?.changes || 0;
      console.log(`Cleaned up ${activeDeletedCount} expired active messages`);
      
      // 对于标记为已删除的消息，设置更长的保留时间（7天）
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      const deletedResult = await db.prepare(
        'DELETE FROM messages WHERE created_at < ? AND is_deleted = 1'
      ).bind(sevenDaysAgo).run();
      
      const deletedDeletedCount = deletedResult.meta?.changes || 0;
      if (deletedDeletedCount > 0) {
        console.log(`Cleaned up ${deletedDeletedCount} permanently deleted messages`);
      }
      
      return activeDeletedCount + deletedDeletedCount;
    } catch (error) {
      console.error('Failed to cleanup expired messages:', error);
      // 提供更详细的错误信息
      throw new Error(`Database cleanup error: ${error.message}`);
    }
  },
  
  /**
   * 确保messages表存在（如果需要）
   * @param {Object} db - D1数据库实例
   */
  async ensureMessageTableExists(db) {
    try {
      // 创建表的SQL语句
      const createTableSql = `
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          is_deleted INTEGER DEFAULT 0
        );
      `;
      
      await db.exec(createTableSql);
      console.log('Messages table ensured');
    } catch (error) {
      console.error('Error creating messages table:', error);
      throw error;
    }
  },
  
  /**
   * 处理HTTP请求（用于手动触发清理）
   */
  async fetch(request, env, ctx) {
    // 验证请求方法
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 405
      });
    }
    
    // 验证授权
    const authHeader = request.headers.get('Authorization');
    const expectedHeader = `Bearer ${env.CLEANUP_API_KEY || ''}`;
    
    if (!authHeader || authHeader !== expectedHeader) {
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Unauthorized', code: 'UNAUTHORIZED' }
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 401
      });
    }
    
    try {
      // 确保异步任务完成
      ctx.waitUntil(this.processCleanup(env));
      
      // 返回即时响应，告知清理已开始
      return new Response(JSON.stringify({
        success: true,
        message: 'Cleanup process started',
        status: 'processing'
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 202
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: { message: error.message, code: 'INTERNAL_ERROR' }
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
  }
};