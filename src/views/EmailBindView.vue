<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/authStore'
import ValidationUtils from '../utils/validationUtils'

const router = useRouter()
const authStore = useAuthStore()

// 邮箱绑定表单
const emailForm = reactive({
  email: '',
  verificationCode: ''
})

// 用户当前绑定的邮箱
const currentEmail = ref('')

// UI状态
const isLoading = ref(false)
const isSendingCode = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const codeSentMessage = ref('')
const countdown = ref(0)
const isEmailBound = ref(false)
const isVerified = ref(false)

// 初始化页面
onMounted(async () => {
  try {
    isLoading.value = true
    
    // 检查用户是否已登录
    if (!authStore.isAuthenticated) {
      router.push('/login')
      return
    }
    
    // 获取当前用户信息
    const user = await authStore.getCurrentUser()
    if (user) {
      currentEmail.value = user.email || ''
      isEmailBound.value = !!currentEmail.value
    }
  } catch (error) {
    errorMessage.value = '加载用户信息失败'
  } finally {
    isLoading.value = false
  }
})

// 发送验证码
  async function sendVerificationCode() {
    errorMessage.value = ''
    successMessage.value = ''
    codeSentMessage.value = ''
    
    // 验证邮箱格式
    if (!emailForm.email.trim()) {
      errorMessage.value = '请输入邮箱地址'
      return
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForm.email.trim())) {
      errorMessage.value = '邮箱格式不正确'
      return
    }
    
    try {
      isSendingCode.value = true
      
      // 调用authStore中的sendVerificationCode方法
      await authStore.sendVerificationCode(emailForm.email.trim(), 'bind_email')
      
      // 显示成功消息
      codeSentMessage.value = '验证码已发送，请查收'
      
      // 开始倒计时
      startCountdown()
    } catch (error) {
      // 处理频率限制错误
      if (error.message && error.message.includes('操作过于频繁')) {
        countdown.value = 60; // 即使失败也启动倒计时
        startCountdown();
      }
      errorMessage.value = error.message || '发送验证码失败，请稍后重试'
    } finally {
      isSendingCode.value = false
    }
  }

// 开始倒计时
function startCountdown() {
  countdown.value = 60
  const timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer)
    }
  }, 1000)
}

// 绑定邮箱
  async function bindEmail() {
    errorMessage.value = ''
    successMessage.value = ''
    
    // 验证表单
    if (!emailForm.email.trim()) {
      errorMessage.value = '请输入邮箱地址'
      return
    }
    
    if (!emailForm.verificationCode.trim()) {
      errorMessage.value = '请输入验证码'
      return
    }
    
    try {
      isSubmitting.value = true
      
      // 使用更新后的bindEmail方法，包含验证码参数
      await authStore.bindEmail(emailForm.email.trim(), emailForm.verificationCode.trim())
      
      // 重新获取用户信息以更新邮箱状态
      const user = await authStore.getCurrentUser()
      
      // 更新状态
      currentEmail.value = emailForm.email.trim()
      isEmailBound.value = true
      
      // 显示成功消息
      successMessage.value = isEmailBound.value ? '邮箱绑定成功！' : '邮箱修改成功！'
      
      // 重置表单
      emailForm.verificationCode = ''
      
      // 3秒后返回个人中心
      setTimeout(() => {
        router.push('/profile')
      }, 3000)
    } catch (error) {
      // 处理特定错误
      if (error.message && error.message.includes('验证码无效')) {
        errorMessage.value = '验证码无效，请重新获取'
      } else if (error.message && error.message.includes('邮箱已被使用')) {
        errorMessage.value = '该邮箱已被其他用户绑定'
      } else {
        errorMessage.value = error.message || '邮箱绑定失败，请稍后重试'
      }
    } finally {
      isSubmitting.value = false
    }
  }

// 取消绑定邮箱
async function unbindEmail() {
  if (confirm('确定要解绑邮箱吗？解绑后您将无法使用邮箱进行密码重置等操作。')) {
    try {
      isLoading.value = true
      
      // 调用API解绑邮箱
      await authStore.unbindEmail()
      
      // 更新状态
      currentEmail.value = ''
      isEmailBound.value = false
      
      // 显示成功消息
      successMessage.value = '邮箱解绑成功！'
    } catch (error) {
      errorMessage.value = error.message || '邮箱解绑失败，请稍后重试'
    } finally {
      isLoading.value = false
    }
  }
}

// 格式化邮箱显示（保护隐私）
function formatEmailDisplay(email) {
  if (!email) return ''
  
  const [username, domain] = email.split('@')
  const maskedUsername = username.charAt(0) + '*'.repeat(Math.max(0, username.length - 2)) + 
                         username.length > 1 ? username.charAt(username.length - 1) : ''
  
  return `${maskedUsername}@${domain}`
}
</script>

<template>
  <div class="email-bind-container">
    <div class="page-header">
      <button 
        type="button" 
        class="back-button"
        @click="router.back()"
      >
        &larr; 返回
      </button>
      <h1 class="page-title">邮箱管理</h1>
    </div>
    
    <div v-if="isLoading" class="loading">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>
    
    <div v-else class="content">
      <!-- 错误消息 -->
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
      
      <!-- 成功消息 -->
      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
        <span v-if="successMessage.includes('成功')">
          <br />3秒后自动返回个人中心...
        </span>
      </div>
      
      <!-- 验证码发送成功消息 -->
      <div v-if="codeSentMessage" class="info-message">
        {{ codeSentMessage }}
      </div>
      
      <!-- 当前邮箱状态 -->
      <div class="current-email-status">
        <h2 class="section-title">当前邮箱状态</h2>
        <div class="status-card">
          <div class="status-item">
            <span class="status-label">绑定状态：</span>
            <span class="status-value" :class="{ 'bound': isEmailBound, 'unbound': !isEmailBound }">
              {{ isEmailBound ? '已绑定' : '未绑定' }}
            </span>
          </div>
          
          <div v-if="isEmailBound" class="status-item">
            <span class="status-label">当前邮箱：</span>
            <span class="status-value email-display">
              {{ formatEmailDisplay(currentEmail) }}
            </span>
          </div>
          
          <div v-if="isEmailBound" class="status-actions">
            <button 
              type="button" 
              class="unbind-btn"
              @click="unbindEmail"
              :disabled="isLoading"
            >
              {{ isLoading ? '处理中...' : '解绑邮箱' }}
            </button>
          </div>
        </div>
      </div>
      
      <!-- 邮箱绑定/修改表单 -->
      <div class="form-section">
        <h2 class="section-title">
          {{ isEmailBound ? '修改邮箱' : '绑定邮箱' }}
        </h2>
        
        <form @submit.prevent="bindEmail" class="email-bind-form">
          <!-- 邮箱输入 -->
          <div class="form-group">
            <label for="email" class="form-label">邮箱地址</label>
            <input 
              type="email" 
              id="email" 
              v-model="emailForm.email" 
              class="form-input"
              placeholder="请输入邮箱地址"
              :disabled="isSendingCode || isSubmitting"
            />
          </div>
          
          <!-- 验证码输入 -->
          <div class="form-group">
            <label for="verificationCode" class="form-label">验证码</label>
            <div class="code-input-container">
              <input 
                type="text" 
                id="verificationCode" 
                v-model="emailForm.verificationCode" 
                class="form-input code-input"
                placeholder="请输入验证码"
                :disabled="isSubmitting"
              />
              <button 
                type="button" 
                class="send-code-btn"
                @click="sendVerificationCode"
                :disabled="countdown > 0 || isSendingCode || isSubmitting || !emailForm.email.trim()"
              >
                {{ isSendingCode ? '发送中...' : countdown > 0 ? `${countdown}秒后重发` : '获取验证码' }}
              </button>
            </div>
            <p class="form-note">验证码有效期为10分钟，请尽快使用</p>
          </div>
          
          <!-- 安全提示 -->
          <div class="security-tips">
            <h3>安全提示</h3>
            <ul>
              <li>请确保您有权访问该邮箱，避免绑定他人邮箱</li>
              <li>邮箱用于账号安全验证、密码找回等重要操作</li>
              <li>请勿在短时间内频繁获取验证码</li>
            </ul>
          </div>
          
          <!-- 提交按钮 -->
          <div class="form-actions">
            <button 
              type="submit" 
              class="submit-button"
              :disabled="isSubmitting || !emailForm.email.trim() || !emailForm.verificationCode.trim()"
            >
              {{ isSubmitting ? '处理中...' : isEmailBound ? '修改邮箱' : '绑定邮箱' }}
            </button>
            <button 
              type="button" 
              class="cancel-button"
              @click="router.back()"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.email-bind-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  display: flex;
  align-items: center;
  margin-bottom: 2rem;
  gap: 1rem;
}

.back-button {
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 1rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.back-button:hover {
  background-color: var(--bg-secondary);
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: var(--accent-color);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* 消息样式 */
.error-message {
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid #ef4444;
  border-radius: 8px;
  padding: 1rem;
  color: #b91c1c;
}

.success-message {
  background-color: rgba(52, 211, 153, 0.1);
  border: 1px solid #34d399;
  border-radius: 8px;
  padding: 1rem;
  color: #166534;
}

.info-message {
  background-color: rgba(59, 130, 246, 0.1);
  border: 1px solid #3b82f6;
  border-radius: 8px;
  padding: 1rem;
  color: #1e40af;
}

/* 当前邮箱状态 */
.current-email-status {
  background-color: var(--bg-primary);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid var(--border-color);
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem 0;
}

.status-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-label {
  font-weight: 500;
  color: var(--text-primary);
  min-width: 100px;
}

.status-value {
  font-weight: 600;
}

.status-value.bound {
  color: #10b981;
}

.status-value.unbound {
  color: #f59e0b;
}

.email-display {
  font-weight: 400;
  font-style: italic;
}

.status-actions {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
}

.unbind-btn {
  background-color: #ef4444;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.unbind-btn:hover:not(:disabled) {
  background-color: #dc2626;
}

.unbind-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 表单样式 */
.form-section {
  background-color: var(--bg-primary);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid var(--border-color);
}

.email-bind-form {
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
  background-color: var(--bg-disabled);
  cursor: not-allowed;
  opacity: 0.7;
}

.code-input-container {
  display: flex;
  gap: 1rem;
}

.code-input {
  flex-grow: 1;
}

.send-code-btn {
  background-color: var(--accent-color);
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
  min-width: 120px;
}

.send-code-btn:hover:not(:disabled) {
  background-color: #2563eb;
}

.send-code-btn:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.form-note {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0;
  font-style: italic;
}

/* 安全提示 */
.security-tips {
  background-color: rgba(251, 191, 36, 0.1);
  border: 1px solid #fcd34d;
  border-radius: 8px;
  padding: 1rem;
}

.security-tips h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #92400e;
  margin: 0 0 0.5rem 0;
}

.security-tips ul {
  margin: 0;
  padding-left: 1.5rem;
}

.security-tips li {
  font-size: 0.85rem;
  color: #92400e;
  margin-bottom: 0.25rem;
}

/* 表单操作按钮 */
.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1rem;
}

.submit-button {
  background-color: var(--accent-color);
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-button:hover:not(:disabled) {
  background-color: #2563eb;
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-button {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.cancel-button:hover {
  background-color: #e5e7eb;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .email-bind-container {
    padding: 1rem;
  }
  
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .page-title {
    font-size: 1.5rem;
  }
  
  .status-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
  
  .code-input-container {
    flex-direction: column;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .submit-button,
  .cancel-button {
    width: 100%;
  }
}
</style>