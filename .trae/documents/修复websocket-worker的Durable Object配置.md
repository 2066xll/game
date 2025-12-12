我需要修复websocket-worker的Durable Object配置，主要问题是migrations配置格式不正确。具体修复方案如下：

**1. 修复migrations配置格式**

* 将`[env.websocket-worker.migrations]`改为`[[migrations]]`数组格式

* 为每个migration添加`env`字段，指定对应的环境

* 移除当前错误的环境内migrations配置

**2. 修复的文件**

* `wrangler.toml`：更新Durable Object migrations配置

**3. 预期结果**

* ✅ 解决websocket-worker的Durable Object部署错误

* ✅ 正确配置Durable Object migrations

* ✅ 支持多环境的Durable Object配置

* ✅ 可以成功部署websocket-worker

**4. 修复步骤**

1. 移除`[env.websocket-worker.migrations]`配置
2. 添加全局`[[migrations]]`配置，指定websocket-worker环境
3. 移除`[env.minimal-websocket-worker.migrations]`配置
4. 添加全局`[[migrations]]`配置，指定minimal-websocket-worker环境
5. 测试修复后的配置

