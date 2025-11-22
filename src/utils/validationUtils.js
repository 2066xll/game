// 输入验证和安全工具类
class ValidationUtils {
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
}

export default ValidationUtils;