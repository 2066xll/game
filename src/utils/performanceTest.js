/**
 * 聊天系统性能测试工具
 * 用于模拟多用户并发连接和消息收发，评估系统性能和可靠性
 */

export class ChatPerformanceTest {
  constructor() {
    this.testResults = [];
    this.activeConnections = new Map();
    this.messagesSent = 0;
    this.messagesReceived = 0;
    this.startTime = 0;
    this.endTime = 0;
  }

  /**
   * 开始性能测试
   * @param {number} userCount - 模拟用户数量
   * @param {number} messagesPerUser - 每个用户发送的消息数量
   * @param {string} roomId - 测试的聊天室ID
   * @param {string} websocketUrl - WebSocket服务器URL
   */
  async startTest(userCount = 10, messagesPerUser = 5, roomId = '1', websocketUrl = 'wss://your-websocket-url') {
    console.log(`Starting performance test with ${userCount} users, ${messagesPerUser} messages per user`);
    
    this.startTime = Date.now();
    this.messagesSent = 0;
    this.messagesReceived = 0;
    
    // 创建用户连接
    const connectPromises = [];
    for (let i = 1; i <= userCount; i++) {
      const userId = `test_user_${i}`;
      const userName = `Test User ${i}`;
      connectPromises.push(this.createUserConnection(userId, userName, roomId, websocketUrl, messagesPerUser));
    }
    
    await Promise.all(connectPromises);
    console.log(`All ${userCount} users connected`);
    
    // 等待一段时间让消息处理完成
    await new Promise(resolve => setTimeout(resolve, messagesPerUser * 1000));
    
    this.endTest();
  }

  /**
   * 创建单个用户WebSocket连接
   */
  async createUserConnection(userId, userName, roomId, websocketUrl, messagesPerUser) {
    return new Promise((resolve) => {
      // 在实际环境中，这里应该使用真实的WebSocket连接
      // 在浏览器环境中，可以使用new WebSocket()
      // 这里模拟WebSocket连接行为
      
      console.log(`Creating connection for user ${userId}`);
      
      // 模拟连接建立
      setTimeout(() => {
        // 模拟发送消息
        this.sendMessageLoop(userId, messagesPerUser);
        
        // 模拟接收消息
        this.simulateMessageReception(userId);
        
        resolve();
      }, 100);
    });
  }

  /**
   * 模拟消息发送循环
   */
  sendMessageLoop(userId, messagesPerUser) {
    let messageCount = 0;
    
    const sendNextMessage = () => {
      if (messageCount < messagesPerUser) {
        // 模拟发送消息延迟
        setTimeout(() => {
          const message = {
            type: 'send_message',
            data: {
              content: `Test message from ${userId}, message #${messageCount + 1}`
            }
          };
          
          // 在实际测试中，这里应该通过WebSocket发送消息
          console.log(`User ${userId} sending message #${messageCount + 1}`);
          
          this.messagesSent++;
          messageCount++;
          sendNextMessage();
        }, Math.random() * 500 + 200); // 随机延迟200-700ms
      }
    };
    
    sendNextMessage();
  }

  /**
   * 模拟消息接收
   */
  simulateMessageReception(userId) {
    // 模拟接收其他用户的消息
    const receiveRandomMessages = () => {
      if (this.messagesReceived < this.messagesSent * 10) { // 模拟每个用户收到多条消息
        setTimeout(() => {
          this.messagesReceived++;
          receiveRandomMessages();
        }, Math.random() * 300);
      }
    };
    
    receiveRandomMessages();
  }

  /**
   * 结束测试并计算性能指标
   */
  endTest() {
    this.endTime = Date.now();
    const totalTime = (this.endTime - this.startTime) / 1000; // 秒
    const messagesPerSecond = this.messagesSent / totalTime;
    const receptionRate = this.messagesReceived / (this.messagesSent * 10) * 100; // 假设每个消息应该被10个用户接收
    
    const result = {
      totalTime,
      messagesSent: this.messagesSent,
      messagesReceived: this.messagesReceived,
      messagesPerSecond: messagesPerSecond.toFixed(2),
      receptionRate: receptionRate.toFixed(2) + '%'
    };
    
    this.testResults.push(result);
    
    console.log('Performance test completed:');
    console.log(`Total time: ${totalTime.toFixed(2)} seconds`);
    console.log(`Messages sent: ${this.messagesSent}`);
    console.log(`Messages received: ${this.messagesReceived}`);
    console.log(`Messages per second: ${messagesPerSecond.toFixed(2)}`);
    console.log(`Message reception rate: ${receptionRate.toFixed(2)}%`);
    
    return result;
  }

  /**
   * 获取所有测试结果
   */
  getResults() {
    return this.testResults;
  }

  /**
   * 优化建议生成器
   */
  generateOptimizationSuggestions() {
    const suggestions = [];
    
    if (this.testResults.length > 0) {
      const lastResult = this.testResults[this.testResults.length - 1];
      
      if (parseFloat(lastResult.messagesPerSecond) < 50) {
        suggestions.push('考虑优化WebSocket消息处理逻辑，可能存在性能瓶颈');
      }
      
      if (parseFloat(lastResult.receptionRate) < 95) {
        suggestions.push('消息接收率低于95%，检查消息广播机制是否可靠');
      }
      
      suggestions.push('考虑在Durable Objects中增加消息队列，避免阻塞主线程');
      suggestions.push('实现消息批处理，减少数据库操作频率');
      suggestions.push('优化数据库索引，特别是messages表的group_id和created_at字段');
      suggestions.push('增加连接超时处理，及时清理无效连接');
      suggestions.push('考虑使用缓存层减轻数据库负担');
    }
    
    return suggestions;
  }
}

/**
 * 使用示例：
 * const test = new ChatPerformanceTest();
 * test.startTest(20, 10, '1', 'wss://your-websocket-url');
 */