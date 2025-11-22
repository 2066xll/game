// 日志记录系统，用于记录应用程序的日志信息

/**
 * 日志级别枚举
 */
export const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
  TRACE: 'TRACE'
};

/**
 * 日志记录器配置
 */
const DEFAULT_CONFIG = {
  level: import.meta.env.MODE === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG,
  enableConsole: true,
  enableLocalStorage: import.meta.env.MODE === 'development',
  maxLogs: 100,
  logToServer: import.meta.env.MODE === 'production'
};

/**
 * 日志记录器类
 */
export class Logger {
  /**
   * 创建日志记录器实例
   * @param {string} name - 日志记录器名称
   * @param {Object} config - 配置选项
   */
  constructor(name, config = {}) {
    this.name = name || 'AppLogger';
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logs = [];
    
    // 初始化本地存储
    if (this.config.enableLocalStorage) {
      this._initLocalStorage();
    }
  }
  
  /**
   * 初始化本地存储
   * @private
   */
  _initLocalStorage() {
    try {
      const storedLogs = localStorage.getItem(`logs_${this.name}`);
      if (storedLogs) {
        this.logs = JSON.parse(storedLogs);
      }
    } catch (error) {
      console.error('Failed to load logs from localStorage:', error);
      this.logs = [];
    }
  }
  
  /**
   * 保存日志到本地存储
   * @private
   */
  _saveToLocalStorage() {
    if (!this.config.enableLocalStorage) return;
    
    try {
      // 保持日志数量在限制范围内
      if (this.logs.length > this.config.maxLogs) {
        this.logs = this.logs.slice(-this.config.maxLogs);
      }
      localStorage.setItem(`logs_${this.name}`, JSON.stringify(this.logs));
    } catch (error) {
      console.error('Failed to save logs to localStorage:', error);
    }
  }
  
  /**
   * 发送日志到服务器
   * @param {Object} logData - 日志数据
   * @private
   */
  _sendToServer(logData) {
    if (!this.config.logToServer || logData.level < this.config.level) return;
    
    // 实际项目中，这里应该发送日志到日志服务器
    try {
      // 使用 fetch API 发送日志，不阻塞主线程
      fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(logData),
        // 不等待响应
        keepalive: true
      }).catch(err => {
        // 避免日志发送失败导致应用崩溃
        console.error('Failed to send log to server:', err);
      });
    } catch (error) {
      // 静默失败，避免日志功能影响主应用
    }
  }
  
  /**
   * 判断日志级别是否应该被记录
   * @param {string} level - 日志级别
   * @returns {boolean} 是否应该记录
   * @private
   */
  _shouldLog(level) {
    const levelValues = Object.values(LOG_LEVELS);
    return levelValues.indexOf(level) >= levelValues.indexOf(this.config.level);
  }
  
  /**
   * 生成日志记录
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @param {Object} data - 附加数据
   * @private
   */
  _log(level, message, data = {}) {
    // 检查是否应该记录
    if (!this._shouldLog(level)) return;
    
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      name: this.name,
      data
    };
    
    // 添加到日志历史
    this.logs.push(logData);
    this._saveToLocalStorage();
    
    // 发送到服务器
    this._sendToServer(logData);
    
    // 输出到控制台
    if (this.config.enableConsole) {
      this._logToConsole(level, message, data, timestamp);
    }
  }
  
  /**
   * 输出日志到控制台
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @param {Object} data - 附加数据
   * @param {string} timestamp - 时间戳
   * @private
   */
  _logToConsole(level, message, data, timestamp) {
    const logPrefix = `[${timestamp}] [${level}] [${this.name}]`;
    
    switch (level) {
      case LOG_LEVELS.ERROR:
        console.error(logPrefix, message, data);
        break;
      case LOG_LEVELS.WARN:
        console.warn(logPrefix, message, data);
        break;
      case LOG_LEVELS.INFO:
        console.info(logPrefix, message, data);
        break;
      case LOG_LEVELS.DEBUG:
      case LOG_LEVELS.TRACE:
        console.log(logPrefix, message, data);
        break;
      default:
        console.log(logPrefix, message, data);
    }
  }
  
  /**
   * 记录错误日志
   * @param {string} message - 日志消息
   * @param {Object|Error} error - 错误对象或附加数据
   */
  error(message, error = {}) {
    // 处理Error对象
    const errorData = error instanceof Error
      ? {
          message: error.message,
          stack: error.stack,
          code: error.code || error.errorCode
        }
      : error;
    
    this._log(LOG_LEVELS.ERROR, message, errorData);
  }
  
  /**
   * 记录警告日志
   * @param {string} message - 日志消息
   * @param {Object} data - 附加数据
   */
  warn(message, data = {}) {
    this._log(LOG_LEVELS.WARN, message, data);
  }
  
  /**
   * 记录信息日志
   * @param {string} message - 日志消息
   * @param {Object} data - 附加数据
   */
  info(message, data = {}) {
    this._log(LOG_LEVELS.INFO, message, data);
  }
  
  /**
   * 记录调试日志
   * @param {string} message - 日志消息
   * @param {Object} data - 附加数据
   */
  debug(message, data = {}) {
    this._log(LOG_LEVELS.DEBUG, message, data);
  }
  
  /**
   * 记录跟踪日志
   * @param {string} message - 日志消息
   * @param {Object} data - 附加数据
   */
  trace(message, data = {}) {
    this._log(LOG_LEVELS.TRACE, message, data);
  }
  
  /**
   * 获取日志历史
   * @param {number} limit - 返回的日志数量限制
   * @returns {Array} 日志数组
   */
  getLogs(limit = 100) {
    return this.logs.slice(-limit);
  }
  
  /**
   * 清空日志
   */
  clearLogs() {
    this.logs = [];
    this._saveToLocalStorage();
  }
  
  /**
   * 设置日志级别
   * @param {string} level - 日志级别
   */
  setLevel(level) {
    if (Object.values(LOG_LEVELS).includes(level)) {
      this.config.level = level;
    } else {
      this.warn(`Invalid log level: ${level}, using current level: ${this.config.level}`);
    }
  }
}

// 创建默认日志记录器实例
const defaultLogger = new Logger('App');

// 导出默认日志记录器和工厂方法
export default {
  logger: defaultLogger,
  
  /**
   * 创建新的日志记录器
   * @param {string} name - 日志记录器名称
   * @param {Object} config - 配置选项
   * @returns {Logger} 日志记录器实例
   */
  createLogger(name, config = {}) {
    return new Logger(name, config);
  }
};
