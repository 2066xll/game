/**
 * 处理注册请求的Pages Function
 */

import bcrypt from 'bcryptjs';

/**
 * 生成6位数唯一用户编码
 * @param {KVNamespace} kv - KV存储实例
 * @returns {Promise<string>} - 唯一的6位数用户编码
 */
async function generateUniqueUserCode(kv) {
  const MAX_ATTEMPTS = 100;
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    // 生成6位数随机编码
    const userCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 检查KV中是否已存在该编码
    const existingUser = await kv.get(`user:${userCode}`);
    
    if (!existingUser) {
      // 编码唯一，返回
      return userCode;
    }
    
    attempts++;
  }
  
  // 如果尝试多次仍未找到唯一编码，抛出错误
  throw new Error('无法生成唯一用户编码，请稍后重试');
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
      // 检查KV存储是否可用
      if (!context.env.USER_DATA) {
        console.error('注册失败：KV存储不可用，context.env.USER_DATA 为 undefined');
        return new Response(JSON.stringify({
          success: false,
          error: {
            message: '服务器配置错误，请稍后重试',
            details: 'KV存储未正确配置'
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

      // 1. 解析请求体
      let requestBody;
      try {
        requestBody = await context.request.json();
      } catch (parseError) {
        console.error('解析请求体失败:', parseError);
        return new Response(JSON.stringify({
          success: false,
          error: {
            message: '请求格式错误，请检查输入内容',
            details: '无法解析请求体'
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

      const { nickname, email, password } = requestBody;

      // 2. 输入验证
      if (!nickname || !password) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            message: '请填写所有必填字段'
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

      // 密码强度验证
      if (password.length < 8) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            message: '密码长度不能少于8个字符'
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

      // 3. 生成唯一6位数用户编码
      const userCode = await generateUniqueUserCode(context.env.USER_DATA);

      // 4. 密码哈希处理
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(password, salt);

      // 5. 准备用户数据
      const userId = `user-${Date.now()}`;
      const userData = {
        id: userId,
        user_code: userCode,
        nickname: nickname,
        email: email || null,
        password_hash: passwordHash,
        created_at: new Date().toISOString()
      };

      // 6. 存储用户数据到KV
      // 使用user_code作为主键，方便根据用户编码查询
      await context.env.USER_DATA.put(`user:${userCode}`, JSON.stringify(userData));
      
      // 如果有邮箱，也存储一份映射，方便根据邮箱查询
      if (email) {
        await context.env.USER_DATA.put(`email:${email.toLowerCase()}`, userCode);
      }

      // 7. 生成JWT token（简化实现）
      const token = `mock-token-${Date.now()}-${userId}`;

      // 8. 返回成功响应
      return new Response(JSON.stringify({
        success: true,
        data: {
          user: {
            id: userData.id,
            user_code: userData.user_code,
            nickname: userData.nickname,
            email: userData.email,
            created_at: userData.created_at
          },
          userCode: userData.user_code,
          token: token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7天后过期
        },
        status: 201
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Set-Cookie': `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`
        },
        status: 201
      });
    } catch (error) {
      console.error('注册失败:', error);
      console.error('错误堆栈:', error.stack);
      
      // 根据错误类型返回不同的错误信息
      let errorMessage = '注册失败，请稍后重试';
      let errorDetails = error.message;
      let statusCode = 500;
      
      // 处理特定类型的错误
      if (error.message === '无法生成唯一用户编码，请稍后重试') {
        errorMessage = '无法生成唯一用户编码，请稍后重试';
        errorDetails = '系统生成用户编码失败，请稍后再试';
      } else if (error.name === 'TypeError') {
        // 处理类型错误，可能是KV存储未正确配置
        errorMessage = '服务器配置错误，请稍后重试';
        errorDetails = '系统组件未正确初始化';
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: {
          message: errorMessage,
          details: errorDetails
        },
        status: statusCode
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        status: statusCode
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
