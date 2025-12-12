/**
 * 认证Worker主入口文件
 * 负责整合所有认证相关模块
 */

import { createDbInstance, handleDbError } from '../database/db.js';
import { handleCors, authenticate, setAuthCookie, clearAuthCookie } from './auth-core.js';
import { rateLimit } from './auth-rate-limit.js';
import { initDatabase } from './auth-db.js';
import { registerUser, loginUser, getUserInfo, bindEmail, unbindEmail, updateUserInfo, changePassword, refreshToken, logout, sendPasswordResetCode, verifyPasswordResetCode, resetPassword, deleteAccount, recoverAccount } from './auth-routes.js';

// 主处理函数 - 增强安全性
async function handleRequest(request, env, ctx) {
  try {
    // 处理CORS，传递env以支持环境感知的CORS策略
    const corsHeaders = handleCors(request, env);
    if (corsHeaders instanceof Response) {
      return corsHeaders;
    }
    
    // 数据库初始化路由（仅在开发环境使用）
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (path === '/api/auth/init-db' && method === 'GET') {
      const result = await initDatabase(env);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.success ? 200 : 500
      });
    }
    
    // 应用速率限制
    const rateLimitResult = await rateLimit(request, env);
    if (!rateLimitResult.allowed) {
      return new Response(JSON.stringify({ 
        error: rateLimitResult.message || 'Rate limit exceeded' 
      }), {
        status: rateLimitResult.status || 429,
        headers: { ...corsHeaders, ...rateLimitResult.headers, 'Content-Type': 'application/json' },
      });
    }
    
    // 日志记录（脱敏敏感信息）
    const requestUrl = new URL(request.url);
    const safeLogData = {
        path: requestUrl.pathname,
      method: request.method,
      ip: request.headers.get('CF-Connecting-IP') || 'unknown',
      userAgent: request.headers.get('User-Agent') || 'unknown'
    };
    console.log('Request received:', JSON.stringify(safeLogData));
    
    // 创建数据库实例
    const db = createDbInstance(env);
    
    // 解析JSON请求体（如果有）
    let requestBody = null;
    if (request.method !== 'GET' && request.method !== 'DELETE') {
      try {
        requestBody = await request.json();
        // 验证请求体大小（防止DOS攻击）
        const bodySize = JSON.stringify(requestBody).length;
        if (bodySize > 1024 * 100) { // 100KB 限制
          return new Response(JSON.stringify({ 
            error: 'Request body too large' 
          }), {
            status: 413,
            headers: { ...corsHeaders, ...rateLimitResult.headers, 'Content-Type': 'application/json' },
          });
        }
      } catch (e) {
        // 如果不是有效的JSON，则返回错误
        return new Response(JSON.stringify({ error: 'Invalid JSON format' }), {
          status: 400,
          headers: { ...corsHeaders, ...rateLimitResult.headers, 'Content-Type': 'application/json' },
        });
      }
    }
  
    // 处理不同的API端点
    // 支持两种路径格式：/register 和 /api/auth/register
    let handledPath = path;
    if (handledPath === '/register') {
      handledPath = '/api/auth/register';
    } else if (handledPath === '/login') {
      handledPath = '/api/auth/login';
    } else if (handledPath === '/me') {
      handledPath = '/api/auth/me';
    } else if (handledPath === '/user') {
      handledPath = '/api/auth/user';
    } else if (handledPath === '/bind-email') {
      handledPath = '/api/auth/bind-email';
    } else if (handledPath === '/unbind-email') {
      handledPath = '/api/auth/unbind-email';
    } else if (handledPath === '/change-password') {
      handledPath = '/api/auth/change-password';
    } else if (handledPath === '/refresh-token') {
      handledPath = '/api/auth/refresh-token';
    } else if (handledPath === '/logout') {
      handledPath = '/api/auth/logout';
    } else if (handledPath === '/send-password-reset') {
      handledPath = '/api/auth/send-password-reset';
    } else if (handledPath === '/verify-reset-code') {
      handledPath = '/api/auth/verify-reset-code';
    } else if (handledPath === '/reset-password') {
      handledPath = '/api/auth/reset-password';
    } else if (handledPath === '/delete-account') {
      handledPath = '/api/auth/delete-account';
    } else if (handledPath === '/recover-account') {
      handledPath = '/api/auth/recover-account';
    }
    
    switch (handledPath) {
      case '/api/auth/register':
        if (method === 'POST') {
          const result = await registerUser(db, env, requestBody);
          
          const response = new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
          
          // 如果注册成功，设置HTTP-only cookie
          if (result.success && result.data && result.data.token && result.data.expiresAt) {
            setAuthCookie(response, result.data.token, new Date(result.data.expiresAt), env);
          }
          
          return response;
        }
        break;
        
      case '/api/auth/login':
        if (method === 'POST') {
          // 增加特定的登录速率限制
          if (env && env.RATE_LIMIT_STORE) {
            // 在开发环境中跳过速率限制，便于测试
            // 在实际部署时会启用此限制
            const isDevelopment = request.url.includes('localhost') || request.url.includes('127.0.0.1');
            if (!isDevelopment) {
              const clientIP = request.headers.get('CF-Connecting-IP') || 
                              request.headers.get('X-Forwarded-For') || 
                              'unknown';
              const loginKey = `login_limit:${clientIP}`;
              const loginCount = await env.RATE_LIMIT_STORE.get(loginKey) || '0';
              
              // 登录限制：每IP 5分钟内最多5次尝试
              if (parseInt(loginCount, 10) >= 5) {
                return new Response(JSON.stringify({ 
                  error: 'Too many login attempts. Please try again later.' 
                }), {
                  status: 429,
                  headers: { ...corsHeaders, ...rateLimitResult.headers, 'Content-Type': 'application/json' },
                });
              }
              
              // 增加登录尝试计数
              await env.RATE_LIMIT_STORE.put(loginKey, (parseInt(loginCount, 10) + 1).toString(), {
                expirationTtl: 300 // 5分钟
              });
            }
          }
          
          const result = await loginUser(db, env, requestBody);
          
          // 登录成功时清除限制计数
          if (result.success && env && env.RATE_LIMIT_STORE) {
            const clientIP = request.headers.get('CF-Connecting-IP') || 
                            request.headers.get('X-Forwarded-For') || 
                            'unknown';
            env.RATE_LIMIT_STORE.delete(`login_limit:${clientIP}`).catch(console.error);
          }
          
          const response = new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              ...rateLimitResult.headers,
              'Content-Type': 'application/json',
            },
          });
          
          // 如果登录成功，设置HTTP-only cookie
          if (result.success && result.data && result.data.token && result.data.expiresAt) {
            setAuthCookie(response, result.data.token, new Date(result.data.expiresAt), env);
          }
          
          return response;
        }
        break;
        
      case '/api/auth/me':
        if (method === 'GET') {
          const { user, error } = await authenticate(db, request);
          
          if (!user) {
            return new Response(JSON.stringify({ error }), {
              status: 401,
              headers: {
                ...corsHeaders,
                ...rateLimitResult.headers,
                'Content-Type': 'application/json',
              },
            });
          }
          
          return new Response(JSON.stringify({ success: true, data: user }), {
            status: 200,
            headers: {
              ...corsHeaders,
              ...rateLimitResult.headers,
              'Content-Type': 'application/json',
            },
          });
        }
        break;
        
      case '/api/auth/user':
        if (method === 'GET') {
          const { user, error } = await authenticate(db, request);
          
          if (!user) {
            return new Response(JSON.stringify({ error }), {
              status: 401,
              headers: {
                ...corsHeaders,
                ...rateLimitResult.headers,
                'Content-Type': 'application/json',
              },
            });
          }
          
          const result = await getUserInfo(db, user.id);
          return new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              ...rateLimitResult.headers,
              'Content-Type': 'application/json',
            },
          });
        } else if (method === 'PUT') {
          const { user, error } = await authenticate(db, request);
          
          if (!user) {
            return new Response(JSON.stringify({ error }), {
              status: 401,
              headers: {
                ...corsHeaders,
                ...rateLimitResult.headers,
                'Content-Type': 'application/json',
              },
            });
          }
          
          const result = await updateUserInfo(db, user.id, requestBody);
          return new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              ...rateLimitResult.headers,
              'Content-Type': 'application/json',
            },
          });
        }
        break;
        
      case '/api/auth/bind-email':
        if (method === 'POST') {
          const { user, error } = await authenticate(db, request);
          
          if (!user) {
            return new Response(JSON.stringify({ error }), {
              status: 401,
              headers: {
                ...corsHeaders,
                ...rateLimitResult.headers,
                'Content-Type': 'application/json',
              },
            });
          }
          
          const result = await bindEmail(db, user.id, requestBody);
          return new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              ...rateLimitResult.headers,
              'Content-Type': 'application/json',
            },
          });
        }
        break;
        
      case '/api/auth/unbind-email':
        if (method === 'POST') {
          const { user, error } = await authenticate(db, request);
          
          if (!user) {
            return new Response(JSON.stringify({ error }), {
              status: 401,
              headers: {
                ...corsHeaders,
                ...rateLimitResult.headers,
                'Content-Type': 'application/json',
              },
            });
          }
          
          const result = await unbindEmail(db, user.id);
          return new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              ...rateLimitResult.headers,
              'Content-Type': 'application/json',
            },
          });
        }
        break;
        
      case '/api/auth/change-password':
        if (method === 'POST') {
          const { user, error } = await authenticate(db, request);
          
          if (!user) {
            return new Response(JSON.stringify({ error }), {
              status: 401,
              headers: {
                ...corsHeaders,
                ...rateLimitResult.headers,
                'Content-Type': 'application/json',
              },
            });
          }
          
          const result = await changePassword(db, user.id, requestBody);
          return new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              ...rateLimitResult.headers,
              'Content-Type': 'application/json',
            },
          });
        }
        break;
        
      case '/api/auth/refresh-token':
        if (method === 'POST') {
          const { token } = requestBody;
          const result = await refreshToken(db, env, token);
          return new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              ...rateLimitResult.headers,
              'Content-Type': 'application/json',
            },
          });
        }
        break;
        
      case '/api/auth/logout':
        if (method === 'POST') {
          const { token } = requestBody;
          const result = await logout(db, token);
          
          const response = new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              ...rateLimitResult.headers,
              'Content-Type': 'application/json',
            },
          });
          
          // 清除HTTP-only cookie
          clearAuthCookie(response, env);
          
          return response;
        }
        break;
        
      case '/api/auth/send-password-reset':
        if (method === 'POST') {
          const result = await sendPasswordResetCode(db, env, requestBody);
          return new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              ...rateLimitResult.headers,
              'Content-Type': 'application/json',
            },
          });
        }
        break;
        
      case '/api/auth/verify-reset-code':
        if (method === 'POST') {
          const result = await verifyPasswordResetCode(db, requestBody);
          return new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              ...rateLimitResult.headers,
              'Content-Type': 'application/json',
            },
          });
        }
        break;
        
      case '/api/auth/reset-password':
        if (method === 'POST') {
          const result = await resetPassword(db, requestBody);
          return new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              ...rateLimitResult.headers,
              'Content-Type': 'application/json',
            },
          });
        }
        break;
        
      case '/api/auth/delete-account':
        if (method === 'POST') {
          const { user } = await authenticate(db, request);
          if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: {
                ...corsHeaders,
                ...rateLimitResult.headers,
                'Content-Type': 'application/json',
              },
            });
          }
          
          const result = await deleteAccount(db, user.id);
          
          const response = new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              ...rateLimitResult.headers,
              'Content-Type': 'application/json',
            },
          });
          
          // 清除HTTP-only cookie
          clearAuthCookie(response, env);
          
          return response;
        }
        break;
        
      case '/api/auth/recover-account':
        if (method === 'POST') {
          const { user } = await authenticate(db, request);
          if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: {
                ...corsHeaders,
                ...rateLimitResult.headers,
                'Content-Type': 'application/json',
              },
            });
          }
          
          const result = await recoverAccount(db, user.id);
          return new Response(JSON.stringify(result), {
            status: result.status,
            headers: {
              ...corsHeaders,
              ...rateLimitResult.headers,
              'Content-Type': 'application/json',
            },
          });
        }
        break;
        
      default:
        // 未匹配到路由
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: {
            ...corsHeaders,
            ...rateLimitResult.headers,
            'Content-Type': 'application/json',
          },
        });
    }
    
    // 方法不允许
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        ...corsHeaders,
        ...rateLimitResult.headers,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    
    // 处理CORS
    const corsHeaders = handleCors(request, env);
    if (corsHeaders instanceof Response) {
      return corsHeaders;
    }
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
}

// 导出主处理函数
export default {
  fetch: handleRequest
};