<template>
  <!-- 底部导航栏 -->
  <div class="mobile-nav">
    <div class="nav-items">
      <router-link to="/" class="nav-item" active-class="active">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        <span>首页</span>
      </router-link>
      <button class="nav-item" @click="openCategoryPanel" :class="{ 'active': categoryPanelOpen }">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
        <span>分类</span>
      </button>
      <button class="nav-item" @click="openSearchPanel" :class="{ 'active': searchPanelOpen }">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <span>搜索</span>
      </button>
      <button class="nav-item" @click="openProfilePanel" :class="{ 'active': profilePanelOpen }">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span>我的</span>
      </button>
    </div>
  </div>

  <!-- 分类筛选面板 -->
  <transition name="slide-up">
    <div v-if="categoryPanelOpen" class="filter-panel">
      <div class="panel-header">
        <h3>筛选游戏</h3>
        <button class="close-btn" @click="closeAllPanels">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="panel-content">
        <!-- 游戏类型筛选 -->
        <div class="filter-section">
          <h4>游戏类型</h4>
          <div class="filter-options">
            <button 
              v-for="type in gameTypes" 
              :key="type"
              class="filter-option"
              :class="{ 'active': selectedTypes.includes(type) }"
              @click="toggleType(type)"
            >
              {{ type }}
            </button>
          </div>
        </div>
        
        <!-- 平台筛选 -->
        <div class="filter-section">
          <h4>平台</h4>
          <div class="filter-options">
            <button 
              v-for="platform in platforms" 
              :key="platform"
              class="filter-option"
              :class="{ 'active': selectedPlatform === platform }"
              @click="selectPlatform(platform)"
            >
              {{ platform }}
            </button>
          </div>
        </div>
        
        <!-- 排序方式 -->
        <div class="filter-section">
          <h4>排序方式</h4>
          <div class="filter-options">
            <button 
              v-for="sort in sortOptions" 
              :key="sort.value"
              class="filter-option"
              :class="{ 'active': selectedSort === sort.value }"
              @click="selectSort(sort.value)"
            >
              {{ sort.label }}
            </button>
          </div>
        </div>
        
        <!-- 标签筛选 -->
        <div class="filter-section">
          <h4>标签</h4>
          <div class="filter-options tags-options">
            <button 
              v-for="tag in popularTags" 
              :key="tag"
              class="filter-option tag-option"
              :class="{ 'active': selectedTags.includes(tag) }"
              @click="toggleTag(tag)"
            >
              {{ tag }}
            </button>
          </div>
        </div>
      </div>
      
      <div class="panel-footer">
        <button class="reset-btn" @click="resetFilters">重置</button>
        <button class="apply-btn" @click="applyFilters">应用筛选</button>
      </div>
    </div>
  </transition>

  <!-- 搜索面板 -->
  <transition name="slide-down">
    <div v-if="searchPanelOpen" class="search-panel">
      <div class="search-header">
        <div class="search-input-container">
          <input 
            type="text" 
            placeholder="搜索游戏名称、标签或描述..."
            class="search-input"
            v-model="searchQuery"
            @input="handleSearchInput"
            @focus="showSearchResults = true"
            ref="searchInputRef"
          />
          <button class="clear-btn" v-if="searchQuery" @click="clearSearch">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <button class="close-btn" @click="closeSearchPanel">
          取消
        </button>
      </div>
      
      <!-- 搜索历史 -->
      <div v-if="!searchQuery && searchHistory.length > 0" class="search-history">
        <div class="history-header">
          <h4>搜索历史</h4>
          <button class="clear-history-btn" @click="clearSearchHistory">
            清空
          </button>
        </div>
        <div class="history-items">
          <button 
            v-for="(item, index) in searchHistory" 
            :key="index"
            class="history-item"
            @click="searchWithHistory(item)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              <line x1="10" y1="13" x2="10" y2="17"></line>
              <line x1="14" y1="13" x2="14" y2="17"></line>
              <line x1="8" y1="9" x2="16" y2="9"></line>
            </svg>
            {{ item }}
          </button>
        </div>
      </div>
      
      <!-- 热门搜索 -->
      <div v-if="!searchQuery && searchHistory.length === 0" class="hot-searches">
        <h4>热门搜索</h4>
        <div class="hot-search-items">
          <button 
            v-for="(item, index) in hotSearchItems" 
            :key="index"
            class="hot-search-item"
            @click="searchWithHistory(item)"
          >
            <span class="rank">{{ index + 1 }}</span>
            {{ item }}
          </button>
        </div>
      </div>
      
      <!-- 搜索结果 -->
      <div v-if="showSearchResults && searchResults.length > 0" class="search-results">
        <div 
          v-for="game in searchResults" 
          :key="game.name"
          class="search-result-item"
          @click="navigateToGame(game.name)"
        >
          <div class="result-info">
            <h4 class="result-title">{{ game.name }}</h4>
            <p class="result-description">{{ truncateText(game.description, 60) }}</p>
          </div>
        </div>
      </div>
      
      <!-- 无结果提示 -->
      <div v-if="showSearchResults && searchResults.length === 0 && searchQuery" class="no-results">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          <line x1="8" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="8" y2="12"></line>
        </svg>
        <p>未找到相关游戏</p>
      </div>
    </div>
  </transition>

  <!-- 遮罩层 -->
  <transition name="fade">
    <div 
      v-if="categoryPanelOpen || profilePanelOpen"
      class="panel-overlay"
      @click="closeAllPanels"
    ></div>
  </transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../store/gameStore'
import { useCategoryStore } from '../store/categoryStore'
import { useTagStore } from '../store/tagStore'
import { debounce } from 'lodash'

// 响应式状态
const categoryPanelOpen = ref(false)
const searchPanelOpen = ref(false)
const profilePanelOpen = ref(false)
const showSearchResults = ref(false)
const searchQuery = ref('')
const searchResults = ref([])
const searchInputRef = ref(null)

// 筛选相关状态
const selectedTypes = ref([])
const selectedPlatform = ref('全部')
const selectedSort = ref('popularity')
const selectedTags = ref([])

// 数据
const gameTypes = ['动作', '冒险', '休闲', '策略', '角色扮演', '模拟', '竞技']
const platforms = ['全部', 'PC', '移动端', '主机', 'Web']
const sortOptions = [
  { label: '热门优先', value: 'popularity' },
  { label: '评分最高', value: 'rating' },
  { label: '最新发布', value: 'release' },
  { label: '名称排序', value: 'name' }
]
const hotSearchItems = ['超级马里奥', '赛车游戏', '多人联机', '免费游戏', '冒险游戏']
const searchHistory = ref([])

// 路由和状态管理
const router = useRouter()
const gameStore = useGameStore()
const categoryStore = useCategoryStore()
const tagStore = useTagStore()

// 计算热门标签
const popularTags = ref([])

// 打开分类面板
const openCategoryPanel = () => {
  closeAllPanels()
  categoryPanelOpen.value = true
  // 加载热门标签
  loadPopularTags()
}

// 打开搜索面板
const openSearchPanel = () => {
  closeAllPanels()
  searchPanelOpen.value = true
  nextTick(() => {
    searchInputRef.value?.focus()
  })
  // 加载搜索历史
  loadSearchHistory()
}

// 打开个人面板
const openProfilePanel = () => {
  closeAllPanels()
  profilePanelOpen.value = true
}

// 关闭搜索面板
const closeSearchPanel = () => {
  searchPanelOpen.value = false
  showSearchResults.value = false
  searchQuery.value = ''
}

// 关闭所有面板
const closeAllPanels = () => {
  categoryPanelOpen.value = false
  searchPanelOpen.value = false
  profilePanelOpen.value = false
  showSearchResults.value = false
}

// 加载热门标签
const loadPopularTags = () => {
  // 从tagStore获取热门标签，或使用预设标签
  popularTags.value = tagStore.popularTags.length > 0 
    ? tagStore.popularTags 
    : ['经典', '3D', '多人联机', '免费', '独立游戏']
}

// 筛选器操作
const toggleType = (type) => {
  const index = selectedTypes.value.indexOf(type)
  if (index > -1) {
    selectedTypes.value.splice(index, 1)
  } else {
    selectedTypes.value.push(type)
  }
}

const selectPlatform = (platform) => {
  selectedPlatform.value = platform
}

const selectSort = (sort) => {
  selectedSort.value = sort
}

const toggleTag = (tag) => {
  const index = selectedTags.value.indexOf(tag)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tag)
  }
}

const resetFilters = () => {
  selectedTypes.value = []
  selectedPlatform.value = '全部'
  selectedSort.value = 'popularity'
  selectedTags.value = []
}

const applyFilters = () => {
  // 更新categoryStore的筛选条件
  categoryStore.setFilters({
    types: selectedTypes.value,
    platform: selectedPlatform.value === '全部' ? null : selectedPlatform.value,
    sort: selectedSort.value,
    tags: selectedTags.value
  })
  
  // 导航到分类页并应用筛选
  router.push({
    path: '/category',
    query: categoryStore.getFilterQuery()
  })
  
  closeAllPanels()
}

// 搜索相关操作
const handleSearchInput = debounce(() => {
  if (searchQuery.value.trim()) {
    searchResults.value = gameStore.searchGames(searchQuery.value.trim())
    showSearchResults.value = true
  } else {
    searchResults.value = []
    showSearchResults.value = false
  }
}, 300)

const clearSearch = () => {
  searchQuery.value = ''
  searchResults.value = []
  showSearchResults.value = false
}

const navigateToGame = (gameName) => {
  // 添加到搜索历史
  addToSearchHistory(searchQuery.value.trim())
  
  // 导航到游戏详情页
  router.push({
    path: '/game/:name',
    name: 'GameDetail',
    params: { name: encodeURIComponent(gameName) }
  })
  
  closeAllPanels()
}

// 搜索历史管理
const loadSearchHistory = () => {
  const history = localStorage.getItem('searchHistory')
  searchHistory.value = history ? JSON.parse(history) : []
}

const addToSearchHistory = (query) => {
  if (!query) return
  
  // 移除重复项
  const index = searchHistory.value.indexOf(query)
  if (index > -1) {
    searchHistory.value.splice(index, 1)
  }
  
  // 添加到开头
  searchHistory.value.unshift(query)
  
  // 限制历史记录数量
  if (searchHistory.value.length > 10) {
    searchHistory.value = searchHistory.value.slice(0, 10)
  }
  
  // 保存到localStorage
  localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value))
}

const searchWithHistory = (query) => {
  searchQuery.value = query
  handleSearchInput()
  addToSearchHistory(query)
}

const clearSearchHistory = () => {
  searchHistory.value = []
  localStorage.removeItem('searchHistory')
}

// 截断文本
const truncateText = (text, maxLength) => {
  if (!text) return ''
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

// 处理返回键
const handleBackPress = () => {
  if (categoryPanelOpen.value || searchPanelOpen.value || profilePanelOpen.value) {
    closeAllPanels()
    return true
  }
  return false
}

// 生命周期钩子
onMounted(() => {
  // 加载游戏数据
  gameStore.loadGames()
  
  // 监听返回键
  window.addEventListener('popstate', handleBackPress)
  
  // 初始化筛选器
  resetFilters()
})

onUnmounted(() => {
  window.removeEventListener('popstate', handleBackPress)
})
</script>

<style scoped>
/* 底部导航栏 */
.mobile-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background-color: var(--secondary-bg);
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
}

.nav-items {
  display: flex;
  width: 100%;
  height: 100%;
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  min-height: 48px;
}

.nav-item svg {
  margin-bottom: 4px;
}

.nav-item span {
  font-size: 0.75rem;
}

.nav-item.active {
  color: var(--accent-primary);
}

.nav-item:hover {
  background-color: var(--hover-bg);
  transform: none;
  box-shadow: none;
}

/* 通用面板样式 */
.filter-panel,
.search-panel {
  position: fixed;
  bottom: 60px;
  left: 0;
  right: 0;
  background-color: var(--secondary-bg);
  border-top-left-radius: var(--border-radius-xl);
  border-top-right-radius: var(--border-radius-xl);
  box-shadow: 0 -5px 20px rgba(0, 0, 0, 0.2);
  z-index: 950;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.filter-panel {
  transform: translateY(100%);
  animation: slideUp 0.3s ease-out forwards;
}

.search-panel {
  transform: translateY(-100%);
  animation: slideDown 0.3s ease-out forwards;
}

@keyframes slideUp {
  to {
    transform: translateY(0);
  }
}

@keyframes slideDown {
  to {
    transform: translateY(0);
  }
}

.panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 940;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 面板头部 */
.panel-header,
.search-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-header h3,
.search-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

/* 搜索头部特殊样式 */
.search-header {
  flex-direction: row;
  gap: 1rem;
}

.search-input-container {
  flex: 1;
  position: relative;
}

.search-input {
  width: 100%;
  padding: 0.75rem 2.5rem 0.75rem 1rem;
  background-color: var(--surface-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  color: var(--text-primary);
  font-size: 1rem;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px rgba(157, 78, 221, 0.2);
}

.clear-btn {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn {
  background: none;
  border: none;
  color: var(--accent-primary);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 面板内容 */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.filter-section {
  margin-bottom: 1.5rem;
}

.filter-section h4 {
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.filter-option {
  padding: 0.5rem 1rem;
  background-color: var(--surface-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-full);
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-option.active {
  background-color: var(--accent-primary);
  border-color: var(--accent-primary);
  color: white;
}

.filter-option:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

/* 标签选项特殊样式 */
.tags-options {
  gap: 0.5rem;
}

.tag-option {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  min-height: 36px;
}

/* 面板底部 */
.panel-footer {
  padding: 1rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 1rem;
}

.reset-btn,
.apply-btn {
  flex: 1;
  padding: 0.75rem;
  border-radius: var(--border-radius-lg);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-height: 48px;
}

.reset-btn {
  background-color: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.reset-btn:hover {
  background-color: var(--hover-bg);
}

.apply-btn {
  background-color: var(--accent-primary);
  border: 1px solid var(--accent-primary);
  color: white;
}

.apply-btn:hover {
  background-color: var(--accent-primary-dark);
  border-color: var(--accent-primary-dark);
}

/* 搜索历史和热门搜索 */
.search-history,
.hot-searches {
  padding: 1rem;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.history-header h4,
.hot-searches h4 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.clear-history-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.875rem;
  cursor: pointer;
}

.history-items,
.hot-search-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.history-item,
.hot-search-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background-color: var(--surface-bg);
  border-radius: var(--border-radius-md);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
}

.history-item:hover,
.hot-search-item:hover {
  background-color: var(--hover-bg);
}

.hot-search-item .rank {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background-color: var(--accent-primary);
  color: white;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
}

/* 搜索结果 */
.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 0 1rem;
}

.search-result-item {
  padding: 1rem 0;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background-color: var(--hover-bg);
}

.result-title {
  margin: 0 0 0.25rem 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.result-description {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

/* 无结果提示 */
.no-results {
  padding: 3rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  text-align: center;
}

.no-results svg {
  margin-bottom: 1rem;
  opacity: 0.5;
}

.no-results p {
  margin: 0;
  font-size: 0.9375rem;
}

/* 动画 */
.slide-up-enter-active,
.slide-up-leave-active,
.slide-down-enter-active,
.slide-down-leave-active {
  transition: transform 0.3s ease-out;
}

.slide-up-enter-from {
  transform: translateY(100%);
}

.slide-up-leave-to {
  transform: translateY(100%);
}

.slide-down-enter-from {
  transform: translateY(-100%);
}

.slide-down-leave-to {
  transform: translateY(-100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 滚动条样式 */
.panel-content::-webkit-scrollbar,
.search-results::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track,
.search-results::-webkit-scrollbar-track {
  background: var(--surface-bg);
}

.panel-content::-webkit-scrollbar-thumb,
.search-results::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb:hover,
.search-results::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

/* 响应式调整 */
@media (min-width: 768px) {
  .mobile-nav {
    display: none;
  }
}

/* 触控区域优化 */
@media (hover: none) and (pointer: coarse) {
  .filter-option,
  .history-item,
  .hot-search-item {
    min-height: 48px;
  }
}
</style>