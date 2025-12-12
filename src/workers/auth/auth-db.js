/**
 * 数据库操作功能
 * 负责处理与数据库相关的操作
 */

import { createDbInstance, handleDbError } from '../database/db.js';

// 数据库初始化SQL
const createTablesSQL = `
-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_code TEXT UNIQUE NOT NULL,
  nickname TEXT NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建会话表
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建邮箱验证表
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_used INTEGER DEFAULT 0,
  attempt_count INTEGER DEFAULT 0,
  last_failed_at TIMESTAMP,
  used_at TIMESTAMP,
  failure_reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_verification_codes_email ON email_verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_user_id ON email_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_expires_at ON email_verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_is_used ON email_verification_codes(is_used);
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_email_purpose ON email_verification_codes(email, purpose);

-- 创建游戏收藏表
CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  game_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, game_id)
);

-- 创建安全事件日志表
CREATE TABLE IF NOT EXISTS security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  email TEXT,
  ip_address TEXT NOT NULL,
  user_id INTEGER,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 为安全事件日志表添加索引
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_email ON security_events(email);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_address ON security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);

-- 创建请求频率限制表
CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expiry_time INTEGER NOT NULL
);

-- 为请求频率限制表添加索引
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_action ON rate_limits(identifier, action);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expiry_time ON rate_limits(expiry_time);
CREATE INDEX IF NOT EXISTS idx_rate_limits_created_at ON rate_limits(created_at);
`;

// 初始化数据库表
export async function initDatabase(env) {
  try {
    const db = createDbInstance(env);
    const statements = createTablesSQL
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    
    console.log('开始初始化数据库表...');
    for (const statement of statements) {
      try {
        await db.prepare(statement).run();
        console.log(`成功执行: ${statement.substring(0, 30)}...`);
      } catch (err) {
        console.warn(`执行SQL时出错: ${err.message}`);
        // 继续执行其他语句，不要因为一个表创建失败就停止
      }
    }
    console.log('数据库表初始化完成');
    return { success: true, message: '数据库初始化成功' };
  } catch (error) {
    console.error('数据库初始化失败:', error);
    return { success: false, message: '数据库初始化失败: ' + error.message };
  }
}

// 从auth-core.js导入generateUserCode函数
import { generateUserCode } from './auth-core.js';

// 优化的用户编码生成函数，支持批量生成和检查
export async function generateUniqueUserCode(db) {
  const maxAttempts = 10;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // 添加小延迟以避免连续生成相同的随机数（尤其是在高并发场景）
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, 50 + (attempt * 10)));
    }
    
    // 生成候选编码
    const candidateCode = generateUserCode();
    
    try {
      // 检查编码是否已存在
      console.time(`checkCode_${attempt}`);
      const existingCode = await db.getOne(
        'SELECT id FROM users WHERE user_code = ?',
        [candidateCode]
      );
      console.timeEnd(`checkCode_${attempt}`);
      
      // 如果不存在，返回此编码
      if (!existingCode) {
        console.log(`Found unique user code on attempt ${attempt + 1}: ${candidateCode}`);
        return candidateCode;
      } else {
        console.warn(`User code conflict on attempt ${attempt + 1}: ${candidateCode}`);
      }
    } catch (error) {
      console.error(`Error checking user code uniqueness on attempt ${attempt + 1}:`, error);
      // 继续尝试下一个编码
    }
  }
  
  // 如果多次尝试仍失败，采用批量生成策略确保六位数唯一性
  console.warn(`Generating fallback six-digit code after ${maxAttempts} attempts`);
  
  // 批量生成多个六位数编码并一次性检查
  try {
    const batchSize = 20;
    const candidates = new Set();
    
    // 生成一批候选编码
    for (let i = 0; i < batchSize; i++) {
      candidates.add(generateUserCode());
    }
    
    // 将候选编码转换为数组以便查询
    const codesArray = Array.from(candidates);
    const placeholders = codesArray.map(() => '?').join(', ');
    
    // 一次性查询所有候选编码是否存在
    const existingCodes = await db.all(
      `SELECT user_code FROM users WHERE user_code IN (${placeholders})`,
      codesArray
    );
    
    // 创建已存在编码的Set以快速查找
    const existingCodesSet = new Set(existingCodes.map(row => row.user_code));
    
    // 查找第一个不存在的候选编码
    for (const code of codesArray) {
      if (!existingCodesSet.has(code)) {
        console.log(`Found unique user code in fallback batch: ${code}`);
        return code;
      }
    }
  } catch (batchError) {
    console.error('Error in batch fallback strategy:', batchError);
  }
  
  // 如果批量策略也失败，使用顺序查找方式（效率较低但确保成功）
  // 从100000开始递增查找可用的六位数编码
  try {
    // 先查询最大的用户编码
    const maxCode = await db.getOne(
      'SELECT MAX(CAST(user_code AS INTEGER)) as max_code FROM users WHERE user_code GLOB "[0-9][0-9][0-9][0-9][0-9][0-9]"'
    );
    
    let startCode = 100000;
    if (maxCode && maxCode.max_code) {
      startCode = parseInt(maxCode.max_code) + 1;
      // 如果已达到最大值999999，则重置为100000
      if (startCode > 999999) startCode = 100000;
    }
    
    // 从起始编码开始查找
    for (let code = startCode; code <= 999999; code++) {
      const codeStr = code.toString().padStart(6, '0');
      const exists = await db.getOne(
        'SELECT id FROM users WHERE user_code = ?',
        [codeStr]
      );
      
      if (!exists) {
        console.log(`Found unique user code through sequential search: ${codeStr}`);
        return codeStr;
      }
    }
    
    // 如果从startCode到999999都没找到，从100000开始查找
    if (startCode > 100000) {
      for (let code = 100000; code < startCode; code++) {
        const codeStr = code.toString().padStart(6, '0');
        const exists = await db.getOne(
          'SELECT id FROM users WHERE user_code = ?',
          [codeStr]
        );
        
        if (!exists) {
          console.log(`Found unique user code through sequential search: ${codeStr}`);
          return codeStr;
        }
      }
    }
  } catch (seqError) {
    console.error('Error in sequential fallback strategy:', seqError);
  }
  
  // 极端情况下，如果所有策略都失败，生成一个时间戳相关的六位数编码
  console.error('All fallback strategies failed, using timestamp-based six-digit code');
  const timestamp = Date.now().toString().slice(-6);
  return timestamp;
}

// 用户注册
export async function registerUser(db, userData) {
  const { nickname, email, password_hash } = userData;
  const user_code = await generateUniqueUserCode(db);
  
  try {
    // 支持可选邮箱注册，email可以为null或undefined
    const result = await db.prepare(
      `INSERT INTO users (user_code, nickname, email, password_hash) 
       VALUES (?, ?, ?, ?)`
    ).run([user_code, nickname, email || null, password_hash]);
    
    return { success: true, userId: result.lastInsertRowid, user_code };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 根据用户编码或邮箱查找用户
export async function findUserByCodeOrEmail(db, identifier) {
  try {
    const user = await db.getOne(
      `SELECT * FROM users 
       WHERE (user_code = ? OR email = ?) 
       AND (status != "deleted" OR (deleted_at IS NOT NULL AND deleted_at > 0 AND recovery_expire_at > unixepoch()))`,
      [identifier, identifier]
    );
    return user;
  } catch (error) {
    console.error('查找用户失败:', error);
    return null;
  }
}

// 更新用户登录时间
export async function updateLastLogin(db, userId) {
  try {
    await db.prepare(
      `UPDATE users SET last_login = unixepoch() 
       WHERE id = ?`
    ).run([userId]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 创建用户会话
export async function createSession(db, userId, token, token_hash, expires_at) {
  try {
    // 首先清除用户的所有旧会话
    await db.prepare(
      `DELETE FROM sessions WHERE user_id = ?`
    ).run([userId]);
    
    // 然后创建新会话
    await db.prepare(
      `INSERT INTO sessions (user_id, token, token_hash, expires_at, created_at, last_used) 
       VALUES (?, ?, ?, ?, unixepoch(), unixepoch())`
    ).run([userId, token, token_hash, expires_at]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 根据token查找会话
export async function findSessionByToken(db, token) {
  try {
    const session = await db.getOne(
      `SELECT * FROM sessions 
       WHERE token = ? AND expires_at > unixepoch()`
    , [token]);
    return session;
  } catch (error) {
    console.error('查找会话失败:', error);
    return null;
  }
}

// 查找用户信息
export async function findUserById(db, userId) {
  try {
    const user = await db.getOne(
      `SELECT id, user_code, nickname, email, is_email_verified, created_at, last_login, status, avatar_url, settings 
       FROM users 
       WHERE id = ? 
       AND (status != "deleted" OR (deleted_at IS NOT NULL AND deleted_at > 0 AND recovery_expire_at > unixepoch()))`,
      [userId]
    );
    return user;
  } catch (error) {
    console.error('查找用户失败:', error);
    return null;
  }
}

// 更新用户邮箱
export async function updateUserEmail(db, userId, email) {
  try {
    await db.prepare(
      `UPDATE users SET email = ?, is_email_verified = 0 
       WHERE id = ?`
    ).run([email, userId]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 验证用户邮箱
export async function verifyUserEmail(db, userId) {
  try {
    await db.prepare(
      `UPDATE users SET is_email_verified = 1 
       WHERE id = ?`
    ).run([userId]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 更新用户昵称
export async function updateUserNickname(db, userId, nickname) {
  try {
    await db.prepare(
      `UPDATE users SET nickname = ? 
       WHERE id = ?`
    ).run([nickname, userId]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 更新用户密码
export async function updateUserPassword(db, userId, password_hash) {
  try {
    await db.prepare(
      `UPDATE users SET password_hash = ? 
       WHERE id = ?`
    ).run([password_hash, userId]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 注销用户（软删除）
export async function deleteUser(db, userId) {
  const recovery_expire_at = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7天后过期
  try {
    await db.prepare(
      `UPDATE users SET 
       status = 'deleted', 
       deleted_at = unixepoch(), 
       recovery_expire_at = ? 
       WHERE id = ?`
    ).run([recovery_expire_at, userId]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 恢复注销的用户
export async function recoverUser(db, userId) {
  try {
    await db.prepare(
      `UPDATE users SET 
       status = 'active', 
       deleted_at = NULL, 
       recovery_expire_at = NULL 
       WHERE id = ?`
    ).run([userId]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 创建邮箱验证记录
export async function createEmailVerificationCode(db, userId, email, code, code_hash, purpose, expires_at, ip_address, user_agent) {
  try {
    // 先删除该用户的所有同类型验证码
    await db.prepare(
      `DELETE FROM email_verification_codes 
       WHERE user_id = ? AND purpose = ?`
    ).run([userId, purpose]);
    
    const result = await db.prepare(
      `INSERT INTO email_verification_codes (user_id, email, code, code_hash, purpose, expires_at, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run([userId, email, code, code_hash, purpose, expires_at, ip_address, user_agent]);
    
    return { success: true, id: result.lastInsertRowid };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 查找邮箱验证记录
export async function findEmailVerificationCode(db, email, purpose) {
  try {
    const record = await db.getOne(
      `SELECT * FROM email_verification_codes 
       WHERE email = ? AND purpose = ? AND expires_at > unixepoch() AND is_used = 0`,
      [email, purpose]
    );
    return record;
  } catch (error) {
    console.error('查找邮箱验证记录失败:', error);
    return null;
  }
}

// 更新邮箱验证记录状态
export async function updateEmailVerificationCode(db, id, is_used, failure_reason) {
  try {
    await db.prepare(
      `UPDATE email_verification_codes SET 
       is_used = ?, 
       attempt_count = attempt_count + 1, 
       last_failed_at = CASE WHEN ? = 0 THEN unixepoch() ELSE last_failed_at END, 
       used_at = CASE WHEN ? = 1 THEN unixepoch() ELSE used_at END, 
       failure_reason = ? 
       WHERE id = ?`
    ).run([is_used, is_used, is_used, failure_reason, id]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

