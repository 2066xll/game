<template>
  <div class="chat-container">
    <!-- 聊天头部 -->
    <div class="chat-header">
      <button class="back-btn" @click="goBack">
        <i class="icon-back"></i>
      </button>
      <div class="chat-info">
        <div class="group-avatar">
          <span>{{ getGroupInitial(groupInfo?.name) }}</span>
        </div>
        <div class="group-details">
          <h2 class="group-name">{{ groupInfo?.name || '加载中...' }}</h2>
          <p class="member-count">{{ groupInfo?.members?.length || 0 }} 名成员</p>
        </div>
      </div>
      <button class="group-settings-btn" @click="showGroupDetails">
        <i class="icon-settings"></i>
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载消息中...</p>
    </div>

    <!-- 错误提示 -->
    <div v-else-if="error" class="error-message">
      {{ error }}
      <button class="retry-btn" @click="loadMessages">重试</button>
    </div>

    <!-- 消息列表 -->
    <div v-else class="messages-container" ref="messagesContainer">
      <div v-if="messages.length === 0" class="empty-messages">
        <p>暂无消息，发送第一条消息开始聊天吧！</p>
      </div>
      
      <div v-for="message in messages" :key="message.id" class="message-wrapper">
        <div 
          class="message-item" 
          :class="{
            'own-message': isOwnMessage(message),
            'system-message': message.type === 'system'
          }"
        >
          <!-- 系统消息 -->
          <div v-if="message.type === 'system'" class="system-message-content">
            <p>{{ message.content }}</p>
          </div>
          
          <!-- 普通消息 -->
          <template v-else>
            <div class="message-avatar">
              <span>{{ getMemberInitial(message.user) }}</span>
            </div>
            <div class="message-content-wrapper">
              <div class="message-meta">
                <span class="message-author">{{ getMemberName(message.user) }}</span>
                <span class="message-time">{{ formatTime(message.createdAt) }}</span>
              </div>
              <div class="message-content">
                <p>{{ message.content }}</p>
                <!-- 可以添加图片、文件等其他消息类型的渲染 -->
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 正在输入提示 -->
      <div v-if="typingUsers.length > 0" class="typing-indicator">
        <span>{{ getTypingText() }} 正在输入...</span>
      </div>
    </div>

    <!-- 输入框区域 -->
    <div class="input-container">
      <div class="input-wrapper">
        <input 
          v-model="messageInput" 
          type="text" 
          placeholder="输入消息..."
          @keyup.enter="sendMessage"
          @input="handleInput"
          maxlength="500"
        >
        <div class="input-actions">
          <!-- 可以添加表情、图片等附件按钮 -->
          <button class="attach-btn" title="附加">
            <i class="icon-attach"></i>
          </button>
          <span class="char-count">{{ messageInput.length }}/500</span>
        </div>
      </div>
      <button 
        class="send-btn" 
        @click="sendMessage"
        :disabled="!canSendMessage"
      >
        <i class="icon-send"></i>
      </button>
    </div>

    <!-- 群组详情侧边栏 -->
    <div v-if="showGroupSidebar" class="group-sidebar" :class="{ open: showGroupSidebar }">
      <div class="sidebar-header">
        <h3>群组信息</h3>
        <button class="close-sidebar" @click="showGroupSidebar = false">×</button>
      </div>
      
      <div v-if="groupInfo" class="sidebar-content">
        <div class="group-meta">
          <p><strong>创建者:</strong> {{ getOwnerName(groupInfo) }}</p>
          <p><strong>创建时间:</strong> {{ formatDate(groupInfo.createdAt) }}</p>
          <p><strong>成员数量:</strong> {{ groupInfo.members.length }}</p>
        </div>

        <div class="members-section">
          <h4>群组成员</h4>
          <div class="members-list">
            <div 
              v-for="member in groupInfo.members" 
              :key="member.id" 
              class="member-item"
            >
              <div class="member-avatar">
                <span>{{ getMemberInitial(member) }}</span>
              </div>
              <div class="member-info">
                <p class="member-name">{{ getMemberName(member) }}</p>
                <p class="member-role">{{ isOwner(member.id) ? '群主' : '成员' }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="sidebar-actions">
          <button class="danger-btn" @click="confirmLeaveGroup">退出群组</button>
        </div>
      </div>
    </div>

    <!-- 确认退出对话框 -->
    <div v-if="showConfirmDialog" class="modal-overlay" @click.self="cancelLeaveGroup">
      <div class="modal-content confirm-dialog">
        <div class="modal-header">
          <h3>{{ confirmTitle }}</h3>
          <button class="close-modal" @click="cancelLeaveGroup">×</button>
        </div>
        <div class="modal-body">
          <p>{{ confirmMessage }}</p>
        </div>
        <div class="modal-actions">
          <button class="cancel-btn" @click="cancelLeaveGroup">取消</button>
          <button class="danger-btn" @click="leaveGroup">确认</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export default {
  name: 'ChatView',
  setup() {
    const chatStore = useChatStore()
    const authStore = useAuthStore()
    const route = useRoute()
    const router = useRouter()
    
    // 状态
    const messages = ref([])
    const groupInfo = ref(null)
    const messageInput = ref('')
    const isLoading = ref(true)
    const error = ref(null)
    const messagesContainer = ref(null)
    const showGroupSidebar = ref(false)
    const showConfirmDialog = ref(false)
    const confirmTitle = ref('')
    const confirmMessage = ref('')
    const typingUsers = ref([])
    const lastTypingTime = ref(0)
    
    // 获取群组ID
    const groupId = computed(() => route.params.id)
    
    // 获取当前用户ID
    const currentUserId = computed(() => authStore.user?.id)
    
    // 判断是否可以发送消息
    const canSendMessage = computed(() => {
      return messageInput.value.trim().length > 0 && messageInput.value.length <= 500
    })
    
    // 加载消息和群组信息
    const loadMessages = async () => {
      try {
        isLoading.value = true
        error.value = null
        
        // 获取群组详情
        await chatStore.fetchGroupDetail(groupId.value)
        groupInfo.value = chatStore.currentGroup
        
        // 获取历史消息
        await chatStore.fetchMessages(groupId.value)
        messages.value = chatStore.messages
        
        // 滚动到底部
        scrollToBottom()
        
        // 连接WebSocket
        await setupWebSocket()
      } catch (err) {
        error.value = err.message || '加载聊天失败'
      } finally {
        isLoading.value = false
      }
    }
    
    // 发送消息
    const sendMessage = async () => {
      if (!canSendMessage.value) return
      
      const content = messageInput.value.trim()
      messageInput.value = ''
      
      // 创建临时消息对象（乐观更新UI）
      const tempMessage = {
        id: `temp_${Date.now()}`,
        content,
        user: authStore.user,
        groupId: groupId.value,
        createdAt: new Date().toISOString(),
        type: 'text',
        isTemp: true
      }
      
      messages.value.push(tempMessage)
      scrollToBottom()
      
      try {
        // 发送消息到服务器
        const newMessage = await chatStore.sendMessage(groupId.value, content)
        
        // 替换临时消息
        const index = messages.value.findIndex(m => m.id === tempMessage.id)
        if (index !== -1) {
          messages.value[index] = newMessage
        }
        
        // 取消正在输入状态
        clearTypingStatus()
      } catch (err) {
        // 失败时从UI移除临时消息
        messages.value = messages.value.filter(m => m.id !== tempMessage.id)
        error.value = '发送消息失败，请重试'
      }
    }
    
    // WebSocket连接
    let ws = null
    let wsReconnectInterval = null
    let wsReconnectAttempts = 0
    const MAX_RECONNECT_ATTEMPTS = 5
    
    // 设置WebSocket连接
    const setupWebSocket = async () => {
      try {
        // 关闭现有连接
        if (ws) {
          ws.close()
        }
        
        // 取消现有重连定时器
        if (wsReconnectInterval) {
          clearInterval(wsReconnectInterval)
        }
        
        // 获取WebSocket URL（从环境变量或配置中获取）
        const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8787'
        
        // 创建WebSocket连接
        ws = new WebSocket(`${wsUrl}/ws/chat/${groupId.value}`)
        
        // 发送认证信息
        ws.onopen = () => {
          console.log('WebSocket连接已建立')
          wsReconnectAttempts = 0
          
          // 发送认证token
          ws.send(JSON.stringify({
            type: 'auth',
            token: authStore.token
          }))
        }
        
        // 接收消息
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            
            switch (data.type) {
              case 'message':
                // 如果不是自己发送的消息才添加到列表（避免重复）
                if (data.message.user.id !== currentUserId.value) {
                  messages.value.push(data.message)
                  scrollToBottom()
                }
                break
              
              case 'typing':
                handleTypingEvent(data)
                break
              
              case 'system':
                messages.value.push({
                  id: `sys_${Date.now()}`,
                  content: data.content,
                  type: 'system',
                  createdAt: new Date().toISOString()
                })
                scrollToBottom()
                break
              
              default:
                console.log('未知消息类型:', data.type)
            }
          } catch (err) {
            console.error('解析WebSocket消息失败:', err)
          }
        }
        
        // 处理连接关闭
        ws.onclose = () => {
          console.log('WebSocket连接已关闭')
          handleReconnect()
        }
        
        // 处理连接错误
        ws.onerror = (error) => {
          console.error('WebSocket连接错误:', error)
        }
      } catch (err) {
        console.error('设置WebSocket连接失败:', err)
        handleReconnect()
      }
    }
    
    // 处理重连
    const handleReconnect = () => {
      if (wsReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('WebSocket重连失败，已达到最大尝试次数')
        return
      }
      
      wsReconnectAttempts++
      const delay = Math.min(1000 * Math.pow(2, wsReconnectAttempts), 30000) // 指数退避策略
      
      console.log(`WebSocket将在 ${delay}ms 后尝试重新连接（第${wsReconnectAttempts}次）`)
      
      wsReconnectInterval = setTimeout(() => {
        setupWebSocket()
      }, delay)
    }
    
    // 处理输入事件（发送正在输入状态）
    const handleInput = () => {
      const now = Date.now()
      
      // 防抖：避免频繁发送正在输入状态
      if (now - lastTypingTime.value > 500) {
        lastTypingTime.value = now
        
        // 通过WebSocket发送正在输入状态
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'typing',
            groupId: groupId.value,
            isTyping: true
          }))
        }
        
        // 设置定时器，一段时间后自动取消正在输入状态
        clearTimeout(window.typingTimeout)
        window.typingTimeout = setTimeout(() => {
          clearTypingStatus()
        }, 3000)
      }
    }
    
    // 清除正在输入状态
    const clearTypingStatus = () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'typing',
          groupId: groupId.value,
          isTyping: false
        }))
      }
    }
    
    // 处理正在输入事件
    const handleTypingEvent = (data) => {
      const { userId, userName, isTyping } = data
      
      // 避免显示自己的输入状态
      if (userId === currentUserId.value) return
      
      if (isTyping) {
        // 添加到正在输入用户列表
        if (!typingUsers.value.find(user => user.id === userId)) {
          typingUsers.value.push({ id: userId, name: userName })
        }
        
        // 3秒后自动移除（如果用户停止输入）
        setTimeout(() => {
          typingUsers.value = typingUsers.value.filter(user => user.id !== userId)
        }, 3000)
      } else {
        // 从列表中移除
        typingUsers.value = typingUsers.value.filter(user => user.id !== userId)
      }
    }
    
    // 获取正在输入文本
    const getTypingText = () => {
      if (typingUsers.value.length === 0) return ''
      if (typingUsers.value.length === 1) return typingUsers.value[0].name
      return `${typingUsers.value.slice(0, 2).map(u => u.name).join('和')}等${typingUsers.value.length}人`
    }
    
    // 滚动到底部
    const scrollToBottom = () => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    }
    
    // 返回上一页
    const goBack = () => {
      router.push('/groups')
    }
    
    // 显示群组详情
    const showGroupDetails = () => {
      showGroupSidebar.value = true
    }
    
    // 确认退出群组
    const confirmLeaveGroup = () => {
      const isOwner = groupInfo.value?.ownerId === currentUserId.value
      
      confirmTitle.value = isOwner ? '解散群组' : '退出群组'
      confirmMessage.value = isOwner 
        ? '确定要解散该群组吗？此操作不可恢复，所有群消息将会丢失。' 
        : '确定要退出该群组吗？'
      
      showConfirmDialog.value = true
    }
    
    // 取消退出
    const cancelLeaveGroup = () => {
      showConfirmDialog.value = false
    }
    
    // 退出群组
    const leaveGroup = async () => {
      try {
        await chatStore.leaveGroup(groupId.value)
        router.push('/groups')
      } catch (err) {
        error.value = '退出群组失败'
      }
    }
    
    // 获取成员姓名
    const getMemberName = (member) => {
      return member.nickname || member.username || '未知用户'
    }
    
    // 获取群组成员姓名首字母
    const getMemberInitial = (member) => {
      const name = getMemberName(member)
      return name ? name.charAt(0).toUpperCase() : '?'
    }
    
    // 获取群组名称首字母
    const getGroupInitial = (name) => {
      return name ? name.charAt(0).toUpperCase() : '?'
    }
    
    // 判断是否是群主
    const isOwner = (userId) => {
      return groupInfo.value && groupInfo.value.ownerId === userId
    }
    
    // 获取群主姓名
    const getOwnerName = (group) => {
      const owner = group.members.find(m => m.id === group.ownerId)
      return owner ? getMemberName(owner) : '未知'
    }
    
    // 格式化日期
    const formatDate = (dateString) => {
      const date = new Date(dateString)
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    }
    
    // 格式化时间
    const formatTime = (dateString) => {
      const date = new Date(dateString)
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    // 判断是否是自己发送的消息
    const isOwnMessage = (message) => {
      return message.user?.id === currentUserId.value
    }
    
    // 监听消息变化，自动滚动到底部
    watch(messages, () => {
      scrollToBottom()
    }, { deep: true })
    
    // 监听窗口大小变化，调整滚动
    const handleResize = () => {
      scrollToBottom()
    }
    
    // 组件挂载
    onMounted(() => {
      loadMessages()
      window.addEventListener('resize', handleResize)
    })
    
    // 组件卸载
    onUnmounted(() => {
      // 关闭WebSocket连接
      if (ws) {
        ws.close()
      }
      
      // 清除重连定时器
      if (wsReconnectInterval) {
        clearInterval(wsReconnectInterval)
      }
      
      // 清除输入状态定时器
      if (window.typingTimeout) {
        clearTimeout(window.typingTimeout)
      }
      
      // 移除事件监听器
      window.removeEventListener('resize', handleResize)
    })
    
    return {
      messages,
      groupInfo,
      messageInput,
      isLoading,
      error,
      messagesContainer,
      showGroupSidebar,
      showConfirmDialog,
      confirmTitle,
      confirmMessage,
      typingUsers,
      canSendMessage,
      sendMessage,
      handleInput,
      goBack,
      showGroupDetails,
      confirmLeaveGroup,
      cancelLeaveGroup,
      leaveGroup,
      getMemberName,
      getMemberInitial,
      getGroupInitial,
      isOwner,
      getOwnerName,
      formatDate,
      formatTime,
      isOwnMessage,
      loadMessages,
      getTypingText
    }
  }
}
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f5f5;
  position: relative;
}

/* 聊天头部 */
.chat-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: #fff;
  border-bottom: 1px solid #e0e0e0;
  z-index: 10;
}

.back-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 8px;
  margin-right: 12px;
  color: #666;
}

.chat-info {
  display: flex;
  align-items: center;
  flex: 1;
}

.group-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #4CAF50;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  margin-right: 12px;
}

.group-details h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
}

.member-count {
  margin: 0;
  font-size: 14px;
  color: #666;
}

.group-settings-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 8px;
  color: #666;
}

/* 加载状态 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #666;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #4CAF50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 错误提示 */
.error-message {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #d32f2f;
  padding: 20px;
  text-align: center;
}

.retry-btn {
  margin-top: 16px;
  background-color: #f44336;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
}

/* 消息列表 */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-messages {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #999;
  font-size: 16px;
}

.message-wrapper {
  display: flex;
  width: 100%;
}

.message-item {
  display: flex;
  max-width: 70%;
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-item.own-message {
  margin-left: auto;
  flex-direction: row-reverse;
}

.message-item.system-message {
  max-width: 100%;
  justify-content: center;
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: #2196F3;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
  margin: 0 8px;
}

.message-content-wrapper {
  display: flex;
  flex-direction: column;
  max-width: calc(100% - 52px);
}

.own-message .message-content-wrapper {
  align-items: flex-end;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 12px;
  color: #666;
}

.own-message .message-meta {
  flex-direction: row-reverse;
}

.message-author {
  font-weight: 500;
}

.message-time {
  color: #999;
}

.message-content {
  background-color: #fff;
  padding: 10px 14px;
  border-radius: 18px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  word-wrap: break-word;
  white-space: pre-wrap;
}

.own-message .message-content {
  background-color: #4CAF50;
  color: white;
}

.system-message-content {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 14px;
  color: #666;
}

/* 正在输入提示 */
.typing-indicator {
  margin-top: -8px;
  padding: 4px 12px;
  font-size: 14px;
  color: #666;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 12px;
  align-self: flex-start;
  margin-left: 52px;
}

/* 输入框区域 */
.input-container {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: #fff;
  border-top: 1px solid #e0e0e0;
  gap: 12px;
}

.input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  background-color: #f5f5f5;
  border-radius: 20px;
  padding: 0 16px;
  min-height: 40px;
}

.input-wrapper input {
  flex: 1;
  border: none;
  background: none;
  outline: none;
  padding: 10px 0;
  font-size: 16px;
}

.input-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.attach-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
  padding: 4px;
}

.char-count {
  font-size: 12px;
  color: #999;
}

.send-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #4CAF50;
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.send-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

/* 群组详情侧边栏 */
.group-sidebar {
  position: fixed;
  top: 0;
  right: -400px;
  width: 400px;
  height: 100vh;
  background-color: #fff;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
  transition: right 0.3s;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.group-sidebar.open {
  right: 0;
}

.sidebar-header {
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 18px;
}

.close-sidebar {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.group-meta {
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.group-meta p {
  margin: 8px 0;
  color: #666;
}

.members-section {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.members-section h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
}

.members-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.member-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background-color: #f5f5f5;
  border-radius: 6px;
}

.member-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.member-name {
  margin: 0;
  font-weight: 500;
}

.member-role {
  margin: 0;
  font-size: 12px;
  color: #666;
}

.sidebar-actions {
  padding: 20px;
  border-top: 1px solid #eee;
}

.danger-btn {
  width: 100%;
  background-color: #f44336;
  color: white;
  border: none;
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
}

/* 确认对话框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-content {
  background-color: #fff;
  border-radius: 8px;
  width: 90%;
  max-width: 400px;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
}

.close-modal {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.modal-body {
  padding: 20px;
}

.modal-body p {
  margin: 0;
  color: #333;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #eee;
}

.cancel-btn {
  background-color: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.confirm-btn {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .group-sidebar {
    width: 100%;
    right: -100%;
  }
  
  .message-item {
    max-width: 85%;
  }
  
  .input-container {
    padding: 8px 12px;
  }
  
  .modal-content {
    width: 95%;
    margin: 20px;
  }
}
</style>