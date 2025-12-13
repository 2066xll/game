import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';

const app = express();
const PORT = 8787;

// 启用 CORS
app.use(cors());

// 解析 JSON 请求体
app.use(express.json());

// 模拟 KV 存储
const mockKV = {
  // 存储用户数据，key: `user:${userCode}`, value: JSON.stringify(userData)
  users: new Map(),
  // 存储邮箱到用户编码的映射，key: `email:${email}`, value: userCode
  emailMap: new Map(),
  
  // 模拟 KV.get 方法
  async get(key) {
    if (key.startsWith('user:')) {
      return this.users.get(key) || null;
    } else if (key.startsWith('email:')) {
      return this.emailMap.get(key) || null;
    }
    return null;
  },
  
  // 模拟 KV.put 方法
  async put(key, value) {
    if (key.startsWith('user:')) {
      this.users.set(key, value);
    } else if (key.startsWith('email:')) {
      this.emailMap.set(key, value);
    }
  }
};

/**
 * 生成6位数唯一用户编码
 * @returns {Promise<string>} - 唯一的6位数用户编码
 */
async function generateUniqueUserCode() {
  const MAX_ATTEMPTS = 100;
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    // 生成6位数随机编码
    const userCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 检查KV中是否已存在该编码
    const existingUser = await mockKV.get(`user:${userCode}`);
    
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
 * 根据标识符查找用户
 * @param {string} identifier - 用户编码或邮箱
 * @returns {Promise<object|null>} - 用户信息或null
 */
async function findUserByIdentifier(identifier) {
  // 检查是否为用户编码（6位数）
  if (/^\d{6}$/.test(identifier)) {
    // 用户编码登录
    const userJson = await mockKV.get(`user:${identifier}`);
    return userJson ? JSON.parse(userJson) : null;
  } 
  // 检查是否为邮箱
  else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
    // 邮箱登录
    const userCode = await mockKV.get(`email:${identifier.toLowerCase()}`);
    if (!userCode) {
      return null;
    }
    
    const userJson = await mockKV.get(`user:${userCode}`);
    return userJson ? JSON.parse(userJson) : null;
  }
  
  return null;
}

// 注册端点
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nickname, email, password } = req.body;

    if (!nickname || !password) {
      return res.status(400).json({
        success: false,
        error: {
          message: '请填写所有必填字段'
        },
        status: 400
      });
    }

    // 生成唯一用户编码
    const userCode = await generateUniqueUserCode();

    // 密码哈希处理
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    // 准备用户数据
    const userId = `user-${Date.now()}`;
    const userData = {
      id: userId,
      user_code: userCode,
      nickname: nickname,
      email: email || null,
      password_hash: passwordHash,
      created_at: new Date().toISOString()
    };

    // 存储用户数据
    await mockKV.put(`user:${userCode}`, JSON.stringify(userData));
    
    // 如果有邮箱，也存储一份映射
    if (email) {
      await mockKV.put(`email:${email.toLowerCase()}`, userCode);
    }

    // 返回成功响应
    res.status(201).json({
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
        token: `mock-token-${Date.now()}-${userId}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      status: 201
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message || '注册失败',
        details: error.message
      },
      status: 500
    });
  }
});

// 登录端点
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        error: {
          message: '请输入用户名/邮箱和密码'
        },
        status: 400
      });
    }

    // 根据标识符查找用户
    const user = await findUserByIdentifier(identifier);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          message: '用户不存在'
        },
        status: 401
      });
    }

    // 验证密码
    const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          message: '密码错误'
        },
        status: 401
      });
    }

    // 生成令牌
    const token = `mock-token-${Date.now()}-${user.id}`;

    // 返回成功响应
    res.status(200).json({
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
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      status: 200
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({
      success: false,
      error: {
        message: '登录失败',
        details: error.message
      },
      status: 500
    });
  }
});

// 更新用户资料端点
app.put('/api/auth/profile', async (req, res) => {
  try {
    // 简单实现：从请求体中获取nickname，更新用户信息
    const { nickname } = req.body;
    
    // 获取令牌
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    
    // 简单验证令牌（实际应该使用JWT验证）
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          message: '未授权'
        },
        status: 401
      });
    }
    
    // 从令牌中提取用户ID（简单实现）
    const userId = token.split('-').slice(-1)[0];
    
    // 查找用户（实际应该根据用户ID查找）
    // 这里简化实现，直接返回模拟数据
    const user = {
      id: userId,
      user_code: '302410',
      nickname: nickname || 'testuser3',
      email: 'test3@example.com',
      created_at: new Date().toISOString()
    };
    
    // 返回成功响应
    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        user_code: user.user_code,
        nickname: user.nickname,
        email: user.email,
        created_at: user.created_at
      },
      status: 200
    });
  } catch (error) {
    console.error('更新用户资料失败:', error);
    res.status(500).json({
      success: false,
      error: {
        message: '更新用户资料失败',
        details: error.message
      },
      status: 500
    });
  }
});

// 获取当前用户信息端点
app.get('/api/auth/me', async (req, res) => {
  try {
    // 获取令牌
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    
    // 简单验证令牌（实际应该使用JWT验证）
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          message: '未授权'
        },
        status: 401
      });
    }
    
    // 从令牌中提取用户ID（简单实现）
    const userId = token.split('-').slice(-1)[0];
    
    // 模拟用户数据（实际应该根据用户ID从mockKV中查找）
    // 这里简化实现，返回包含user_code和nickname的完整用户信息
    const user = {
      id: userId,
      user_code: '302410',
      nickname: 'testuser3',
      email: 'test3@example.com',
      created_at: new Date().toISOString()
    };
    
    // 返回成功响应
    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        user_code: user.user_code,
        nickname: user.nickname,
        email: user.email,
        created_at: user.created_at
      },
      status: 200
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      error: {
        message: '获取用户信息失败',
        details: error.message
      },
      status: 500
    });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Mock API server is running on http://localhost:${PORT}`);
  console.log('模拟 KV 存储已启用，支持唯一用户编码生成和用户数据持久化');
});
