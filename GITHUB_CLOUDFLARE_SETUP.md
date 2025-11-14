# GitHub和Cloudflare配置指南

本指南将详细说明如何在GitHub仓库中配置必要的Cloudflare Secrets，以及如何在Cloudflare控制台中连接GitHub仓库并完成Pages配置。

## 1. 在GitHub仓库中配置必要的Cloudflare Secrets

### 步骤1: 获取Cloudflare API令牌

1. 登录您的Cloudflare账户
2. 点击右上角的个人资料图标，选择「我的个人资料」
3. 在左侧导航中选择「API令牌」
4. 点击「创建令牌」按钮
5. 选择「自定义令牌」
6. 设置令牌名称（例如：`github-actions-deploy-token`）
7. 设置权限：
   - 选择「Account」→「Cloudflare Pages」→「Edit」权限
   - 选择「Account」→「Account Settings」→「Read」权限
8. 点击「继续创建」→「创建令牌」
9. **重要：复制生成的API令牌并保存，它只会显示一次！**

### 步骤2: 获取Cloudflare账户ID

1. 登录您的Cloudflare账户
2. 点击右上角的个人资料图标，选择「我的个人资料」
3. 在页面右侧的「API」部分，您可以找到「账户ID」
4. 复制此账户ID

### 步骤3: 在GitHub仓库中添加Secrets

1. 访问您的GitHub仓库（https://github.com/2066xll/game）
2. 点击顶部导航栏中的「Settings」
3. 在左侧导航中，展开「Secrets and variables」并选择「Actions」
4. 点击「New repository secret」按钮

#### 添加API令牌
- **Name**: `CLOUDFLARE_API_TOKEN`
- **Secret**: 粘贴您之前复制的Cloudflare API令牌
- 点击「Add secret」

#### 添加账户ID
- 再次点击「New repository secret」
- **Name**: `CLOUDFLARE_ACCOUNT_ID`
- **Secret**: 粘贴您的Cloudflare账户ID
- 点击「Add secret」

## 2. 在Cloudflare控制台中连接GitHub仓库并完成Pages配置

### 步骤1: 登录Cloudflare并导航到Pages

1. 登录您的Cloudflare账户
2. 在左侧导航中选择「Pages」

### 步骤2: 创建新的Pages项目

1. 点击「创建项目」按钮
2. 在「连接到Git」部分，选择「GitHub」
3. 如果尚未授权，点击「授权GitHub」并按照提示完成授权流程
4. 在仓库列表中找到并选择您的`game`仓库
5. 点击「开始设置」

### 步骤3: 配置构建和部署设置

1. **项目名称**: 可以保留默认名称（`game`）或修改为您喜欢的名称
2. **生产分支**: 选择`main`
3. **构建配置**: 
   - **框架预设**: 如果您的项目使用特定框架，可以选择；否则选择「None」
   - **构建命令**: `npm run build`
   - **构建输出目录**: `dist`
   - **环境变量**: 可以添加必要的环境变量（如果有）
4. 点击「保存并部署」

### 步骤4: 等待部署完成

Cloudflare Pages将开始构建和部署您的项目。您可以在部署日志中查看进度和任何错误信息。

## 3. 验证部署是否成功

部署完成后，您可以通过以下步骤验证部署是否成功：

1. 在Cloudflare Pages项目页面，您会看到一个`*.pages.dev`域名
2. 点击此域名或复制到浏览器中打开
3. 检查网站是否正常加载
4. 测试主要功能，如导航、搜索、游戏详情页等
5. 验证所有静态资源（图片、CSS、JavaScript）是否正确加载

## 4. 故障排除

如果部署过程中遇到问题，请检查以下几点：

1. **构建错误**: 查看部署日志中的错误信息
2. **环境变量**: 确保所有必要的环境变量都已正确设置
3. **API令牌权限**: 确保您的Cloudflare API令牌具有正确的权限
4. **GitHub Secrets**: 确认GitHub Secrets中的值是否正确
5. **构建脚本**: 检查项目中的`npm run build`脚本是否能正常工作

如果问题仍然存在，请参考Cloudflare Pages文档或联系支持获取进一步帮助。