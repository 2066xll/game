import { defineStore } from 'pinia'
import axios from 'axios'
import { ApiError, ValidationError } from '../utils/ErrorHandler.js'
import ErrorHandler from '../utils/ErrorHandler.js'
import { Logger } from '../utils/Logger.js'

const logger = new Logger('AuthStore')
const errorHandler = ErrorHandler

// 从环境变量获取API基础URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/auth'

// 创建axios实例
const authApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器 - 添加token
authApi.interceptors.request.use(
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

// 响应拦截器 - 处理错误和token过期
authApi.interceptors.response.use(
  (response) => {
    // 直接返回data部分，简化使用
    return response.data
  },
  (error) => {
    if (error.response?.status === 401) {
      // token过期，清除本地存储并跳转到登录页
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_info')
      window.location.href = '/login'
    }
    // 提取错误信息
    const errorMessage = error.response?.data?.message || 
                        error.message || 
                        '操作失败，请稍后重试'
    
    return Promise.reject(new Error(errorMessage))
  }
)

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: null,
    isAuthenticated: false,
    loading: false,
    error: null
  }),

  getters: {
    // 获取用户ID
    userId: (state) => state.user?.id,
    
    // 获取用户编码
    userCode: (state) => state.user?.user_code,
    
    // 获取用户昵称
    nickname: (state) => state.user?.nickname || state.user?.user_code,
    
    // 是否已绑定邮箱
    hasEmail: (state) => !!state.user?.email
  },

  actions: {
    // 初始化认证状态
    initAuth() {
      try {
        const token = localStorage.getItem('auth_token')
        const userInfo = localStorage.getItem('user_info')
        
        if (token && userInfo) {
          this.token = token
          this.user = JSON.parse(userInfo)
          this.isAuthenticated = true
          logger.info('用户认证状态已初始化')
        }
      } catch (error) {
        errorHandler.handleError('初始化认证状态失败', error)
        this.clearAuth()
      }
    },

    // 用户注册
    async register(password) {
      this.loading = true
      this.error = null
      
      try {
        // 密码强度验证
        if (!password || password.length < 8) {
          throw new ValidationError('密码长度至少为8位')
        }
        
        if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/.test(password)) {
          throw new ValidationError('密码必须包含字母和数字')
        }
        
        const response = await authApi.post('/register', { password })
        // 确保返回正确的数据格式
        const data = response.data || response
        
        logger.info('用户注册成功', { userCode: data.userCode || data.user?.user_code })
        return data
      } catch (error) {
        this.error = error.message || '注册失败，请稍后重试'
        errorHandler.handleError('用户注册失败', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    // 用户登录（支持用户编码或邮箱登录）
    async login(identifier, password) {
      this.loading = true
      this.error = null
      
      try {
        // 输入验证
        if (!identifier || !password) {
          throw new ValidationError('请输入用户名/邮箱和密码')
        }
        
        // 区分登录方式（用户编码为6位数字，邮箱包含@符号）
        const loginData = {
          identifier,
          password,
          loginType: /^\d{6}$/.test(identifier) ? 'user_code' : 'email'
        }
        
        const response = await authApi.post('/login', loginData)
        
        // 确保响应数据格式正确
        const data = response.data || response
        const { token, user } = data
        
        // 安全保存到本地存储
        localStorage.setItem('auth_token', token)
        localStorage.setItem('user_info', JSON.stringify(user))
        
        // 更新状态
        this.token = token
        this.user = user
        this.isAuthenticated = true
        
        logger.info('用户登录成功', { userId: user.id, userCode: user.user_code, loginType: loginData.loginType })
        return user
      } catch (error) {
        this.error = error.message || '登录失败，请稍后重试'
        errorHandler.handleError('用户登录失败', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    // 用户登出
    logout() {
      // 清除本地存储
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_info')
      
      // 清除状态
      this.token = null
      this.user = null
      this.isAuthenticated = false
      this.error = null
      
      logger.info('用户已登出')
    },

    // 清除认证信息
    clearAuth() {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_info')
      this.token = null
      this.user = null
      this.isAuthenticated = false
      this.error = null
    },

    // 更新用户昵称
    async updateNickname(nickname) {
      this.loading = true
      this.error = null
      
      try {
        const response = await authApi.put('/profile', { nickname })
        const data = response.data || response
        this.user.nickname = data.nickname
        localStorage.setItem('user_info', JSON.stringify(this.user))
        logger.info('用户昵称更新成功', { nickname })
        return data
      } catch (error) {
        this.error = error.message
        errorHandler.handleError('更新用户昵称失败', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    // 绑定邮箱
    async bindEmail(email) {
      this.loading = true
      this.error = null
      
      try {
        // 邮箱格式验证
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          throw new ValidationError('请输入有效的邮箱地址')
        }
        
        const response = await authApi.put('/email', { email })
        const data = response.data || response
        
        // 更新用户信息
        this.user.email = data.email || email
        localStorage.setItem('user_info', JSON.stringify(this.user))
        
        logger.info('邮箱绑定成功', { email, userId: this.user.id })
        return data
      } catch (error) {
        this.error = error.message || '邮箱绑定失败，请稍后重试'
        errorHandler.handleError('绑定邮箱失败', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    // 获取当前用户信息
    async getCurrentUserInfo() {
      if (!this.token) return null
      
      this.loading = true
      this.error = null
      
      try {
        const response = await authApi.get('/me')
        const userData = response.data || response
        this.user = userData
        localStorage.setItem('user_info', JSON.stringify(this.user))
        logger.info('获取用户信息成功', { userId: this.user.id })
        return this.user
      } catch (error) {
        errorHandler.handleError('获取用户信息失败', error)
        // 如果获取失败，清除认证状态
        this.clearAuth()
        return null
      } finally {
        this.loading = false
      }
    },

    // 验证用户编码是否存在
    async checkUserCodeExists(userCode) {
      try {
        const response = await authApi.get(`/check-user-code/${userCode}`)
        const data = response.data || response
        return data.exists
      } catch (error) {
        errorHandler.handleError('验证用户编码失败', error)
        return false
      }
    },
    
    // 修改密码
    async changePassword(currentPassword, newPassword) {
      this.loading = true
      this.error = null
      
      try {
        // 输入验证
        if (!currentPassword || !newPassword) {
          throw new ValidationError('请输入当前密码和新密码')
        }
        
        // 新密码强度验证
        if (newPassword.length < 8) {
          throw new ValidationError('新密码长度至少为8位')
        }
        
        if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/.test(newPassword)) {
          throw new ValidationError('新密码必须包含字母和数字')
        }
        
        // 避免使用与当前密码相同的新密码
        if (currentPassword === newPassword) {
          throw new ValidationError('新密码不能与当前密码相同')
        }
        
        const response = await authApi.post('/change-password', {
          currentPassword,
          newPassword
        })
        
        const data = response.data || response
        
        // 密码修改成功后可以考虑刷新令牌
        try {
          await this.refreshToken()
        } catch (refreshError) {
          logger.warn('密码修改后刷新令牌失败', refreshError)
          // 不阻止主流程
        }
        
        logger.info('密码修改成功', { userId: this.user?.id })
        return data
      } catch (error) {
        this.error = error.message || '密码修改失败，请稍后重试'
        errorHandler.handleError('修改密码失败', error)
        throw error
      } finally {
        this.loading = false
      }
    },
    
    // 刷新令牌
    async refreshToken() {
      if (!this.token) throw new Error('用户未登录')
      
      this.loading = true
      this.error = null
      
      try {
        const response = await authApi.post('/refresh')
        const data = response.data || response
        
        // 更新令牌
        this.token = data.token
        localStorage.setItem('auth_token', this.token)
        
        logger.info('令牌刷新成功')
        return data
      } catch (error) {
        this.error = error.message
        errorHandler.handleError('刷新令牌失败', error)
        // 如果刷新失败，清除本地状态
        this.clearAuth()
        throw error
      } finally {
        this.loading = false
      }
    }
  }
})