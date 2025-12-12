/**
 * 输入验证功能
 * 负责处理用户输入的验证逻辑
 */

// 增强的输入验证函数
function validateRegistrationInput(nickname, email, password) {
  // 验证必填字段（邮箱现在变为可选）
  if (!nickname || !password) {
    return { valid: false, message: 'Missing required fields', code: 'MISSING_FIELDS' };
  }
  
  // 验证昵称
  if (typeof nickname !== 'string' || nickname.trim().length < 2 || nickname.trim().length > 30) {
    return { valid: false, message: 'Nickname must be between 2-30 characters', code: 'INVALID_NICKNAME' };
  }
  // 昵称只允许字母、数字、空格和一些常见特殊字符
  const nicknameRegex = /^[a-zA-Z0-9\s._-]+$/;
  if (!nicknameRegex.test(nickname.trim())) {
    return { valid: false, message: 'Nickname contains invalid characters', code: 'INVALID_NICKNAME_CHARS' };
  }
  
  // 如果提供了邮箱，验证邮箱格式
  if (email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      return { valid: false, message: 'Invalid email format', code: 'INVALID_EMAIL' };
    }
    if (email.length > 100) {
      return { valid: false, message: 'Email too long', code: 'EMAIL_TOO_LONG' };
    }
  }
  
  // 验证密码强度
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long', code: 'WEAK_PASSWORD' };
  }
  if (password.length > 100) {
    return { valid: false, message: 'Password too long', code: 'PASSWORD_TOO_LONG' };
  }
  
  // 检查密码是否只包含空白字符
  if (!password.trim()) {
    return { valid: false, message: 'Password cannot contain only whitespace', code: 'EMPTY_PASSWORD' };
  }
  
  return { valid: true };
}

// 增强的登录输入验证函数
function validateLoginInput(email, password, userCode) {
  // 验证必填字段
  if (!password || (!email && !userCode)) {
    return { valid: false, message: 'Missing required fields', code: 'MISSING_FIELDS' };
  }
  
  // 如果提供了邮箱，验证邮箱格式
  if (email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      return { valid: false, message: 'Invalid email format', code: 'INVALID_EMAIL' };
    }
  }
  
  // 验证密码
  if (password.length < 1 || password.length > 100) {
    return { valid: false, message: 'Invalid password length', code: 'INVALID_PASSWORD_LENGTH' };
  }
  
  // 如果提供了用户编码，验证格式
  if (userCode) {
    if (typeof userCode !== 'string' || userCode.length < 1 || userCode.length > 20) {
      return { valid: false, message: 'Invalid user code', code: 'INVALID_USER_CODE' };
    }
  }
  
  return { valid: true };
}

// 验证邮箱格式
function validateEmail(email) {
  if (!email) {
    return { valid: false, message: 'Email is required', code: 'EMAIL_REQUIRED' };
  }
  
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email.trim())) {
    return { valid: false, message: 'Invalid email format', code: 'INVALID_EMAIL_FORMAT' };
  }
  
  if (email.length > 100) {
    return { valid: false, message: 'Email too long', code: 'EMAIL_TOO_LONG' };
  }
  
  return { valid: true };
}

export {
  validateRegistrationInput,
  validateLoginInput,
  validateEmail
};