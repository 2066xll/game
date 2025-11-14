// 错误处理模块，用于统一管理应用程序中的错误

/**
 * 应用错误类，扩展原生Error
 */
export class AppError extends Error {
  /**
   * 创建应用错误实例
   * @param {string} message - 错误消息
   * @param {string} errorCode - 错误代码
   * @param {number} statusCode - HTTP状态码（如果适用）
   * @param {boolean} isOperational - 是否为操作型错误（可预期的业务错误）
   */
  constructor(message, errorCode = 'APP_ERROR', statusCode = 500, isOperational = false) {
    super(message);
    this.name = this.constructor.name;
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    // 保留错误堆栈
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * API错误类，用于处理API相关的错误
 */
export class ApiError extends AppError {
  constructor(message, errorCode = 'API_ERROR', statusCode = 500) {
    super(message, errorCode, statusCode, true);
  }
}

/**
 * 资源错误类，用于处理资源相关的错误
 */
export class ResourceError extends AppError {
  constructor(message, errorCode = 'RESOURCE_ERROR', statusCode = 404) {
    super(message, errorCode, statusCode, true);
  }
}

/**
 * 验证错误类，用于处理验证相关的错误
 */
export class ValidationError extends AppError {
  constructor(message, errorCode = 'VALIDATION_ERROR', statusCode = 400) {
    super(message, errorCode, statusCode, true);
  }
}

/**
 * 错误处理工具类
 */
export class ErrorHandler {
  /**
   * 处理错误并转换为友好响应
   * @param {Error} error - 错误对象
   * @param {boolean} includeStackTrace - 是否包含堆栈信息（开发环境）
   * @returns {Object} 错误响应对象
   */
  static handleError(error, includeStackTrace = false) {
    // 判断错误类型并转换为统一格式
    let appError;
    
    if (error instanceof AppError) {
      appError = error;
    } else {
      // 对于非应用错误，转换为内部服务器错误
      appError = new AppError(
        process.env.NODE_ENV === 'production' ? '服务器内部错误' : error.message,
        'INTERNAL_ERROR',
        500,
        false
      );
    }
    
    // 构建错误响应
    const errorResponse = {
      error: {
        code: appError.errorCode,
        message: appError.message,
        status: appError.statusCode,
        timestamp: appError.timestamp
      }
    };
    
    // 开发环境包含堆栈信息
    if (includeStackTrace && process.env.NODE_ENV !== 'production') {
      errorResponse.error.stack = error.stack;
    }
    
    return errorResponse;
  }
  
  /**
   * 格式化API错误响应
   * @param {Error} error - 错误对象
   * @returns {Object} 格式化的API错误响应
   */
  static formatApiError(error) {
    const handledError = this.handleError(error);
    return {
      success: false,
      ...handledError
    };
  }
  
  /**
   * 记录错误日志
   * @param {Error} error - 错误对象
   * @param {string} context - 错误发生的上下文
   */
  static logError(error, context = 'Unknown context') {
    console.error(`[${context}] Error occurred:`, {
      message: error.message,
      code: error.errorCode || 'UNKNOWN',
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * 抛出验证错误
   * @param {string} message - 验证错误消息
   */
  static throwValidationError(message) {
    throw new ValidationError(message);
  }
  
  /**
   * 抛出API错误
   * @param {string} message - API错误消息
   * @param {string} errorCode - 错误代码
   * @param {number} statusCode - HTTP状态码
   */
  static throwApiError(message, errorCode, statusCode) {
    throw new ApiError(message, errorCode, statusCode);
  }
  
  /**
   * 抛出资源错误
   * @param {string} message - 资源错误消息
   */
  static throwResourceError(message) {
    throw new ResourceError(message);
  }
}

export default ErrorHandler;
