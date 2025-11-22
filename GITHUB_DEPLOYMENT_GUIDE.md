# GitHub 仓库初始化与代码提交指南

## 1. 环境准备

### 1.1 安装必要工具

确保你的系统已安装以下工具：

```bash
# 检查Git版本
git --version

# 检查Node.js和npm版本
node --version  # 要求 v22.0.0 或更高
npm --version
```

如果未安装，请前往官方网站下载并安装：
- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/zh-cn/download/current/)

### 1.2 配置Git全局设置

首次使用Git需要配置用户名和邮箱：

```bash
git config --global user.name "你的用户名"
git config --global user.email "你的邮箱@example.com"

# 配置默认使用HTTPS（避免SSH连接问题）
git config --global url.https://github.com/.insteadOf git@github.com/

# 增加HTTP缓冲区大小（处理大文件和子模块）
git config --global http.postBuffer 524288000
```

## 2. GitHub仓库创建

### 2.1 创建新仓库

1. 登录 [GitHub官网](https://github.com/)
2. 点击右上角的 "+" 图标，选择 "New repository"
3. 填写以下信息：
   - **Repository name**: `game-website`（或你喜欢的名称）
   - **Description**: 游戏网站项目 - 包含前端Vue应用和Cloudflare Workers后端
   - **Public/Private**: 选择适合你的选项
   - **Initialize this repository with a README**: 不勾选（因为我们将导入现有代码）
   - **Add .gitignore**: 不勾选（项目已有）
   - **Choose a license**: 根据需要选择
4. 点击 "Create repository"

### 2.2 获取仓库URL

创建仓库后，复制仓库的HTTPS URL，例如：
`https://github.com/你的用户名/game-website.git`

## 3. 项目初始化与代码提交

### 3.1 本地代码初始化

```bash
# 进入项目目录
cd /Users/sunrize/Documents/game

# 初始化Git仓库（如果尚未初始化）
git init

# 添加.gitignore文件（如果不存在）
# 检查.gitignore文件是否存在
ls -la

# 如果不存在，创建一个基础的.gitignore文件
echo "# Logs\nlogs\n*.log\nnpm-debug.log*\nyarn-debug.log*\nyarn-error.log*\npnpm-debug.log*\nlerna-debug.log*\n\ndist\ndist-ssr\n*.local\n\n# Editor directories and files\n.vscode/*\n!.vscode/extensions.json\n.idea\n.DS_Store\n*.suo\n*.ntvs*\n*.njsproj\n*.sln\n*.sw?" > .gitignore
```

### 3.2 处理子模块

**重要**：该项目包含子模块 `public/game-website-core`，需要特殊处理：

```bash
# 确保子模块目录存在
mkdir -p public/game-website-core

# 如果需要添加子模块（替换为实际的子模块URL）
git submodule add https://github.com/你的用户名/game-website-core.git public/game-website-core

# 初始化并更新子模块
git submodule sync --recursive
git submodule update --init --recursive --force
```

### 3.3 添加和提交代码

```bash
# 检查当前状态
git status

# 添加所有文件
git add .

# 提交代码
git commit -m "Initial commit: 游戏网站项目 - 包含前端Vue应用和Cloudflare Workers后端"

# 关联到远程仓库
git remote add origin https://github.com/你的用户名/game-website.git

# 推送代码到远程仓库
git push -u origin main
```

## 4. 分支管理策略

### 4.1 创建开发分支

```bash
# 从main分支创建dev分支
git checkout -b dev

# 推送dev分支到远程仓库
git push -u origin dev
```

### 4.2 分支规范

- **main**：生产环境分支，仅接受稳定版本的合并
- **dev**：开发环境分支，日常开发工作在此分支
- **feature/***：新功能开发分支，命名格式为 `feature/功能名称`
- **bugfix/***：bug修复分支，命名格式为 `bugfix/问题描述`

### 4.3 分支操作示例

```bash
# 创建新功能分支
git checkout dev
git checkout -b feature/new-chat-feature

# 开发完成后，合并到dev分支
git checkout dev
git merge feature/new-chat-feature

# 推送更新
git push

# 删除已完成的功能分支
git branch -d feature/new-chat-feature
git push origin --delete feature/new-chat-feature
```

## 5. GitHub Actions CI/CD 配置

### 5.1 了解现有CI/CD流程

项目已配置了GitHub Actions工作流 `.github/workflows/ci-cd.yml`，包含以下主要任务：

1. **lint-and-test**：代码检查和测试
2. **build-and-deploy**：生产环境构建和部署（main分支触发）
3. **build-dev**：开发环境构建（dev分支触发）

### 5.2 设置必要的密钥

为了让CI/CD正常工作，需要在GitHub仓库中设置以下密钥：

1. 进入GitHub仓库 → Settings → Secrets and variables → Actions
2. 点击 "New repository secret"
3. 添加以下密钥：

   - `CLOUDFLARE_API_TOKEN`：具有Pages编辑权限的Cloudflare API令牌
   - `CLOUDFLARE_ACCOUNT_ID`：Cloudflare账户ID

### 5.3 获取Cloudflare API令牌

1. 登录 [Cloudflare账户](https://dash.cloudflare.com/)
2. 点击右上角头像 → My Profile → API Tokens → Create Token
3. 选择 "Create Custom Token"
4. 设置以下权限：
   - Account → Cloudflare Pages → Edit
5. 点击 "Continue to summary" → "Create Token"
6. 复制生成的令牌并保存（只显示一次）

### 5.4 获取Cloudflare账户ID

1. 登录 [Cloudflare账户](https://dash.cloudflare.com/)
2. 点击右上角头像 → 复制Account ID

## 6. 常见问题解决

### 6.1 子模块更新失败

如果遇到子模块更新失败：

```bash
# 强制删除并重新添加子模块
rm -rf public/game-website-core
git submodule deinit -f --all
git rm -f public/game-website-core
git submodule add https://github.com/你的用户名/game-website-core.git public/game-website-core
git submodule update --init --recursive --force
```

### 6.2 推送权限问题

如果遇到权限错误，请确保：

1. GitHub账户已正确配置
2. 使用HTTPS而非SSH（已在全局配置中设置）
3. 考虑使用GitHub CLI或个人访问令牌

### 6.3 CI/CD工作流失败

常见原因：

1. 缺少必要的密钥（Cloudflare API Token或Account ID）
2. 子模块初始化失败
3. Node.js版本不兼容（要求v22.x）
4. 构建超时

解决方法：查看GitHub Actions日志，根据具体错误信息进行修复。

## 7. 最佳实践

1. **提交前检查**：每次提交前运行 `npm run lint` 确保代码质量
2. **定期拉取**：开发过程中定期从远程仓库拉取更新 `git pull`
3. **保持主分支稳定**：只有经过充分测试的代码才能合并到main分支
4. **详细的提交信息**：提交信息应清晰描述所做的更改
5. **保护分支**：在GitHub仓库设置中保护main和dev分支，防止直接推送

---

完成以上步骤后，你的代码已成功提交到GitHub仓库，并且配置了自动化的CI/CD流程。下一部分将详细介绍Cloudflare Workers的部署流程。