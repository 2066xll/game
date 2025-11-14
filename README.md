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

## 常见问题排查

### 子模块更新失败

如果在构建过程中遇到子模块更新失败：

1. 检查`.gitmodules`文件配置是否正确
2. 确保GitHub Actions有足够的权限访问子模块仓库
3. 尝试使用HTTPS而不是SSH访问GitHub仓库
4. 增加git http缓冲区大小：`git config --global http.postBuffer 524288000`
