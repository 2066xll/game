import { defineStore } from 'pinia'
import axios from 'axios'
import { useAuthStore } from './authStore'

// 获取API基础URL，优先使用环境变量，其次使用默认值
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'

// 创建axios实例
const chatApi = axios.create({
  baseURL: `${API_BASE_URL}/api/chat`,
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
    messageDrafts: {} // 每个群组的消息草稿 { groupId: draftText }
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
        const groups = await chatApi.get('/groups')
        this.groups = groups
        
        // 初始化每个群组的未读消息数
        groups.forEach(group => {
          if (!this.unreadCounts[group.id]) {
            this.unreadCounts[group.id] = 0
          }
        })
        
        return groups
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
        const messages = await chatApi.get(`/groups/${groupId}/messages`, {
          params: { limit, offset }
        })
        
        // 初始化该群组的消息数组（如果不存在）
        if (!this.groupMessages[groupId]) {
          this.groupMessages[groupId] = []
        }
        
        // 如果是首次加载或重置，直接替换消息数组
        if (offset === 0) {
          this.groupMessages[groupId] = messages
        } else {
          // 否则追加到现有消息的前面（历史消息）
          this.groupMessages[groupId] = [...messages, ...this.groupMessages[groupId]]
        }
        
        // 清除未读消息计数
        if (this.currentGroup && this.currentGroup.id === groupId) {
          this.unreadCounts[groupId] = 0
          await this.markAsRead(groupId)
        }
        
        return messages
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

    // 发送消息到当前群组
    async sendMessage(content) {
      if (!this.currentGroup || !content.trim()) {
        return
      }
      
      try {
        const messageData = {
          content: content.trim(),
          groupId: this.currentGroup.id
        }
        
        // 通过WebSocket发送消息
        if (this.wsConnected && this.wsConnection) {
          this.wsConnection.send(JSON.stringify({
            type: 'send_message',
            data: messageData
          }))
        } else {
          // 如果WebSocket未连接，通过HTTP API发送
          await chatApi.post('/messages', messageData)
          // 手动添加消息到本地状态
          await this.fetchGroupMessages(this.currentGroup.id, 50, 0)
        }
        
        // 清除草稿
        this.clearDraft(this.currentGroup.id)
        
        return true
      } catch (error) {
        this.setError('发送消息失败')
        throw error
      }
    },

    // 创建新的聊天群组
    async createGroup(groupName, userIds = []) {
      try {
        this.isLoading = true
        const newGroup = await chatApi.post('/groups', {
          name: groupName,
          userIds: [...userIds]
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
        const token = authStore.token
        if (!token) {
          console.warn('No auth token available, cannot connect to WebSocket')
          return
        }
        
        // WebSocket URL（将http替换为ws）
        const wsProtocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws'
        const wsUrl = `${wsProtocol}://${API_BASE_URL.replace(/^https?:\/\//, '')}/ws`
        
        this.wsConnection = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`)
        
        // WebSocket事件处理
        this.wsConnection.onopen = () => {
          console.log('WebSocket connected')
          this.wsConnected = true
          this.wsReconnectAttempts = 0
          
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
          }
        }
        
        this.wsConnection.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.wsConnected = false
        }
        
        this.wsConnection.onclose = () => {
          console.log('WebSocket disconnected')
          this.wsConnected = false
          this.attemptReconnect()
        }
      } catch (error) {
        console.error('WebSocket connection error:', error)
        this.wsConnected = false
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
          this.addNewMessage(data.data)
          break
          
        case 'message_delivered':
          this.updateMessageStatus(data.data.messageId, 'delivered')
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
            isTyping
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