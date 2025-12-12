import { defineStore } from 'pinia'
import axios from 'axios'
import { useAuthStore } from './authStore'

// 获取API基础URL，优先使用环境变量，其次使用相对路径
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

// 创建axios实例
const chatApi = axios.create({
  baseURL: `${API_BASE_URL}`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器，添加认证token
chatApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
chatApi.interceptors.response.use(
  (response) => {
    return response.data // 直接返回data部分
  },
  (error) => {
    const message = error.response?.data?.message || '网络请求失败'
    console.error('Chat API Error:', message)
    return Promise.reject(new Error(message))
  }
)

export const useChatStore = defineStore('chat', {
  state: () => ({
    // 聊天群组相关
    groups: [], // 用户加入的所有聊天群组
    currentGroup: null, // 当前选中的聊天群组
    groupMessages: {}, // 每个群组的消息历史 { groupId: [messages] }
    
    // WebSocket相关
    wsConnection: null, // WebSocket连接实例
    wsConnected: false, // WebSocket连接状态
    wsReconnectAttempts: 0, // 重连尝试次数
    maxReconnectAttempts: 5, // 最大重连次数
    reconnectInterval: 2000, // 重连间隔（毫秒）
    
    // 消息状态
    unreadCounts: {}, // 每个群组的未读消息数 { groupId: count }
    isLoading: false, // 加载状态
    error: null, // 错误信息
    
    // 消息草稿
    messageDrafts: {}, // 每个群组的消息草稿 { groupId: draftText }
    
    // 消息验证和重试相关
    pendingMessages: new Map(), // 等待确认的消息 { messageId: { message, retries, timestamp } }
    lastSequenceId: {}, // 每个群组的最后序列号 { groupId: sequenceId }
    messageRetries: 3, // 消息发送最大重试次数
    retryDelay: 1000 // 消息重试间隔（毫秒）
  }),

  getters: {
    // 获取当前群组的消息列表
    currentGroupMessages: (state) => {
      if (!state.currentGroup) return []
      return state.groupMessages[state.currentGroup.id] || []
    },

    // 获取当前群组的未读消息数
    currentGroupUnreadCount: (state) => {
      if (!state.currentGroup) return 0
      return state.unreadCounts[state.currentGroup.id] || 0
    },

    // 获取所有群组的总未读消息数
    totalUnreadCount: (state) => {
      return Object.values(state.unreadCounts).reduce((total, count) => total + count, 0)
    },

    // 获取当前群组的草稿
    currentGroupDraft: (state) => {
      if (!state.currentGroup) return ''
      return state.messageDrafts[state.currentGroup.id] || ''
    }
  },

  actions: {
    // 初始化聊天store
    async initialize() {
      try {
        // 加载用户的聊天群组
        await this.fetchGroups()
        
        // 建立WebSocket连接
        this.connectWebSocket()
      } catch (error) {
        this.setError('初始化聊天失败')
        console.error('Chat initialization error:', error)
      }
    },

    // 设置错误信息
    setError(message) {
      this.error = message
      setTimeout(() => {
        this.error = null
      }, 3000)
    },

    // 获取用户的聊天群组列表
    async fetchGroups() {
      try {
        this.isLoading = true
        const groups = await chatApi.get('/groups', {
          headers: {
            'X-Session-Id': localStorage.getItem('auth_token')
          }
        })
        this.groups = groups.groups || []
        
        // 初始化每个群组的未读消息数
        this.groups.forEach(group => {
          if (!this.unreadCounts[group.id]) {
            this.unreadCounts[group.id] = 0
          }
        })
        
        return this.groups
      } catch (error) {
        this.setError('获取群组列表失败')
        throw error
      } finally {
        this.isLoading = false
      }
    },

    // 获取指定群组的消息历史
    async fetchGroupMessages(groupId, limit = 50, offset = 0) {
      try {
        this.isLoading = true
        const messages = await chatApi.get('/channel/messages', {
          headers: {
            'X-Channel-Id': groupId,
            'X-Session-Id': localStorage.getItem('auth_token')
          },
          params: { limit, offset }
        })
        
        // 初始化该群组的消息数组（如果不存在）
        if (!this.groupMessages[groupId]) {
          this.groupMessages[groupId] = []
        }
        
        // 如果是首次加载或重置，直接替换消息数组
        if (offset === 0) {
          this.groupMessages[groupId] = messages.messages || []
        } else {
          // 否则追加到现有消息的前面（历史消息）
          this.groupMessages[groupId] = [...(messages.messages || []), ...this.groupMessages[groupId]]
        }
        
        // 清除未读消息计数
        if (this.currentGroup && this.currentGroup.id === groupId) {
          this.unreadCounts[groupId] = 0
          await this.markAsRead(groupId)
        }
        
        return messages.messages || []
      } catch (error) {
        this.setError('获取消息历史失败')
        throw error
      } finally {
        this.isLoading = false
      }
    },

    // 选择当前聊天群组
    async selectGroup(groupId) {
      try {
        const group = this.groups.find(g => g.id === groupId)
        if (group) {
          this.currentGroup = group
          
          // 如果该群组的消息还未加载，则加载
          if (!this.groupMessages[groupId] || this.groupMessages[groupId].length === 0) {
            await this.fetchGroupMessages(groupId)
          }
          
          // 清除未读计数
          this.unreadCounts[groupId] = 0
          await this.markAsRead(groupId)
        }
      } catch (error) {
        this.setError('选择群组失败')
        console.error('Select group error:', error)
      }
    },

    // 生成唯一消息ID
    generateMessageId() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2)
    },
    
    // 获取下一个序列号
    getNextSequenceId(groupId) {
      if (!this.lastSequenceId[groupId]) {
        this.lastSequenceId[groupId] = 0
      }
      return ++this.lastSequenceId[groupId]
    },
    
    // 发送消息到当前群组
    async sendMessage(content) {
      if (!this.currentGroup || !content.trim()) {
        return
      }
      
      try {
        const messageId = this.generateMessageId()
        const sequenceId = this.getNextSequenceId(this.currentGroup.id)
        
        const messageData = {
          id: messageId,
          content: content.trim(),
          groupId: this.currentGroup.id,
          roomId: this.currentGroup.id, // 兼容服务器端的roomId
          sequenceId: sequenceId,
          senderId: useAuthStore().user?.id,
          status: 'sending',
          timestamp: new Date().toISOString()
        }
        
        // 保存到待确认消息列表
        this.pendingMessages.set(messageId, {
          message: messageData,
          retries: 0,
          timestamp: Date.now()
        })
        
        // 添加到本地消息列表（乐观更新）
        this.addNewMessage(messageData)
        
        // 通过HTTP API发送消息
        try {
          const newMessage = await chatApi.post('/channel/messages', 
            { content: content.trim() },
            {
              headers: {
                'X-Channel-Id': this.currentGroup.id,
                'X-Session-Id': localStorage.getItem('auth_token')
              }
            }
          )
          // 移除待确认消息
          this.pendingMessages.delete(messageId)
          // 更新消息状态
          this.updateMessageStatus(messageId, 'sent')
          // 替换本地消息
          this.replaceLocalMessage(messageId, newMessage.message)
        } catch (apiError) {
          // 启动重试机制
          this._scheduleMessageRetry(messageId)
          throw apiError
        }
        
        // 清除草稿
        this.clearDraft(this.currentGroup.id)
        
        return true
      } catch (error) {
        this.setError('发送消息失败')
        throw error
      }
    },
    
    // 安全发送WebSocket消息
    _safeSendWebSocketMessage(messageObj, messageId) {
      try {
        if (this.wsConnected && this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
          this.wsConnection.send(JSON.stringify(messageObj))
        } else {
          console.warn('WebSocket not connected, scheduling retry')
          this._scheduleMessageRetry(messageId)
        }
      } catch (error) {
        console.error('Error sending WebSocket message:', error)
        this._scheduleMessageRetry(messageId)
      }
    },
    
    // 安排消息重试
    _scheduleMessageRetry(messageId) {
      const pendingMsg = this.pendingMessages.get(messageId)
      if (!pendingMsg) return
      
      if (pendingMsg.retries >= this.messageRetries) {
        console.error(`Message ${messageId} failed after ${this.messageRetries} retries`)
        this.updateMessageStatus(messageId, 'failed')
        this.pendingMessages.delete(messageId)
        return
      }
      
      pendingMsg.retries++
      const delay = this.retryDelay * Math.pow(2, pendingMsg.retries - 1) // 指数退避
      
      setTimeout(() => {
        // 检查消息是否仍在待处理中
        if (this.pendingMessages.has(messageId)) {
          const msgData = this.pendingMessages.get(messageId).message
          this._safeSendWebSocketMessage({
            type: 'send_message',
            data: msgData
          }, messageId)
        }
      }, delay)
    },
    
    // 确认消息已发送
    confirmMessageDelivery(messageId) {
      if (this.pendingMessages.has(messageId)) {
        this.pendingMessages.delete(messageId)
        this.updateMessageStatus(messageId, 'delivered')
      }
    },

    // 创建新的聊天群组
    async createGroup(groupName, userIds = [], options = {}) {
      try {
        this.isLoading = true
        const newGroup = await chatApi.post('/groups', {
          name: groupName,
          userIds: [...userIds],
          description: options.description || '',
          is_private: options.is_private || 0
        })
        
        // 添加到群组列表
        this.groups.push(newGroup)
        
        // 初始化未读计数
        this.unreadCounts[newGroup.id] = 0
        
        return newGroup
      } catch (error) {
        this.setError('创建群组失败')
        throw error
      } finally {
        this.isLoading = false
      }
    },

    // 加入聊天群组
    async joinGroup(groupId) {
      try {
        this.isLoading = true
        const group = await chatApi.post(`/groups/${groupId}/join`)
        
        // 检查群组是否已存在
        const existingGroupIndex = this.groups.findIndex(g => g.id === groupId)
        if (existingGroupIndex >= 0) {
          this.groups[existingGroupIndex] = group
        } else {
          this.groups.push(group)
          this.unreadCounts[groupId] = 0
        }
        
        return group
      } catch (error) {
        this.setError('加入群组失败')
        throw error
      } finally {
        this.isLoading = false
      }
    },
    
    // 邀请用户加入群组
    async inviteUsersToGroup(groupId, userIds) {
      try {
        this.isLoading = true
        await chatApi.post(`/groups/${groupId}/invite`, {
          userIds: userIds
        })
        return true
      } catch (error) {
        this.setError('邀请用户失败')
        throw error
      } finally {
        this.isLoading = false
      }
    },

    // 离开聊天群组
    async leaveGroup(groupId) {
      try {
        this.isLoading = true
        await chatApi.post(`/groups/${groupId}/leave`)
        
        // 从群组列表中移除
        this.groups = this.groups.filter(group => group.id !== groupId)
        
        // 清理相关数据
        delete this.groupMessages[groupId]
        delete this.unreadCounts[groupId]
        delete this.messageDrafts[groupId]
        
        // 如果当前正在查看该群组，清除当前群组
        if (this.currentGroup && this.currentGroup.id === groupId) {
          this.currentGroup = null
        }
        
        return true
      } catch (error) {
        this.setError('离开群组失败')
        throw error
      } finally {
        this.isLoading = false
      }
    },

    // 将消息标记为已读
    async markAsRead(groupId) {
      try {
        await chatApi.post(`/groups/${groupId}/read`)
        return true
      } catch (error) {
        console.error('Mark as read error:', error)
        // 即使API调用失败，仍然清除本地未读计数
        this.unreadCounts[groupId] = 0
        return false
      }
    },

    // 保存消息草稿
    saveDraft(groupId, draftText) {
      this.messageDrafts[groupId] = draftText
    },

    // 清除消息草稿
    clearDraft(groupId) {
      this.messageDrafts[groupId] = ''
    },

    // 连接WebSocket
    connectWebSocket() {
      // 如果已经有连接，先断开
      if (this.wsConnection) {
        this.disconnectWebSocket()
      }
      
      try {
        const authStore = useAuthStore()
        const token = authStore.token || localStorage.getItem('auth_token')
        if (!token) {
          console.warn('No auth token available, cannot connect to WebSocket')
          this.setError('登录状态已过期，请重新登录')
          return
        }
        
        // WebSocket URL构建
        let wsUrl = ''
        if (API_BASE_URL.startsWith('http')) {
          // 如果是完整URL
          const wsProtocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws'
          wsUrl = `${wsProtocol}://${API_BASE_URL.replace(/^https?:\/\//, '')}/ws`
        } else {
          // 如果是相对路径，使用当前页面的主机名
          const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
          const host = window.location.host
          wsUrl = `${wsProtocol}//${host}${API_BASE_URL}/ws`
        }
        
        console.log('Attempting to connect to WebSocket:', `${wsUrl}?token=***`)
        this.wsConnection = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`)
        
        // WebSocket事件处理
        this.wsConnection.onopen = () => {
          console.log('WebSocket connected')
          this.wsConnected = true
          this.wsReconnectAttempts = 0
          this.setError(null) // 清除之前的错误
          
          // 发送加入所有群组的消息
          this.groups.forEach(group => {
            if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
              this.wsConnection.send(JSON.stringify({
                type: 'join_group',
                data: { groupId: group.id }
              }))
            }
          })
        }
        
        this.wsConnection.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this.handleWebSocketMessage(data)
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
            // 尝试发送错误消息给用户界面
            this.setError('接收消息失败，请检查网络连接')
          }
        }
        
        this.wsConnection.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.wsConnected = false
          // 显示错误给用户
          this.setError('WebSocket连接错误，请检查网络连接')
        }
        
        this.wsConnection.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason)
          this.wsConnected = false
          
          // 不显示错误，直接尝试重新连接
          if (event.code !== 1000) { // 1000是正常关闭
            this.attemptReconnect()
          }
        }
      } catch (error) {
        console.error('WebSocket connection error:', error)
        this.wsConnected = false
        this.setError('WebSocket连接失败，请检查网络连接或稍后重试')
        this.attemptReconnect()
      }
    },

    // 断开WebSocket连接
    disconnectWebSocket() {
      if (this.wsConnection) {
        this.wsConnection.close()
        this.wsConnection = null
        this.wsConnected = false
      }
    },

    // 尝试重新连接WebSocket
    attemptReconnect() {
      if (this.wsReconnectAttempts < this.maxReconnectAttempts) {
        this.wsReconnectAttempts++
        console.log(`Attempting to reconnect WebSocket... (${this.wsReconnectAttempts}/${this.maxReconnectAttempts})`)
        
        setTimeout(() => {
          this.connectWebSocket()
        }, this.reconnectInterval * this.wsReconnectAttempts) // 指数退避
      } else {
        console.error('Maximum WebSocket reconnection attempts reached')
      }
    },

    // 处理WebSocket消息
    handleWebSocketMessage(data) {
      switch (data.type) {
        case 'new_message':
          // 验证消息的roomId和sequenceId
          if (data.data.roomId && data.data.sequenceId !== undefined) {
            // 更新该群组的最后序列号
            if (!this.lastSequenceId[data.data.roomId] || 
                data.data.sequenceId > this.lastSequenceId[data.data.roomId]) {
              this.lastSequenceId[data.data.roomId] = data.data.sequenceId
            }
            this.addNewMessage(data.data)
          } else {
            console.warn('Received message without valid roomId or sequenceId:', data.data)
            // 仍然添加消息，但标记为可能有问题
            const messageWithWarning = {
              ...data.data,
              _validationWarning: 'Missing roomId or sequenceId'
            }
            this.addNewMessage(messageWithWarning)
          }
          break
          
        case 'message_delivered':
          // 确认消息已送达
          this.confirmMessageDelivery(data.data.messageId)
          break
          
        case 'message_confirmed':
          // 处理服务器的消息确认
          this.confirmMessageDelivery(data.data.messageId)
          break
          
        case 'message_read':
          this.updateMessageStatus(data.data.messageId, 'read')
          break
          
        case 'user_joined':
          this.handleUserJoined(data.data)
          break
          
        case 'user_left':
          this.handleUserLeft(data.data)
          break
          
        case 'typing_status':
          this.handleTypingStatus(data.data)
          break
          
        case 'error':
          // 处理来自服务器的错误
          console.error('Server error:', data.message)
          this.setError(data.message || '服务器错误')
          break
          
        case 'reconnect_required':
          // 服务器要求重新连接
          console.warn('Server requested reconnection')
          this.attemptReconnect()
          break
          
        default:
          console.log('Unknown WebSocket message type:', data.type)
      }
    },

    // 添加新消息到群组
    addNewMessage(message) {
      const { groupId } = message
      
      // 初始化该群组的消息数组（如果不存在）
      if (!this.groupMessages[groupId]) {
        this.groupMessages[groupId] = []
      }
      
      // 检查消息是否已存在
      const existingMessageIndex = this.groupMessages[groupId].findIndex(
        msg => msg.id === message.id
      )
      
      if (existingMessageIndex === -1) {
        // 添加新消息
        this.groupMessages[groupId].push(message)
        
        // 如果不是当前群组，则增加未读计数
        if (!this.currentGroup || this.currentGroup.id !== groupId) {
          this.unreadCounts[groupId] = (this.unreadCounts[groupId] || 0) + 1
        }
      } else {
        // 更新现有消息
        this.groupMessages[groupId][existingMessageIndex] = message
      }
    },

    // 更新消息状态
    updateMessageStatus(messageId, status) {
      for (const groupId in this.groupMessages) {
        const messageIndex = this.groupMessages[groupId].findIndex(
          msg => msg.id === messageId
        )
        
        if (messageIndex !== -1) {
          this.groupMessages[groupId][messageIndex].status = status
          break
        }
      }
    },

    // 替换本地消息
    replaceLocalMessage(localId, serverMessage) {
      for (const groupId in this.groupMessages) {
        const messageIndex = this.groupMessages[groupId].findIndex(
          msg => msg.id === localId
        )
        
        if (messageIndex !== -1) {
          // 替换本地消息，保留本地状态
          this.groupMessages[groupId][messageIndex] = {
            ...serverMessage,
            status: this.groupMessages[groupId][messageIndex].status
          }
          break
        }
      }
    },

    // 处理用户加入群组
    handleUserJoined(data) {
      const { groupId, user } = data
      
      // 更新群组信息
      const group = this.groups.find(g => g.id === groupId)
      if (group) {
        // 更新群组的成员列表（如果API返回了完整成员信息）
        if (data.members) {
          group.members = data.members
        }
      }
    },

    // 处理用户离开群组
    handleUserLeft(data) {
      const { groupId, userId } = data
      
      // 更新群组信息
      const group = this.groups.find(g => g.id === groupId)
      if (group && group.members) {
        group.members = group.members.filter(member => member.id !== userId)
      }
    },

    // 处理输入状态
    handleTypingStatus(data) {
      // 这里可以实现显示"正在输入"的功能
      console.log('Typing status:', data)
    },

    // 发送输入状态
    sendTypingStatus(isTyping) {
      if (this.wsConnected && this.wsConnection && this.currentGroup) {
        this.wsConnection.send(JSON.stringify({
          type: 'typing_status',
          data: {
            groupId: this.currentGroup.id,
            isTyping: isTyping
          }
        }))
      }
    },

    // 登出时清理聊天状态
    cleanupOnLogout() {
      this.disconnectWebSocket()
      this.groups = []
      this.currentGroup = null
      this.groupMessages = {}
      this.unreadCounts = {}
      this.messageDrafts = {}
      this.error = null
    }
  }
})