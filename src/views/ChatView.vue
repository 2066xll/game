<template>
  <div class="chat-container">
    <!-- 左侧频道列表 -->
    <div class="channels-sidebar">
      <div class="sidebar-header">
        <h2>聊天频道</h2>
        <button class="create-channel-btn" @click="showCreateChannelModal = true">
          <i class="icon-plus"></i>
        </button>
      </div>
      
      <div class="channels-list">
        <div v-if="channels.length === 0" class="no-channels-message">
          <div class="no-channels-icon">💬</div>
          <h3>还没有聊天频道</h3>
          <p>创建一个新频道开始聊天吧！</p>
          <button class="create-first-channel-btn" @click="showCreateChannelModal = true">
            创建第一个频道
          </button>
        </div>
        <div 
          v-else
          v-for="channel in channels" 
          :key="channel.id"
          class="channel-item"
          :class="{ active: currentChannelId === channel.id }"
          @click="selectChannel(channel.id)"
        >
          <div class="channel-avatar">
            <span>{{ getChannelInitial(channel.name) }}</span>
          </div>
          <div class="channel-info">
            <div class="channel-name">{{ channel.name }}</div>
            <div class="channel-member-count">{{ channel.member_count }} 成员</div>
          </div>
          <div v-if="unreadCounts[channel.id] > 0" class="unread-badge">{{ unreadCounts[channel.id] }}</div>
        </div>
      </div>
    </div>

    <!-- 右侧聊天区域 -->
    <div class="chat-main">
      <!-- 聊天头部 -->
      <div class="chat-header">
        <div class="chat-info">
          <div class="channel-avatar">
            <span>{{ getChannelInitial(currentChannel?.name) }}</span>
          </div>
          <div class="channel-details">
            <h2 class="channel-name">{{ currentChannel?.name || '选择频道开始聊天' }}</h2>
            <p class="member-count">{{ currentChannel?.member_count || 0 }} 名成员</p>
          </div>
        </div>
        <div class="header-actions">
          <button class="invite-btn" @click="showInviteModal = true" :disabled="!currentChannel">
            <i class="icon-invite"></i> 邀请
          </button>
          <button class="leave-btn" @click="confirmLeaveChannel" :disabled="!currentChannel">
            <i class="icon-leave"></i> 离开
          </button>
        </div>
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
      <div v-else-if="currentChannel" class="messages-container" ref="messagesContainer">
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
                <span>{{ getMemberInitial(message) }}</span>
              </div>
              <div class="message-content-wrapper">
                <div class="message-meta">
                  <span class="message-author">{{ getMessageSenderName(message) }}</span>
                  <span class="message-time">{{ formatTime(message.created_at) }}</span>
                </div>
                <div class="message-content">
                  <p>{{ message.content }}</p>
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

      <!-- 选择频道提示 -->
      <div v-else class="select-channel-prompt">
        <h3>选择一个频道开始聊天</h3>
        <p>从左侧列表中选择一个频道，或创建一个新频道开始聊天。</p>
      </div>

      <!-- 输入框区域 -->
      <div v-if="currentChannel" class="input-container">
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
            <span class="char-count" :class="{
  warning: messageInput.length > 400,
  error: messageInput.length > 480
}">{{ messageInput.length }}/500</span>
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
    </div>

    <!-- 创建频道模态框 -->
    <div v-if="showCreateChannelModal" class="modal-overlay" @click.self="showCreateChannelModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>创建新频道</h3>
          <button class="close-modal" @click="showCreateChannelModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>频道名称</label>
            <input 
              v-model="newChannelName" 
              type="text" 
              placeholder="输入频道名称"
              maxlength="50"
            >
          </div>
          <div class="form-group">
            <label>频道描述</label>
            <textarea 
              v-model="newChannelDescription" 
              placeholder="输入频道描述"
              rows="3"
              maxlength="200"
            ></textarea>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="newChannelPrivate">
              <span>设为私有频道</span>
            </label>
          </div>
        </div>
        <div class="modal-actions">
          <button class="cancel-btn" @click="showCreateChannelModal = false">取消</button>
          <button 
            class="create-btn" 
            @click="createChannel"
            :disabled="!newChannelName.trim()"
          >
            创建频道
          </button>
        </div>
      </div>
    </div>

    <!-- 邀请成员模态框 -->
    <div v-if="showInviteModal" class="modal-overlay" @click.self="showInviteModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>邀请成员</h3>
          <button class="close-modal" @click="showInviteModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>成员ID（用逗号分隔）</label>
            <textarea 
              v-model="inviteUserIds" 
              placeholder="输入要邀请的成员ID，用逗号分隔"
              rows="3"
            ></textarea>
          </div>
        </div>
        <div class="modal-actions">
          <button class="cancel-btn" @click="showInviteModal = false">取消</button>
          <button 
            class="invite-btn" 
            @click="inviteUsers"
            :disabled="!inviteUserIds.trim()"
          >
            发送邀请
          </button>
        </div>
      </div>
    </div>

    <!-- 确认退出对话框 -->
    <div v-if="showConfirmDialog" class="modal-overlay" @click.self="showConfirmDialog = false">
      <div class="modal-content confirm-dialog">
        <div class="modal-header">
          <h3>{{ confirmTitle }}</h3>
          <button class="close-modal" @click="showConfirmDialog = false">×</button>
        </div>
        <div class="modal-body">
          <p>{{ confirmMessage }}</p>
        </div>
        <div class="modal-actions">
          <button class="cancel-btn" @click="showConfirmDialog = false">取消</button>
          <button class="danger-btn" @click="leaveChannel">确认</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

export default {
  name: 'ChatView',
  setup() {
    const chatStore = useChatStore()
    const authStore = useAuthStore()
    const router = useRouter()
    const route = useRoute()
    
    // 状态
    const channels = ref([])
    const currentChannelId = ref(null)
    const currentChannel = ref(null)
    const messages = ref([])
    const messageInput = ref('')
    const isLoading = ref(true)
    const error = ref(null)
    const messagesContainer = ref(null)
    const typingUsers = ref([])
    const lastTypingTime = ref(0)
    const unreadCounts = ref({})
    
    // 模态框状态
    const showCreateChannelModal = ref(false)
    const newChannelName = ref('')
    const newChannelDescription = ref('')
    const newChannelPrivate = ref(false)
    
    const showInviteModal = ref(false)
    const inviteUserIds = ref('')
    
    const showConfirmDialog = ref(false)
    const confirmTitle = ref('')
    const confirmMessage = ref('')
    
    // 初始化聊天store
    const initializeChat = async () => {
      try {
        console.log('Initializing chat...')
        await chatStore.initialize()
        console.log('Chat initialized successfully')
      } catch (err) {
        console.error('Failed to initialize chat:', err)
        // 只记录错误，不影响页面加载
        console.log('Continuing without WebSocket connection')
      }
    }
    
    // 计算属性
    const canSendMessage = computed(() => {
      return messageInput.value.trim().length > 0 && messageInput.value.length <= 500
    })
    
    // 加载频道列表
    const loadChannels = async () => {
      try {
        isLoading.value = true
        const loadedChannels = await chatStore.fetchGroups()
        channels.value = loadedChannels || []
        
        // 初始化未读计数
        (loadedChannels || []).forEach(channel => {
          if (!unreadCounts.value[channel.id]) {
            unreadCounts.value[channel.id] = 0
          }
        })
        
        // 如果没有频道，创建一个默认频道
        if ((loadedChannels || []).length === 0) {
          console.log('No channels found, creating a default channel...')
          try {
            await createChannel()
          } catch (createErr) {
            console.error('Failed to create default channel:', createErr)
          }
        }
      } catch (err) {
        console.error('Failed to load channels:', err)
        error.value = '加载频道列表失败，请检查网络连接或稍后重试'
        // 即使加载失败，也显示空的频道列表，允许用户创建新频道
        channels.value = []
      } finally {
        isLoading.value = false
      }
    }
    
    // 加载消息
    const loadMessages = async () => {
      if (!currentChannelId.value) return
      
      try {
        isLoading.value = true
        const loadedMessages = await chatStore.fetchGroupMessages(currentChannelId.value)
        messages.value = loadedMessages
        scrollToBottom()
      } catch (err) {
        error.value = '加载消息失败'
      } finally {
        isLoading.value = false
      }
    }
    
    // 选择频道
    const selectChannel = async (channelId) => {
      currentChannelId.value = channelId
      currentChannel.value = channels.value.find(c => c.id === channelId)
      
      // 清除未读计数
      unreadCounts.value[channelId] = 0
      
      // 加载消息
      await loadMessages()
    }
    
    // 发送消息
    const sendMessage = async () => {
      if (!canSendMessage.value || !currentChannelId.value) return
      
      const content = messageInput.value.trim()
      messageInput.value = ''
      
      try {
        await chatStore.sendMessage(content)
      } catch (err) {
        error.value = '发送消息失败'
      }
    }
    
    // 处理输入事件（发送正在输入状态）
    const handleInput = () => {
      // 这里可以添加正在输入状态的处理
    }
    
    // 创建频道
    const createChannel = async (isDefault = false) => {
      // 如果是创建默认频道，使用默认值
      const channelName = isDefault ? '默认聊天频道' : newChannelName.value.trim()
      if (!channelName) return
      
      try {
        // 调用状态管理的createGroup方法创建频道
        await chatStore.createGroup(channelName, [], {
          description: isDefault ? '系统创建的默认聊天频道' : newChannelDescription.value,
          is_private: isDefault ? 0 : (newChannelPrivate.value ? 1 : 0)
        })
        
        // 重新加载频道列表
        await loadChannels()
        
        // 如果不是默认频道，关闭模态框并重置表单
        if (!isDefault) {
          showCreateChannelModal.value = false
          newChannelName.value = ''
          newChannelDescription.value = ''
          newChannelPrivate.value = false
        }
      } catch (err) {
        console.error('Failed to create channel:', err)
        error.value = '创建频道失败，请重试'
      }
    }
    
    // 邀请用户
    const inviteUsers = async () => {
      if (!currentChannelId.value || !inviteUserIds.value.trim()) return
      
      try {
        const userIds = inviteUserIds.value.split(',').map(id => id.trim()).filter(id => id)
        await chatStore.inviteUsersToGroup(currentChannelId.value, userIds)
        
        // 关闭模态框
        showInviteModal.value = false
        inviteUserIds.value = ''
      } catch (err) {
        error.value = '邀请用户失败'
      }
    }
    
    // 确认退出频道
    const confirmLeaveChannel = () => {
      confirmTitle.value = '退出频道'
      confirmMessage.value = '确定要退出该频道吗？'
      showConfirmDialog.value = true
    }
    
    // 退出频道
    const leaveChannel = async () => {
      if (!currentChannelId.value) return
      
      try {
        await chatStore.leaveGroup(currentChannelId.value)
        
        // 重新加载频道列表
        await loadChannels()
        
        // 清除当前频道
        currentChannelId.value = null
        currentChannel.value = null
        messages.value = []
        
        // 关闭模态框
        showConfirmDialog.value = false
      } catch (err) {
        error.value = '退出频道失败'
      }
    }
    
    // 辅助方法
    const getChannelInitial = (name) => {
      return name ? name.charAt(0).toUpperCase() : '?'
    }
    
    const getMemberInitial = (message) => {
      const senderName = getMessageSenderName(message)
      return senderName ? senderName.charAt(0).toUpperCase() : '?'
    }
    
    const getMessageSenderName = (message) => {
      return message.username || message.user?.username || message.sender?.name || '未知用户'
    }
    
    const isOwnMessage = (message) => {
      return message.senderId === authStore.user?.id || message.user?.id === authStore.user?.id
    }
    
    const getTypingText = () => {
      if (typingUsers.value.length === 0) return ''
      if (typingUsers.value.length === 1) return typingUsers.value[0].name
      return `${typingUsers.value.slice(0, 2).map(u => u.name).join('和')}等${typingUsers.value.length}人`
    }
    
    const scrollToBottom = () => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    }
    
    // 格式化时间
    const formatTime = (timestamp) => {
      const date = new Date(timestamp * 1000)
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    // 生命周期
    onMounted(async () => {
      await initializeChat()
      await loadChannels()
      
      // 处理路由参数
      const channelId = route.params.id
      if (channelId) {
        if (channelId === 'all') {
          // 如果是/all路径，默认选择第一个频道
          if (channels.value.length > 0) {
            await selectChannel(channels.value[0].id)
          }
        } else {
          // 否则选择指定ID的频道
          await selectChannel(channelId)
        }
      } else if (channels.value.length > 0) {
        // 如果没有路由参数，默认选择第一个频道
        await selectChannel(channels.value[0].id)
      }
    })
    
    // 监听路由参数变化
    watch(
      () => route.params.id,
      async (newId) => {
        if (newId) {
          if (newId === 'all') {
            // 如果是/all路径，默认选择第一个频道
            if (channels.value.length > 0) {
              await selectChannel(channels.value[0].id)
            }
          } else {
            // 否则选择指定ID的频道
            await selectChannel(newId)
          }
        }
      },
      { immediate: true }
    )
    
    return {
      // 状态
      channels,
      currentChannelId,
      currentChannel,
      messages,
      messageInput,
      isLoading,
      error,
      messagesContainer,
      typingUsers,
      unreadCounts,
      canSendMessage,
      
      // 模态框
      showCreateChannelModal,
      newChannelName,
      newChannelDescription,
      newChannelPrivate,
      showInviteModal,
      inviteUserIds,
      showConfirmDialog,
      confirmTitle,
      confirmMessage,
      
      // 方法
      loadChannels,
      loadMessages,
      selectChannel,
      sendMessage,
      handleInput,
      createChannel,
      inviteUsers,
      confirmLeaveChannel,
      leaveChannel,
      
      // 辅助方法
      getChannelInitial,
      getMemberInitial,
      getMessageSenderName,
      isOwnMessage,
      getTypingText,
      formatTime
    }
  }
}
</script>

<style scoped>
.chat-container {
  display: flex;
  height: 100vh;
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  overflow: hidden;
  position: relative;
}

/* 频道侧边栏 */
.channels-sidebar {
  width: 300px;
  background: linear-gradient(180deg, #252525 0%, #1e1e1e 100%);
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.3);
  z-index: 10;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #333;
  background: linear-gradient(135deg, #2d2d2d 0%, #252525 100%);
  position: relative;
}

.sidebar-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 20px;
  right: 20px;
  height: 1px;
  background: linear-gradient(90deg, transparent, #4285F4, transparent);
}

.sidebar-header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  background: linear-gradient(135deg, #4285F4 0%, #34A853 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.create-channel-btn {
  background: linear-gradient(135deg, #4285F4 0%, #34A853 100%);
  color: white;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 22px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.4);
  position: relative;
  overflow: hidden;
}

.create-channel-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s ease;
}

.create-channel-btn:hover::before {
  left: 100%;
}

.create-channel-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(66, 133, 244, 0.5);
}

.channels-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: rgba(0, 0, 0, 0.1);
}

/* 自定义滚动条 */
.channels-list::-webkit-scrollbar {
  width: 8px;
}

.channels-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.channels-list::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #4285F4 0%, #34A853 100%);
  border-radius: 4px;
  transition: all 0.3s ease;
}

.channels-list::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #3367d6 0%, #2c8a4a 100%);
}

.channel-item {
  display: flex;
  align-items: center;
  padding: 14px 18px;
  border-radius: 16px;
  cursor: pointer;
  margin-bottom: 6px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
}

.channel-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(66, 133, 244, 0.15), transparent);
  transition: left 0.5s ease;
}

.channel-item:hover::before {
  left: 100%;
}

.channel-item:hover {
  background: rgba(66, 133, 244, 0.1);
  transform: translateX(6px);
  border-color: rgba(66, 133, 244, 0.3);
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.2);
}

.channel-item.active {
  background: rgba(66, 133, 244, 0.15);
  border-left: 4px solid #4285F4;
  transform: translateX(6px);
  border-color: rgba(66, 133, 244, 0.4);
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
}

.channel-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4285F4 0%, #34A853 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  margin-right: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.channel-item:hover .channel-avatar {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.channel-info {
  flex: 1;
  min-width: 0;
}

.channel-name {
  font-weight: 600;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #ffffff;
  font-size: 16px;
  transition: all 0.3s ease;
}

.channel-item:hover .channel-name {
  color: #4285F4;
}

.channel-member-count {
  font-size: 13px;
  color: #888;
  display: flex;
  align-items: center;
  gap: 6px;
}

.channel-member-count::before {
  content: '👥';
  font-size: 14px;
}

.unread-badge {
  background: linear-gradient(135deg, #34A853 0%, #4285F4 100%);
  color: white;
  border-radius: 16px;
  min-width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 3px 8px rgba(52, 168, 83, 0.4);
  transition: all 0.3s ease;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.channel-item:hover .unread-badge {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(52, 168, 83, 0.5);
}

/* 没有频道时的提示信息 */
.no-channels-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;
  color: #888;
}

.no-channels-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.no-channels-message h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
}

.no-channels-message p {
  margin: 0 0 20px 0;
  font-size: 14px;
  color: #aaa;
}

.create-first-channel-btn {
  background: linear-gradient(135deg, #4285F4 0%, #34A853 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(66, 133, 244, 0.3);
}

.create-first-channel-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.4);
}

/* 聊天主区域 */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(135deg, #121212 0%, #1e1e1e 100%);
  position: relative;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.3);
}

/* 聊天头部 */
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 30px;
  background: linear-gradient(135deg, #1e1e1e 0%, #252525 100%);
  border-bottom: 1px solid #333;
  position: relative;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  z-index: 10;
}

.chat-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 30px;
  right: 30px;
  height: 1px;
  background: linear-gradient(90deg, transparent, #4285F4, transparent);
}

.chat-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.channel-details h2 {
  margin: 0 0 6px 0;
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  background: linear-gradient(135deg, #4285F4 0%, #34A853 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.member-count {
  margin: 0;
  font-size: 14px;
  color: #888;
  display: flex;
  align-items: center;
  gap: 6px;
}

.member-count::before {
  content: '👥';
  font-size: 16px;
}

.header-actions {
  display: flex;
  gap: 16px;
}

.invite-btn, .leave-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 12px 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.invite-btn::before, .leave-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.5s ease;
}

.invite-btn:hover::before, .leave-btn:hover::before {
  left: 100%;
}

.invite-btn:hover:not(:disabled) {
  background: rgba(66, 133, 244, 0.15);
  border-color: rgba(66, 133, 244, 0.4);
  color: #4285F4;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
}

.leave-btn {
  color: #EA4335;
  border-color: rgba(234, 67, 53, 0.3);
}

.leave-btn:hover:not(:disabled) {
  background: rgba(234, 67, 53, 0.15);
  border-color: rgba(234, 67, 53, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(234, 67, 53, 0.3);
}

.invite-btn:disabled, .leave-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 选择频道提示 */
.select-channel-prompt {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #888;
  padding: 40px 20px;
  text-align: center;
  background: linear-gradient(135deg, rgba(18, 18, 18, 0.95) 0%, rgba(30, 30, 30, 0.95) 100%);
  position: relative;
  overflow: hidden;
}

.select-channel-prompt::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(66, 133, 244, 0.1) 0%, transparent 70%);
  transform: translate(-50%, -50%);
  z-index: 0;
}

.select-channel-prompt h3 {
  margin-bottom: 16px;
  color: #ffffff;
  font-size: 28px;
  font-weight: 700;
  position: relative;
  z-index: 1;
}

.select-channel-prompt p {
  font-size: 16px;
  max-width: 500px;
  line-height: 1.6;
  position: relative;
  z-index: 1;
}

/* 消息列表 */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px 30px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: linear-gradient(135deg, #121212 0%, #1e1e1e 100%);
  position: relative;
}

/* 自定义滚动条 */
.messages-container::-webkit-scrollbar {
  width: 10px;
}

.messages-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 5px;
}

.messages-container::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #4285F4 0%, #34A853 100%);
  border-radius: 5px;
  transition: all 0.3s ease;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #3367d6 0%, #2c8a4a 100%);
}

.empty-messages {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #888;
  font-size: 16px;
  flex-direction: column;
  gap: 16px;
  position: relative;
  z-index: 1;
}

.empty-messages::before {
  content: '💬';
  font-size: 64px;
  opacity: 0.3;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

.empty-messages p {
  margin: 0;
  font-size: 18px;
  color: #aaa;
  font-weight: 500;
}

.message-wrapper {
  display: flex;
  width: 100%;
  animation: messageSlideIn 0.3s ease-out;
}

@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-item {
  display: flex;
  max-width: 75%;
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
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
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4285F4, #34A853);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  margin: 0 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}

.own-message .message-avatar {
  background: linear-gradient(135deg, #34A853, #4285F4);
}

.message-content-wrapper {
  display: flex;
  flex-direction: column;
  max-width: calc(100% - 60px);
}

.own-message .message-content-wrapper {
  align-items: flex-end;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  color: #888;
}

.own-message .message-meta {
  flex-direction: row-reverse;
}

.message-author {
  font-weight: 600;
  color: #4285F4;
}

.own-message .message-author {
  color: #34A853;
}

.message-time {
  color: #999;
}

/* 现代化消息气泡样式 */
.message-content {
  background: linear-gradient(135deg, #2a2a2a 0%, #333333 100%);
  padding: 14px 18px;
  border-radius: 20px;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.3);
  word-wrap: break-word;
  white-space: pre-wrap;
  color: #ffffff;
  font-size: 15px;
  line-height: 1.6;
  position: relative;
  max-width: 100%;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.message-content:hover {
  box-shadow: 0 5px 16px rgba(0, 0, 0, 0.4);
  transform: translateY(-1px);
}

.message-content::before {
  content: '';
  position: absolute;
  top: 14px;
  width: 0;
  height: 0;
  border-style: solid;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.message-item:not(.own-message) .message-content::before {
  left: -8px;
  border-width: 8px 8px 8px 0;
  border-color: transparent #2a2a2a transparent transparent;
}

.message-item.own-message .message-content::before {
  right: -8px;
  border-width: 8px 0 8px 8px;
  border-color: transparent transparent transparent #4285F4;
}

.own-message .message-content {
  background: linear-gradient(135deg, #4285F4 0%, #34A853 100%);
  color: white;
  box-shadow: 0 4px 16px rgba(66, 133, 244, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.own-message .message-content:hover {
  box-shadow: 0 6px 20px rgba(66, 133, 244, 0.5);
  transform: translateY(-2px);
}

.system-message-content {
  background: linear-gradient(135deg, rgba(66, 133, 244, 0.15) 0%, rgba(52, 168, 83, 0.15) 100%);
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 14px;
  color: #4285F4;
  border: 1px solid rgba(66, 133, 244, 0.3);
  box-shadow: 0 2px 8px rgba(66, 133, 244, 0.2);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  animation: systemMessageSlide 0.5s ease-out;
}

.system-message-content:hover {
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
  border-color: rgba(66, 133, 244, 0.4);
  transform: translateY(-1px);
}

@keyframes systemMessageSlide {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 正在输入提示 */
.typing-indicator {
  margin-top: -8px;
  padding: 10px 20px;
  font-size: 14px;
  color: #4285F4;
  background: linear-gradient(135deg, rgba(66, 133, 244, 0.1) 0%, rgba(52, 168, 83, 0.1) 100%);
  border-radius: 20px;
  align-self: flex-start;
  margin-left: 60px;
  box-shadow: 0 2px 8px rgba(66, 133, 244, 0.2);
  animation: typingPulse 1.5s infinite;
  border: 1px solid rgba(66, 133, 244, 0.3);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.typing-indicator::before {
  content: '';
  display: flex;
  gap: 4px;
  animation: typingDots 1.5s infinite;
}

.typing-indicator::before {
  content: '● ● ●';
  font-size: 8px;
  letter-spacing: -2px;
  color: #4285F4;
}

@keyframes typingPulse {
  0%, 100% { opacity: 0.8; transform: scale(0.98); }
  50% { opacity: 1; transform: scale(1); }
}

@keyframes typingDots {
  0%, 20% { opacity: 0.3; }
  50% { opacity: 1; }
  80%, 100% { opacity: 0.3; }
}

.typing-indicator:hover {
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
  border-color: rgba(66, 133, 244, 0.4);
}

/* 输入框区域 */
.input-container {
  display: flex;
  align-items: center;
  padding: 20px 30px;
  background: linear-gradient(135deg, #1e1e1e 0%, #252525 100%);
  border-top: 1px solid #333;
  gap: 16px;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.3);
  position: relative;
}

.input-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 30px;
  right: 30px;
  height: 1px;
  background: linear-gradient(90deg, transparent, #4285F4, transparent);
}

.input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #2a2a2a 0%, #333333 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 28px;
  padding: 0 24px;
  min-height: 52px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
}

.input-wrapper:focus-within {
  border-color: #4285F4;
  box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.15), 0 4px 12px rgba(66, 133, 244, 0.3);
  transform: translateY(-1px);
}

.input-wrapper input {
  flex: 1;
  border: none;
  background: none;
  outline: none;
  padding: 14px 0;
  font-size: 15px;
  color: #ffffff;
  font-family: inherit;
  transition: all 0.3s ease;
}

.input-wrapper input::placeholder {
  color: #888;
  transition: all 0.3s ease;
}

.input-wrapper:focus-within input::placeholder {
  color: #aaa;
}

.input-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.attach-btn {
  background: linear-gradient(135deg, rgba(66, 133, 244, 0.1) 0%, rgba(52, 168, 83, 0.1) 100%);
  border: 1px solid rgba(66, 133, 244, 0.3);
  font-size: 20px;
  cursor: pointer;
  color: #888;
  padding: 6px;
  transition: all 0.3s ease;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}

.attach-btn:hover {
  background: linear-gradient(135deg, rgba(66, 133, 244, 0.2) 0%, rgba(52, 168, 83, 0.2) 100%);
  color: #4285F4;
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(66, 133, 244, 0.3);
  border-color: rgba(66, 133, 244, 0.5);
}

.char-count {
  font-size: 12px;
  color: #888;
  min-width: 50px;
  text-align: right;
  transition: all 0.3s ease;
}

.char-count.warning {
  color: #FBBC05;
}

.char-count.error {
  color: #EA4335;
}

.send-btn {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4285F4 0%, #34A853 100%);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(66, 133, 244, 0.4);
  position: relative;
  overflow: hidden;
}

.send-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s ease;
}

.send-btn:hover:not(:disabled)::before {
  left: 100%;
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(66, 133, 244, 0.5);
}

.send-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.send-btn:disabled {
  background: linear-gradient(135deg, #444444 0%, #555555 100%);
  cursor: not-allowed;
  opacity: 0.5;
  box-shadow: none;
  transform: none;
}

/* 模态框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background-color: #1e1e1e;
  border: 1px solid #333;
  border-radius: 12px;
  width: 90%;
  max-width: 450px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.3s ease-out;
  overflow: hidden;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #333;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #252525;
}

.modal-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
}

.close-modal {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #888;
  transition: all 0.3s ease;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.close-modal:hover {
  color: #ffffff;
  background-color: #333;
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #ffffff;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #444;
  border-radius: 8px;
  font-size: 15px;
  box-sizing: border-box;
  background-color: #2a2a2a;
  color: #ffffff;
  font-family: inherit;
  transition: all 0.3s ease;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #4285F4;
  box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.1);
  background-color: #252525;
}

.form-group input::placeholder,
.form-group textarea::placeholder {
  color: #888;
}

.form-group textarea {
  resize: vertical;
  min-height: 100px;
  line-height: 1.5;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  gap: 10px;
  padding: 12px 0;
  color: #ffffff;
  font-size: 15px;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #4285F4;
  cursor: pointer;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #333;
  background-color: #252525;
}

.cancel-btn {
  background-color: #2a2a2a;
  color: #ffffff;
  border: 1px solid #444;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.cancel-btn:hover {
  background-color: #333;
  border-color: #555;
  transform: translateY(-1px);
}

.create-btn {
  background: linear-gradient(135deg, #34A853 0%, #4285F4 100%);
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(52, 168, 83, 0.3);
}

.create-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(52, 168, 83, 0.4);
}

.create-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.invite-btn {
  background: linear-gradient(135deg, #4285F4 0%, #34A853 100%);
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(66, 133, 244, 0.3);
}

.invite-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.4);
}

.invite-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.danger-btn {
  background: linear-gradient(135deg, #EA4335 0%, #FBBC05 100%);
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(234, 67, 53, 0.3);
}

.danger-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(234, 67, 53, 0.4);
}

/* 加载状态 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #888;
  gap: 16px;
  padding: 40px;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(66, 133, 244, 0.1);
  border-top: 4px solid #4285F4;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  box-shadow: 0 0 20px rgba(66, 133, 244, 0.2);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-container p {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}

/* 错误提示 */
.error-message {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #EA4335;
  padding: 40px 20px;
  text-align: center;
  gap: 20px;
  background-color: rgba(234, 67, 53, 0.05);
  border: 1px solid rgba(234, 67, 53, 0.2);
  border-radius: 12px;
  margin: 20px;
}

.error-message::before {
  content: '⚠️';
  font-size: 48px;
  opacity: 0.7;
}

.error-message p {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  max-width: 500px;
}

.retry-btn {
  margin-top: 8px;
  background: linear-gradient(135deg, #EA4335 0%, #FBBC05 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(234, 67, 53, 0.3);
}

.retry-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(234, 67, 53, 0.4);
}

/* 响应式设计优化 */
@media (max-width: 768px) {
  .chat-container {
    flex-direction: column;
  }
  
  .channels-sidebar {
    width: 100%;
    height: 200px;
    border-right: none;
    border-bottom: 1px solid #333;
  }
  
  .message-item {
    max-width: 85%;
  }
  
  .chat-header {
    padding: 12px 16px;
  }
  
  .header-actions {
    gap: 8px;
  }
  
  .invite-btn, .leave-btn {
    padding: 8px 12px;
    font-size: 13px;
  }
  
  .messages-container {
    padding: 16px;
  }
  
  .input-container {
    padding: 12px 16px;
  }
  
  .modal-content {
    width: 95%;
    margin: 20px;
  }
}

@media (max-width: 480px) {
  .sidebar-header {
    padding: 12px 16px;
  }
  
  .sidebar-header h2 {
    font-size: 18px;
  }
  
  .create-channel-btn {
    width: 32px;
    height: 32px;
    font-size: 18px;
  }
  
  .channel-item {
    padding: 10px 12px;
  }
  
  .channel-avatar {
    width: 36px;
    height: 36px;
    font-size: 16px;
  }
  
  .channel-name {
    font-size: 14px;
  }
  
  .message-avatar {
    width: 32px;
    height: 32px;
    font-size: 14px;
    margin: 0 6px;
  }
  
  .message-content {
    padding: 10px 14px;
    font-size: 14px;
  }
  
  .input-wrapper {
    padding: 0 12px;
    min-height: 44px;
  }
  
  .input-wrapper input {
    font-size: 14px;
  }
  
  .send-btn {
    width: 44px;
    height: 44px;
    font-size: 18px;
  }
}


</style>