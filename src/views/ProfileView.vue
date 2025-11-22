<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/authStore'

const router = useRouter()
const authStore = useAuthStore()

// 用户信息表单
const userInfo = reactive({
  nickname: '',
  email: '',
  userCode: ''
})

// 修改密码表单
const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// UI状态
const activeTab = ref('profile') // 'profile' 或 'password'
const isLoading = ref(false)
const isSavingProfile = ref(false)
const isChangingPassword = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// 获取用户信息
onMounted(async () => {
  isLoading.value = true
  try {
    const user = await authStore.getCurrentUser()
    if (user) {
      userInfo.nickname = user.nickname || ''
      userInfo.email = user.email || ''
      userInfo.userCode = user.userCode
    }
  } catch (error) {
    errorMessage.value = '获取用户信息失败'
  } finally {
    isLoading.value = false
  }
})

// 切换标签
function switchTab(tab) {
  activeTab.value = tab
  errorMessage.value = ''
  successMessage.value = ''
}

// 更新用户信息
async function updateProfile() {
  errorMessage.value = ''
  successMessage.value = ''
  
  // 验证昵称
  if (!userInfo.nickname.trim()) {
    errorMessage.value = '昵称不能为空'
    return
  }
  
  // 验证邮箱（如果填写了）
  if (userInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userInfo.email)) {
    errorMessage.value = '邮箱格式不正确'
    return
  }
  
  isSavingProfile.value = true
  try {
    await authStore.updateUserProfile({
      nickname: userInfo.nickname.trim(),
      email: userInfo.email.trim() || null
    })
    successMessage.value = '个人信息更新成功'
  } catch (error) {
    errorMessage.value = error.message || '更新失败，请稍后重试'
  } finally {
    isSavingProfile.value = false
  }
}

// 修改密码
async function changePassword() {
  errorMessage.value = ''
  successMessage.value = ''
  
  // 验证当前密码
  if (!passwordForm.currentPassword) {
    errorMessage.value = '请输入当前密码'
    return
  }
  
  // 验证新密码
  if (!passwordForm.newPassword) {
    errorMessage.value = '请输入新密码'
    return
  }
  
  if (passwordForm.newPassword.length < 8) {
    errorMessage.value = '新密码长度至少为8个字符'
    return
  }
  
  if (!/[A-Za-z]/.test(passwordForm.newPassword) || !/[0-9]/.test(passwordForm.newPassword)) {
    errorMessage.value = '新密码必须包含字母和数字'
    return
  }
  
  // 验证确认密码
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    errorMessage.value = '两次输入的新密码不一致'
    return
  }
  
  // 检查新旧密码是否相同
  if (passwordForm.currentPassword === passwordForm.newPassword) {
    errorMessage.value = '新密码不能与当前密码相同'
    return
  }
  
  isChangingPassword.value = true
  try {
    await authStore.changePassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword
    })
    
    successMessage.value = '密码修改成功，请重新登录'
    
    // 清空表单
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    
    // 3秒后登出用户
    setTimeout(() => {
      authStore.logout()
      router.push('/login')
    }, 3000)
  } catch (error) {
    errorMessage.value = error.message || '修改密码失败，请检查当前密码是否正确'
  } finally {
    isChangingPassword.value = false
  }
}

// 登出
async function handleLogout() {
  try {
    await authStore.logout()
    router.push('/login')
  } catch (error) {
    errorMessage.value = '登出失败，请稍后重试'
  }
}
</script>

<template>
  <div class="profile-container">
    <div class="profile-header">
      <h1 class="page-title">个人资料</h1>
      <button 
        type="button" 
        class="logout-button"
        @click="handleLogout"
      >
        退出登录
      </button>
    </div>
    
    <div v-if="isLoading" class="loading">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>
    
    <div v-else class="profile-content">
      <!-- 错误消息 -->
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
      
      <!-- 成功消息 -->
      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
      </div>
      
      <!-- 标签切换 -->
      <div class="tab-container">
        <button 
          type="button" 
          class="tab-button" 
          :class="{ active: activeTab === 'profile' }"
          @click="switchTab('profile')"
        >
          基本信息
        </button>
        <button 
          type="button" 
          class="tab-button" 
          :class="{ active: activeTab === 'password' }"
          @click="switchTab('password')"
        >
          修改密码
        </button>
      </div>
      
      <!-- 个人信息表单 -->
      <div v-if="activeTab === 'profile'" class="form-container">
        <form @submit.prevent="updateProfile" class="profile-form">
          <!-- 用户编码（只读） -->
          <div class="form-group">
            <label class="form-label">用户编码</label>
            <input 
              type="text" 
              v-model="userInfo.userCode" 
              class="form-input" 
              readonly
            />
          </div>
          
          <!-- 昵称 -->
          <div class="form-group">
            <label for="nickname" class="form-label">昵称</label>
            <input 
              type="text" 
              id="nickname"
              v-model="userInfo.nickname" 
              class="form-input"
              placeholder="请输入昵称"
              maxlength="20"
            />
          </div>
          
          <!-- 邮箱 -->
          <div class="form-group">
            <label for="email" class="form-label">邮箱 <span class="optional-text">(可选)</span></label>
            <input 
              type="email" 
              id="email"
              v-model="userInfo.email" 
              class="form-input"
              placeholder="请输入邮箱地址"
            />
          </div>
          
          <!-- 提交按钮 -->
          <div class="form-actions">
            <button 
              type="submit" 
              class="save-button"
              :disabled="isSavingProfile"
            >
              {{ isSavingProfile ? '保存中...' : '保存修改' }}
            </button>
          </div>
        </form>
      </div>
      
      <!-- 修改密码表单 -->
      <div v-if="activeTab === 'password'" class="form-container">
        <form @submit.prevent="changePassword" class="password-form">
          <!-- 当前密码 -->
          <div class="form-group">
            <label for="currentPassword" class="form-label">当前密码</label>
            <input 
              type="password" 
              id="currentPassword"
              v-model="passwordForm.currentPassword" 
              class="form-input"
              placeholder="请输入当前密码"
            />
          </div>
          
          <!-- 新密码 -->
          <div class="form-group">
            <label for="newPassword" class="form-label">新密码</label>
            <input 
              type="password" 
              id="newPassword"
              v-model="passwordForm.newPassword" 
              class="form-input"
              placeholder="至少8个字符，包含字母和数字"
            />
          </div>
          
          <!-- 确认新密码 -->
          <div class="form-group">
            <label for="confirmPassword" class="form-label">确认新密码</label>
            <input 
              type="password" 
              id="confirmPassword"
              v-model="passwordForm.confirmPassword" 
              class="form-input"
              placeholder="请再次输入新密码"
            />
          </div>
          
          <!-- 提交按钮 -->
          <div class="form-actions">
            <button 
              type="submit" 
              class="save-button"
              :disabled="isChangingPassword"
            >
              {{ isChangingPassword ? '修改中...' : '修改密码' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.logout-button {
  background-color: #ef4444;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.logout-button:hover {
  background-color: #dc2626;
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

.profile-content {
  background-color: var(--bg-primary);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid var(--border-color);
}

.error-message {
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid #ef4444;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  color: #b91c1c;
}

.success-message {
  background-color: rgba(52, 211, 153, 0.1);
  border: 1px solid #34d399;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  color: #166534;
}

.tab-container {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 2rem;
}

.tab-button {
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-weight: 500;
  position: relative;
  transition: color 0.2s;
}

.tab-button.active {
  color: var(--accent-color);
}

.tab-button.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 3px;
  background-color: var(--accent-color);
  border-radius: 3px 3px 0 0;
}

.tab-button:hover:not(.active) {
  color: var(--text-primary);
}

.form-container {
  max-width: 500px;
  margin: 0 auto;
}

.profile-form,
.password-form {
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

.optional-text {
  font-weight: 400;
  color: var(--text-secondary);
  font-size: 0.85rem;
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

.form-input:disabled,
.form-input[readonly] {
  background-color: var(--bg-disabled);
  cursor: not-allowed;
  opacity: 0.7;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}

.save-button {
  background-color: var(--accent-color);
  color: white;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
}

.save-button:hover:not(:disabled) {
  background-color: #2563eb;
}

.save-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .profile-container {
    padding: 1rem;
  }
  
  .profile-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .tab-button {
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
  }
}
</style>