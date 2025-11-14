# game

This is a Vue 3 + Vite project. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about IDE Support for Vue in the [Vue Docs Scaling up Guide](https://vuejs.org/guide/scaling-up/tooling.html#ide-support).

## 子模块配置说明

本项目使用Git子模块管理`public/game-website-core`目录，包含游戏核心资源。

### 克隆项目时初始化子模块

```bash
git clone --recursive https://github.com/2066xll/game.git
```

或者，如果已经克隆了项目但没有初始化子模块：

```bash
git clone https://github.com/2066xll/game.git
cd game
git submodule update --init --recursive
```

### 更新子模块

当子模块仓库有更新时，使用以下命令更新：

```bash
git submodule update --remote --merge
```

## CI/CD 工作流最佳实践

本项目使用GitHub Actions进行持续集成和部署。关键配置包括：

1. **子模块处理**：CI/CD工作流配置了显式的子模块初始化和更新步骤，确保构建过程中能正确访问子模块内容。

2. **错误处理**：工作流包含详细的调试信息输出和错误检查，便于排查构建失败问题。

3. **超时控制**：为各个作业和步骤设置了合理的超时时间，避免长时间运行。

4. **环境变量**：使用GitHub Secrets存储敏感信息，如API令牌。

### 构建命令

- 开发环境构建：`npm run build:dev`
- 生产环境构建：`npm run build`

### 部署

- 主分支(`main`)：自动构建并部署到Cloudflare Pages生产环境
- 开发分支(`dev`)：自动构建并保存构建产物，不部署

## Cloudflare Pages部署配置指南

### 1. GitHub仓库准备

1. 确保项目已推送到GitHub仓库
2. 配置必要的GitHub Secrets（在仓库的Settings > Secrets and variables > Actions中）：
   - `CLOUDFLARE_API_TOKEN`: 具有Pages编辑权限的API令牌
   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare账户ID

### 2. Cloudflare Pages配置

1. 登录Cloudflare控制台
2. 导航到"Pages"部分
3. 点击"连接到Git"
4. 选择您的GitHub账户，找到并选择`game`仓库
5. 配置构建设置：
   - 构建命令: `npm run build`
   - 构建输出目录: `dist`
   - 环境变量: `NODE_VERSION=18`
6. 点击"开始构建"

### 3. 自动化部署验证

推送代码到GitHub后，验证部署流程是否正常工作：

1. 检查GitHub Actions工作流是否正常触发（仓库的Actions标签页）
2. 查看Cloudflare Pages构建状态（Cloudflare控制台的Pages部分）
3. 访问分配的Cloudflare Pages域名，确认网站正常访问

### 4. 自定义域名配置（可选）

1. 在Cloudflare Pages项目设置中，导航到"自定义域"
2. 点击"设置自定义域"
3. 按照提示添加和验证您的自定义域名
4. 更新DNS设置，确保域名正确解析到Cloudflare

## 常见问题排查

### 子模块更新失败

如果在构建过程中遇到子模块更新失败：

1. 检查`.gitmodules`文件配置是否正确
2. 确保GitHub Actions有足够的权限访问子模块仓库
3. 尝试使用HTTPS而不是SSH访问GitHub仓库
4. 增加git http缓冲区大小：`git config --global http.postBuffer 524288000`

### Cloudflare部署问题

1. 验证API令牌权限是否正确
2. 检查账户ID是否准确
3. 确认构建命令和输出目录配置正确
4. 查看Cloudflare Pages构建日志获取详细错误信息
