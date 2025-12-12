# Pull Request 模板

## PR标题建议
"优化部署流程，添加自动化脚本和配置"

## PR描述模板

```markdown
## 部署流程优化说明

本PR主要优化了项目的部署流程，添加了自动化脚本和配置，简化了后续部署步骤。

### 主要更改：

1. **创建简化部署脚本**
   - 添加了`deploy.sh`脚本，提供交互式菜单和多种部署选项
   - 支持OAuth登录解决API Token冲突问题
   - 添加颜色提示和错误处理机制

2. **更新package.json**
   - 添加`npm run setup`、`npm run deploy`、`npm run login`等简化命令
   - 修复login脚本配置，解决环境变量冲突问题

3. **配置GitHub Actions自动化部署**
   - 创建`.github/workflows/cloudflare-deploy.yml`配置文件
   - 设置自动化部署流程，支持main分支合并后自动部署

4. **环境变量管理优化**
   - 创建`.env.example`提供配置模板
   - 添加`.env.login`解决OAuth登录冲突
   - 更新`.gitignore`确保敏感文件不被提交

5. **添加部署测试工具**
   - 创建`test-deployment.js`脚本验证部署环境
   - 提供一键检查部署配置的功能

### 部署使用说明：

1. 基础配置：复制`.env.example`到`.env`并填写相关配置
2. 安装依赖：`npm install`
3. Cloudflare登录：`npm run login`或使用`./deploy.sh`中的OAuth登录选项
4. 部署项目：`npm run deploy`或使用`./deploy.sh`脚本

### 注意事项：

- 确保正确配置Cloudflare账户信息和API令牌
- 部署前请验证环境变量设置是否正确
- 自动化部署会在PR合并到main分支后触发
```