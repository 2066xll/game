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

// 账号删除相关状态
const deleteAccountModal = ref(false)
const deleteConfirmPassword = ref('')
const isDeletingAccount = ref(false)

// 格式化邮箱显示（保护隐私）
function formatEmailDisplay(email) {
  if (!email) return ''
  
  const [username, domain] = email.split('@')
  const maskedUsername = username.charAt(0) + '*'.repeat(Math.max(0, username.length - 2)) + 
                         username.length > 1 ? username.charAt(username.length - 1) : ''
  
  return `${maskedUsername}@${domain}`
}

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
  console.log('开始获取用户信息...')
  isLoading.value = true
  try {
    const user = await authStore.getCurrentUser()
    if (user) {
      console.log('获取到用户信息:', user)
      // 安全地赋值用户信息，添加默认值防止显示undefined
      userInfo.nickname = user.nickname || user.user_code || '未知用户'
      userInfo.email = user.email || ''
      userInfo.userCode = user.user_code || ''
      console.log('用户信息已更新到表单')
    } else {
      console.warn('未获取到用户信息')
      errorMessage.value = '未获取到用户信息'
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
    errorMessage.value = '获取用户信息失败，请稍后重试'
  } finally {
    isLoading.value = false
    console.log('用户信息获取完成')
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
  if (userInfo.email && userInfo.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userInfo.email.trim())) {
    errorMessage.value = '邮箱格式不正确'
    return
  }
  
  // 提示用户邮箱修改需要通过邮箱管理页面进行
  if (userInfo.email && userInfo.email.trim()) {
    errorMessage.value = '邮箱修改需要通过邮箱管理页面进行'
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

// 打开账号删除模态框
function openDeleteModal() {
  deleteAccountModal.value = true
  deleteConfirmPassword.value = ''
  errorMessage.value = ''
  successMessage.value = ''
}

// 关闭账号删除模态框
function closeDeleteModal() {
  deleteAccountModal.value = false
  deleteConfirmPassword.value = ''
}

// 执行账号删除
async function deleteAccount() {
  errorMessage.value = ''
  successMessage.value = ''
  
  if (!deleteConfirmPassword.value) {
    errorMessage.value = '请输入密码确认删除'
    return
  }
  
  isDeletingAccount.value = true
  try {
    await authStore.deleteAccount(deleteConfirmPassword.value)
    successMessage.value = '账号已成功删除，7天内可恢复'
    
    // 3秒后登出用户
    setTimeout(() => {
      authStore.logout()
      router.push('/login')
    }, 3000)
  } catch (error) {
    errorMessage.value = error.message || '删除失败，请检查密码是否正确'
  } finally {
    isDeletingAccount.value = false
  }
}
</script>

<template>
  <div class="profile-container">
    <div class="profile-header">
      <h1 class="page-title">个人中心</h1>
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
          <button 
            type="button" 
            class="tab-button"
            @click="$router.push('/profile/email-bind')"
          >
            邮箱管理
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
            <div class="user-code-warning">
              <span class="warning-icon">⚠️</span>
              <span class="warning-text">请妥善保管您的用户编码，用于登录和账号恢复</span>
            </div>
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
            <div v-if="!userInfo.email" class="email-status-container">
              <input 
                type="email" 
                id="email" 
                v-model="userInfo.email" 
                class="form-input"
                placeholder="请输入邮箱地址"
              />
              <div class="email-status unbound">未绑定邮箱</div>
              <button 
                type="button" 
                class="email-bind-btn"
                @click="$router.push('/profile/email-bind')"
              >
                前往绑定
              </button>
            </div>
            <div v-else class="email-status-container">
              <input 
                type="email" 
                id="email" 
                v-model="userInfo.email" 
                class="form-input"
                placeholder="请输入邮箱地址"
                readonly
              />
              <div class="email-status bound">已绑定邮箱</div>
              <button 
                type="button" 
                class="email-bind-btn"
                @click="$router.push('/profile/email-bind')"
              >
                修改邮箱
              </button>
            </div>
            <p class="form-note">邮箱用于账号安全，请前往邮箱管理页面完成绑定</p>
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
          
          <!-- 删除账号按钮 -->
          <div class="account-actions">
            <button 
              type="button" 
              class="delete-account-button"
              @click="openDeleteModal"
            >
              删除账号
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
      
      <!-- 删除账号模态框 -->
      <div v-if="deleteAccountModal" class="modal-overlay" @click="closeDeleteModal">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h2 class="modal-title">删除账号</h2>
            <button 
              type="button" 
              class="close-button"
              @click="closeDeleteModal"
            >
              ×
            </button>
          </div>
          
          <div class="modal-body">
            <div class="warning-message">
              <span class="warning-icon">⚠️</span>
              <p>删除账号是不可逆操作！账号删除后，您的数据将被保留7天，7天内可恢复账号。</p>
              <p>7天后，您的所有数据将被永久删除，无法恢复。</p>
            </div>
            
            <div class="form-group">
              <label for="deleteConfirmPassword" class="form-label">请输入密码确认删除</label>
              <input 
                type="password" 
                id="deleteConfirmPassword"
                v-model="deleteConfirmPassword" 
                class="form-input"
                placeholder="请输入您的密码"
                :disabled="isDeletingAccount"
              />
            </div>
          </div>
          
          <div class="modal-footer">
            <button 
              type="button" 
              class="cancel-button"
              @click="closeDeleteModal"
              :disabled="isDeletingAccount"
            >
              取消
            </button>
            <button 
              type="button" 
              class="confirm-delete-button"
              @click="deleteAccount"
              :disabled="isDeletingAccount"
            >
              {{ isDeletingAccount ? '删除中...' : '确认删除' }}
            </button>
          </div>
        </div>
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

.email-status-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.email-status {
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
}

.email-status.bound {
  background-color: rgba(52, 211, 153, 0.1);
  color: #166534;
  border: 1px solid #34d399;
}

.email-status.unbound {
  background-color: rgba(245, 158, 11, 0.1);
  color: #92400e;
  border: 1px solid #f59e0b;
}

.email-bind-btn {
  background-color: var(--accent-color);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
  align-self: flex-start;
}

.email-bind-btn:hover {
  background-color: #2563eb;
}

.form-note {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0;
  font-style: italic;
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

/* 用户编码警告样式 */
.user-code-warning {
  background-color: rgba(245, 158, 11, 0.1);
  border: 1px solid #f59e0b;
  border-radius: 6px;
  padding: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.warning-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.warning-text {
  font-size: 0.9rem;
  color: #92400e;
  line-height: 1.4;
}

/* 账号删除按钮样式 */
.account-actions {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color);
}

.delete-account-button {
  background-color: #ef4444;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  width: 100%;
}

.delete-account-button:hover {
  background-color: #dc2626;
}

/* 删除账号模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.close-button {
  background: none;
  border: none;
  font-size: 1.75rem;
  color: var(--text-secondary);
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-button:hover {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1rem 1.5rem 1.5rem;
  border-top: 1px solid var(--border-color);
}

.cancel-button {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-button:hover:not(:disabled) {
  background-color: var(--bg-disabled);
}

.confirm-delete-button {
  background-color: #ef4444;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.confirm-delete-button:hover:not(:disabled) {
  background-color: #dc2626;
}

.confirm-delete-button:disabled,
.cancel-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 模态框内的警告消息样式 */
.warning-message {
  background-color: rgba(245, 158, 11, 0.1);
  border: 1px solid #f59e0b;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: flex-start;
}

.warning-message p {
  margin: 0;
  color: #92400e;
  line-height: 1.4;
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
  
  .modal-content {
    width: 95%;
    margin: 1rem;
  }
  
  .modal-footer {
    flex-direction: column;
  }
  
  .cancel-button,
  .confirm-delete-button {
    width: 100%;
  }
}
</style>