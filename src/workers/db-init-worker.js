/**
 * 数据库初始化Worker
 * 负责初始化D1数据库表结构和提供数据库管理功能
 */

import { createDbInstance, handleDbError } from './database/db.js';
import schema from './database/schema.sql';

// 导入schema文件内容（在实际部署中，可能需要使用fetch或其他方式加载）
async function getSchema() {
  // 在实际Worker环境中，schema.sql需要被正确导入或读取
  // 这里使用导入的schema变量
  return schema;
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
            `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'chat_groups', 'messages')`
          );
          
          const tables = tablesCheck.results.map(row => row.name);
          const expectedTables = ['users', 'chat_groups', 'messages'];
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
