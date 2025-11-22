/**
 * 消息定时清理Worker
 * 负责定期清理超过24小时的过期消息
 */

export default {
  /**
   * 定时触发的主要处理函数
   */
  async scheduled(event, env, ctx) {
    try {
      console.log('Message cleanup scheduled task started');
      
      // 清理24小时前的消息
      await this.cleanupExpiredMessages(env.DB);
      
      console.log('Message cleanup completed successfully');
      
      return new Response('Message cleanup completed', { status: 200 });
    } catch (error) {
      console.error('Error during message cleanup:', error);
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  },
  
  /**
   * 清理过期消息的核心函数
   */
  async cleanupExpiredMessages(db) {
    try {
      // 计算24小时前的时间戳
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      // 执行清理操作
      const result = await db.prepare(
        'DELETE FROM messages WHERE created_at < ?'
      ).bind(twentyFourHoursAgo).run();
      
      console.log(`Cleaned up ${result.meta.changes || 0} expired messages`);
      
      return result.meta.changes || 0;
    } catch (error) {
      console.error('Failed to cleanup expired messages:', error);
      throw error;
    }
  },
  
  /**
   * 处理HTTP请求（如果需要手动触发清理）
   */
  async fetch(request, env, ctx) {
    // 验证请求方法
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    
    // 验证授权（可选：添加API密钥验证）
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${env.CLEANUP_API_KEY}`) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    try {
      // 执行清理
      const deletedCount = await this.cleanupExpiredMessages(env.DB);
      
      return new Response(JSON.stringify({
        status: 'success',
        deletedCount
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error) {
      return new Response(JSON.stringify({
        status: 'error',
        message: error.message
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
  }
};