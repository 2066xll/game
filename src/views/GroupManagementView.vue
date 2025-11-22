<template>
  <div class="group-management-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1>群组管理</h1>
      <button class="create-group-btn" @click="showCreateModal = true">
        <i class="icon-plus"></i> 创建群组
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>

    <!-- 错误提示 -->
    <div v-else-if="error" class="error-message">
      {{ error }}
      <button class="close-btn" @click="error = null">×</button>
    </div>

    <!-- 群组列表 -->
    <div v-else-if="groups.length > 0" class="groups-list">
      <div 
        v-for="group in groups" 
        :key="group.id" 
        class="group-item"
        :class="{ active: selectedGroup && selectedGroup.id === group.id }"
        @click="selectGroup(group)"
      >
        <div class="group-info">
          <div class="group-avatar">
            <span>{{ getGroupInitial(group.name) }}</span>
          </div>
          <div class="group-details">
            <h3 class="group-name">{{ group.name }}</h3>
            <p class="group-members">{{ group.members.length }} 名成员</p>
          </div>
        </div>
        <div class="group-actions">
          <button class="action-btn view-btn" @click.stop="viewGroupDetails(group)">
            详情
          </button>
          <button 
            v-if="group.ownerId === currentUserId" 
            class="action-btn edit-btn" 
            @click.stop="editGroup(group)"
          >
            编辑
          </button>
          <button class="action-btn leave-btn" @click.stop="confirmLeaveGroup(group)">
            退出
          </button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-icon">
        <i class="icon-users"></i>
      </div>
      <h2>还没有加入任何群组</h2>
      <p>创建一个新群组或加入现有群组开始聊天</p>
      <button class="primary-btn" @click="showCreateModal = true">创建第一个群组</button>
    </div>

    <!-- 群组详情侧边栏 -->
    <div v-if="selectedGroup" class="group-details-sidebar" :class="{ open: selectedGroup }">
      <div class="sidebar-header">
        <h2>{{ selectedGroup.name }}</h2>
        <button class="close-sidebar" @click="selectedGroup = null">×</button>
      </div>
      
      <div class="group-meta">
        <p><strong>创建者:</strong> {{ getOwnerName(selectedGroup) }}</p>
        <p><strong>创建时间:</strong> {{ formatDate(selectedGroup.createdAt) }}</p>
        <p><strong>成员数量:</strong> {{ selectedGroup.members.length }}</p>
      </div>

      <div class="members-section">
        <h3>群组成员</h3>
        <div class="members-list">
          <div 
            v-for="member in selectedGroup.members" 
            :key="member.id" 
            class="member-item"
          >
            <div class="member-avatar">
              <span>{{ getMemberInitial(member) }}</span>
            </div>
            <div class="member-info">
              <p class="member-name">{{ member.nickname || member.username }}</p>
              <p class="member-role">{{ isOwner(member.id) ? '群主' : '成员' }}</p>
            </div>
            <button 
              v-if="isOwner(currentUserId) && !isOwner(member.id)" 
              class="remove-member-btn"
              @click="confirmRemoveMember(member)"
            >
              移除
            </button>
          </div>
        </div>
      </div>

      <div class="sidebar-actions">
        <button class="primary-btn" @click="navigateToChat(selectedGroup)">
          进入聊天
        </button>
        <button 
          v-if="isOwner(currentUserId)" 
          class="danger-btn" 
          @click="confirmDeleteGroup(selectedGroup)"
        >
          删除群组
        </button>
      </div>
    </div>

    <!-- 创建群组模态框 -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="closeCreateModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>创建新群组</h2>
          <button class="close-modal" @click="closeCreateModal">×</button>
        </div>
        
        <div class="modal-body">
          <form @submit.prevent="submitCreateGroup">
            <div class="form-group">
              <label for="groupName">群组名称</label>
              <input 
                id="groupName"
                v-model="newGroup.name"
                type="text"
                placeholder="请输入群组名称"
                maxlength="100"
                required
              >
              <p class="char-count">{{ newGroup.name.length }}/100</p>
            </div>

            <div class="form-group">
              <label>添加成员</label>
              <div class="add-members-section">
                <input 
                  v-model="memberSearchQuery"
                  type="text"
                  placeholder="搜索用户名或用户ID"
                  @input="searchMembers"
                  @keyup.enter.prevent="addMember"
                >
                <button type="button" class="add-btn" @click="addMember">添加</button>
              </div>
              
              <!-- 搜索结果 -->
              <div v-if="memberSearchResults.length > 0" class="search-results">
                <div 
                  v-for="user in memberSearchResults" 
                  :key="user.id"
                  class="search-result-item"
                  @click="selectUser(user)"
                >
                  <span>{{ user.nickname || user.username }}</span>
                  <span class="user-id">{{ user.id }}</span>
                </div>
              </div>
            </div>

            <!-- 已选成员列表 -->
            <div v-if="newGroup.members.length > 0" class="selected-members">
              <h4>已选成员 ({{ newGroup.members.length }})</h4>
              <div class="selected-members-list">
                <div 
                  v-for="member in newGroup.members" 
                  :key="member.id"
                  class="selected-member-item"
                >
                  <span>{{ member.nickname || member.username }}</span>
                  <button type="button" class="remove-btn" @click="removeSelectedMember(member.id)">×</button>
                </div>
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" class="cancel-btn" @click="closeCreateModal">取消</button>
              <button type="submit" class="create-btn" :disabled="isSubmitting">
                {{ isSubmitting ? '创建中...' : '创建群组' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- 编辑群组模态框 -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="closeEditModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>编辑群组</h2>
          <button class="close-modal" @click="closeEditModal">×</button>
        </div>
        
        <div class="modal-body">
          <form @submit.prevent="submitEditGroup">
            <div class="form-group">
              <label for="editGroupName">群组名称</label>
              <input 
                id="editGroupName"
                v-model="editingGroup.name"
                type="text"
                placeholder="请输入群组名称"
                maxlength="100"
                required
              >
              <p class="char-count">{{ editingGroup.name.length }}/100</p>
            </div>

            <div class="modal-actions">
              <button type="button" class="cancel-btn" @click="closeEditModal">取消</button>
              <button type="submit" class="save-btn" :disabled="isSubmitting">
                {{ isSubmitting ? '保存中...' : '保存' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- 确认对话框 -->
    <div v-if="showConfirmDialog" class="modal-overlay" @click.self="closeConfirmDialog">
      <div class="modal-content confirm-dialog">
        <div class="modal-header">
          <h2>{{ confirmDialog.title }}</h2>
          <button class="close-modal" @click="closeConfirmDialog">×</button>
        </div>
        
        <div class="modal-body">
          <p>{{ confirmDialog.message }}</p>
        </div>

        <div class="modal-actions">
          <button class="cancel-btn" @click="closeConfirmDialog">取消</button>
          <button 
            :class="confirmDialog.isDanger ? 'danger-btn' : 'confirm-btn'"
            @click="confirmDialog.action"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? '处理中...' : confirmDialog.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'

export default {
  name: 'GroupManagementView',
  setup() {
    const chatStore = useChatStore()
    const authStore = useAuthStore()
    const router = useRouter()
    
    // 状态
    const groups = ref([])
    const selectedGroup = ref(null)
    const isLoading = ref(true)
    const error = ref(null)
    
    // 创建群组相关
    const showCreateModal = ref(false)
    const newGroup = ref({ name: '', members: [] })
    const memberSearchQuery = ref('')
    const memberSearchResults = ref([])
    const isSearching = ref(false)
    
    // 编辑群组相关
    const showEditModal = ref(false)
    const editingGroup = ref({ id: '', name: '' })
    
    // 确认对话框相关
    const showConfirmDialog = ref(false)
    const confirmDialog = ref({
      title: '',
      message: '',
      confirmText: '',
      action: null,
      isDanger: false
    })
    
    const isSubmitting = ref(false)
    
    // 获取当前用户ID
    const currentUserId = computed(() => authStore.user?.id)
    
    // 加载群组列表
    const loadGroups = async () => {
      try {
        isLoading.value = true
        error.value = null
        await chatStore.fetchGroups()
        groups.value = chatStore.groups
      } catch (err) {
        error.value = err.message || '加载群组失败'
      } finally {
        isLoading.value = false
      }
    }
    
    // 选择群组
    const selectGroup = (group) => {
      selectedGroup.value = { ...group }
    }
    
    // 查看群组详情
    const viewGroupDetails = (group) => {
      selectedGroup.value = { ...group }
    }
    
    // 进入聊天
    const navigateToChat = (group) => {
      router.push(`/chat/${group.id}`)
    }
    
    // 创建群组
    const submitCreateGroup = async () => {
      try {
        isSubmitting.value = true
        
        // 提取成员ID
        const memberIds = newGroup.value.members.map(m => m.id)
        
        // 创建群组
        await chatStore.createGroup(newGroup.value.name, memberIds)
        
        // 刷新群组列表
        await loadGroups()
        
        // 关闭模态框
        closeCreateModal()
      } catch (err) {
        error.value = err.message || '创建群组失败'
      } finally {
        isSubmitting.value = false
      }
    }
    
    // 关闭创建群组模态框
    const closeCreateModal = () => {
      showCreateModal.value = false
      newGroup.value = { name: '', members: [] }
      memberSearchQuery.value = ''
      memberSearchResults.value = []
    }
    
    // 编辑群组
    const editGroup = (group) => {
      editingGroup.value = { id: group.id, name: group.name }
      showEditModal.value = true
    }
    
    // 提交编辑群组
    const submitEditGroup = async () => {
      try {
        isSubmitting.value = true
        
        // 更新群组信息（这里需要在chatStore中添加updateGroup方法）
        // await chatStore.updateGroup(editingGroup.value.id, editingGroup.value.name)
        
        // 刷新群组列表
        await loadGroups()
        
        // 如果当前选中的是编辑的群组，更新选中的群组信息
        if (selectedGroup.value && selectedGroup.value.id === editingGroup.value.id) {
          selectedGroup.value.name = editingGroup.value.name
        }
        
        // 关闭模态框
        closeEditModal()
      } catch (err) {
        error.value = err.message || '更新群组失败'
      } finally {
        isSubmitting.value = false
      }
    }
    
    // 关闭编辑群组模态框
    const closeEditModal = () => {
      showEditModal.value = false
      editingGroup.value = { id: '', name: '' }
    }
    
    // 退出群组确认
    const confirmLeaveGroup = (group) => {
      confirmDialog.value = {
        title: group.ownerId === currentUserId ? '解散群组' : '退出群组',
        message: group.ownerId === currentUserId 
          ? '确定要解散该群组吗？此操作不可恢复，所有群消息将会丢失。' 
          : '确定要退出该群组吗？',
        confirmText: '确认',
        isDanger: true,
        action: async () => {
          try {
            isSubmitting.value = true
            await chatStore.leaveGroup(group.id)
            
            // 刷新群组列表
            await loadGroups()
            
            // 如果当前选中的是退出的群组，清除选中状态
            if (selectedGroup.value && selectedGroup.value.id === group.id) {
              selectedGroup.value = null
            }
            
            closeConfirmDialog()
          } catch (err) {
            error.value = err.message || '退出群组失败'
            isSubmitting.value = false
          }
        }
      }
      showConfirmDialog.value = true
    }
    
    // 删除群组确认
    const confirmDeleteGroup = (group) => {
      confirmDialog.value = {
        title: '删除群组',
        message: '确定要删除该群组吗？此操作不可恢复，所有群消息将会丢失。',
        confirmText: '删除',
        isDanger: true,
        action: async () => {
          try {
            isSubmitting.value = true
            await chatStore.leaveGroup(group.id) // 群主退出即删除群组
            
            // 刷新群组列表
            await loadGroups()
            
            // 清除选中状态
            selectedGroup.value = null
            
            closeConfirmDialog()
          } catch (err) {
            error.value = err.message || '删除群组失败'
            isSubmitting.value = false
          }
        }
      }
      showConfirmDialog.value = true
    }
    
    // 移除成员确认
    const confirmRemoveMember = (member) => {
      confirmDialog.value = {
        title: '移除成员',
        message: `确定要将 ${member.nickname || member.username} 移出群组吗？`,
        confirmText: '移除',
        isDanger: true,
        action: async () => {
          try {
            isSubmitting.value = true
            // 这里需要在chatStore中添加removeMember方法
            // await chatStore.removeMember(selectedGroup.value.id, member.id)
            
            // 刷新选中的群组信息
            // const updatedGroup = await chatStore.getGroupDetail(selectedGroup.value.id)
            // selectedGroup.value = updatedGroup
            
            closeConfirmDialog()
          } catch (err) {
            error.value = err.message || '移除成员失败'
            isSubmitting.value = false
          }
        }
      }
      showConfirmDialog.value = true
    }
    
    // 关闭确认对话框
    const closeConfirmDialog = () => {
      showConfirmDialog.value = false
      confirmDialog.value = {
        title: '',
        message: '',
        confirmText: '',
        action: null,
        isDanger: false
      }
    }
    
    // 搜索成员（这里只是模拟，实际需要调用API）
    const searchMembers = async () => {
      if (!memberSearchQuery.value.trim()) {
        memberSearchResults.value = []
        return
      }
      
      try {
        isSearching.value = true
        // 这里应该调用API搜索用户
        // 模拟搜索结果
        const query = memberSearchQuery.value.toLowerCase()
        // 过滤掉已选中的成员
        const filteredUsers = [
          // 模拟数据
          { id: '1', username: 'user1', nickname: '用户一' },
          { id: '2', username: 'user2', nickname: '用户二' },
          { id: '3', username: 'user3', nickname: '用户三' }
        ].filter(user => 
          (user.username.toLowerCase().includes(query) || 
           user.nickname.toLowerCase().includes(query) ||
           user.id.includes(query)) &&
          !newGroup.value.members.find(m => m.id === user.id)
        )
        
        memberSearchResults.value = filteredUsers
      } catch (err) {
        console.error('搜索用户失败:', err)
        memberSearchResults.value = []
      } finally {
        isSearching.value = false
      }
    }
    
    // 选择用户
    const selectUser = (user) => {
      newGroup.value.members.push(user)
      memberSearchQuery.value = ''
      memberSearchResults.value = []
    }
    
    // 添加成员（通过ID）
    const addMember = () => {
      const query = memberSearchQuery.value.trim()
      if (!query) return
      
      // 这里应该调用API根据ID查找用户
      // 模拟添加成员
      const mockUser = { id: query, username: `user_${query}`, nickname: `用户_${query}` }
      if (!newGroup.value.members.find(m => m.id === mockUser.id)) {
        newGroup.value.members.push(mockUser)
        memberSearchQuery.value = ''
        memberSearchResults.value = []
      }
    }
    
    // 移除已选成员
    const removeSelectedMember = (memberId) => {
      newGroup.value.members = newGroup.value.members.filter(m => m.id !== memberId)
    }
    
    // 获取群组成员姓名首字母
    const getMemberInitial = (member) => {
      const name = member.nickname || member.username
      return name ? name.charAt(0).toUpperCase() : '?'
    }
    
    // 获取群组名称首字母
    const getGroupInitial = (name) => {
      return name ? name.charAt(0).toUpperCase() : '?'
    }
    
    // 判断是否是群主
    const isOwner = (userId) => {
      return selectedGroup.value && selectedGroup.value.ownerId === userId
    }
    
    // 获取群主姓名
    const getOwnerName = (group) => {
      const owner = group.members.find(m => m.id === group.ownerId)
      return owner ? (owner.nickname || owner.username) : '未知'
    }
    
    // 格式化日期
    const formatDate = (dateString) => {
      const date = new Date(dateString)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    // 组件挂载时加载群组列表
    onMounted(() => {
      loadGroups()
    })
    
    return {
      groups,
      selectedGroup,
      isLoading,
      error,
      showCreateModal,
      newGroup,
      memberSearchQuery,
      memberSearchResults,
      isSearching,
      showEditModal,
      editingGroup,
      showConfirmDialog,
      confirmDialog,
      isSubmitting,
      currentUserId,
      selectGroup,
      viewGroupDetails,
      navigateToChat,
      submitCreateGroup,
      closeCreateModal,
      editGroup,
      submitEditGroup,
      closeEditModal,
      confirmLeaveGroup,
      confirmDeleteGroup,
      confirmRemoveMember,
      closeConfirmDialog,
      searchMembers,
      selectUser,
      addMember,
      removeSelectedMember,
      getMemberInitial,
      getGroupInitial,
      isOwner,
      getOwnerName,
      formatDate
    }
  }
}
</script>

<style scoped>
.group-management-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  position: relative;
  min-height: 100vh;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.page-header h1 {
  font-size: 24px;
  margin: 0;
}

.create-group-btn {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.3s;
}

.create-group-btn:hover {
  background-color: #45a049;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #666;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #4CAF50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  background-color: #ffdddd;
  color: #d32f2f;
  padding: 12px 20px;
  border-radius: 6px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-message .close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #d32f2f;
}

.groups-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.group-item {
  background-color: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.group-item:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.group-item.active {
  border-left: 4px solid #4CAF50;
}

.group-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.group-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background-color: #4CAF50;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: bold;
}

.group-details h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
}

.group-details p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.group-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.view-btn {
  background-color: #2196F3;
  color: white;
}

.view-btn:hover {
  background-color: #0b7dda;
}

.edit-btn {
  background-color: #FFC107;
  color: #333;
}

.edit-btn:hover {
  background-color: #e0a800;
}

.leave-btn {
  background-color: #f44336;
  color: white;
}

.leave-btn:hover {
  background-color: #d32f2f;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
  color: #ccc;
}

.empty-state h2 {
  margin: 0 0 12px 0;
  font-size: 20px;
}

.empty-state p {
  margin: 0 0 24px 0;
}

.primary-btn {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s;
}

.primary-btn:hover {
  background-color: #45a049;
}

.group-details-sidebar {
  position: fixed;
  top: 0;
  right: -400px;
  width: 400px;
  height: 100vh;
  background-color: #fff;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
  transition: right 0.3s;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.group-details-sidebar.open {
  right: 0;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h2 {
  margin: 0;
  font-size: 20px;
}

.close-sidebar {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.group-meta {
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.group-meta p {
  margin: 8px 0;
  color: #666;
}

.members-section {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.members-section h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
}

.members-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.member-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background-color: #f5f5f5;
  border-radius: 6px;
}

.member-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.member-name {
  margin: 0;
  font-weight: 500;
}

.member-role {
  margin: 0;
  font-size: 12px;
  color: #666;
}

.member-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #2196F3;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
  margin-right: 12px;
}

.remove-member-btn {
  background-color: #f44336;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.sidebar-actions {
  padding: 20px;
  border-top: 1px solid #eee;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.danger-btn {
  background-color: #f44336;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s;
}

.danger-btn:hover {
  background-color: #d32f2f;
}

/* 模态框样式 */
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
  z-index: 2000;
}

.modal-content {
  background-color: #fff;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
}

.confirm-dialog {
  max-width: 400px;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
}

.close-modal {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.char-count {
  text-align: right;
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.add-members-section {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.add-members-section input {
  flex: 1;
}

.add-btn {
  background-color: #2196F3;
  color: white;
  border: none;
  padding: 0 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.search-results {
  background-color: #f5f5f5;
  border-radius: 4px;
  max-height: 150px;
  overflow-y: auto;
  border: 1px solid #ddd;
}

.search-result-item {
  padding: 10px 15px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-result-item:hover {
  background-color: #e3f2fd;
}

.user-id {
  font-size: 12px;
  color: #666;
}

.selected-members h4 {
  margin: 0 0 12px 0;
}

.selected-members-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.selected-member-item {
  background-color: #e3f2fd;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.remove-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 30px;
}

.cancel-btn {
  background-color: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.create-btn,
.save-btn,
.confirm-btn {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.create-btn:disabled,
.save-btn:disabled,
.confirm-btn:disabled,
.danger-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .group-details-sidebar {
    width: 100%;
    right: -100%;
  }
  
  .groups-list {
    grid-template-columns: 1fr;
  }
  
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .modal-content {
    width: 95%;
    margin: 20px;
  }
}
</style>