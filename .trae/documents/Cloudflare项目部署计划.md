# Cloudflare项目部署计划

## 1. 项目概述

这是一个游戏网站项目，使用Vue 3 + Vite构建，包含多个Cloudflare Workers服务：
- 前端：Vue 3 + Vite应用，部署到Cloudflare Pages
- 后端服务：
  - 认证Worker (auth-worker.js)
  - WebSocket Worker (websocket-worker.js)
  - 聊天房间Durable Object (chatRoomDurableObject.js)
  - 消息清理Worker (messageCleanupWorker.js)

## 2. 部署准备

### 2.1 检查依赖
确保已安装所有项目依赖：
```bash
npm install
```

### 2.2 登录Cloudflare账户
使用Wrangler CLI登录Cloudflare账户：
```bash
wrangler login
```

## 3. 部署步骤

### 3.1 构建项目
构建生产版本：
```bash
npm run build
```

### 3.2 部署前端到Cloudflare Pages
```bash
npm run deploy
```

### 3.3 部署后端服务

#### 3.3.1 部署认证Worker
```bash
npm run deploy:auth-worker
```

#### 3.3.2 部署WebSocket Worker
```bash
npm run deploy:worker
```

#### 3.3.3 部署聊天房间Durable Object
```bash
npm run deploy:chat-room
```

#### 3.3.4 部署消息清理Worker
```bash
npm run deploy:cleanup
```

### 3.4 一键部署所有服务（可选）
```bash
npm run deploy:all
```

## 4. 验证部署

### 4.1 检查部署状态
```bash
wrangler deployments list
```

### 4.2 访问部署的服务
- 前端：https://game-website.pages.dev
- 认证API：https://game-auth-worker.seaman-sun.workers.dev
- WebSocket：wss://game-websocket-worker.seaman-sun.workers.dev

### 4.3 验证功能
1. 检查前端页面是否正常加载
2. 测试用户认证功能
3. 测试WebSocket聊天功能
4. 确认定时清理任务是否按计划运行

## 5. 环境变量配置

项目已在wrangler.toml中配置了环境变量，包括：
- VITE_API_BASE_URL：认证API地址
- VITE_WS_URL：WebSocket地址

## 6. 故障排除

如果部署过程中遇到问题，可以参考以下步骤：
1. 检查Wrangler CLI版本是否最新
2. 确认Cloudflare账户权限
3. 检查wrangler.toml配置是否正确
4. 查看部署日志获取详细错误信息
5. 参考CLOUDFLARE_DEPLOYMENT_GUIDE.md中的故障排除部分

## 7. 自动化部署

项目已配置GitHub Actions自动化部署，推送到main分支会自动部署到生产环境。