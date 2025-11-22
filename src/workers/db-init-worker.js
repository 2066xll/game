/**
 * 数据库初始化Worker
 * 负责初始化D1数据库表结构和提供数据库管理功能
 */

import { createDbInstance, handleDbError } from './database/db.js';

// 内联数据库schema（修复Cloudflare Workers中无法直接导入SQL文件的问题）
async function getSchema() {
  // 直接返回SQL创建语句
  return `-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_code TEXT UNIQUE NOT NULL,      -- 用户唯一编码
    nickname TEXT,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,        -- 密码哈希值
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    avatar_url TEXT,
    status TEXT DEFAULT 'active',        -- active, banned, deleted
    settings TEXT DEFAULT '{}'          -- JSON格式存储用户设置
);

-- 为用户表添加索引
CREATE INDEX IF NOT EXISTS idx_users_user_code ON users(user_code);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 聊天群组表
CREATE TABLE IF NOT EXISTS chat_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    creator_id INTEGER NOT NULL,         -- 创建者用户ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active',        -- active, archived, deleted
    is_private INTEGER DEFAULT 0,        -- 0: 公开, 1: 私有
    avatar_url TEXT,
    FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- 为群组表添加索引
CREATE INDEX IF NOT EXISTS idx_chat_groups_creator_id ON chat_groups(creator_id);
CREATE INDEX IF NOT EXISTS idx_chat_groups_status ON chat_groups(status);

-- 用户-群组关系表
CREATE TABLE IF NOT EXISTS user_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    role TEXT DEFAULT 'member',          -- admin, moderator, member
    status TEXT DEFAULT 'active',        -- active, muted, banned
    last_read_message_id TEXT,
    UNIQUE (user_id, group_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (group_id) REFERENCES chat_groups(id),
    FOREIGN KEY (last_read_message_id) REFERENCES chat_messages(id)
);

-- 为用户-群组关系表添加索引
CREATE INDEX IF NOT EXISTS idx_user_groups_user_id ON user_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_group_id ON user_groups(group_id);

-- 聊天消息表
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,                  -- 使用UUID格式的消息ID
    room_id INTEGER NOT NULL,              -- 聊天室ID（与chat_groups表关联）
    user_id INTEGER NOT NULL,              -- 发送者用户ID
    user_name TEXT,                        -- 发送者用户名（冗余存储，便于查询）
    content TEXT NOT NULL,                 -- 消息内容
    created_at INTEGER NOT NULL,           -- 消息创建时间戳（毫秒）
    FOREIGN KEY (room_id) REFERENCES chat_groups(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 为聊天消息表添加索引
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- 会话表（用于存储用户会话信息和Token管理）
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    status TEXT DEFAULT 'active',        -- active, revoked, expired
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 为会话表添加索引
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- 好友关系表（可选，用于一对一聊天）
CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',       -- pending, accepted, blocked
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, friend_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id)
);

-- 为好友关系表添加索引
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

-- 创建触发器以自动更新updated_at字段
CREATE TRIGGER IF NOT EXISTS update_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_chat_groups_updated_at
AFTER UPDATE ON chat_groups
FOR EACH ROW
BEGIN
    UPDATE chat_groups SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- 聊天消息表不需要updated_at触发器，因为消息一旦发送通常不修改

CREATE TRIGGER IF NOT EXISTS update_friendships_updated_at
AFTER UPDATE ON friendships
FOR EACH ROW
BEGIN
    UPDATE friendships SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;`;
}

/**
 * 处理请求的主要函数
 * @param {Request} request - 传入的HTTP请求
 * @param {Object} env - Worker环境变量和绑定
 * @param {Object} ctx - 上下文对象
 * @returns {Response} HTTP响应
 */
async function handleRequest(request, env, ctx) {
  // CORS头部设置
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // 处理预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    // 创建数据库实例
    const db = createDbInstance(env);
    
    // 解析请求URL和参数
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 处理不同的API端点
    switch (path) {
      case '/api/db/check':
        // 检查数据库连接
        const isConnected = await db.checkConnection();
        return new Response(JSON.stringify({
          success: true,
          connected: isConnected,
          message: isConnected ? 'Database connection successful' : 'Database connection failed'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
        
      case '/api/db/init':
        // 初始化数据库表结构
        try {
          const schemaContent = await getSchema();
          const result = await db.initialize(schemaContent);
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Database initialized successfully',
            result
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        } catch (initError) {
          console.error('Database initialization failed:', initError);
          return new Response(JSON.stringify({
            success: false,
            error: {
              message: 'Database initialization failed',
              details: process.env.NODE_ENV === 'production' ? null : initError.message
            }
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        }
        
      case '/api/db/health':
        // 数据库健康检查
        const healthStatus = await db.checkConnection();
        
        if (healthStatus) {
          // 检查关键表是否存在
          const tablesCheck = await db.prepare(
            `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'chat_groups', 'chat_messages')`
          );
          
          const tables = tablesCheck.results.map(row => row.name);
          const expectedTables = ['users', 'chat_groups', 'chat_messages'];
          const missingTables = expectedTables.filter(table => !tables.includes(table));
          
          return new Response(JSON.stringify({
            success: true,
            status: missingTables.length > 0 ? 'partial' : 'complete',
            connected: true,
            tables: {
              total: tables.length,
              present: tables,
              missing: missingTables
            }
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        } else {
          return new Response(JSON.stringify({
            success: false,
            status: 'error',
            connected: false,
            message: 'Database connection failed'
          }), {
            status: 503,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        }
        
      case '/api/db/query':
        // 执行SQL查询（仅用于开发环境）
        if (process.env.NODE_ENV !== 'production') {
          if (request.method !== 'POST') {
            return new Response(JSON.stringify({
              success: false,
              error: { message: 'Method not allowed' }
            }), {
              status: 405,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            });
          }
          
          const { query, params } = await request.json();
          
          if (!query) {
            return new Response(JSON.stringify({
              success: false,
              error: { message: 'Query parameter is required' }
            }), {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            });
          }
          
          // 安全检查：禁止执行危险操作
          const dangerousCommands = ['DROP', 'ALTER', 'TRUNCATE'];
          const isDangerous = dangerousCommands.some(cmd => 
            query.toUpperCase().includes(cmd)
          );
          
          if (isDangerous) {
            return new Response(JSON.stringify({
              success: false,
              error: { message: 'Dangerous operation not allowed' }
            }), {
              status: 403,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            });
          }
          
          try {
            const result = await db.prepare(query, params);
            return new Response(JSON.stringify({
              success: true,
              data: result.results || [],
              meta: {
                query,
                params
              }
            }), {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            });
          } catch (queryError) {
            return new Response(JSON.stringify(handleDbError(queryError)), {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            });
          }
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: { message: 'This endpoint is only available in development mode' }
          }), {
            status: 403,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        }
        
      default:
        // 未知端点
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Endpoint not found' }
        }), {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
    }
  } catch (error) {
    console.error('Unhandled error in DB Worker:', error);
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: 'Internal server error',
        details: process.env.NODE_ENV === 'production' ? null : error.message
      }
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
