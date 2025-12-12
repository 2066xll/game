// 输入验证和安全工具类
class ValidationUtils {
  // 验证邮箱格式
  static validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return { valid: false, message: '邮箱不能为空且必须为字符串' };
    }
    
    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!emailRegex.test(trimmedEmail)) {
      return { valid: false, message: '邮箱格式不正确' };
    }
    
    if (trimmedEmail.length > 254) {
      return { valid: false, message: '邮箱长度不能超过254个字符' };
    }
    
    return { valid: true, email: trimmedEmail };
  }
  
  // 验证密码强度
  static validatePassword(password) {
    if (!password || typeof password !== 'string') {
      return { valid: false, message: '密码不能为空且必须为字符串' };
    }
    
    if (password.length < 8) {
      return { valid: false, message: '密码长度不能少于8个字符' };
    }
    
    if (password.length > 128) {
      return { valid: false, message: '密码长度不能超过128个字符' };
    }
    
    // 密码强度检查
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const strength = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    
    if (strength < 3) {
      return { 
        valid: false, 
        message: '密码必须包含至少3种字符类型（小写字母、大写字母、数字、特殊字符）' 
      };
    }
    
    return { valid: true, strength };
  }
  
  // 验证用户编码（6位数字）
  static validateUserCode(userCode) {
    if (!userCode || typeof userCode !== 'string') {
      return { valid: false, message: '用户编码不能为空且必须为字符串' };
    }
    
    const trimmedUserCode = userCode.trim();
    if (!/^\d{6}$/.test(trimmedUserCode)) {
      return { valid: false, message: '用户编码必须为6位数字' };
    }
    
    return { valid: true, userCode: trimmedUserCode };
  }
  
  // 验证昵称
  static validateNickname(nickname) {
    if (!nickname || typeof nickname !== 'string') {
      return { valid: false, message: '昵称不能为空且必须为字符串' };
    }
    
    const trimmedNickname = nickname.trim();
    if (trimmedNickname.length === 0) {
      return { valid: false, message: '昵称不能为空' };
    }
    
    if (trimmedNickname.length < 2 || trimmedNickname.length > 50) {
      return { valid: false, message: '昵称长度必须在2-50个字符之间' };
    }
    
    // 允许字母、数字、下划线、中文字符
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{2,50}$/.test(trimmedNickname)) {
      return { valid: false, message: '昵称只能包含字母、数字、下划线和中文字符' };
    }
    
    return { valid: true, nickname: trimmedNickname };
  }
  
  // 验证注册输入
  static validateRegistration(nickname, email, password) {
    // 验证昵称
    const nicknameValidation = this.validateNickname(nickname);
    if (!nicknameValidation.valid) {
      return nicknameValidation;
    }
    
    // 验证邮箱（可选）
    if (email) {
      const emailValidation = this.validateEmail(email);
      if (!emailValidation.valid) {
        return emailValidation;
      }
    }
    
    // 验证密码
    const passwordValidation = this.validatePassword(password);
    if (!passwordValidation.valid) {
      return passwordValidation;
    }
    
    return { valid: true };
  }
  
  // 验证登录输入
  static validateLogin(email, password, userCode) {
    // 验证标识符（邮箱或用户编码）
    if (!email && !userCode) {
      return { valid: false, message: '邮箱或用户编码不能为空' };
    }
    
    // 验证邮箱（如果提供）
    if (email) {
      const emailValidation = this.validateEmail(email);
      if (!emailValidation.valid) {
        return emailValidation;
      }
    }
    
    // 验证用户编码（如果提供）
    if (userCode) {
      const userCodeValidation = this.validateUserCode(userCode);
      if (!userCodeValidation.valid) {
        return userCodeValidation;
      }
    }
    
    // 验证密码
    if (!password || typeof password !== 'string') {
      return { valid: false, message: '密码不能为空且必须为字符串' };
    }
    
    if (password.length < 8 || password.length > 128) {
      return { valid: false, message: '密码长度必须在8-128个字符之间' };
    }
    
    return { valid: true };
  }
  // 验证消息内容
  static validateMessageContent(content) {
    if (!content || typeof content !== 'string') {
      throw new Error('消息内容不能为空且必须为字符串');
    }
    
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      throw new Error('消息内容不能为空');
    }
    
    if (trimmedContent.length > 1000) {
      throw new Error('消息内容不能超过1000个字符');
    }
    
    return trimmedContent;
  }
  
  // 验证用户ID
  static validateUserId(userId) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('用户ID不能为空且必须为字符串');
    }
    
    if (!/^[a-zA-Z0-9-_]{3,50}$/.test(userId)) {
      throw new Error('用户ID格式不正确');
    }
    
    return userId;
  }
  
  // 验证群组ID
  static validateGroupId(groupId) {
    if (!groupId || typeof groupId !== 'string') {
      throw new Error('群组ID不能为空且必须为字符串');
    }
    
    if (!/^[a-zA-Z0-9-_]{3,50}$/.test(groupId)) {
      throw new Error('群组ID格式不正确');
    }
    
    return groupId;
  }
  
  // 验证用户名
  static validateUserName(username) {
    if (!username || typeof username !== 'string') {
      throw new Error('用户名不能为空且必须为字符串');
    }
    
    const trimmedUsername = username.trim();
    if (trimmedUsername.length === 0) {
      throw new Error('用户名不能为空');
    }
    
    if (trimmedUsername.length < 2 || trimmedUsername.length > 50) {
      throw new Error('用户名长度必须在2-50个字符之间');
    }
    
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{2,50}$/.test(trimmedUsername)) {
      throw new Error('用户名格式不正确，只能包含字母、数字、下划线和中文字符');
    }
    
    return trimmedUsername;
  }
  
  // 验证消息ID
  static validateMessageId(messageId) {
    // 非空检查
    if (!messageId || typeof messageId !== 'string') {
      return false;
    }
    
    // 消息ID长度检查
    if (messageId.length < 8 || messageId.length > 128) {
      return false;
    }
    
    // 消息ID格式检查（支持UUID、MongoDB ObjectId或自定义格式）
    // UUID v4格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    // MongoDB ObjectId格式
    const objectIdRegex = /^[0-9a-f]{24}$/i;
    // 自定义消息ID格式（字母、数字、连字符）
    const customIdRegex = /^[a-zA-Z0-9-]+$/;
    
    return uuidRegex.test(messageId) || objectIdRegex.test(messageId) || customIdRegex.test(messageId);
  }
  
  // 验证群组名称
  static validateGroupName(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('群组名称不能为空且必须为字符串');
    }
    
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      throw new Error('群组名称不能为空');
    }
    
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      throw new Error('群组名称长度必须在2-50个字符之间');
    }
    
    return trimmedName;
  }
  
  // 验证用户输入，防止XSS攻击
  static sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    // 替换HTML特殊字符
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  // 验证消息格式
  static validateMessageFormat(message) {
    if (!message || typeof message !== 'object') {
      throw new Error('消息必须为有效的对象');
    }
    
    const requiredFields = ['type', 'data'];
    for (const field of requiredFields) {
      if (!(field in message)) {
        throw new Error(`消息缺少必要字段: ${field}`);
      }
    }
    
    const validTypes = ['join', 'leave', 'message', 'typing', 'stopTyping', 'error'];
    if (!validTypes.includes(message.type)) {
      throw new Error(`无效的消息类型: ${message.type}`);
    }
    
    return message;
  }
  
  // 验证Token格式
  static validateToken(token) {
    if (!token || typeof token !== 'string') {
      throw new Error('Token不能为空且必须为字符串');
    }
    
    if (!/^[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]*$/.test(token)) {
      throw new Error('Token格式不正确');
    }
    
    return token;
  }
  
  // 验证聊天消息格式
  static isValidChatMessage(message) {
    // 检查消息是否为对象
    if (!message || typeof message !== 'object') {
      return false;
    }
    
    // 检查必要字段
    const requiredFields = ['id', 'userId', 'username', 'content', 'timestamp', 'type'];
    for (const field of requiredFields) {
      if (!(field in message)) {
        return false;
      }
    }
    
    // 验证各个字段的类型和格式
    if (typeof message.id !== 'string' || message.id.trim() === '') {
      return false;
    }
    
    if (typeof message.userId !== 'string' || message.userId.trim() === '') {
      return false;
    }
    
    if (typeof message.username !== 'string' || message.username.trim() === '') {
      return false;
    }
    
    if (typeof message.content !== 'string' || message.content.trim() === '') {
      return false;
    }
    
    if (!Number.isInteger(message.timestamp) || message.timestamp < 0) {
      return false;
    }
    
    // 验证消息类型
    const validTypes = ['text', 'image', 'system'];
    if (!validTypes.includes(message.type)) {
      return false;
    }
    
    // 验证内容长度
    if (message.content.length > 1000) {
      return false;
    }
    
    // 可选字段验证
    if (message.attachments && !Array.isArray(message.attachments)) {
      return false;
    }
    
    return true;
  }
}

export default ValidationUtils;