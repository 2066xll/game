// WebSocket连接测试脚本
import { WebSocket } from 'ws';

// 测试WebSocket连接
async function testWebSocketConnection() {
  console.log('开始测试WebSocket连接...');
  
  // 使用本地开发服务器的端口
  const wsUrl = 'ws://localhost:8787?roomId=test&token=mock-token-user1';
  console.log(`连接到: ${wsUrl}`);
  
  const ws = new WebSocket(wsUrl);
  
  ws.on('open', () => {
    console.log('✅ WebSocket连接成功建立！');
    
    // 发送测试消息
    const testMessage = JSON.stringify({
      content: 'Hello from test script!',
      messageId: Date.now().toString()
    });
    console.log(`发送测试消息: ${testMessage}`);
    ws.send(testMessage);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📥 接收到消息:', JSON.stringify(message, null, 2));
      
      // 如果接收到消息确认，等待一段时间后关闭连接
      if (message.type === 'message_ack') {
        console.log('✅ 消息发送成功并收到确认');
        setTimeout(() => {
          ws.close();
          console.log('✅ 测试完成，连接已关闭');
        }, 1000);
      }
    } catch (e) {
      console.log('📥 接收到原始消息:', data.toString());
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket错误:', error.message);
  });
  
  ws.on('close', (code, reason) => {
    console.log(`🔌 连接关闭: 代码=${code}, 原因=${reason || '正常关闭'}`);
  });
}

// 测试多个并发连接
async function testMultipleConnections() {
  console.log('\n开始测试多个并发连接...');
  
  const connections = [];
  const numConnections = 2;
  let messagesReceived = 0;
  
  for (let i = 0; i < numConnections; i++) {
    const userId = `user${i + 1}`;
    const wsUrl = `ws://localhost:8787?roomId=test&token=mock-token-${userId}`;
    
    const ws = new WebSocket(wsUrl);
    connections.push(ws);
    
    ws.on('open', () => {
      console.log(`✅ 连接 ${userId} 成功建立！`);
      
      // 连接全部建立后，发送一条测试消息
      if (connections.every(conn => conn.readyState === WebSocket.OPEN)) {
        setTimeout(() => {
          const testMessage = JSON.stringify({
            content: '测试消息广播功能',
            messageId: Date.now().toString()
          });
          console.log(`连接 ${userId} 发送测试消息`);
          ws.send(testMessage);
        }, 1000);
      }
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log(`📥 连接 ${userId} 接收到消息类型: ${message.type}`);
      
      if (message.type === 'chat_message') {
        console.log(`   消息内容: ${message.content}, 发送者: ${message.senderId}`);
        messagesReceived++;
        
        // 检查是否所有连接都收到了消息
        if (messagesReceived >= numConnections) {
          console.log('✅ 广播测试成功！所有连接都收到了消息');
          
          // 关闭所有连接
          setTimeout(() => {
            connections.forEach(conn => conn.close());
            console.log('✅ 所有连接已关闭');
          }, 1000);
        }
      }
    });
    
    ws.on('error', (error) => {
      console.error(`❌ 连接 ${userId} 错误:`, error.message);
    });
  }
}

// 执行测试
(async () => {
  try {
    // 测试单个连接
    await testWebSocketConnection();
    
    // 等待2秒后测试多个连接
    setTimeout(() => {
      testMultipleConnections();
    }, 2000);
  } catch (error) {
    console.error('测试失败:', error);
  }
})();