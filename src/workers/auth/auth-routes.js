/**
 * API路由处理功能
 * 负责处理各种API路由请求
 */

import { generateToken, hashPassword, verifyPassword, authenticate, checkPasswordStrength } from './auth-core.js';
import { rateLimit } from './auth-rate-limit.js';
import { validateRegistrationInput, validateLoginInput, validateEmail } from './auth-validation.js';
import {
  registerUser as dbRegisterUser,
  findUserByCodeOrEmail,
  updateLastLogin,
  createSession,
  findUserById,
  updateUserEmail,
  verifyUserEmail,
  updateUserNickname,
  updateUserPassword,
  deleteUser,
  recoverUser,
  createEmailVerificationCode,
  findEmailVerificationCode,
  updateEmailVerificationCode
} from './auth-db.js';

// 注册用户 - 增强版，使用事务和完善的错误处理
async function registerUser(db, env, userData) {
  const { nickname, email, password } = userData;
  
  // 增强的输入验证
  const validation = validateRegistrationInput(nickname, email, password);
  if (!validation.valid) {
    return { success: false, error: { message: validation.message, code: validation.code }, status: 400 };
  }
  
  // 检查密码强度
  const passwordStrength = checkPasswordStrength(password);
  if (passwordStrength.strength < 3) {
    return { 
      success: false, 
      error: { 
        message: 'Password is too weak', 
        code: 'WEAK_PASSWORD',
        feedback: passwordStrength.feedback
      }, 
      status: 400 
    };
  }
  
  // 清理输入以防止XSS和注入攻击
  const cleanNickname = nickname.trim().replace(/'/g, "''"); // 转义单引号
  const cleanEmail = email ? email.trim().toLowerCase() : null;
  
  // 哈希密码
  const passwordHash = await hashPassword(password);
  
  try {
    // 使用新的数据库操作层注册用户
    const registerResult = await dbRegisterUser(db, {
      nickname: cleanNickname,
      email: cleanEmail,
      password_hash: passwordHash
    });
    
    if (!registerResult.success) {
      return { 
        success: false, 
        error: { message: 'Registration failed', details: registerResult.error }, 
        status: 500 
      };
    }
    
    // 为新用户生成令牌
    const { token, tokenHash, expiresAt } = await generateToken(registerResult.userId, env);
    const expiresAtUnix = Math.floor(expiresAt.getTime() / 1000);
    
    // 存储会话
    await createSession(db, registerResult.userId, token, tokenHash, expiresAtUnix);
    
    // 获取完整用户信息
    const user = await findUserById(db, registerResult.userId);
    
    return {
      success: true,
      data: {
        user,
        userCode: registerResult.user_code, // 明确返回用户编码，方便前端显示
        token,
        expiresAt
      },
      status: 201
    };
  } catch (error) {
    console.error('Registration failed:', error.message, { email, nickname });
    
    if (error.message.includes('timeout')) {
      return { 
        success: false, 
        error: { 
          message: 'Registration process timeout. Please try again later.', 
          code: 'TIMEOUT_ERROR' 
        }, 
        status: 504 
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
  let { email, password, userCode, identifier, loginType } = loginData;
  
  // 处理前端发送的identifier和loginType格式
  if (identifier) {
    if (loginType === 'user_code' || /^\d{6}$/.test(identifier)) {
      userCode = identifier;
    } else {
      email = identifier;
    }
  }
  
  // 增强的输入验证
  const validation = validateLoginInput(email, password, userCode);
  if (!validation.valid) {
    console.log('Login validation failed:', validation);
    return { success: false, error: { message: validation.message, code: validation.code }, status: 400 };
  }
  
  // 清理输入
  const cleanIdentifier = email ? email.trim().toLowerCase() : userCode ? userCode.trim() : null;
  
  try {
    // 根据用户编码或邮箱查找用户
    const user = await findUserByCodeOrEmail(db, cleanIdentifier);
    
    // 安全考虑：即使邮箱/用户编码不存在，也返回相同的错误信息
    if (!user) {
      return { 
        success: false, 
        error: { message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' }, 
        status: 401 
      };
    }
    
    // 验证密码
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    
    if (!isPasswordValid) {
      return { 
        success: false, 
        error: { message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' }, 
        status: 401 
      };
    }
    
    // 更新最后登录时间
    await updateLastLogin(db, user.id);
    
    // 生成新令牌
    const { token, tokenHash, expiresAt } = await generateToken(user.id, env);
    const expiresAtUnix = Math.floor(expiresAt.getTime() / 1000);
    
    // 存储会话
    await createSession(db, user.id, token, tokenHash, expiresAtUnix);
    
    // 获取完整用户信息
    const userInfo = await findUserById(db, user.id);
    
    // 记录成功登录日志
    console.log(`User logged in successfully: ${userInfo.id}`);
    
    return {
      success: true,
      data: {
        user: userInfo,
        token,
        expiresAt
      },
      status: 200
    };
  } catch (error) {
    console.error('Login error:', error.message, { email, userCode });
    
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
    const user = await findUserById(db, userId);
    
    if (!user) {
      return { success: false, error: { message: 'User not found', code: 'USER_NOT_FOUND' }, status: 404 };
    }
    
    return { success: true, data: user, status: 200 };
  } catch (error) {
    console.error('Get user info error:', error);
    return { 
      success: false, 
      error: { message: 'Failed to retrieve user information', details: error.message, code: 'DATABASE_ERROR' }, 
      status: 500 
    };
  }
}

// 绑定邮箱功能
async function bindEmail(db, userId, emailData) {
  const { email, verificationCode } = emailData;
  
  // 验证邮箱格式
  const validation = validateEmail(email);
  if (!validation.valid) {
    return { success: false, error: { message: validation.message, code: validation.code }, status: 400 };
  }
  
  // 验证验证码是否提供
  if (!verificationCode) {
    return { 
      success: false, 
      error: { message: 'Verification code is required', code: 'CODE_REQUIRED' }, 
      status: 400 
    };
  }
  
  // 清理输入
  const cleanEmail = email.trim().toLowerCase();
  
  try {
    // 验证验证码
    const codeRecord = await findEmailVerificationCode(db, cleanEmail, 'bind');
    if (!codeRecord) {
      return { 
        success: false, 
        error: { message: 'Invalid or expired verification code', code: 'INVALID_CODE' }, 
        status: 400 
      };
    }
    
    // 验证验证码是否正确
    if (codeRecord.code !== verificationCode) {
      await updateEmailVerificationCode(db, codeRecord.id, 0, 'Invalid code');
      return { 
        success: false, 
        error: { message: 'Invalid verification code', code: 'INVALID_CODE' }, 
        status: 400 
      };
    }
    
    // 检查邮箱是否已被其他用户使用
    const existingUser = await findUserByCodeOrEmail(db, cleanEmail);
    if (existingUser && existingUser.id !== userId) {
      return { 
        success: false, 
        error: { message: 'Email already in use', code: 'EMAIL_IN_USE' }, 
        status: 409 
      };
    }
    
    // 更新用户邮箱
    await updateUserEmail(db, userId, cleanEmail);
    
    // 验证邮箱
    await verifyUserEmail(db, userId);
    
    // 标记验证码为已使用
    await updateEmailVerificationCode(db, codeRecord.id, 1, null);
    
    // 获取更新后的用户信息
    const updatedUser = await findUserById(db, userId);
    
    console.log(`Email bound successfully for user ${userId}`);
    
    return { 
      success: true, 
      data: updatedUser, 
      status: 200,
      message: 'Email bound successfully'
    };
  } catch (error) {
    console.error('Bind email error:', error);
    
    // 处理唯一性约束错误
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return { 
        success: false, 
        error: { message: 'Email already in use', code: 'EMAIL_IN_USE' }, 
        status: 409 
      };
    }
    
    return { 
      success: false, 
      error: { message: 'Failed to bind email', details: error.message, code: 'DATABASE_ERROR' }, 
      status: 500 
    };
  }
}

// 解绑邮箱功能
async function unbindEmail(db, userId) {
  try {
    // 检查用户是否存在
    const user = await findUserById(db, userId);
    
    if (!user) {
      return { success: false, error: { message: 'User not found', code: 'USER_NOT_FOUND' }, status: 404 };
    }
    
    // 检查用户是否已经绑定了邮箱
    if (!user.email) {
      return { 
        success: false, 
        error: { 
          message: 'No email bound to unbind', 
          code: 'NO_EMAIL_BOUND'
        }, 
        status: 400 
      };
    }
    
    // 更新用户邮箱为NULL
    await updateUserEmail(db, userId, null);
    
    // 获取更新后的用户信息
    const updatedUser = await findUserById(db, userId);
    
    console.log(`Email unbound successfully for user ${userId}`);
    
    return { 
      success: true, 
      data: updatedUser, 
      status: 200,
      message: 'Email unbound successfully'
    };
  } catch (error) {
    console.error('Unbind email error:', error);
    
    return { 
      success: false, 
      error: { message: 'Failed to unbind email', details: error.message, code: 'DATABASE_ERROR' }, 
      status: 500 
    };
  }
}

// 更新用户信息
async function updateUserInfo(db, userId, updateData) {
  const { nickname, avatarUrl, email } = updateData;
  
  try {
    // 检查用户是否存在
    const existingUser = await findUserById(db, userId);
    if (!existingUser) {
      return { success: false, error: { message: 'User not found', code: 'USER_NOT_FOUND' }, status: 404 };
    }
    
    // 更新昵称
    if (nickname !== undefined) {
      await updateUserNickname(db, userId, nickname);
    }
    
    // 更新邮箱
    if (email !== undefined) {
      // 验证邮箱格式
      const validation = validateEmail(email);
      if (!validation.valid) {
        return { success: false, error: { message: validation.message, code: validation.code }, status: 400 };
      }
      
      // 清理邮箱输入
      const cleanEmail = email.trim().toLowerCase();
      
      // 检查邮箱是否已被其他用户使用
      const emailUser = await findUserByCodeOrEmail(db, cleanEmail);
      if (emailUser && emailUser.id !== userId) {
        return { 
          success: false, 
          error: { message: 'Email already in use', code: 'EMAIL_IN_USE' }, 
          status: 409 
        };
      }
      
      await updateUserEmail(db, userId, cleanEmail);
    }
    
    // 获取更新后的用户信息
    const updatedUser = await findUserById(db, userId);
    
    return { success: true, data: updatedUser, status: 200 };
  } catch (error) {
    console.error('Update user info error:', error);
    
    // 处理唯一性约束错误
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return { 
        success: false, 
        error: { message: 'Email already in use', code: 'EMAIL_IN_USE' }, 
        status: 409 
      };
    }
    
    return { 
      success: false, 
      error: { message: 'Failed to update user information', details: error.message, code: 'DATABASE_ERROR' }, 
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
  
  // 检查新密码强度
  const passwordStrength = checkPasswordStrength(newPassword);
  if (passwordStrength.strength < 3) {
    return { 
      success: false, 
      error: { 
        message: 'Password is too weak', 
        code: 'WEAK_PASSWORD',
        feedback: passwordStrength.feedback
      }, 
      status: 400 
    };
  }
  
  try {
    // 获取用户当前密码哈希
    const user = await findUserById(db, userId);
    if (!user) {
      return { 
        success: false, 
        error: { message: 'User not found', code: 'USER_NOT_FOUND' }, 
        status: 404 
      };
    }
    
    // 验证旧密码
    const isOldPasswordValid = await verifyPassword(oldPassword, user.password_hash);
    
    if (!isOldPasswordValid) {
      return { 
        success: false, 
        error: { message: 'Invalid old password', code: 'INVALID_PASSWORD' }, 
        status: 401 
      };
    }
    
    // 哈希新密码
    const newPasswordHash = await hashPassword(newPassword);
    
    // 更新密码
    await updateUserPassword(db, userId, newPasswordHash);
    
    // 记录密码更改日志
    console.log(`Password changed successfully for user: ${userId}`);
    
    return { 
      success: true, 
      message: 'Password changed successfully', 
      status: 200 
    };
  } catch (error) {
    console.error('Change password error:', error.message, { userId });
    
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

// 发送密码重置验证码
async function sendPasswordResetCode(db, env, emailData) {
  const { email } = emailData;
  
  // 验证邮箱格式
  const validation = validateEmail(email);
  if (!validation.valid) {
    return { success: false, error: { message: validation.message, code: validation.code }, status: 400 };
  }
  
  // 清理输入
  const cleanEmail = email.trim().toLowerCase();
  
  try {
    // 检查用户是否存在
    const user = await findUserByCodeOrEmail(db, cleanEmail);
    if (!user) {
      // 为了安全，即使邮箱不存在，也返回相同的成功信息
      return { 
        success: true, 
        message: 'Password reset code sent if email exists', 
        status: 200 
      };
    }
    
    // 生成6位验证码
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 计算验证码哈希
    const encoder = new TextEncoder();
    const codeData = encoder.encode(verificationCode);
    const codeHashBuffer = await crypto.subtle.digest('SHA-256', codeData);
    const codeHash = Array.from(new Uint8Array(codeHashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // 设置验证码有效期为15分钟
    const expiresAt = Math.floor(Date.now() / 1000) + 15 * 60;
    
    // 记录IP地址和用户代理
    const ipAddress = emailData.ipAddress || 'unknown';
    const userAgent = emailData.userAgent || 'unknown';
    
    // 创建验证码记录
    await createEmailVerificationCode(
      db, 
      user.id, 
      cleanEmail, 
      verificationCode, 
      codeHash, 
      'password_reset', 
      expiresAt, 
      ipAddress, 
      userAgent
    );
    
    // TODO: 发送验证码邮件（这里需要集成邮箱服务）
    console.log(`Password reset code sent to ${cleanEmail}: ${verificationCode}`);
    
    return { 
      success: true, 
      message: 'Password reset code sent if email exists', 
      status: 200 
    };
  } catch (error) {
    console.error('Send password reset code error:', error);
    return { 
      success: false, 
      error: { message: 'Failed to send password reset code', details: error.message }, 
      status: 500 
    };
  }
}

// 验证密码重置验证码
async function verifyPasswordResetCode(db, resetData) {
  const { email, code } = resetData;
  
  // 验证输入
  if (!email || !code) {
    return { success: false, error: { message: 'Missing required fields', code: 'INVALID_INPUT' }, status: 400 };
  }
  
  // 清理输入
  const cleanEmail = email.trim().toLowerCase();
  
  try {
    // 查找验证码记录
    const codeRecord = await findEmailVerificationCode(db, cleanEmail, 'password_reset');
    if (!codeRecord) {
      return { 
        success: false, 
        error: { message: 'Invalid or expired verification code', code: 'INVALID_CODE' }, 
        status: 400 
      };
    }
    
    // 验证验证码是否正确
    if (codeRecord.code !== code) {
      await updateEmailVerificationCode(db, codeRecord.id, 0, 'Invalid code');
      return { 
        success: false, 
        error: { message: 'Invalid verification code', code: 'INVALID_CODE' }, 
        status: 400 
      };
    }
    
    // 标记验证码为已使用
    await updateEmailVerificationCode(db, codeRecord.id, 1, null);
    
    return { 
      success: true, 
      message: 'Verification code validated successfully', 
      status: 200 
    };
  } catch (error) {
    console.error('Verify password reset code error:', error);
    return { 
      success: false, 
      error: { message: 'Failed to verify password reset code', details: error.message }, 
      status: 500 
    };
  }
}

// 重置密码
async function resetPassword(db, resetData) {
  const { email, code, newPassword } = resetData;
  
  // 验证输入
  if (!email || !code || !newPassword) {
    return { success: false, error: { message: 'Missing required fields', code: 'INVALID_INPUT' }, status: 400 };
  }
  
  // 检查新密码强度
  const passwordStrength = checkPasswordStrength(newPassword);
  if (passwordStrength.strength < 3) {
    return { 
      success: false, 
      error: { 
        message: 'Password is too weak', 
        code: 'WEAK_PASSWORD',
        feedback: passwordStrength.feedback
      }, 
      status: 400 
    };
  }
  
  // 清理输入
  const cleanEmail = email.trim().toLowerCase();
  
  try {
    // 验证验证码
    const verifyResult = await verifyPasswordResetCode(db, { email: cleanEmail, code });
    if (!verifyResult.success) {
      return verifyResult;
    }
    
    // 查找用户
    const user = await findUserByCodeOrEmail(db, cleanEmail);
    if (!user) {
      return { 
        success: false, 
        error: { message: 'User not found', code: 'USER_NOT_FOUND' }, 
        status: 404 
      };
    }
    
    // 哈希新密码
    const newPasswordHash = await hashPassword(newPassword);
    
    // 更新密码
    await updateUserPassword(db, user.id, newPasswordHash);
    
    return { 
      success: true, 
      message: 'Password reset successfully', 
      status: 200 
    };
  } catch (error) {
    console.error('Reset password error:', error);
    return { 
      success: false, 
      error: { message: 'Failed to reset password', details: error.message }, 
      status: 500 
    };
  }
}

// 注销用户（软删除）
async function deleteAccount(db, userId) {
  try {
    // 检查用户是否存在
    const user = await findUserById(db, userId);
    if (!user) {
      return { 
        success: false, 
        error: { message: 'User not found', code: 'USER_NOT_FOUND' }, 
        status: 404 
      };
    }
    
    // 注销用户（软删除）
    await deleteUser(db, userId);
    
    return { 
      success: true, 
      message: 'Account deleted. You can recover it within 7 days.', 
      status: 200 
    };
  } catch (error) {
    console.error('Delete account error:', error);
    return { 
      success: false, 
      error: { message: 'Failed to delete account', details: error.message }, 
      status: 500 
    };
  }
}

// 恢复注销的用户
async function recoverAccount(db, userId) {
  try {
    // 检查用户是否存在
    const user = await findUserById(db, userId);
    if (!user) {
      return { 
        success: false, 
        error: { message: 'User not found or recovery period expired', code: 'USER_NOT_FOUND' }, 
        status: 404 
      };
    }
    
    // 恢复用户
    await recoverUser(db, userId);
    
    return { 
      success: true, 
      message: 'Account recovered successfully', 
      status: 200 
    };
  } catch (error) {
    console.error('Recover account error:', error);
    return { 
      success: false, 
      error: { message: 'Failed to recover account', details: error.message }, 
      status: 500 
    };
  }
}

// 验证验证码函数（暂时为空实现，需要根据实际情况补充）
async function validateVerificationCode(tx, email, code, purpose) {
  // 这里需要实现验证码验证逻辑
  // 暂时返回一个模拟的成功结果
  return { valid: true };
}

// 生成6位数字格式的用户编码（暂时从auth-db.js导入，这里保留作为备用）
function generateUserCode() {
  // 生成唯一的六位数用户编码（100000-999999之间）
  // 使用crypto API获取真正的随机值，如果可用
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    // 使用crypto API生成真正的随机数
    const array = new Uint8Array(2);
    crypto.getRandomValues(array);
    // 计算一个0-899999之间的随机数，然后加100000得到100000-999999
    const randomNum = (array[0] * 256 + array[1]) % 900000 + 100000;
    return randomNum.toString().padStart(6, '0');
  } else {
    // 回退方案：使用Math.random生成六位数
    // 生成0-1之间的随机数，乘以900000得到0-899999，然后加100000得到100000-999999
    const randomNum = Math.floor(Math.random() * 900000) + 100000;
    return randomNum.toString();
  }
}

export {
  registerUser,
  loginUser,
  getUserInfo,
  bindEmail,
  unbindEmail,
  updateUserInfo,
  changePassword,
  refreshToken,
  logout,
  sendPasswordResetCode,
  verifyPasswordResetCode,
  resetPassword,
  deleteAccount,
  recoverAccount
};