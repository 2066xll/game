<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/authStore'
import ValidationUtils from '../utils/validationUtils'

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
const successMessage = ref('')
const isRemember = ref(false)
const showPassword = ref(false) // 密码可见性切换

// 忘记密码相关状态
const isForgotPassword = ref(false)
const resetEmail = ref('')
const resetCode = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const resetStep = ref(1) // 1: 输入邮箱, 2: 输入验证码, 3: 重置密码
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

// 切换登录方式
function toggleLoginType() {
  loginType.value = loginType.value === 'code' ? 'email' : 'code'
  errorMessage.value = ''
}

// 表单验证
function validateForm() {
  errorMessage.value = ''
  
  // 使用新的验证工具进行登录验证
  const validationResult = ValidationUtils.validateLogin(
    loginType.value === 'email' ? formData.email : '',
    formData.password,
    loginType.value === 'code' ? formData.userCode : ''
  )
  
  if (!validationResult.valid) {
    errorMessage.value = validationResult.message
    return false
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

// 忘记密码处理
function handleForgotPassword() {
  isForgotPassword.value = true
  resetStep.value = 1
  errorMessage.value = ''
  successMessage.value = ''
}

// 取消密码重置
function cancelForgotPassword() {
  isForgotPassword.value = false
  resetEmail.value = ''
  resetCode.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  resetStep.value = 1
  errorMessage.value = ''
  successMessage.value = ''
}

// 发送密码重置验证码
async function sendResetCode() {
  errorMessage.value = ''
  successMessage.value = ''
  
  // 验证邮箱格式
  const emailValidation = ValidationUtils.validateEmail(resetEmail.value)
  if (!emailValidation.valid) {
    errorMessage.value = emailValidation.message
    return
  }
  
  isSubmitting.value = true
  
  try {
    await authStore.sendPasswordResetCode({
      email: resetEmail.value.trim()
    })
    
    successMessage.value = '重置验证码已发送到您的邮箱'
    resetStep.value = 2
  } catch (error) {
    errorMessage.value = error.message || '发送验证码失败，请稍后重试'
  } finally {
    isSubmitting.value = false
  }
}

// 验证重置验证码
async function verifyResetCode() {
  errorMessage.value = ''
  
  if (!resetCode.value) {
    errorMessage.value = '请输入验证码'
    return
  }
  
  isSubmitting.value = true
  
  try {
    await authStore.verifyPasswordResetCode({
      email: resetEmail.value.trim(),
      code: resetCode.value.trim()
    })
    
    resetStep.value = 3
    errorMessage.value = ''
    successMessage.value = ''
  } catch (error) {
    errorMessage.value = error.message || '验证码无效或已过期'
  } finally {
    isSubmitting.value = false
  }
}

// 重置密码
async function resetPassword() {
  errorMessage.value = ''
  
  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = '两次输入的密码不一致'
    return
  }
  
  // 验证密码强度
  const passwordValidation = ValidationUtils.validatePassword(newPassword.value)
  if (!passwordValidation.valid) {
    errorMessage.value = passwordValidation.message
    return
  }
  
  isSubmitting.value = true
  
  try {
    await authStore.resetPassword({
      email: resetEmail.value.trim(),
      code: resetCode.value.trim(),
      newPassword: newPassword.value
    })
    
    successMessage.value = '密码重置成功'
    
    // 3秒后跳转到登录表单
    setTimeout(() => {
      cancelForgotPassword()
    }, 3000)
  } catch (error) {
    errorMessage.value = error.message || '重置密码失败，请稍后重试'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="login-title">登录游戏平台</h1>
      <p class="login-subtitle">欢迎回来，请输入您的账号信息</p>
      
      <!-- 成功消息 -->
      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
      </div>
      
      <!-- 错误消息 -->
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
      
      <!-- 登录表单 -->
      <form v-if="!isForgotPassword" @submit.prevent="handleLogin" class="login-form">
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
          <div class="password-input-container">
            <input
              :type="showPassword ? 'text' : 'password'"
              id="password"
              v-model="formData.password"
              placeholder="请输入您的密码"
              class="form-input password-input"
              :disabled="isSubmitting"
              required
            />
            <button
              type="button"
              class="toggle-password-btn"
              @click="showPassword = !showPassword"
              :disabled="isSubmitting"
              aria-label="切换密码可见性"
            >
              {{ showPassword ? '隐藏' : '显示' }}
            </button>
          </div>
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
      <div v-if="!isForgotPassword" class="third-party-login">
        <button type="button" class="third-party-btn" disabled>
          <span class="btn-text">其他登录方式开发中...</span>
        </button>
      </div>
      
      <!-- 忘记密码表单 -->
      <div v-if="isForgotPassword" class="forgot-password-form">
        <h2 class="reset-title">重置密码</h2>
        
        <!-- 步骤指示器 -->
        <div class="reset-steps">
          <div class="step-item" :class="{ active: resetStep >= 1 }">1</div>
          <div class="step-line" :class="{ active: resetStep >= 2 }"></div>
          <div class="step-item" :class="{ active: resetStep >= 2 }">2</div>
          <div class="step-line" :class="{ active: resetStep >= 3 }"></div>
          <div class="step-item" :class="{ active: resetStep >= 3 }">3</div>
        </div>
        
        <!-- 步骤1: 输入邮箱 -->
        <div v-if="resetStep === 1" class="reset-step">
          <div class="form-group">
            <label for="resetEmail" class="form-label">邮箱地址</label>
            <input
              type="email"
              id="resetEmail"
              v-model="resetEmail"
              placeholder="请输入您的注册邮箱"
              class="form-input"
              :disabled="isSubmitting"
              required
            />
          </div>
          <div class="reset-buttons">
            <button
              type="button"
              class="cancel-btn"
              @click="cancelForgotPassword"
              :disabled="isSubmitting"
            >
              取消
            </button>
            <button
              type="button"
              class="login-button"
              @click="sendResetCode"
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? '发送中...' : '发送验证码' }}
            </button>
          </div>
        </div>
        
        <!-- 步骤2: 输入验证码 -->
        <div v-if="resetStep === 2" class="reset-step">
          <div class="form-group">
            <label for="resetCode" class="form-label">验证码</label>
            <input
              type="text"
              id="resetCode"
              v-model="resetCode"
              placeholder="请输入收到的验证码"
              class="form-input"
              :disabled="isSubmitting"
              required
              maxlength="6"
            />
          </div>
          <div class="reset-buttons">
            <button
              type="button"
              class="cancel-btn"
              @click="cancelForgotPassword"
              :disabled="isSubmitting"
            >
              取消
            </button>
            <button
              type="button"
              class="login-button"
              @click="verifyResetCode"
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? '验证中...' : '验证验证码' }}
            </button>
          </div>
        </div>
        
        <!-- 步骤3: 重置密码 -->
        <div v-if="resetStep === 3" class="reset-step">
          <div class="form-group">
            <label for="newPassword" class="form-label">新密码</label>
            <div class="password-input-container">
              <input
                :type="showNewPassword ? 'text' : 'password'"
                id="newPassword"
                v-model="newPassword"
                placeholder="请输入新密码"
                class="form-input password-input"
                :disabled="isSubmitting"
                required
              />
              <button
                type="button"
                class="toggle-password-btn"
                @click="showNewPassword = !showNewPassword"
                :disabled="isSubmitting"
                aria-label="切换密码可见性"
              >
                {{ showNewPassword ? '隐藏' : '显示' }}
              </button>
            </div>
          </div>
          <div class="form-group">
            <label for="confirmPassword" class="form-label">确认新密码</label>
            <div class="password-input-container">
              <input
                :type="showConfirmPassword ? 'text' : 'password'"
                id="confirmPassword"
                v-model="confirmPassword"
                placeholder="请再次输入新密码"
                class="form-input password-input"
                :disabled="isSubmitting"
                required
              />
              <button
                type="button"
                class="toggle-password-btn"
                @click="showConfirmPassword = !showConfirmPassword"
                :disabled="isSubmitting"
                aria-label="切换密码可见性"
              >
                {{ showConfirmPassword ? '隐藏' : '显示' }}
              </button>
            </div>
          </div>
          <div class="reset-buttons">
            <button
              type="button"
              class="cancel-btn"
              @click="cancelForgotPassword"
              :disabled="isSubmitting"
            >
              取消
            </button>
            <button
              type="button"
              class="login-button"
              @click="resetPassword"
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? '重置中...' : '重置密码' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%);
  position: relative;
  overflow: hidden;
}

/* 背景装饰元素 */
.login-container::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -50%;
  width: 300%;
  height: 300%;
  background: radial-gradient(circle, rgba(66, 133, 244, 0.1) 0%, transparent 70%);
  animation: rotate 20s linear infinite;
  z-index: 0;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.login-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 2.5rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  z-index: 1;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.login-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.25);
}

.login-title {
  font-size: 2.25rem;
  font-weight: 700;
  background: linear-gradient(90deg, #4285F4, #34A853);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: transparent;
  margin-bottom: 0.75rem;
  text-align: center;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  letter-spacing: -0.5px;
}

.login-subtitle {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  margin-bottom: 2.5rem;
  opacity: 0.9;
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
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
}

.toggle-btn {
  flex: 1;
  padding: 0.875rem;
  background-color: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
  position: relative;
}

.toggle-btn.active {
  background: linear-gradient(135deg, #4285F4 0%, #34A853 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
}

.toggle-btn:hover:not(:active):not(:disabled) {
  background-color: rgba(255, 255, 255, 0.08);
  color: white;
}

.toggle-btn.active:hover:not(:disabled) {
  opacity: 0.95;
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
  padding: 0.875rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 1rem;
  background-color: rgba(255, 255, 255, 0.05);
  color: white;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.form-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.form-input:focus {
  outline: none;
  border-color: #4285F4;
  box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.2);
  background-color: rgba(255, 255, 255, 0.08);
}

.form-input:not(:placeholder-shown):valid {
  background-color: rgba(255, 255, 255, 0.08);
}

.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.password-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input {
  padding-right: 80px;
}

.toggle-password-btn {
  position: absolute;
  right: 0.75rem;
  background: none;
  border: none;
  color: var(--accent-color);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.5rem;
}

.toggle-password-btn:hover:not(:disabled) {
  text-decoration: underline;
}

.toggle-password-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.login-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.remember-me {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  transition: color 0.3s ease;
}

.remember-me:hover {
  color: white;
}

.remember-me input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #4285F4;
  cursor: pointer;
}

.forgot-password {
  background: none;
  border: none;
  color: #4285F4;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0;
  transition: all 0.3s ease;
  font-weight: 500;
}

.forgot-password:hover {
  color: #5a95f5;
  text-decoration: underline;
  transform: translateX(2px);
}

.login-button {
  background: linear-gradient(135deg, #4285F4 0%, #34A853 100%);
  color: white;
  padding: 0.875rem 1rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.login-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s ease;
}

.login-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(66, 133, 244, 0.4);
}

.login-button:hover:not(:disabled)::before {
  left: 100%;
}

.login-button:active:not(:disabled) {
  transform: translateY(0);
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.register-link {
  text-align: center;
  margin-top: 1.5rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.95rem;
}

.link-button {
  background: none;
  border: none;
  color: #34A853;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  margin-left: 0.25rem;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.link-button::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 2px;
  background: #34A853;
  transition: width 0.3s ease;
}

.link-button:hover {
  color: #48b963;
}

.link-button:hover::after {
  width: 100%;
}

.divider {
  display: flex;
  align-items: center;
  margin: 2rem 0;
  position: relative;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
}

.divider span {
  padding: 0 1rem;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9rem;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 0.25rem 0.75rem;
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

/* 成功消息样式 */
.success-message {
  background-color: rgba(52, 211, 153, 0.1);
  border: 1px solid #34d399;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  color: #166534;
}

/* 忘记密码表单样式 */
.forgot-password-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.reset-title {
  font-size: 1.75rem;
  font-weight: 700;
  background: linear-gradient(90deg, #4285F4, #34A853);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: transparent;
  text-align: center;
  margin-bottom: 0.5rem;
}

/* 步骤指示器样式 */
.reset-steps {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 1.5rem 0;
  gap: 1rem;
}

.step-item {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  transition: all 0.3s ease;
}

.step-item.active {
  background: linear-gradient(135deg, #4285F4 0%, #34A853 100%);
  color: white;
  transform: scale(1.1);
}

.step-line {
  height: 2px;
  flex: 1;
  max-width: 60px;
  background-color: rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.step-line.active {
  background: linear-gradient(90deg, #4285F4, #34A853);
}

/* 重置步骤样式 */
.reset-step {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* 重置按钮组样式 */
.reset-buttons {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.cancel-btn {
  flex: 1;
  padding: 0.875rem;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
}

.cancel-btn:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
}

.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  
  .reset-steps {
    gap: 0.5rem;
  }
  
  .step-line {
    max-width: 40px;
  }
  
  .reset-buttons {
    flex-direction: column;
  }
}
</style>