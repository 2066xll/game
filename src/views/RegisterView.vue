<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/authStore'
import ValidationUtils from '../utils/validationUtils'

const router = useRouter()
const authStore = useAuthStore()

// 表单数据
const formData = reactive({
  nickname: '',
  email: '',
  password: '',
  confirmPassword: ''
})

// 响应状态
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const userCode = ref('')
// 密码可见性控制
const showPassword = ref(false)
const showConfirmPassword = ref(false)

// 密码强度检查
const passwordStrength = ref(0)
const passwordStrengthText = ref('')
const passwordFeedback = ref([])
const strengthColors = ['text-red-500', 'text-orange-500', 'text-yellow-500', 'text-green-500']
const strengthTexts = ['弱', '一般', '中等', '强']

// 检查密码强度
function checkPasswordStrength(password) {
  if (!password) {
    passwordStrength.value = 0
    passwordStrengthText.value = ''
    passwordFeedback.value = []
    return
  }
  
  const result = ValidationUtils.validatePassword(password)
  if (!result.valid) {
    // 计算强度级别（0-3）
    const strengthLevel = Math.min(3, Math.max(0, (result.strength || 0) - 1))
    passwordStrength.value = strengthLevel
    passwordStrengthText.value = strengthTexts[strengthLevel]
    passwordFeedback.value = [result.message]
  } else {
    // 强度从1-4，转换为0-3的索引
    const strengthLevel = result.strength - 1
    passwordStrength.value = strengthLevel
    passwordStrengthText.value = strengthTexts[strengthLevel]
    passwordFeedback.value = []
  }
}

// 表单验证
function validateForm() {
  errorMessage.value = ''
  
  // 确认密码检查
  if (formData.password !== formData.confirmPassword) {
    errorMessage.value = '两次输入的密码不一致'
    return false
  }
  
  // 使用新的验证工具进行注册验证
  const validationResult = ValidationUtils.validateRegistration(
    formData.nickname,
    formData.email,
    formData.password
  )
  
  if (!validationResult.valid) {
    errorMessage.value = validationResult.message
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
    // 传递完整的表单数据给register方法
    const result = await authStore.register({
      nickname: formData.nickname.trim(),
      email: formData.email.trim(),
      password: formData.password
    })
    
    userCode.value = result.userCode
    successMessage.value = '注册成功！您的用户编码是：' + result.userCode
    
    // 清空表单
    formData.nickname = ''
    formData.email = ''
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
      <p class="register-subtitle">设置昵称和密码后，我们将为您生成唯一的6位数用户编码</p>
      
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
        <!-- 昵称输入 -->
        <div class="form-group">
          <label for="nickname" class="form-label">昵称</label>
          <input
            type="text"
            id="nickname"
            v-model="formData.nickname"
            placeholder="请输入2-30个字符的昵称（仅支持英文、数字、空格、点、下划线和连字符）"
            class="form-input"
            :disabled="isSubmitting"
            required
            maxlength="30"
          />
        </div>
        
        <!-- 邮箱输入（可选） -->
        <div class="form-group">
          <label for="email" class="form-label">邮箱 (可选)</label>
          <input
            type="email"
            id="email"
            v-model="formData.email"
            placeholder="请输入有效的邮箱地址（可选）"
            class="form-input"
            :disabled="isSubmitting"
          />
        </div>
        
        <!-- 密码输入 -->
        <div class="form-group">
          <label for="password" class="form-label">设置密码</label>
          <div class="password-input-container">
            <input
              :type="showPassword ? 'text' : 'password'"
              id="password"
              v-model="formData.password"
              @input="handlePasswordInput"
              placeholder="至少8个字符，包含字母和数字"
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
        
        <!-- 密码强度指示器 -->
        <div v-if="formData.password" class="password-strength">
          <div class="strength-meter">
            <div 
              class="strength-bar" 
              :class="strengthColors[passwordStrength]"
              :style="{ width: `${(passwordStrength + 1) * 25}%` }"
            ></div>
          </div>
          <div class="strength-info">
            <span class="strength-text" :class="strengthColors[passwordStrength]">
              强度: {{ passwordStrengthText }}
            </span>
            <span v-if="passwordStrength < 2" class="strength-hint">
              建议使用更复杂的密码，包含大小写字母、数字和特殊字符
            </span>
          </div>
        </div>
        
        <!-- 确认密码 -->
        <div class="form-group">
          <label for="confirmPassword" class="form-label">确认密码</label>
          <div class="password-input-container">
            <input
              :type="showConfirmPassword ? 'text' : 'password'"
              id="confirmPassword"
              v-model="formData.confirmPassword"
              @input="handleConfirmPasswordInput"
              placeholder="请再次输入密码"
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
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
}

.register-container::before,
.register-container::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.3;
  z-index: 0;
}

.register-container::before {
  width: 500px;
  height: 500px;
  background: #4facfe;
  top: -100px;
  left: -100px;
  animation: rotate 15s linear infinite;
}

.register-container::after {
  width: 600px;
  height: 600px;
  background: #00f2fe;
  bottom: -200px;
  right: -200px;
  animation: rotate 20s linear infinite reverse;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.register-card {
  background-color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 2.5rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  position: relative;
  z-index: 1;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.register-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
}

.register-title {
  font-size: 2.2rem;
  font-weight: 700;
  text-align: center;
  margin-bottom: 0.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-fill-color: transparent;
}

.register-subtitle {
  font-size: 1rem;
  color: #555;
  text-align: center;
  margin-bottom: 2rem;
  line-height: 1.5;
}

.success-message {
  background-color: rgba(52, 211, 153, 0.1);
  border: 1px solid #34d399;
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  color: #166534;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.success-message::before {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 1rem;
  transform: translateY(-50%);
  font-size: 1.5rem;
  color: #34d399;
}

.redirect-notice {
  margin-top: 0.75rem;
  font-size: 0.9rem;
  color: #666;
}

.error-message {
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid #ef4444;
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  color: #b91c1c;
  position: relative;
  overflow: hidden;
}

.error-message::before {
  content: '!';
  position: absolute;
  top: 50%;
  left: 1rem;
  transform: translateY(-50%);
  font-size: 1.5rem;
  color: #ef4444;
  font-weight: bold;
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
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  background-color: rgba(255, 255, 255, 0.7);
  color: #333;
  transition: all 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  transform: translateY(-1px);
}

.password-input {
  padding-right: 80px;
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
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid #ddd;
  color: #667eea;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.toggle-password-btn:hover:not(:disabled) {
  text-decoration: none;
  background-color: #667eea;
  color: white;
  border-color: #667eea;
  transform: translateY(-1px);
}

.toggle-password-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.password-strength {
  margin-top: -1rem;
  margin-bottom: 1rem;
}

.strength-meter {
  height: 6px;
  background-color: #eee;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.5rem;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
}

.strength-bar {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
  border-radius: 3px;
}

.strength-text {
  font-size: 0.85rem;
  font-weight: 600;
}

.strength-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.strength-hint {
  font-size: 0.75rem;
  color: #666;
  font-style: italic;
  padding-left: 4px;
}

.register-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.register-button::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 300px;
  height: 300px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  transition: transform 0.6s ease;
}

.register-button:hover:not(:disabled)::before {
  transform: translate(-50%, -50%) scale(1);
}

.register-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.register-button:active:not(:disabled) {
  transform: translateY(0);
}

.register-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-link {
  text-align: center;
  margin-top: 1.5rem;
  color: #555;
  font-size: 0.95rem;
}

.link-button {
  background: none;
  border: none;
  color: #667eea;
  font-weight: 600;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  margin-left: 0.25rem;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.link-button:hover {
  text-decoration: none;
  background-color: rgba(102, 126, 234, 0.1);
  transform: translateY(-1px);
}

.terms-privacy {
  margin-top: 2rem;
  text-align: center;
  font-size: 0.85rem;
  color: #666;
  line-height: 1.5;
}

.text-link {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
  position: relative;
  padding-bottom: 2px;
  transition: all 0.3s ease;
}

.text-link::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background-color: #667eea;
  transition: width 0.3s ease;
}

.text-link:hover {
  text-decoration: none;
}

.text-link:hover::after {
  width: 100%;
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