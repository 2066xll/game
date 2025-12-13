import { defineStore } from 'pinia'
import axios from 'axios'
import { ApiError, ValidationError } from '../utils/ErrorHandler.js'
import ErrorHandler from '../utils/ErrorHandler.js'
import { Logger } from '../utils/Logger.js'
import ValidationUtils from '../utils/validationUtils.js'

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
        logger.info('开始初始化认证状态')
        
        const token = localStorage.getItem('auth_token')
        const userInfo = localStorage.getItem('user_info')
        
        if (!token) {
          logger.info('未找到令牌，认证状态初始化失败')
          return
        }
        
        if (!userInfo) {
          logger.info('未找到用户信息，认证状态初始化失败')
          return
        }
        
        // 解析用户信息
        const parsedUserInfo = JSON.parse(userInfo)
        
        // 验证用户信息格式和关键字段
        if (!parsedUserInfo || typeof parsedUserInfo !== 'object') {
          throw new Error('用户信息格式不正确')
        }
        
        // 确保关键用户字段存在
        if (!parsedUserInfo.id) {
          throw new Error('用户信息缺少ID字段')
        }
        
        // 如果缺少user_code或nickname，添加默认值
        const normalizedUserInfo = {
          ...parsedUserInfo,
          user_code: parsedUserInfo.user_code || '',
          nickname: parsedUserInfo.nickname || parsedUserInfo.user_code || '未知用户'
        }
        
        // 更新状态
        this.token = token
        this.user = normalizedUserInfo
        this.isAuthenticated = true
        
        // 重新保存规范化后的用户信息到本地存储
        localStorage.setItem('user_info', JSON.stringify(normalizedUserInfo))
        
        logger.info('用户认证状态初始化成功', { userId: normalizedUserInfo.id, userCode: normalizedUserInfo.user_code, nickname: normalizedUserInfo.nickname })
      } catch (error) {
        errorHandler.handleError('初始化认证状态失败', error)
        logger.error('初始化认证状态失败，错误详情:', error.message)
        this.clearAuth()
      }
    },

    // 用户注册 - 修改为接受所有必填字段
    async register(userData) {
    this.loading = true
    this.error = null
    
    try {
      logger.info('开始处理注册请求')
      logger.info('注册数据:', {
        nickname: userData.nickname,
        email: userData.email,
        password: '******' // 不记录明文密码
      })
      
      // 解构用户数据
      const { nickname, email, password } = userData
      
      // 验证必填字段（邮箱现在是可选的）
      if (!nickname || !password) {
        logger.error('注册验证失败：缺少必填字段')
        throw new ValidationError('请填写所有必填字段')
      }
      
      // 密码强度验证
      const passwordValidation = ValidationUtils.validatePassword(password);
      if (!passwordValidation.valid) {
        logger.error('注册验证失败：密码强度不足', { message: passwordValidation.message })
        throw new ValidationError(passwordValidation.message);
      }
      
      // 如果提供了邮箱，验证邮箱格式
      if (email && email.trim()) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
        if (!emailRegex.test(email)) {
          logger.error('注册验证失败：邮箱格式不正确', { email })
          throw new ValidationError('请输入有效的邮箱地址')
        }
      }
      
      // 昵称验证
      if (nickname.length < 2 || nickname.length > 30) {
        logger.error('注册验证失败：昵称长度不符合要求', { nickname })
        throw new ValidationError('昵称长度必须在2-30个字符之间')
      }
      
      logger.info('注册验证通过，准备发送请求到后端')
      
      // 发送所有必填字段到后端
      const response = await authApi.post('/register', { nickname, email, password })
      
      logger.info('后端返回响应:', response)
      
      // 响应拦截器已经直接返回了data，所以不需要再访问response.data
      const data = response
      
      // 验证返回数据格式
      if (!data || typeof data !== 'object') {
        logger.error('注册失败：后端返回数据格式不正确', { data })
        throw new Error('注册失败：后端返回数据格式不正确')
      }
      
      // 从data.data中获取所需数据，因为API响应结构是{ success: true, data: { user: {...}, userCode: "...", token: "..." } }
      const result = data.data
      
      if (!result) {
        logger.error('注册失败：后端返回数据中缺少data字段', { data })
        throw new Error('注册失败：后端返回数据中缺少data字段')
      }
      
      const userCode = result.userCode || result.user?.user_code
      
      logger.info('用户注册成功', { userCode, userId: result.user?.id, nickname: result.user?.nickname })
      return result
    } catch (error) {
      logger.error('用户注册失败', { error: error.message, stack: error.stack })
      this.error = error.message || '注册失败，请稍后重试'
      errorHandler.handleError('用户注册失败', error)
      throw error
    } finally {
      this.loading = false
      logger.info('注册流程结束')
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
        
        // 响应拦截器已经直接返回了data，所以不需要再访问response.data
        const data = response
        // 从data.data中解构token和user，因为API响应结构是{ success: true, data: { user: {...}, token: "..." } }
        const { token, user } = data.data
        
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
        const data = response
        this.user.nickname = data.data.nickname
        localStorage.setItem('user_info', JSON.stringify(this.user))
        logger.info('用户昵称更新成功', { nickname })
        return data.data
      } catch (error) {
        this.error = error.message
        errorHandler.handleError('更新用户昵称失败', error)
        throw error
      } finally {
        this.loading = false
      }
    },
    
    // 更新用户资料（通用方法）
    async updateUserProfile(profileData) {
      this.loading = true
      this.error = null
      
      try {
        const response = await authApi.put('/profile', profileData)
        const data = response
        
        // 更新用户信息
        this.user = { ...this.user, ...data.data }
        localStorage.setItem('user_info', JSON.stringify(this.user))
        
        logger.info('用户资料更新成功', { userId: this.user.id })
        return data.data
      } catch (error) {
        this.error = error.message
        errorHandler.handleError('更新用户资料失败', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    // 发送邮箱验证码
    async sendVerificationCode(email, purpose = 'bind_email') {
      this.loading = true
      this.error = null
      
      try {
        // 邮箱格式验证
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          throw new ValidationError('请输入有效的邮箱地址')
        }
        
        const response = await authApi.post('/send-verification-code', { 
          email, 
          purpose 
        })
        const data = response
        
        logger.info('验证码发送成功', { email, purpose })
        return data.data
      } catch (error) {
        this.error = error.message || '验证码发送失败，请稍后重试'
        errorHandler.handleError('发送验证码失败', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    // 绑定邮箱（支持验证码）
    async bindEmail(email, verificationCode) {
      this.loading = true
      this.error = null
      
      try {
        // 邮箱格式验证
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          throw new ValidationError('请输入有效的邮箱地址')
        }
        
        // 验证码验证
        if (!verificationCode) {
          throw new ValidationError('请输入验证码')
        }
        
        // 使用更新的API端点，包含验证码参数
        const response = await authApi.put('/users/me/email', { 
          email, 
          verificationCode 
        })
        
        const data = response
        
        // 更新用户信息
        this.user.email = data.data.email || email
        localStorage.setItem('user_info', JSON.stringify(this.user))
        
        logger.info('邮箱绑定成功', { email, userId: this.user.id })
        return data.data
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
      if (!this.token) {
        logger.info('未找到令牌，无法获取用户信息')
        return null
      }
      
      this.loading = true
      this.error = null
      
      try {
        logger.info('开始获取用户信息')
        const response = await authApi.get('/me')
        const data = response
        
        // 验证返回数据格式
        if (!data.data || typeof data.data !== 'object') {
          throw new Error('获取的用户信息格式不正确')
        }
        
        // 更新用户信息
        this.user = data.data
        localStorage.setItem('user_info', JSON.stringify(this.user))
        logger.info('获取用户信息成功', { userId: this.user.id, userCode: this.user.user_code, nickname: this.user.nickname })
        return this.user
      } catch (error) {
        errorHandler.handleError('获取用户信息失败', error)
        logger.error('获取用户信息失败，错误详情:', error.message)
        
        // 如果获取失败，使用本地存储的用户信息，而不是清除认证状态
        if (this.user) {
          logger.info('使用本地存储的用户信息', { userId: this.user.id, userCode: this.user.user_code, nickname: this.user.nickname })
          return this.user
        } else {
          logger.warn('本地也未找到用户信息')
          return null
        }
      } finally {
        this.loading = false
      }
    },
    
    // 获取当前用户信息（别名，兼容旧代码）
    async getCurrentUser() {
      return this.getCurrentUserInfo()
    },
    
    // 解绑邮箱
    async unbindEmail() {
      this.loading = true
      this.error = null
      
      try {
        const response = await authApi.post('/unbind-email')
        const data = response
        
        // 更新用户信息
        this.user.email = null
        localStorage.setItem('user_info', JSON.stringify(this.user))
        
        logger.info('邮箱解绑成功', { userId: this.user.id })
        return data.data
      } catch (error) {
        this.error = error.message || '邮箱解绑失败，请稍后重试'
        errorHandler.handleError('解绑邮箱失败', error)
        throw error
      } finally {
        this.loading = false
      }
    },
    
    // 验证用户编码是否存在
    async checkUserCodeExists(userCode) {
      try {
        const response = await authApi.get(`/check-user-code/${userCode}`)
        const data = response
        return data.data.exists
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
      const passwordValidation = ValidationUtils.validatePassword(newPassword);
      if (!passwordValidation.valid) {
        throw new ValidationError(passwordValidation.message.replace('密码', '新密码'));
      }
        
        // 避免使用与当前密码相同的新密码
        if (currentPassword === newPassword) {
          throw new ValidationError('新密码不能与当前密码相同')
        }
        
        const response = await authApi.post('/change-password', {
          currentPassword,
          newPassword
        })
        
        const data = response
        
        // 密码修改成功后可以考虑刷新令牌
        try {
          await this.refreshToken()
        } catch (refreshError) {
          logger.warn('密码修改后刷新令牌失败', refreshError)
          // 不阻止主流程
        }
        
        logger.info('密码修改成功', { userId: this.user?.id })
        return data.data
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
        const data = response
        
        // 更新令牌
        this.token = data.data.token
        localStorage.setItem('auth_token', this.token)
        
        logger.info('令牌刷新成功')
        return data.data
      } catch (error) {
        this.error = error.message
        errorHandler.handleError('刷新令牌失败', error)
        // 如果刷新失败，清除本地状态
        this.clearAuth()
        throw error
      } finally {
        this.loading = false
      }
    },
    
    // 删除账号
    async deleteAccount(password) {
      this.loading = true
      this.error = null
      
      try {
        const response = await authApi.post('/delete-account', { password })
        const data = response
        
        // 清除本地认证状态
        this.clearAuth()
        
        logger.info('账号删除成功', { userId: this.user?.id })
        return data.data
      } catch (error) {
        this.error = error.message
        errorHandler.handleError('删除账号失败', error)
        throw error
      } finally {
        this.loading = false
      }
    }
  }
})