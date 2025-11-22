/**
 * 认证Worker
 * 负责处理用户注册、登录、信息管理等认证相关功能
 */

import { createDbInstance, handleDbError } from './database/db.js';

// 生成随机用户编码
function generateUserCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 生成JWT令牌
async function generateToken(userId, env) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天有效期
  
  // 存储令牌哈希值，不存储原始令牌
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const tokenHash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return {
    token,
    tokenHash,
    expiresAt
  };
}

// 验证密码
async function verifyPassword(password, passwordHash) {
  // 在实际环境中，应使用更安全的密码验证方法
  // 这里为简化示例，实际应使用bcrypt或Argon2
  // 注意：在Cloudflare Worker中，需要使用Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const computedHash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return computedHash === passwordHash;
}

// 哈希密码
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// 验证令牌 - 增强版，使用事务和完善的错误处理
async function verifyToken(db, token) {
  // 验证输入
  if (!token) {
    return null;
  }
  
  try {
    // 计算令牌哈希值
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const tokenHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // 开始事务处理
    return await db.transaction(async (tx) => {
      // 查询会话
      const session = await tx.getOne(
        'SELECT * FROM sessions WHERE token_hash = ? AND status = ?',
        [tokenHash, 'active']
      );
      
      if (!session) {
        return null;
      }
      
      // 检查令牌是否过期
      const now = new Date();
      const expiresAt = new Date(session.expires_at);
      
      if (now > expiresAt) {
        // 更新会话状态为过期
        await tx.update(
          'UPDATE sessions SET status = ? WHERE id = ?',
          ['expired', session.id]
        );
        return null;
      }
      
      // 更新最后使用时间
      await tx.update(
        'UPDATE sessions SET last_used = CURRENT_TIMESTAMP WHERE id = ?',
        [session.id]
      );
      
      // 获取用户信息
      const user = await tx.getOne(
        'SELECT id, user_code, nickname, email, created_at, status FROM users WHERE id = ?',
        [session.user_id]
      );
      
      // 检查用户状态
      if (!user || user.status !== 'active') {
        // 自动使会话失效
        await tx.update(
          'UPDATE sessions SET status = ? WHERE id = ?',
          ['invalidated', session.id]
        );
        return null;
      }
      
      return user;
    });
  } catch (error) {
    console.error('Token verification error:', error.message);
    return null;
  }
}

// 中间件：验证认证令牌
async function authenticate(db, request) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Authorization header required' };
  }
  
  const token = authHeader.split(' ')[1];
  const user = await verifyToken(db, token);
  
  if (!user) {
    return { user: null, error: 'Invalid or expired token' };
  }
  
  return { user, error: null };
}

// 处理CORS
function handleCors(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  return corsHeaders;
}

// 注册用户 - 增强版，使用事务和完善的错误处理
async function registerUser(db, env, userData) {
  const { nickname, email, password } = userData;
  
  // 验证输入
  if (!nickname || !email || !password) {
    return { success: false, error: { message: 'Missing required fields', code: 'INVALID_INPUT' }, status: 400 };
  }
  
  try {
    // 生成唯一用户编码
    let userCode;
    let codeExists = true;
    
    while (codeExists) {
      userCode = generateUserCode();
      const existingCode = await db.getOne(
        'SELECT id FROM users WHERE user_code = ?',
        [userCode]
      );
      codeExists = !!existingCode;
    }
    
    // 哈希密码
    const passwordHash = await hashPassword(password);
    
    // 开始事务
    const result = await db.transaction(async (tx) => {
      // 检查邮箱是否已存在（在事务内检查避免竞态条件）
      const existingUser = await tx.getOne(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );
      
      if (existingUser) {
        throw new Error('Email already registered');
      }
      
      // 创建用户
      const userResult = await tx.insert(
        'INSERT INTO users (user_code, nickname, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [userCode, nickname, email, passwordHash]
      );
      
      const userId = userResult.meta.last_insert_rowid;
      
      // 生成令牌
      const { token, tokenHash, expiresAt } = await generateToken(userId, env);
      
      // 存储会话 - 添加额外的会话信息
      await tx.insert(
        'INSERT INTO sessions (user_id, token, token_hash, expires_at, created_at, last_used, status) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)',
        [userId, token, tokenHash, expiresAt.toISOString(), 'active']
      );
      
      return { userId, userCode, token, expiresAt };
    });
    
    // 获取完整用户信息
    const user = await db.getOne(
      'SELECT id, user_code, nickname, email, created_at FROM users WHERE id = ?',
      [result.userId]
    );
    
    // 记录成功注册日志
    console.log(`User registered successfully: ${result.userId}`);
    
    return {
      success: true,
      data: {
        user,
        token: result.token,
        expiresAt: result.expiresAt
      },
      status: 201
    };
  } catch (error) {
    // 增强的错误处理
    console.error('Registration error:', error.message, { email, nickname } ); // 不记录密码
    
    // 根据错误类型返回具体的错误信息
    if (error.message === 'Email already registered') {
      return { 
        success: false, 
        error: { message: 'Email already registered', code: 'EMAIL_EXISTS' }, 
        status: 409 
      };
    }
    
    return { 
      success: false, 
      error: { 
        message: 'Registration failed', 
        details: error.message,
        code: 'DATABASE_ERROR' 
      }, 
      status: 500 
    };
  }
}

// 用户登录 - 增强版，使用事务和完善的错误处理
async function loginUser(db, env, loginData) {
  const { email, password, userCode } = loginData;
  
  // 验证输入
  if (!password || (!email && !userCode)) {
    return { success: false, error: { message: 'Missing required fields', code: 'INVALID_INPUT' }, status: 400 };
  }
  
  try {
    // 开始事务处理
    const result = await db.transaction(async (tx) => {
      // 根据邮箱或用户编码查找用户
      const query = email ? 
        'SELECT id, password_hash, status, failed_login_attempts, lock_until FROM users WHERE email = ?' : 
        'SELECT id, password_hash, status, failed_login_attempts, lock_until FROM users WHERE user_code = ?';
      const params = email ? [email] : [userCode];
      
      const user = await tx.getOne(query, params);
      
      // 安全考虑：即使邮箱不存在，也返回相同的错误信息
      if (!user) {
        throw new Error('Invalid credentials');
      }
      
      // 检查账户是否被禁用
      if (user.status !== 'active') {
        throw new Error('Account is disabled');
      }
      
      // 检查账户是否被锁定
      const now = new Date();
      if (user.lock_until && new Date(user.lock_until) > now) {
        throw new Error('Account temporarily locked due to multiple failed login attempts');
      }
      
      // 验证密码
      const isPasswordValid = await verifyPassword(password, user.password_hash);
      
      if (!isPasswordValid) {
        // 增加失败登录次数
        const failedAttempts = (user.failed_login_attempts || 0) + 1;
        let lockUntil = null;
        
        // 如果失败次数达到5次，锁定账户30分钟
        if (failedAttempts >= 5) {
          lockUntil = new Date(now.getTime() + 30 * 60 * 1000).toISOString(); // 30分钟后解锁
        }
        
        await tx.update(
          'UPDATE users SET failed_login_attempts = ?, lock_until = ? WHERE id = ?',
          [failedAttempts, lockUntil, user.id]
        );
        
        throw new Error('Invalid credentials');
      }
      
      // 重置失败登录次数并更新最后登录时间
      await tx.update(
        'UPDATE users SET failed_login_attempts = 0, lock_until = NULL, last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
      );
      
      // 生成新令牌
      const { token, tokenHash, expiresAt } = await generateToken(user.id, env);
      
      // 存储会话
      await tx.insert(
        'INSERT INTO sessions (user_id, token, token_hash, expires_at, created_at, last_used, status) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)',
        [user.id, token, tokenHash, expiresAt.toISOString(), 'active']
      );
      
      // 获取完整用户信息
      const userInfo = await tx.getOne(
        'SELECT id, user_code, nickname, email, created_at FROM users WHERE id = ?',
        [user.id]
      );
      
      return {
        user: userInfo,
        token,
        expiresAt
      };
    });
    
    // 记录成功登录日志
    console.log(`User logged in successfully: ${result.user.id}`);
    
    return {
      success: true,
      data: result,
      status: 200
    };
  } catch (error) {
    console.error('Login error:', error.message, { email, userCode });
    
    if (error.message === 'Account temporarily locked due to multiple failed login attempts') {
      return { 
        success: false, 
        error: { message: error.message, code: 'ACCOUNT_LOCKED' }, 
        status: 423 
      };
    }
    
    if (error.message === 'Account is disabled') {
      return { 
        success: false, 
        error: { message: error.message, code: 'ACCOUNT_DISABLED' }, 
        status: 403 
      };
    }
    
    if (error.message === 'Invalid credentials') {
      return { 
        success: false, 
        error: { message: error.message, code: 'INVALID_CREDENTIALS' }, 
        status: 401 
      };
    }
    
    return { 
      success: false, 
      error: { message: 'Login failed', details: error.message, code: 'DATABASE_ERROR' }, 
      status: 500 
    };
  }
}

// 获取用户信息
async function getUserInfo(db, userId) {
  try {
    const user = await db.getOne(
      'SELECT id, user_code, nickname, email, created_at, last_login, avatar_url, status FROM users WHERE id = ?',
      [userId]
    );
    
    if (!user) {
      return { success: false, error: { message: 'User not found' }, status: 404 };
    }
    
    return { success: true, data: user, status: 200 };
  } catch (error) {
    console.error('Get user info error:', error);
    return { 
      success: false, 
      error: { message: 'Failed to retrieve user information', details: error.message }, 
      status: 500 
    };
  }
}

// 更新用户信息
async function updateUserInfo(db, userId, updateData) {
  const { nickname, avatarUrl } = updateData;
  
  try {
    // 准备更新字段
    const fields = [];
    const params = [];
    
    if (nickname !== undefined) {
      fields.push('nickname = ?');
      params.push(nickname);
    }
    
    if (avatarUrl !== undefined) {
      fields.push('avatar_url = ?');
      params.push(avatarUrl);
    }
    
    if (fields.length === 0) {
      return { success: false, error: { message: 'No fields to update' }, status: 400 };
    }
    
    // 添加用户ID到参数
    params.push(userId);
    
    // 执行更新
    await db.update(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
    
    // 获取更新后的用户信息
    const updatedUser = await db.getOne(
      'SELECT id, user_code, nickname, email, created_at, avatar_url FROM users WHERE id = ?',
      [userId]
    );
    
    return { success: true, data: updatedUser, status: 200 };
  } catch (error) {
    console.error('Update user info error:', error);
    return { 
      success: false, 
      error: { message: 'Failed to update user information', details: error.message }, 
      status: 500 
    };
  }
}

// 修改密码 - 增强版，使用事务和完善的错误处理
async function changePassword(db, userId, passwordData) {
  const { oldPassword, newPassword } = passwordData;
  
  // 验证输入
  if (!oldPassword || !newPassword) {
    return { success: false, error: { message: 'Missing required fields', code: 'INVALID_INPUT' }, status: 400 };
  }
  
  // 验证新密码强度
  if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return { 
      success: false, 
      error: { 
        message: 'New password must be at least 8 characters and contain both letters and numbers', 
        code: 'WEAK_PASSWORD' 
      }, 
      status: 400 
    };
  }
  
  try {
    // 开始事务处理
    const result = await db.transaction(async (tx) => {
      // 获取用户当前密码哈希
      const user = await tx.getOne(
        'SELECT password_hash FROM users WHERE id = ?',
        [userId]
      );
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // 验证旧密码
      const isOldPasswordValid = await verifyPassword(oldPassword, user.password_hash);
      
      if (!isOldPasswordValid) {
        throw new Error('Invalid old password');
      }
      
      // 哈希新密码
      const newPasswordHash = await hashPassword(newPassword);
      
      // 更新密码和相关时间戳
      await tx.update(
        'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP, password_changed_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newPasswordHash, userId]
      );
      
      // 使所有其他会话失效（安全措施）
      const invalidateResult = await tx.update(
        'UPDATE sessions SET status = ? WHERE user_id = ? AND status = ?',
        ['expired', userId, 'active']
      );
      
      return { sessionsInvalidated: invalidateResult.meta.changes || 0 };
    });
    
    // 记录密码更改日志
    console.log(`Password changed successfully for user: ${userId}, invalidated ${result.sessionsInvalidated} sessions`);
    
    return { 
      success: true, 
      message: 'Password changed successfully', 
      sessionsInvalidated: result.sessionsInvalidated,
      status: 200 
    };
  } catch (error) {
    console.error('Change password error:', error.message, { userId });
    
    if (error.message === 'User not found') {
      return { 
        success: false, 
        error: { message: error.message, code: 'USER_NOT_FOUND' }, 
        status: 404 
      };
    }
    
    if (error.message === 'Invalid old password') {
      return { 
        success: false, 
        error: { message: error.message, code: 'INVALID_PASSWORD' }, 
        status: 401 
      };
    }
    
    return { 
      success: false, 
      error: { 
        message: 'Failed to change password', 
        details: error.message, 
        code: 'DATABASE_ERROR' 
      }, 
      status: 500 
    };
  }
}

// 刷新令牌 - 增强版，使用事务和完善的错误处理
async function refreshToken(db, env, token) {
  // 验证输入
  if (!token) {
    return { success: false, error: { message: 'Missing token', code: 'INVALID_INPUT' }, status: 400 };
  }
  
  try {
    // 计算旧令牌哈希值，用于后续查询
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const tokenHashToRevoke = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // 开始事务处理
    const result = await db.transaction(async (tx) => {
      // 查找当前会话
      const session = await tx.getOne(
        'SELECT id, user_id, created_at FROM sessions WHERE token_hash = ? AND status = ?',
        [tokenHashToRevoke, 'active']
      );
      
      if (!session) {
        throw new Error('Invalid or expired token');
      }
      
      // 检查会话是否被滥用（短时间内频繁刷新）
      const sessionAge = Date.now() - new Date(session.created_at).getTime();
      if (sessionAge < 60000) { // 少于1分钟
        throw new Error('Token refresh too frequent');
      }
      
      // 生成新令牌
      const { token: newToken, tokenHash, expiresAt } = await generateToken(session.user_id, env);
      
      // 存储新会话 - 保存完整信息
      await tx.insert(
        'INSERT INTO sessions (user_id, token, token_hash, expires_at, created_at, last_used, status) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)',
        [session.user_id, newToken, tokenHash, expiresAt.toISOString(), 'active']
      );
      
      // 将旧令牌标记为已撤销
      const invalidateResult = await tx.update(
        'UPDATE sessions SET status = ?, revoked_at = CURRENT_TIMESTAMP, revoked_reason = ? WHERE token_hash = ?',
        ['revoked', 'refreshed', tokenHashToRevoke]
      );
      
      if (invalidateResult.meta.changes !== 1) {
        throw new Error('Failed to invalidate old token');
      }
      
      return { newToken, expiresAt, sessionId: session.id };
    });
    
    // 记录令牌刷新日志
    console.log(`Token refreshed successfully for user session: ${result.sessionId}`);
    
    return {
      success: true,
      data: {
        token: result.newToken,
        expiresAt: result.expiresAt
      },
      status: 200
    };
  } catch (error) {
    console.error('Refresh token error:', error.message);
    
    if (error.message === 'Token refresh too frequent') {
      return { 
        success: false, 
        error: { message: error.message, code: 'RATE_LIMIT' }, 
        status: 429 
      };
    }
    
    return { 
      success: false, 
      error: { message: 'Failed to refresh token', details: error.message, code: 'DATABASE_ERROR' }, 
      status: 500 
    };
  }
}

// 注销登录
async function logout(db, token) {
  try {
    // 计算令牌哈希值
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const tokenHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // 标记会话为已撤销
    await db.update(
      'UPDATE sessions SET status = ? WHERE token_hash = ?',
      ['revoked', tokenHash]
    );
    
    return { success: true, message: 'Logged out successfully', status: 200 };
  } catch (error) {
    console.error('Logout error:', error);
    return { 
      success: false, 
      error: { message: 'Failed to logout', details: error.message }, 
      status: 500 
    };
  }
}

// 绑定邮箱
async function bindEmail(db, userId, emailData) {
  const { email } = emailData;
  
  // 验证输入
  if (!email) {
    return { success: false, error: { message: 'Email is required' }, status: 400 };
  }
  
  // 检查邮箱是否已被其他用户使用
  const existingUser = await db.getOne(
    'SELECT id FROM users WHERE email = ? AND id != ?',
    [email, userId]
  );
  
  if (existingUser) {
    return { success: false, error: { message: 'Email already registered' }, status: 409 };
  }
  
  try {
    // 更新邮箱
    await db.update(
      'UPDATE users SET email = ? WHERE id = ?',
      [email, userId]
    );
    
    // 获取更新后的用户信息
    const updatedUser = await db.getOne(
      'SELECT id, user_code, nickname, email, created_at FROM users WHERE id = ?',
      [userId]
    );
    
    return { success: true, data: updatedUser, status: 200 };
  } catch (error) {
    console.error('Bind email error:', error);
    return { 
      success: false, 
      error: { message: 'Failed to bind email', details: error.message }, 
      status: 500 
    };
  }
}

// 主处理函数
async function handleRequest(request, env, ctx) {
  // 处理CORS
  const corsHeaders = handleCors(request);
  if (corsHeaders instanceof Response) {
    return corsHeaders;
  }
  
  try {
    // 创建数据库实例
    const db = createDbInstance(env);
    
    // 解析请求URL
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    // 处理不同的API端点
    switch (path) {
      case '/api/auth/register':
        if (method === 'POST') {
          const body = await request.json();
          const result = await registerUser(db, env, body);
          
          return new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        }
        break;
        
      case '/api/auth/login':
        if (method === 'POST') {
          const body = await request.json();
          const result = await loginUser(db, env, body);
          
          return new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        }
        break;
        
      case '/api/auth/me':
        if (method === 'GET') {
          const { user, error } = await authenticate(db, request);
          
          if (!user) {
            return new Response(JSON.stringify({ success: false, error: { message: error } }), {
              status: 401,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            });
          }
          
          const result = await getUserInfo(db, user.id);
          
          return new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        }
        break;
        
      case '/api/auth/update':
        if (method === 'PUT') {
          const { user, error } = await authenticate(db, request);
          
          if (!user) {
            return new Response(JSON.stringify({ success: false, error: { message: error } }), {
              status: 401,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            });
          }
          
          const body = await request.json();
          const result = await updateUserInfo(db, user.id, body);
          
          return new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        }
        break;
        
      case '/api/auth/change-password':
        if (method === 'POST') {
          const { user, error } = await authenticate(db, request);
          
          if (!user) {
            return new Response(JSON.stringify({ success: false, error: { message: error } }), {
              status: 401,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            });
          }
          
          const body = await request.json();
          const result = await changePassword(db, user.id, body);
          
          return new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        }
        break;
        
      case '/api/auth/refresh':
        if (method === 'POST') {
          const { user, error } = await authenticate(db, request);
          
          if (!user) {
            return new Response(JSON.stringify({ success: false, error: { message: error } }), {
              status: 401,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            });
          }
          
          const authHeader = request.headers.get('Authorization');
          const currentToken = authHeader.split(' ')[1];
          const result = await refreshToken(db, env, currentToken);
          
          return new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        }
        break;
        
      case '/api/auth/logout':
        if (method === 'POST') {
          const authHeader = request.headers.get('Authorization');
          
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ success: false, error: { message: 'Authorization header required' } }), {
              status: 401,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            });
          }
          
          const token = authHeader.split(' ')[1];
          const result = await logout(db, token);
          
          return new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        }
        break;
        
      case '/api/auth/bind-email':
        if (method === 'POST') {
          const { user, error } = await authenticate(db, request);
          
          if (!user) {
            return new Response(JSON.stringify({ success: false, error: { message: error } }), {
              status: 401,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            });
          }
          
          const body = await request.json();
          const result = await bindEmail(db, user.id, body);
          
          return new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        }
        break;
        
      default:
        return new Response(JSON.stringify({ success: false, error: { message: 'Endpoint not found' } }), {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
    }
    
    // 处理不支持的HTTP方法
    return new Response(JSON.stringify({ success: false, error: { message: 'Method not allowed' } }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Allow': 'GET, POST, PUT, DELETE, OPTIONS',
      },
    });
  } catch (error) {
    console.error('Unhandled error in Auth Worker:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { message: 'Internal server error', details: error.message }
    }), {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
    });
  }
}

// Worker入口点
export default {
  fetch: handleRequest
};
