// 执行数据库初始化的脚本
import { createTablesSQL } from './init-database.js';

// 创建一个模拟的数据库连接来测试SQL语法
function testSQLSyntax() {
  console.log('开始检查SQL语法...');
  
  // 简单的语法检查
  const statements = createTablesSQL
    .split(';')
    .map(statement => statement.trim())
    .filter(statement => statement.length > 0);
  
  console.log(`发现 ${statements.length} 条SQL语句:`);
  statements.forEach((stmt, index) => {
    console.log(`\n${index + 1}. ${stmt.substring(0, 50)}${stmt.length > 50 ? '...' : ''}`);
  });
  
  console.log('\nSQL语法检查完成。接下来需要通过Cloudflare CLI执行这些语句。');
  console.log('请运行以下命令初始化D1数据库:');
  console.log('\nwrangler d1 execute <DATABASE_NAME> --command "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, user_code TEXT UNIQUE NOT NULL, nickname TEXT NOT NULL, email TEXT UNIQUE, password_hash TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"');
  console.log('\n然后依次执行其他表的创建命令。');
}

// 运行测试
testSQLSyntax();