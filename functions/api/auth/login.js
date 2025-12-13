/**
 * 处理登录请求的Pages Function
 */

import bcrypt from 'bcryptjs';

/**
 * 生成JWT token（简化实现）
 * @param {string} userId - 用户ID
 * @returns {string} - JWT令牌
 */
function generateToken(userId) {
  return `mock-token-${Date.now()}-${userId}`;
}

/**
 * 根据标识符查找用户
 * @param {string} identifier - 用户编码或邮箱
 * @param {KVNamespace} kv - KV存储实例
 * @returns {Promise<object|null>} - 用户信息或null
 */
async function findUserByIdentifier(identifier, kv) {
  // 检查是否为用户编码（6位数）
  if (/^\d{6}$/.test(identifier)) {
    // 用户编码登录
    const userJson = await kv.get(`user:${identifier}`);
    return userJson ? JSON.parse(userJson) : null;
  } 
  // 检查是否为邮箱
  else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
    // 邮箱登录
    const userCode = await kv.get(`email:${identifier.toLowerCase()}`);
    if (!userCode) {
      return null;
    }
    
    const userJson = await kv.get(`user:${userCode}`);
    return userJson ? JSON.parse(userJson) : null;
  }
  
  return null;
}

/**
 * 处理所有请求
 */
export async function onRequest(context) {
  // 处理OPTIONS请求
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      status: 200
    });
  }

  // 只处理POST请求
  if (context.request.method === 'POST') {
    try {
      // 1. 解析请求体
      const requestBody = await context.request.json();
      const { identifier, password } = requestBody;

      // 2. 输入验证
      if (!identifier || !password) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            message: '请输入用户名/邮箱和密码'
          },
          status: 400
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          status: 400
        });
      }

      // 3. 根据标识符查找用户
      const user = await findUserByIdentifier(identifier, context.env.USER_DATA);
      
      if (!user) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            message: '用户不存在'
          },
          status: 401
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          status: 401
        });
      }

      // 4. 验证密码
      const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
      
      if (!isPasswordValid) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            message: '密码错误'
          },
          status: 401
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          status: 401
        });
      }

      // 5. 生成token
      const token = generateToken(user.id);

      // 6. 返回成功响应，包含用户所有信息
      return new Response(JSON.stringify({
        success: true,
        data: {
          user: {
            id: user.id,
            user_code: user.user_code,
            nickname: user.nickname,
            email: user.email,
            created_at: user.created_at
          },
          token: token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7天后过期
        },
        status: 200
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Set-Cookie': `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`
        },
        status: 200
      });
    } catch (error) {
      console.error('登录失败:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          message: '登录失败',
          details: error.message
        },
        status: 500
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        status: 500
      });
    }
  }

  // 其他HTTP方法返回405
  return new Response(JSON.stringify({
    success: false,
    error: {
      message: 'Method Not Allowed'
    },
    status: 405
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    status: 405
  });
}
