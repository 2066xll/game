<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/authStore'

const router = useRouter()
const authStore = useAuthStore()

// 登录方式
const loginType = ref('code') // 'code' 或 'email'

// 表单数据
const formData = reactive({
  userCode: '',
  email: '',
  password: ''
})

// 响应状态
const isSubmitting = ref(false)
const errorMessage = ref('')
const isRemember = ref(false)

// 切换登录方式
function toggleLoginType() {
  loginType.value = loginType.value === 'code' ? 'email' : 'code'
  errorMessage.value = ''
}

// 表单验证
function validateForm() {
  errorMessage.value = ''
  
  // 检查密码
  if (!formData.password) {
    errorMessage.value = '请输入密码'
    return false
  }
  
  // 根据登录方式验证
  if (loginType.value === 'code') {
    if (!formData.userCode) {
      errorMessage.value = '请输入用户编码'
      return false
    }
    
    // 验证用户编码格式（假设是数字和字母的组合）
    if (!/^[A-Za-z0-9]+$/.test(formData.userCode)) {
      errorMessage.value = '用户编码格式不正确'
      return false
    }
  } else {
    if (!formData.email) {
      errorMessage.value = '请输入邮箱地址'
      return false
    }
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      errorMessage.value = '邮箱地址格式不正确'
      return false
    }
  }
  
  return true
}

// 处理登录提交
async function handleLogin() {
  if (!validateForm()) return
  
  isSubmitting.value = true
  errorMessage.value = ''
  
  try {
    const credentials = loginType.value === 'code' 
      ? { userCode: formData.userCode, password: formData.password }
      : { email: formData.email, password: formData.password }
    
    await authStore.login(credentials, isRemember.value)
    
    // 登录成功后跳转到首页
    router.push('/')
  } catch (error) {
    errorMessage.value = error.message || '登录失败，请检查账号和密码'
  } finally {
    isSubmitting.value = false
  }
}

// 跳转到注册页
function goToRegister() {
  router.push('/register')
}

// 忘记密码（暂时只显示提示）
function handleForgotPassword() {
  errorMessage.value = '忘记密码功能即将上线，请联系客服获取帮助'
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="login-title">登录游戏平台</h1>
      <p class="login-subtitle">欢迎回来，请输入您的账号信息</p>
      
      <!-- 错误消息 -->
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
      
      <!-- 登录表单 -->
      <form @submit.prevent="handleLogin" class="login-form">
        <!-- 登录方式切换 -->
        <div class="login-type-toggle">
          <button 
            type="button" 
            class="toggle-btn" 
            :class="{ active: loginType === 'code' }"
            @click="toggleLoginType"
          >
            用户编码
          </button>
          <button 
            type="button" 
            class="toggle-btn" 
            :class="{ active: loginType === 'email' }"
            @click="toggleLoginType"
          >
            邮箱登录
          </button>
        </div>
        
        <!-- 用户编码输入 -->
        <div v-if="loginType === 'code'" class="form-group">
          <label for="userCode" class="form-label">用户编码</label>
          <input
            type="text"
            id="userCode"
            v-model="formData.userCode"
            placeholder="请输入您的用户编码"
            class="form-input"
            :disabled="isSubmitting"
            required
          />
        </div>
        
        <!-- 邮箱输入 -->
        <div v-else class="form-group">
          <label for="email" class="form-label">邮箱地址</label>
          <input
            type="email"
            id="email"
            v-model="formData.email"
            placeholder="请输入您的邮箱地址"
            class="form-input"
            :disabled="isSubmitting"
            required
          />
        </div>
        
        <!-- 密码输入 -->
        <div class="form-group">
          <label for="password" class="form-label">密码</label>
          <input
            type="password"
            id="password"
            v-model="formData.password"
            placeholder="请输入您的密码"
            class="form-input"
            :disabled="isSubmitting"
            required
          />
        </div>
        
        <!-- 记住我和忘记密码 -->
        <div class="login-options">
          <label class="remember-me">
            <input
              type="checkbox"
              v-model="isRemember"
              :disabled="isSubmitting"
            />
            <span>记住我</span>
          </label>
          <button 
            type="button" 
            class="forgot-password"
            @click="handleForgotPassword"
          >
            忘记密码？
          </button>
        </div>
        
        <!-- 登录按钮 -->
        <button
          type="submit"
          class="login-button"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? '登录中...' : '登录' }}
        </button>
      </form>
      
      <!-- 注册链接 -->
      <div class="register-link">
        还没有账号？
        <button type="button" @click="goToRegister" class="link-button">立即注册</button>
      </div>
      
      <!-- 分隔线 -->
      <div class="divider">
        <span>或</span>
      </div>
      
      <!-- 第三方登录（占位符） -->
      <div class="third-party-login">
        <button type="button" class="third-party-btn" disabled>
          <span class="btn-text">其他登录方式开发中...</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.login-card {
  background-color: var(--bg-primary);
  border-radius: 12px;
  padding: 2.5rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);
}

.login-title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  text-align: center;
}

.login-subtitle {
  font-size: 1rem;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 2rem;
}

.error-message {
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid #ef4444;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  color: #b91c1c;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.login-type-toggle {
  display: flex;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.toggle-btn {
  flex: 1;
  padding: 0.75rem;
  background-color: var(--bg-secondary);
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.toggle-btn.active {
  background-color: var(--accent-color);
  color: white;
}

.toggle-btn:hover:not(:active):not(:disabled) {
  background-color: var(--bg-hover);
}

.toggle-btn.active:hover:not(:disabled) {
  background-color: #2563eb;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
}

.form-input {
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 1rem;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.remember-me {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.forgot-password {
  background: none;
  border: none;
  color: var(--accent-color);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0;
}

.forgot-password:hover {
  text-decoration: underline;
}

.login-button {
  background-color: var(--accent-color);
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
}

.login-button:hover:not(:disabled) {
  background-color: #2563eb;
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.register-link {
  text-align: center;
  margin-top: 1.5rem;
  color: var(--text-secondary);
}

.link-button {
  background: none;
  border: none;
  color: var(--accent-color);
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  margin-left: 0.25rem;
}

.link-button:hover {
  text-decoration: underline;
}

.divider {
  display: flex;
  align-items: center;
  margin: 2rem 0;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background-color: var(--border-color);
}

.divider span {
  padding: 0 1rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.third-party-login {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.third-party-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: not-allowed;
  opacity: 0.7;
}

.btn-text {
  font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .login-container {
    padding: 1rem;
  }
  
  .login-card {
    padding: 1.5rem;
  }
  
  .login-title {
    font-size: 1.75rem;
  }
}
</style>