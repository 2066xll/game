// 简单的数据库连接测试脚本
import Database from './src/workers/database/db.js';

async function testDbConnection() {
  console.log('开始测试数据库连接...');
  
  try {
    // 模拟环境变量和上下文
    const mockDb = {
      prepare: async (sql) => {
        console.log('SQL准备:', sql);
        return {
          first: async (params) => {
            console.log('执行查询，参数:', params);
            return { success: true, duration: 10 }; // 添加duration属性
          },
          run: async (params) => {
            console.log('执行命令，参数:', params);
            return { success: true, duration: 10 }; // 添加duration属性
          },
          bind: function(...params) {
            this.params = params;
            return this;
          },
          all: async function() {
            console.log('执行all查询，参数:', this.params);
            return { results: [{ success: true }], duration: 10 };
          }
        };
      }
    };
    
    // 创建Database实例
    const db = new Database(mockDb);
    console.log('✅ 数据库连接初始化成功');
    
    // 测试简单查询
    try {
      console.log('\n测试简单查询...');
      const result = await db.getOne('SELECT 1 as test');
      console.log('查询结果:', result);
    } catch (error) {
      console.error('❌ 查询失败:', error.message);
    }
    
    // 查看auth-worker.js中的事务处理代码
    console.log('\n请检查auth-worker.js中的事务处理代码，特别是registerUser函数');
    console.log('错误显示：Cannot read properties of undefined (reading \'duration\')');
    
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    console.error(error.stack);
  }
  
  console.log('\n测试完成');
}

testDbConnection();