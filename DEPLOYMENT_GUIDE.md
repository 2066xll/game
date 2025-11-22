# 游戏网站项目傻瓜式部署指南

本文档是一份全面的部署指南，整合了GitHub仓库管理和Cloudflare Workers部署的所有步骤，专为新手设计，确保你能顺利完成项目部署。

## 目录

1. [环境准备](#1-环境准备)
2. [项目克隆与初始化](#2-项目克隆与初始化)
3. [GitHub仓库设置](#3-github仓库设置)
4. [Cloudflare账户配置](#4-cloudflare账户配置)
5. [项目依赖安装](#5-项目依赖安装)
6. [Cloudflare资源创建](#6-cloudflare资源创建)
7. [本地开发与测试](#7-本地开发与测试)
8. [部署到Cloudflare](#8-部署到cloudflare)
9. [自动化CI/CD配置](#9-自动化cicd配置)
10. [常见问题与故障排除](#10-常见问题与故障排除)
11. [维护与更新](#11-维护与更新)

## 1. 环境准备

### 1.1 安装必要软件

#### Git安装

- **Windows**: 下载安装 [Git for Windows](https://git-scm.com/download/win)
- **macOS**: 使用Homebrew安装 `brew install git`，或下载安装 [Git Installer](https://git-scm.com/download/mac)
- **Linux**: `sudo apt-get install git` (Ubuntu/Debian) 或 `sudo yum install git` (CentOS/RHEL)

安装后验证：
```bash
git --version
```

#### Node.js安装

**重要**: 项目需要 Node.js v22.0.0 或更高版本

- **Windows/macOS**: 从 [Node.js官网](https://nodejs.org/zh-cn/download/current/) 下载安装包
- **Linux**: 使用nvm安装（推荐）：
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
  nvm install 22
  ```

安装后验证：
```bash
node --version
npm --version
```

#### Wrangler CLI安装

```bash
npm install -g wrangler
wrangler --version
```

### 1.2 创建必要账户

确保你已注册以下账户：
- [GitHub账户](https://github.com/join)
- [Cloudflare账户](https://dash.cloudflare.com/sign-up)

## 2. 项目克隆与初始化

### 2.1 克隆项目代码

```bash
# 创建项目目录
mkdir -p ~/Projects
cd ~/Projects

# 克隆项目（替换为你的仓库URL）
git clone https://github.com/你的用户名/game-website.git

# 进入项目目录
cd game-website
```

### 2.2 初始化子模块

```bash
# 初始化并更新子模块
git submodule sync --recursive
git submodule update --init --recursive --force

# 验证子模块是否正确初始化
ls -la public/game-website-core/
```

## 3. GitHub仓库设置

### 3.1 Git全局配置

```bash
git config --global user.name "你的GitHub用户名"
git config --global user.email "你的邮箱@example.com"
git config --global url.https://github.com/.insteadOf git@github.com/
git config --global http.postBuffer 524288000
```

### 3.2 如果是首次初始化仓库

```bash
# 初始化Git仓库（如果尚未初始化）
git init

# 添加所有文件
git add .

# 提交代码
git commit -m "Initial commit: 游戏网站项目"

# 创建GitHub远程仓库（按前面的GitHub指南操作）

# 关联远程仓库
git remote add origin https://github.com/你的用户名/game-website.git

# 推送代码
git push -u origin main
```

### 3.3 创建开发分支

```bash
git checkout -b dev
git push -u origin dev
```

## 4. Cloudflare账户配置

### 4.1 登录Wrangler

```bash
# 登录Cloudflare账户
wrangler login

# 浏览器会自动打开，按提示完成登录
```

### 4.2 获取账户信息

登录后获取你的Cloudflare账户信息：

```bash
# 查看账户信息
wrangler whoami
```

记录下 `account_id`，后续配置需要用到。

## 5. 项目依赖安装

### 5.1 安装npm依赖

```bash
cd ~/Projects/game-website
npm install
```

### 5.2 验证依赖安装

```bash
# 运行代码检查
npm run lint

# 运行测试
npm run test
```

## 6. Cloudflare资源创建

### 6.1 创建D1数据库

```bash
# 创建D1数据库
wrangler d1 create game-chat-db

# 复制返回的数据库ID
```

### 6.2 更新数据库配置

编辑 `wrangler.toml` 文件，更新D1数据库ID：

```toml
[[d1_databases]]
binding = "DB"
database_name = "game-chat-db"
database_id = "替换为你的数据库ID"
```

### 6.3 创建KV命名空间

```bash
# 创建生产环境KV命名空间
wrangler kv:namespace create "SESSION_STORE"

# 创建预览环境KV命名空间
wrangler kv:namespace create "SESSION_STORE" --preview
```

### 6.4 更新KV配置

编辑 `wrangler.toml` 文件，更新KV命名空间ID：

```toml
[[kv_namespaces]]
binding = "SESSION_STORE"
id = "替换为生产KV ID"
preview_id = "替换为预览KV ID"
```

### 6.5 初始化数据库

```bash
# 运行数据库初始化Worker
wrangler deploy --name db-init-worker ./src/workers/db-init-worker.js
```

## 7. 本地开发与测试

### 7.1 启动本地开发服务器

```bash
# 启动前端开发服务器
npm run dev

# 启动Worker开发服务器（在另一个终端）
npm run dev:worker
```

前端将在 http://localhost:5173 运行
Worker将在 http://localhost:8787 运行

### 7.2 测试WebSocket功能

```bash
# 运行聊天功能测试
npm run test:chat
```

### 7.3 构建项目

```bash
# 构建开发版本
npm run build:dev

# 或构建生产版本
npm run build
```

## 8. 部署到Cloudflare

### 8.1 开发环境部署

```bash
# 部署到开发环境
npm run deploy:dev
```

### 8.2 生产环境部署

```bash
# 部署到生产环境
npm run deploy
```

### 8.3 部署消息清理Worker

```bash
# 部署定时清理Worker
wrangler deploy --env message-cleanup-worker
```

### 8.4 验证部署

1. 访问你的Worker URL（部署成功后会显示）
2. 测试WebSocket连接
3. 检查基本功能是否正常

## 9. 自动化CI/CD配置

### 9.1 设置GitHub Secrets

1. 登录GitHub，进入你的仓库
2. 点击 Settings → Secrets and variables → Actions → New repository secret
3. 添加以下密钥：
   - `CLOUDFLARE_API_TOKEN`：你的Cloudflare API令牌
   - `CLOUDFLARE_ACCOUNT_ID`：你的Cloudflare账户ID

### 9.2 获取API令牌

1. 登录Cloudflare
2. 点击右上角头像 → My Profile → API Tokens → Create Token
3. 选择 "Create Custom Token"
4. 设置名称为 "GitHub Actions Token"
5. 设置权限：
   - Account → Cloudflare Pages → Edit
   - Account → Workers Scripts → Edit
   - Account → D1 Databases → Edit
6. 点击 "Continue to summary" → "Create Token"
7. 复制生成的令牌（只显示一次！）

### 9.3 CI/CD流程说明

- 推送到 `dev` 分支：自动运行代码检查和构建
- 推送到 `main` 分支：自动运行代码检查、构建并部署到生产环境

## 10. 常见问题与故障排除

### 10.1 环境问题

**Node.js版本错误**
- 症状：`Error: Cannot find module` 或其他版本相关错误
- 解决：确保使用Node.js v22.0.0+，使用nvm管理多个版本

**依赖安装失败**
- 症状：`npm install` 失败
- 解决：清除npm缓存 `npm cache clean --force` 后重试

### 10.2 子模块问题

**子模块初始化失败**
- 症状：`fatal: clone of '...' into submodule path '...' failed`
- 解决：
  ```bash
  rm -rf .git/modules
  git submodule deinit -f .
  git submodule update --init --recursive --force
  ```

### 10.3 Cloudflare部署问题

**权限不足**
- 症状：`Error: Forbidden` 或 `Access denied`
- 解决：检查API令牌权限是否正确

**绑定错误**
- 症状：`Error: Missing binding` 或 `Cannot access binding`
- 解决：检查wrangler.toml中的ID是否正确

**部署超时**
- 症状：`Error: Deployment timed out`
- 解决：增加超时时间 `wrangler deploy --timeout 300`

### 10.4 数据库问题

**数据库连接失败**
- 症状：`Error: Could not connect to database`
- 解决：检查数据库ID和绑定配置

**SQL语法错误**
- 症状：`Error: SQL syntax error`
- 解决：检查SQL语句，确保语法正确

## 11. 维护与更新

### 11.1 定期更新依赖

```bash
# 检查依赖更新
npm outdated

# 更新依赖
npm update
```

### 11.2 更新Wrangler

```bash
npm update -g wrangler
```

### 11.3 监控部署状态

```bash
# 查看部署历史
wrangler deployments list

# 查看实时日志
wrangler tail --env production
```

### 11.4 数据库备份

```bash
# 导出D1数据库
wrangler d1 execute game-chat-db --command ".dump" > backup-$(date +%Y%m%d).sql
```

## 12. 快速参考命令

### 开发命令
```bash
npm run dev           # 启动前端开发服务器
npm run dev:worker    # 启动Worker开发服务器
npm run lint          # 代码检查
npm run test          # 运行测试
```

### 构建命令
```bash
npm run build         # 构建生产版本
npm run build:dev     # 构建开发版本
```

### 部署命令
```bash
npm run deploy        # 部署到生产环境
npm run deploy:dev    # 部署到开发环境
```

### Cloudflare命令
```bash
wrangler login        # 登录Cloudflare
wrangler whoami       # 查看账户信息
wrangler tail         # 查看实时日志
```

---

恭喜！你已完成游戏网站项目的完整部署流程。如有任何问题，请参考本指南的故障排除部分，或在项目仓库中提交Issue。

祝你部署顺利！