/**
 * D1数据库连接和操作封装
 */

// 数据库操作封装类
class Database {
  constructor(db) {
    this.db = db; // Cloudflare D1数据库绑定
  }

  /**
   * 执行SQL查询
   * @param {string} query - SQL查询语句
   * @param {Array} params - 查询参数
   * @returns {Promise} 查询结果
   */
  async prepare(query, params = []) {
    try {
      // 准备查询
      const stmt = this.db.prepare(query);
      
      // 如果有参数，绑定参数
      if (params && params.length > 0) {
        return await stmt.bind(...params).all();
      }
      
      // 执行无参数查询
      return await stmt.all();
    } catch (error) {
      console.error('Database query error:', { query, error });
      throw error;
    }
  }

  /**
   * 执行单条记录查询
   * @param {string} query - SQL查询语句
   * @param {Array} params - 查询参数
   * @returns {Promise<Object>} 单个记录对象
   */
  async getOne(query, params = []) {
    try {
      const stmt = this.db.prepare(query);
      
      if (params && params.length > 0) {
        return await stmt.bind(...params).first();
      }
      
      return await stmt.first();
    } catch (error) {
      console.error('Database getOne error:', { query, error });
      throw error;
    }
  }

  /**
   * 执行插入操作
   * @param {string} query - SQL插入语句
   * @param {Array} params - 查询参数
   * @returns {Promise<Object>} 插入结果，包含lastInsertRowid
   */
  async insert(query, params = []) {
    try {
      const stmt = this.db.prepare(query);
      
      if (params && params.length > 0) {
        return await stmt.bind(...params).run();
      }
      
      return await stmt.run();
    } catch (error) {
      console.error('Database insert error:', { query, error });
      throw error;
    }
  }

  /**
   * 执行更新操作
   * @param {string} query - SQL更新语句
   * @param {Array} params - 查询参数
   * @returns {Promise<Object>} 更新结果，包含changes
   */
  async update(query, params = []) {
    try {
      const stmt = this.db.prepare(query);
      
      if (params && params.length > 0) {
        return await stmt.bind(...params).run();
      }
      
      return await stmt.run();
    } catch (error) {
      console.error('Database update error:', { query, error });
      throw error;
    }
  }

  /**
   * 执行删除操作
   * @param {string} query - SQL删除语句
   * @param {Array} params - 查询参数
   * @returns {Promise<Object>} 删除结果，包含changes
   */
  async delete(query, params = []) {
    try {
      const stmt = this.db.prepare(query);
      
      if (params && params.length > 0) {
        return await stmt.bind(...params).run();
      }
      
      return await stmt.run();
    } catch (error) {
      console.error('Database delete error:', { query, error });
      throw error;
    }
  }

  /**
   * 执行事务
   * @param {Function} fn - 事务中要执行的函数
   * @returns {Promise} 事务结果
   */
  async transaction(fn) {
    try {
      // 开始事务
      await this.db.exec('BEGIN TRANSACTION');
      
      try {
        // 执行事务函数
        const result = await fn(this);
        
        // 提交事务
        await this.db.exec('COMMIT');
        
        return result;
      } catch (error) {
        // 回滚事务
        await this.db.exec('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Database transaction error:', error);
      throw error;
    }
  }

  /**
   * 检查连接是否正常
   * @returns {Promise<boolean>} 连接状态
   */
  async checkConnection() {
    try {
      const result = await this.prepare('SELECT 1 as connected');
      return result.results && result.results.length > 0 && result.results[0].connected === 1;
    } catch (error) {
      console.error('Database connection check failed:', error);
      return false;
    }
  }

  /**
   * 初始化数据库（创建表等）
   * @param {string} schemaPath - 数据库模式文件路径
   * @returns {Promise<boolean>} 初始化结果
   */
  async initialize(schema) {
    try {
      // 执行schema创建语句
      await this.db.exec(schema);
      console.log('Database initialized successfully');
      return true;
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }
}

/**
 * 创建数据库实例
 * @param {Object} env - Worker环境对象，包含D1绑定
 * @returns {Database} 数据库操作实例
 */
export function createDbInstance(env) {
  if (!env.DB) {
    throw new Error('D1 database binding not found');
  }
  return new Database(env.DB);
}

/**
 * 数据库错误处理工具
 * @param {Error} error - 数据库错误
 * @returns {Object} 标准化错误对象
 */
export function handleDbError(error) {
  // 标准化错误响应
  const errorResponse = {
    success: false,
    error: {
      message: 'Database operation failed',
      details: process.env.NODE_ENV === 'production' ? null : error.message,
      code: 'DB_ERROR'
    }
  };

  // 根据错误类型设置更具体的错误消息
  if (error.message.includes('UNIQUE constraint failed')) {
    errorResponse.error.message = 'Duplicate entry found';
    errorResponse.error.code = 'DB_DUPLICATE';
  } else if (error.message.includes('FOREIGN KEY constraint failed')) {
    errorResponse.error.message = 'Invalid reference';
    errorResponse.error.code = 'DB_FOREIGN_KEY';
  } else if (error.message.includes('syntax')) {
    errorResponse.error.message = 'Invalid query syntax';
    errorResponse.error.code = 'DB_SYNTAX_ERROR';
  }

  return errorResponse;
}

export default Database;
