// Cloudflare Workers 入口文件

// 导入静态文件处理模块
import { serveStatic } from 'cloudflare:workers'

// 创建静态文件处理器，指向构建输出目录
export const staticFiles = serveStatic('dist')

// 定义Workers处理函数
export default {
  async fetch(request, env, ctx) {
    try {
      // 尝试从静态文件服务中获取响应
      const response = await staticFiles.fetch(request)
      
      // 如果找到了文件，直接返回
      if (response && response.status !== 404) {
        return response
      }
      
      // 对于SPA应用，当找不到具体文件时，返回index.html
      // 这确保Vue Router可以正确处理路由
      const indexPath = new URL('/index.html', request.url)
      const indexResponse = await staticFiles.fetch(new Request(indexPath, request))
      
      if (indexResponse && indexResponse.status === 200) {
        return indexResponse
      }
      
      // 如果都失败了，返回404响应
      return new Response('Not found', {
        status: 404,
        headers: {
          'content-type': 'text/plain'
        }
      })
    } catch (error) {
      // 处理错误
      return new Response(`Error: ${error.message}`, {
        status: 500,
        headers: {
          'content-type': 'text/plain'
        }
      })
    }
  }
}
