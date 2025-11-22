# Cloudflare Workers 部署指南

本文档提供了详细的Cloudflare Workers部署流程，包括本地开发环境设置、配置说明和部署步骤。

## 1. 准备工作

### 1.1 安装Wrangler CLI

Wrangler是Cloudflare Workers的官方命令行工具，用于本地开发和部署：

```bash
# 使用npm全局安装wrangler
npm install -g wrangler

# 验证安装
wrangler --version
```

### 1.2 登录Cloudflare账户

```bash
# 登录Cloudflare账户
wrangler login

# 这将打开浏览器，请按照提示完成身份验证
```

### 1.3 检查项目依赖

确保已安装所有项目依赖：

```bash
cd /Users/sunrize/Documents/game
npm install
```

## 2. 项目配置说明

### 2.1 理解wrangler.toml配置

项目的`wrangler.toml`文件包含了多个部署环境的配置：

- **默认配置**：基础配置，包含Durable Objects、D1数据库和KV存储的绑定
- **production环境**：生产环境特定配置
- **development环境**：开发环境特定配置
- **message-cleanup-worker**：消息清理Worker的配置，包含定时触发器

### 2.2 必要的资源准备

在部署前，需要确保在Cloudflare中创建以下资源：

1. **D1数据库**：用于存储聊天消息和用户数据
   - 名称: `game-chat-db`
   - ID: `73606391-5970-4435-8dbe-d0be3a201d0a`

2. **KV命名空间**：用于存储会话信息
   - 绑定名: `SESSION_STORE`
   - 生产ID: `0a46093b30dc43eb999c7ae4c3e94a83`
   - 预览ID: `620a37a62e7940c5b849e13837095c0b`

3. **Durable Objects**：用于WebSocket聊天房间管理
   - 绑定名: `CHAT_ROOM`
   - 脚本名: `websocket-worker`
   - 类名: `ChatRoomDurableObject`

## 3. 创建必要的Cloudflare资源

### 3.1 创建D1数据库

```bash
# 创建D1数据库
wrangler d1 create game-chat-db

# 复制返回的数据库ID，并更新wrangler.toml中的database_id字段
```

### 3.2 创建KV命名空间

```bash
# 创建KV命名空间（生产环境）
wrangler kv:namespace create "SESSION_STORE"

# 创建KV命名空间（预览环境）
wrangler kv:namespace create "SESSION_STORE" --preview

# 复制返回的ID，并更新wrangler.toml中的id和preview_id字段
```

### 3.3 初始化数据库架构

```bash
# 运行数据库初始化Worker
wrangler deploy --env development --name db-init-worker ./src/workers/db-init-worker.js

# 或者使用D1直接执行SQL脚本
wrangler d1 execute game-chat-db --file ./src/workers/database/schema.sql
```

## 4. 本地开发环境设置

### 4.1 启动本地开发服务器

```bash
# 启动本地开发服务器（默认端口8787）
npm run dev:worker

# 或者使用wrangler直接启动
wrangler dev --port=8787
```

### 4.2 测试WebSocket功能

```bash
# 运行聊天功能测试脚本
npm run test:chat
```

### 4.3 本地调试技巧

1. **访问本地API**：打开浏览器访问 http://localhost:8787
2. **查看日志**：开发服务器控制台会显示实时日志
3. **热重载**：代码更改会自动应用，无需重启服务器

## 5. 部署流程

### 5.1 开发环境部署

```bash
# 构建开发版本
npm run build:dev

# 部署到开发环境
npm run deploy:dev

# 或者直接使用wrangler命令
wrangler deploy --env development
```

### 5.2 生产环境部署

```bash
# 构建生产版本
npm run build

# 部署到生产环境
npm run deploy

# 或者直接使用wrangler命令
wrangler deploy --env production
```

### 5.3 部署消息清理Worker

```bash
# 部署消息清理Worker（包含定时触发器）
wrangler deploy --env message-cleanup-worker
```

## 6. 验证部署

### 6.1 检查部署状态

```bash
# 查看已部署的Worker
wrangler deployments list
```

### 6.2 访问部署的Worker

部署成功后，可以通过以下URL访问：
- **生产环境**：https://game-website-production.<你的用户名>.workers.dev
- **开发环境**：https://game-website-development.<你的用户名>.workers.dev

### 6.3 验证功能

1. 检查基本API端点是否正常工作
2. 验证WebSocket连接功能
3. 测试聊天消息发送和接收
4. 确认定时清理任务是否按计划运行

## 7. 配置Durable Objects和绑定

### 7.1 创建Durable Objects命名空间

```bash
# 创建Durable Objects命名空间
wrangler durable_objects create ChatRoomDurableObject

# 更新wrangler.toml中的Durable Objects绑定配置
```

### 7.2 验证绑定是否正确

部署后，确保所有绑定都已正确配置：

```bash
# 查看Worker详情（包含绑定信息）
wrangler whoami
```

## 8. 配置定时触发器

消息清理Worker已配置了每小时执行一次的定时触发器。要验证触发器是否正常工作：

1. 登录 [Cloudflare Workers Dashboard](https://dash.cloudflare.com/)
2. 找到 `message-cleanup-worker`
3. 查看Triggers标签页，确认cron表达式已设置为 `0 * * * *`

## 9. 监控和日志

### 9.1 访问实时日志

```bash
# 查看Worker的实时日志
wrangler tail

# 筛选特定环境的日志
wrangler tail --env production
```

### 9.2 在Cloudflare Dashboard查看

1. 登录 [Cloudflare Workers Dashboard](https://dash.cloudflare.com/)
2. 选择已部署的Worker
3. 查看Logs标签页获取历史日志
4. 查看Metrics标签页获取性能指标

## 10. 故障排除

### 10.1 常见部署问题

**问题1: 找不到D1数据库**
- 确保数据库ID正确配置在wrangler.toml中
- 确认已在正确的Cloudflare账户下创建了数据库

**问题2: KV命名空间绑定失败**
- 检查KV命名空间ID是否正确
- 确保预览ID和生产ID没有混淆

**问题3: Durable Objects初始化失败**
- 检查类名和脚本名是否与wrangler.toml中的配置一致
- 确保ChatRoomDurableObject类已正确导出

**问题4: 部署超时**
- 尝试增加部署超时时间：`wrangler deploy --env production --timeout 300`
- 检查网络连接是否稳定

### 10.2 调试WebSocket问题

1. 使用浏览器开发工具的Network标签监控WebSocket连接
2. 检查控制台错误信息
3. 确认防火墙或网络设置不会阻止WebSocket连接

### 10.3 数据库问题

1. 检查SQL语法是否正确
2. 验证数据库权限
3. 查看数据库错误日志：`wrangler d1 execute game-chat-db --command ".schema"`

## 11. 最佳实践

1. **环境隔离**：严格区分开发环境和生产环境配置
2. **定期备份**：定期备份D1数据库中的重要数据
3. **监控系统**：设置监控和告警，及时发现问题
4. **更新依赖**：定期更新wrangler和项目依赖到最新版本
5. **代码审查**：部署前进行代码审查，确保代码质量
6. **灰度发布**：对于大型更改，考虑先在开发环境充分测试

## 12. 自动化部署

结合GitHub Actions，项目已经配置了自动化部署流程。推送到main分支会自动部署到生产环境，推送到dev分支会自动构建开发版本。

要自定义CI/CD流程，请修改 `.github/workflows/ci-cd.yml` 文件。

---

完成以上步骤后，你的游戏网站项目应该已经成功部署到Cloudflare Workers平台。如有任何问题，请参考Cloudflare官方文档或寻求技术支持。