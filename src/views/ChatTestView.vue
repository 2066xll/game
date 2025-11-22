<template>
  <div class="chat-test-container">
    <h1>聊天功能性能测试</h1>
    
    <div class="test-controls">
      <div class="form-group">
        <label for="userCount">用户数量:</label>
        <input 
          id="userCount" 
          type="number" 
          v-model.number="testParams.userCount" 
          min="1" 
          max="50"
        />
      </div>
      
      <div class="form-group">
        <label for="messagesPerUser">每用户消息数:</label>
        <input 
          id="messagesPerUser" 
          type="number" 
          v-model.number="testParams.messagesPerUser" 
          min="1" 
          max="20"
        />
      </div>
      
      <div class="form-group">
        <label for="roomId">房间ID:</label>
        <input 
          id="roomId" 
          type="text" 
          v-model="testParams.roomId" 
          placeholder="输入房间ID"
        />
      </div>
      
      <div class="form-group">
        <label for="websocketUrl">WebSocket URL:</label>
        <input 
          id="websocketUrl" 
          type="text" 
          v-model="testParams.websocketUrl" 
          placeholder="WebSocket服务器地址"
        />
      </div>
      
      <button 
        class="start-button" 
        @click="startTest" 
        :disabled="isRunning"
      >
        {{ isRunning ? '测试进行中...' : '开始测试' }}
      </button>
    </div>
    
    <div class="test-status" v-if="isRunning">
      <h3>测试状态</h3>
      <p>已发送消息: {{ testStatus.messagesSent }}</p>
      <p>已接收消息: {{ testStatus.messagesReceived }}</p>
    </div>
    
    <div class="test-results" v-if="testResults.length > 0">
      <h3>测试结果</h3>
      <div class="result-item" v-for="(result, index) in testResults" :key="index">
        <div class="result-header">测试 #{{ index + 1 }}</div>
        <div class="result-details">
          <p>总耗时: {{ result.totalTime.toFixed(2) }} 秒</p>
          <p>发送消息数: {{ result.messagesSent }}</p>
          <p>接收消息数: {{ result.messagesReceived }}</p>
          <p>消息吞吐量: {{ result.messagesPerSecond }} 消息/秒</p>
          <p>消息接收率: {{ result.receptionRate }}</p>
        </div>
      </div>
    </div>
    
    <div class="optimization-suggestions" v-if="optimizationSuggestions.length > 0">
      <h3>性能优化建议</h3>
      <ul>
        <li v-for="(suggestion, index) in optimizationSuggestions" :key="index">
          {{ suggestion }}
        </li>
      </ul>
    </div>
    
    <div class="test-log">
      <h3>测试日志</h3>
      <div class="log-content">
        <p v-for="(log, index) in logMessages" :key="index">{{ log }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { ChatPerformanceTest } from '../utils/performanceTest';

const isRunning = ref(false);
const testResults = ref([]);
const optimizationSuggestions = ref([]);
const logMessages = ref([]);

// 测试参数
const testParams = reactive({
  userCount: 5,
  messagesPerUser: 3,
  roomId: 'test-room-1',
  websocketUrl: 'ws://localhost:8787'
});

// 测试状态
const testStatus = reactive({
  messagesSent: 0,
  messagesReceived: 0
});

// 记录日志
const log = (message) => {
  const timestamp = new Date().toLocaleTimeString();
  logMessages.value.push(`[${timestamp}] ${message}`);
  // 限制日志长度
  if (logMessages.value.length > 100) {
    logMessages.value.shift();
  }
};

// 开始测试
const startTest = async () => {
  isRunning.value = true;
  log('开始聊天性能测试...');
  
  try {
    // 重置状态
    testStatus.messagesSent = 0;
    testStatus.messagesReceived = 0;
    
    // 创建测试实例
    const chatTest = new ChatPerformanceTest();
    
    // 覆盖控制台日志输出到页面
    const originalConsoleLog = console.log;
    console.log = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : arg
      ).join(' ');
      log(message);
      originalConsoleLog(...args);
    };
    
    // 开始测试
    const result = await chatTest.startTest(
      testParams.userCount,
      testParams.messagesPerUser,
      testParams.roomId,
      testParams.websocketUrl
    );
    
    // 恢复控制台日志
    console.log = originalConsoleLog;
    
    // 更新状态和结果
    testResults.value.unshift(result);
    testStatus.messagesSent = result.messagesSent;
    testStatus.messagesReceived = result.messagesReceived;
    
    // 获取优化建议
    optimizationSuggestions.value = chatTest.generateOptimizationSuggestions();
    
    log('测试完成！');
  } catch (error) {
    log(`测试失败: ${error.message}`);
    console.error('测试错误:', error);
  } finally {
    isRunning.value = false;
  }
};
</script>

<style scoped>
.chat-test-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.test-controls {
  background-color: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  align-items: end;
}

.form-group {
  display: flex;
  flex-direction: column;
  min-width: 150px;
}

.form-group label {
  margin-bottom: 5px;
  font-weight: 500;
}

.form-group input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.start-button {
  padding: 10px 24px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;
  white-space: nowrap;
}

.start-button:hover:not(:disabled) {
  background-color: #45a049;
}

.start-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.test-status, .test-results, .optimization-suggestions, .test-log {
  background-color: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.result-item {
  background-color: white;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 10px;
  border: 1px solid #e0e0e0;
}

.result-header {
  font-weight: bold;
  margin-bottom: 10px;
  color: #2c3e50;
}

.result-details p {
  margin: 5px 0;
}

.optimization-suggestions ul {
  padding-left: 20px;
  margin: 10px 0;
}

.optimization-suggestions li {
  margin-bottom: 5px;
  color: #666;
}

.log-content {
  max-height: 300px;
  overflow-y: auto;
  background-color: #333;
  color: #eee;
  padding: 10px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 14px;
}

.log-content p {
  margin: 3px 0;
  white-space: pre-wrap;
}

@media (max-width: 768px) {
  .test-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .form-group {
    min-width: auto;
  }
}
</style>