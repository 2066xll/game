我需要修复wrangler.toml文件中的多个警告问题：

1. **添加pages\_build\_output\_dir字段**：在配置文件顶部添加此字段，指定静态文件目录
2. **修复triggers配置**：修改message-cleanup-worker的triggers配置，移除不支持的cron字段
3. **为message-cleanup-worker添加kv\_namespaces配置**：添加与其他环境相同的KV命名空间配置
4. **更新package.json中的部署脚本**：为deploy命令添加--env参数，避免multiple environments警告

**修改的文件**：

* `wrangler.toml`：添加pages\_build\_output\_dir字段，修复triggers配置，添加KV命名空间

* `package.json`：更新部署脚本，添加--env参数

**预期结果**：

* 解决Pages部署警告

* 解决triggers配置警告

* 解决KV命名空间继承警告

* 解决multiple environments警告

* 所有部署命令成功执行，无警告信息

