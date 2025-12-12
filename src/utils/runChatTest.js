import WebSocket from 'ws';

// 聊天性能测试工具类
class ChatPerformanceTest {
  constructor() {
    this.connections = [];
    this.testStartTime = null;
    this.testEndTime = null;
    this.messagesSent = 0;
    this.messagesReceived = 0;
    this.messageLatencies = [];
  }

  // 清理资源
  cleanup() {
    this.connections.forEach(conn => {
      if (conn && conn.readyState === WebSocket.OPEN) {
        conn.close();
      }
    });
    this.connections = [];
    console.log('已清理所有连接资源');
  }

  // 创建用户连接
  createUserConnection(userId, roomId, websocketUrl) {
    return new Promise((resolve, reject) => {
      try {
        // 为测试生成模拟token（实际应该从认证服务获取）
        const mockToken = `mock-token-${userId}-${Date.now()}`;
        // 使用正确的URL格式，包含token和roomId参数
        const conn = new WebSocket(`${websocketUrl}/ws?token=${mockToken}&roomId=${roomId}`);
        
        conn.userId = userId;
        conn.roomId = roomId;
        
        // 记录连接开始时间
        conn.connectionStartTime = Date.now();
        
        conn.on('open', () => {
          const connectionTime = Date.now() - conn.connectionStartTime;
          console.log(`用户 ${userId} 连接成功，耗时: ${connectionTime}ms`);
          this.connections.push(conn);
          resolve(conn);
        });
        
        conn.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            // 只统计其他用户的消息接收情况
            if (message.sender_id !== userId && message.type === 'chat_message') {
              const receiveTime = Date.now();
              const messageTime = message.timestamp || receiveTime;
              const latency = receiveTime - messageTime;
              
              this.messagesReceived++;
              this.messageLatencies.push(latency);
              
              if (this.messagesReceived % 10 === 0 || this.messagesReceived === this.messagesSent) {
                console.log(`已接收 ${this.messagesReceived}/${this.messagesSent} 条消息`);
              }
            }
          } catch (e) {
            console.error(`处理消息出错: ${e.message}`);
          }
        });
        
        conn.on('close', () => {
          console.log(`用户 ${userId} 连接已关闭`);
        });
        
        conn.on('error', (error) => {
          console.error(`用户 ${userId} 连接错误: ${error.message}`);
          reject(error);
        });
        
        // 5秒连接超时
        setTimeout(() => {
          if (conn.readyState === WebSocket.CONNECTING) {
            const error = new Error(`用户 ${userId} 连接超时`);
            conn.close();
            reject(error);
          }
        }, 5000);
      } catch (error) {
        console.error(`创建连接出错: ${error.message}`);
        reject(error);
      }
    });
  }

  // 发送消息循环
  async sendMessageLoop(connection, messageCount, roomId, userId) {
    try {
      for (let i = 0; i < messageCount; i++) {
        if (connection.readyState !== WebSocket.OPEN) {
          console.error(`用户 ${userId} 连接已关闭，无法发送消息 ${i+1}`);
          break;
        }
        
        const message = {
          type: 'chat_message',
          room_id: roomId,
          sender_id: userId,
          content: `测试消息 ${i+1} 来自用户 ${userId}`,
          timestamp: Date.now()
        };
        
        connection.send(JSON.stringify(message));
        this.messagesSent++;
        
        if (this.messagesSent % 10 === 0 || this.messagesSent === messageCount) {
          console.log(`已发送 ${this.messagesSent} 条消息`);
        }
        
        // 随机延迟，模拟真实用户行为
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));
      }
    } catch (error) {
      console.error(`用户 ${userId} 发送消息出错: ${error.message}`);
    }
  }

  // 等待消息接收完成
  async waitForMessageReception(timeoutMs = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      // 如果已收到所有应该收到的消息，就退出循环
      const expectedReceived = this.messagesSent * (this.connections.length - 1);
      
      if (this.messagesReceived >= expectedReceived || this.messagesReceived === expectedReceived) {
        console.log('所有消息已接收完成');
        break;
      }
      
      // 每500ms检查一次
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 打印进度
      const progress = (this.messagesReceived / expectedReceived * 100).toFixed(1);
      console.log(`消息接收进度: ${progress}% (${this.messagesReceived}/${expectedReceived})`);
    }
    
    if (Date.now() - startTime >= timeoutMs) {
      console.log('消息接收超时');
    }
  }

  // 计算统计数据
  calculateStats() {
    const totalTime = (this.testEndTime - this.testStartTime) / 1000; // 转换为秒
    const messagesPerSecond = this.messagesSent / totalTime;
    const receptionRate = this.connections.length > 1 
      ? (this.messagesReceived / (this.messagesSent * (this.connections.length - 1)) * 100).toFixed(1) + '%'
      : '100%'; // 如果只有一个用户，接收率为100%
    
    // 计算平均延迟
    const avgLatency = this.messageLatencies.length > 0
      ? Math.round(this.messageLatencies.reduce((a, b) => a + b, 0) / this.messageLatencies.length)
      : 0;
    
    return {
      totalTime,
      messagesSent: this.messagesSent,
      messagesReceived: this.messagesReceived,
      messagesPerSecond: messagesPerSecond.toFixed(1),
      receptionRate,
      avgLatency
    };
  }

  // 生成优化建议
  generateOptimizationSuggestions() {
    const suggestions = [];
    const stats = this.calculateStats();
    
    if (stats.messagesPerSecond < 10) {
      suggestions.push('消息吞吐量较低，建议优化WebSocket服务器性能');
    }
    
    if (stats.receptionRate !== '100%' && parseFloat(stats.receptionRate) < 95) {
      suggestions.push('消息接收率低于95%，可能存在连接不稳定或消息丢失问题');
    }
    
    if (stats.avgLatency > 500) {
      suggestions.push(`平均延迟较高 (${stats.avgLatency}ms)，建议优化网络传输或服务器响应时间`);
    }
    
    if (this.connections.length < 5) {
      suggestions.push('测试用户数量较少，建议增加用户数量以获得更准确的性能评估');
    }
    
    return suggestions;
  }

  // 开始测试
  async startTest(userCount = 5, messagesPerUser = 5, roomId = 'test-room-1', websocketUrl = process.env.WEBSOCKET_URL || 'ws://localhost:8787') {
    console.log(`开始聊天性能测试 - 用户数: ${userCount}, 每用户消息数: ${messagesPerUser}, 房间: ${roomId}`);
    
    try {
      this.testStartTime = Date.now();
      
      // 步骤1: 创建所有用户连接
      console.log('步骤1: 创建用户连接...');
      const connectionPromises = [];
      
      // 正确处理WebSocket URL协议
      let wsProtocol;
      if (websocketUrl.startsWith('http://')) {
        wsProtocol = websocketUrl.replace('http://', 'ws://');
      } else if (websocketUrl.startsWith('https://')) {
        wsProtocol = websocketUrl.replace('https://', 'wss://');
      } else {
        wsProtocol = websocketUrl;
      }
      
      console.log(`使用WebSocket URL: ${wsProtocol}`);
      
      for (let i = 1; i <= userCount; i++) {
        const userId = `test-user-${i}`;
        connectionPromises.push(this.createUserConnection(userId, roomId, wsProtocol));
      }
      
      const connections = await Promise.all(connectionPromises);
      console.log(`所有 ${connections.length} 个用户已成功连接`);
      
      // 短暂等待，确保所有连接稳定
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 步骤2: 开始发送消息
      console.log('步骤2: 开始发送消息...');
      const messagePromises = connections.map((conn, index) => {
        const userId = `test-user-${index + 1}`;
        return this.sendMessageLoop(conn, messagesPerUser, roomId, userId);
      });
      
      // 等待所有消息发送完成
      await Promise.all(messagePromises);
      
      // 步骤3: 等待消息接收完成
      console.log('步骤3: 等待消息接收完成...');
      await this.waitForMessageReception();
      
      this.testEndTime = Date.now();
      
      // 步骤4: 计算并显示结果
      console.log('步骤4: 计算测试结果...');
      const stats = this.calculateStats();
      
      console.log('================ 测试结果 ================');
      console.log(`总耗时: ${stats.totalTime.toFixed(2)} 秒`);
      console.log(`发送消息数: ${stats.messagesSent}`);
      console.log(`接收消息数: ${stats.messagesReceived}`);
      console.log(`消息吞吐量: ${stats.messagesPerSecond} 消息/秒`);
      console.log(`消息接收率: ${stats.receptionRate}`);
      if (stats.avgLatency > 0) {
        console.log(`平均延迟: ${stats.avgLatency}ms`);
      }
      console.log('========================================');
      
      // 生成优化建议
      const suggestions = this.generateOptimizationSuggestions();
      if (suggestions.length > 0) {
        console.log('\n优化建议:');
        suggestions.forEach((suggestion, index) => {
          console.log(`${index + 1}. ${suggestion}`);
        });
      } else {
        console.log('\n测试结果良好，未发现需要优化的问题');
      }
      
      return stats;
    } catch (error) {
      console.error('测试过程中出错:', error);
      throw error;
    } finally {
      // 清理资源
      this.cleanup();
    }
  }
}

// 运行测试
async function runTest() {
  console.log('=== 命令行聊天性能测试工具 ===');
  
  const test = new ChatPerformanceTest();
  
  try {
    const websocketUrl = process.env.WEBSOCKET_URL || 'ws://localhost:8787';
    console.log(`使用WebSocket URL: ${websocketUrl}`);
    await test.startTest(5, 5, 'test-room-1', websocketUrl);
    console.log('\n测试完成！');
  } catch (error) {
    console.error('测试失败:', error.message);
    process.exit(1);
  } finally {
    console.log('\n已清理所有测试资源');
  }
}

// 如果直接运行脚本
if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  runTest();
}

// 导出类供其他模块使用
export { ChatPerformanceTest };