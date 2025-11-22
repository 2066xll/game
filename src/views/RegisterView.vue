<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/authStore'

const router = useRouter()
const authStore = useAuthStore()

// 表单数据
const formData = reactive({
  password: '',
  confirmPassword: ''
})

// 响应状态
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const userCode = ref('')

// 密码强度检查
const passwordStrength = ref(0)
const passwordStrengthText = ref('')
const strengthColors = ['text-red-500', 'text-orange-500', 'text-yellow-500', 'text-green-500']

// 检查密码强度
function checkPasswordStrength(password) {
  let strength = 0
  
  // 长度检查
  if (password.length >= 8) strength++
  if (password.length >= 12) strength++
  
  // 复杂度检查
  if (/[A-Z]/.test(password)) strength++
  if (/[a-z]/.test(password)) strength++
  if (/[0-9]/.test(password)) strength++
  if (/[^A-Za-z0-9]/.test(password)) strength++
  
  // 归一化到0-3的范围
  const normalizedStrength = Math.min(3, Math.floor(strength / 2))
  passwordStrength.value = normalizedStrength
  
  // 设置强度文本
  const strengthTexts = ['弱', '一般', '中等', '强']
  passwordStrengthText.value = strengthTexts[normalizedStrength]
}

// 表单验证
function validateForm() {
  errorMessage.value = ''
  
  // 密码长度检查
  if (!formData.password) {
    errorMessage.value = '请设置密码'
    return false
  }
  
  if (formData.password.length < 8) {
    errorMessage.value = '密码长度至少为8个字符'
    return false
  }
  
  // 密码复杂度检查
  if (!/[A-Za-z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
    errorMessage.value = '密码必须包含字母和数字'
    return false
  }
  
  // 确认密码检查
  if (formData.password !== formData.confirmPassword) {
    errorMessage.value = '两次输入的密码不一致'
    return false
  }
  
  return true
}

// 处理密码输入变化
function handlePasswordInput() {
  checkPasswordStrength(formData.password)
  if (formData.confirmPassword && formData.password !== formData.confirmPassword) {
    errorMessage.value = '两次输入的密码不一致'
  } else {
    errorMessage.value = ''
  }
}

// 处理确认密码输入变化
function handleConfirmPasswordInput() {
  if (formData.password !== formData.confirmPassword) {
    errorMessage.value = '两次输入的密码不一致'
  } else {
    errorMessage.value = ''
  }
}

// 处理注册提交
async function handleRegister() {
  if (!validateForm()) return
  
  isSubmitting.value = true
  errorMessage.value = ''
  
  try {
    const result = await authStore.register(formData.password)
    userCode.value = result.userCode
    successMessage.value = '注册成功！您的用户编码是：' + result.userCode
    
    // 清空表单
    formData.password = ''
    formData.confirmPassword = ''
    passwordStrength.value = 0
    passwordStrengthText.value = ''
    
    // 3秒后跳转到登录页
    setTimeout(() => {
      router.push('/login')
    }, 3000)
  } catch (error) {
    errorMessage.value = error.message || '注册失败，请稍后重试'
  } finally {
    isSubmitting.value = false
  }
}

// 跳转到登录页
function goToLogin() {
  router.push('/login')
}
</script>

<template>
  <div class="register-container">
    <div class="register-card">
      <h1 class="register-title">创建账号</h1>
      <p class="register-subtitle">设置密码后，我们将为您生成唯一的用户编码</p>
      
      <!-- 成功消息 -->
      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
        <p class="redirect-notice">3秒后将自动跳转到登录页...</p>
      </div>
      
      <!-- 错误消息 -->
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
      
      <!-- 注册表单 -->
      <form v-if="!successMessage" @submit.prevent="handleRegister" class="register-form">
        <!-- 密码输入 -->
        <div class="form-group">
          <label for="password" class="form-label">设置密码</label>
          <input
            type="password"
            id="password"
            v-model="formData.password"
            @input="handlePasswordInput"
            placeholder="至少8个字符，包含字母和数字"
            class="form-input"
            :disabled="isSubmitting"
            required
          />
        </div>
        
        <!-- 密码强度指示器 -->
        <div v-if="formData.password" class="password-strength">
          <div class="strength-meter">
            <div 
              class="strength-bar" 
              :class="strengthColors[passwordStrength]"
              :style="{ width: `${(passwordStrength + 1) * 25}%` }"
            ></div>
          </div>
          <span class="strength-text" :class="strengthColors[passwordStrength]">
            强度: {{ passwordStrengthText }}
          </span>
        </div>
        
        <!-- 确认密码 -->
        <div class="form-group">
          <label for="confirmPassword" class="form-label">确认密码</label>
          <input
            type="password"
            id="confirmPassword"
            v-model="formData.confirmPassword"
            @input="handleConfirmPasswordInput"
            placeholder="请再次输入密码"
            class="form-input"
            :disabled="isSubmitting"
            required
          />
        </div>
        
        <!-- 注册按钮 -->
        <button
          type="submit"
          class="register-button"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? '注册中...' : '注册' }}
        </button>
      </form>
      
      <!-- 登录链接 -->
      <div class="login-link">
        已有账号？
        <button type="button" @click="goToLogin" class="link-button">立即登录</button>
      </div>
      
      <!-- 用户协议和隐私政策 -->
      <div class="terms-privacy">
        注册即表示您同意我们的
        <a href="/terms" class="text-link">用户协议</a>
        和
        <a href="/privacy" class="text-link">隐私政策</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.register-container {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.register-card {
  background-color: var(--bg-primary);
  border-radius: 12px;
  padding: 2.5rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);
}

.register-title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  text-align: center;
}

.register-subtitle {
  font-size: 1rem;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 2rem;
}

.success-message {
  background-color: rgba(52, 211, 153, 0.1);
  border: 1px solid #34d399;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  color: #166534;
  text-align: center;
}

.redirect-notice {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.error-message {
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid #ef4444;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  color: #b91c1c;
}

.register-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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

.password-strength {
  margin-top: -1rem;
  margin-bottom: 1rem;
}

.strength-meter {
  height: 4px;
  background-color: var(--bg-secondary);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.25rem;
}

.strength-bar {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.strength-text {
  font-size: 0.8rem;
  font-weight: 500;
}

.register-button {
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

.register-button:hover:not(:disabled) {
  background-color: #2563eb;
}

.register-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-link {
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

.terms-privacy {
  margin-top: 2rem;
  text-align: center;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.text-link {
  color: var(--accent-color);
  text-decoration: none;
}

.text-link:hover {
  text-decoration: underline;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .register-container {
    padding: 1rem;
  }
  
  .register-card {
    padding: 1.5rem;
  }
  
  .register-title {
    font-size: 1.75rem;
  }
}
</style>