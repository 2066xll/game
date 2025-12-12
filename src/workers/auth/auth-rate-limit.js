/**
 * 速率限制功能
 * 负责处理API请求的速率限制，防止滥用
 */

// 速率限制中间件
async function rateLimit(request, env, userId = null) {
  try {
    // 如果没有KV存储，跳过速率限制
    if (!env || !env.RATE_LIMIT_STORE) {
      console.warn('Rate limit KV store not available');
      return { allowed: true };
    }
    
    const clientIP = request.headers.get('CF-Connecting-IP') || 
                    request.headers.get('X-Forwarded-For') || 
                    'unknown';
    
    // 基于IP的限制键
    const ipKey = `rate_limit:${clientIP}`;
    
    // 获取当前计数
    const ipCount = await env.RATE_LIMIT_STORE.get(ipKey) || '0';
    const count = parseInt(ipCount, 10);
    
    // 速率限制规则
    const limits = {
      ip: { count: 100, window: 60 }, // IP每分钟100次请求
      auth: { count: 300, window: 60 } // 已认证用户每分钟300次请求
    };
    
    // 选择适用的限制
    const selectedLimit = userId ? limits.auth : limits.ip;
    
    if (count >= selectedLimit.count) {
      // 返回429状态码和重试时间
      const retryAfter = await env.RATE_LIMIT_STORE.getWithMetadata(ipKey).then(({ metadata }) => {
        if (metadata && metadata.expiration) {
          return Math.max(0, Math.ceil((metadata.expiration - Date.now() / 1000)));
        }
        return selectedLimit.window;
      });
      
      return {
        allowed: false,
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': selectedLimit.count.toString(),
          'X-RateLimit-Remaining': '0'
        },
        message: 'Rate limit exceeded. Please try again later.'
      };
    }
    
    // 增加计数，设置过期时间
    await env.RATE_LIMIT_STORE.put(ipKey, (count + 1).toString(), {
      expirationTtl: selectedLimit.window,
      metadata: { expiration: Date.now() / 1000 + selectedLimit.window }
    });
    
    return {
      allowed: true,
      headers: {
        'X-RateLimit-Limit': selectedLimit.count.toString(),
        'X-RateLimit-Remaining': (selectedLimit.count - count - 1).toString()
      }
    };
  } catch (error) {
    console.error('Rate limit error:', error);
    // 速率限制失败不应阻止请求，但应记录错误
    return { allowed: true };
  }
}

export {
  rateLimit
};