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
  // 添加请求开始日志
  console.log(`[register] 收到请求: ${context.request.method} ${context.request.url}`);
  
  // 处理OPTIONS请求
  if (context.request.method === 'OPTIONS') {
    console.log('[register] 处理OPTIONS请求');
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
        console.error('[register] 错误: KV存储不可用，context.env.USER_DATA 为 undefined');
        return new Response(JSON.stringify({
          success: false,
          error: {
            message: '服务器配置错误，请稍后重试',
            details: 'KV存储未正确配置',
            timestamp: new Date().toISOString()
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
      
      console.log('[register] KV存储已配置，准备处理注册请求');

      // 1. 解析请求体
      console.log('[register] 开始解析请求体');
      const requestBody = await context.request.json();
      console.log('[register] 请求体解析成功:', JSON.stringify({
        ...requestBody,
        password: '******' // 不记录明文密码
      }));
      
      // 提取请求参数
      const { nickname, email, password } = requestBody;
      
      // 2. 输入验证
      console.log('[register] 开始验证输入参数');
      if (!nickname || !password) {
        console.error('[register] 错误: 缺少必填字段');
        return new Response(JSON.stringify({
          success: false,
          error: {
            message: '请填写所有必填字段',
            details: '缺少昵称或密码',
            timestamp: new Date().toISOString()
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
        console.error('[register] 错误: 密码长度不足');
        return new Response(JSON.stringify({
          success: false,
          error: {
            message: '密码长度不能少于8个字符',
            details: '密码长度要求至少8个字符',
            timestamp: new Date().toISOString()
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
      console.log('[register] 开始生成唯一用户编码');
      const userCode = await generateUniqueUserCode(context.env.USER_DATA);
      console.log('[register] 生成用户编码成功:', userCode);

      // 4. 密码哈希处理
      console.log('[register] 开始密码哈希处理');
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(password, salt);
      console.log('[register] 密码哈希处理完成');

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
      console.log('[register] 用户数据准备完成:', JSON.stringify({
        id: userData.id,
        user_code: userData.user_code,
        nickname: userData.nickname,
        email: userData.email,
        password_hash: '******',
        created_at: userData.created_at
      }));

      // 6. 存储用户数据到KV
      console.log('[register] 开始存储用户数据到KV');
      // 使用user_code作为主键，方便根据用户编码查询
      await context.env.USER_DATA.put(`user:${userCode}`, JSON.stringify(userData));
      console.log(`[register] 用户数据已存储，主键: user:${userCode}`);
      
      // 如果有邮箱，也存储一份映射，方便根据邮箱查询
      if (email) {
        await context.env.USER_DATA.put(`email:${email.toLowerCase()}`, userCode);
        console.log(`[register] 邮箱映射已存储，主键: email:${email.toLowerCase()}`);
      }

      // 7. 生成JWT token（简化实现）
      const token = `mock-token-${Date.now()}-${userId}`;
      console.log('[register] 生成token成功:', token);

      // 8. 返回成功响应
      console.log('[register] 准备返回成功响应');
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
      console.error('[register] 错误: 注册失败', error);
      console.error('[register] 错误堆栈:', error.stack);
      
      // 确定错误类型和状态码
      let errorMessage = '注册失败，请稍后重试';
      let errorDetails = error.message || '未知错误';
      let statusCode = 500;
      
      // 根据错误类型返回不同的错误信息
      if (error instanceof SyntaxError && error.message.includes('Unexpected')) {
        // 请求体解析错误
        errorMessage = '请求格式错误，请检查输入内容';
        errorDetails = `无法解析请求体: ${error.message}`;
        statusCode = 400;
      } else if (error.message === '无法生成唯一用户编码，请稍后重试') {
        // 无法生成唯一用户编码
        errorMessage = '无法生成唯一用户编码，请稍后重试';
        errorDetails = '系统生成用户编码失败，请稍后再试';
        statusCode = 500;
      } else if (error.name === 'TypeError') {
        // 处理类型错误，可能是KV存储未正确配置
        errorMessage = '服务器配置错误，请稍后重试';
        errorDetails = '系统组件未正确初始化';
        statusCode = 500;
      }
      
      console.log(`[register] 返回错误响应: ${statusCode} - ${errorMessage}`);
      
      return new Response(JSON.stringify({
        success: false,
        error: {
          message: errorMessage,
          details: errorDetails,
          timestamp: new Date().toISOString()
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
  console.log('[register] 错误: 不支持的HTTP方法');
  return new Response(JSON.stringify({
    success: false,
    error: {
      message: 'Method Not Allowed',
      details: '当前API只支持POST方法',
      timestamp: new Date().toISOString()
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
