<template>
  <div class="search-bar-container">
    <div class="search-input-wrapper">
      <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="placeholder"
        class="search-input"
        @input="handleSearchInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown.enter="executeSearch"
        @keydown.arrow-down="navigateResults('down')"
        @keydown.arrow-up="navigateResults('up')"
        :aria-label="placeholder"
      />
      
      <button
        v-if="searchQuery"
        class="clear-button"
        @click="clearSearch"
        aria-label="清除搜索"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    
    <!-- 搜索结果下拉框 -->
    <div 
      v-if="showDropdown" 
      class="search-dropdown"
      :class="{ 'has-results': searchResults.length > 0, 'has-history': searchHistory.length > 0 }"
    >
      <!-- 搜索历史 -->
      <div v-if="isHistoryVisible && searchHistory.length > 0" class="search-history">
        <div class="history-header">
          <span class="history-title">搜索历史</span>
          <button class="clear-history" @click="clearSearchHistory">清除</button>
        </div>
        <ul class="history-list">
          <li 
            v-for="(item, index) in searchHistory" 
            :key="`history-${index}`"
            class="history-item"
            @click="selectHistoryItem(item)"
          >
            <svg class="history-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"></path>
              <path d="m12 8-4 4 4 4"></path>
            </svg>
            <span>{{ item }}</span>
          </li>
        </ul>
      </div>
      
      <!-- 搜索建议 -->
      <div v-if="searchQuery && searchResults.length > 0" class="search-suggestions">
        <div class="suggestions-header">
          <span class="suggestions-title">搜索结果</span>
          <span class="result-count">{{ searchResults.length }} 个结果</span>
        </div>
        <ul class="suggestions-list">
          <li 
            v-for="(game, index) in searchResults" 
            :key="`game-${game.name}`"
            class="suggestion-item"
            :class="{ 'selected': selectedIndex === index }"
            @click="selectGame(game)"
          >
            <img 
              v-lazy="getGamePosterUrl(game.name)"
              :alt="game.name"
              class="suggestion-poster"
              :width="40"
              :height="40"
            />
            <div class="suggestion-content">
              <h4 class="suggestion-title" v-html="highlightText(game.name)"></h4>
              <p class="suggestion-description">{{ game.description || '暂无描述' }}</p>
              <div class="suggestion-tags">
                <span 
                  v-for="(tag, tagIndex) in game.tags.slice(0, 3)" 
                  :key="`tag-${tagIndex}`"
                  class="suggestion-tag"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
          </li>
        </ul>
      </div>
      
      <!-- 无结果 -->
      <div v-if="searchQuery && searchResults.length === 0" class="no-results">
        <p>没有找到相关游戏</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../store/gameStore'
import { debounce } from 'lodash'

// Props
const props = defineProps({
  placeholder: {
    type: String,
    default: '搜索游戏名称、类型或描述...'
  },
  initialValue: {
    type: String,
    default: ''
  },
  minQueryLength: {
    type: Number,
    default: 1
  }
})

// Emits
const emit = defineEmits(['search', 'clear', 'select', 'focus', 'blur'])

// 路由
const router = useRouter()
const gameStore = useGameStore()

// 响应式数据
const searchQuery = ref(props.initialValue)
const searchResults = ref([])
const searchHistory = ref([])
const showDropdown = ref(false)
const selectedIndex = ref(-1)
const isSearching = ref(false)

// 计算属性
const isHistoryVisible = computed(() => {
  return !searchQuery.value.trim()
})

// 获取游戏海报URL
const getGamePosterUrl = (gameName) => {
  const posterMap = {
    '超级马里奥': 'SuperMario.png',
    'Flappy Bird': 'FlappyBird.png',
    'Getting Over It v1.4': 'GettingOverIt.png',
    'Appel v1.4': 'Appel.png',
    'GunTower': 'GunTower.png',
    'GunTower-Endless': 'GunTowerEndless.png',
    'Hill Climb Racing v1.0': 'HillClimbRacing.png',
    'Griffpatch\'s 3D Laser Tag v0.8': 'LaserTag.png'
  }
  return `/game-website-core/assets/Poster/${posterMap[gameName] || 'default.png'}`
}

// 防抖搜索函数
const performSearch = debounce(async () => {
  if (!searchQuery.value.trim() || searchQuery.value.trim().length < props.minQueryLength) {
    searchResults.value = []
    return
  }
  
  isSearching.value = true
  try {
    // 确保游戏数据已加载
    if (!gameStore.games || gameStore.games.length === 0) {
      await gameStore.loadGames()
    }
    
    // 调用store中的搜索方法
    const results = gameStore.searchGames(searchQuery.value.trim())
    searchResults.value = results
    selectedIndex.value = -1
  } catch (error) {
    console.error('搜索失败:', error)
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}, 300)

// 高亮搜索文本
const highlightText = (text) => {
  if (!searchQuery.value.trim()) return text
  
  const regex = new RegExp(`(${searchQuery.value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

// 导航搜索结果
const navigateResults = (direction) => {
  if (searchResults.value.length === 0) return
  
  if (direction === 'down') {
    selectedIndex.value = (selectedIndex.value + 1) % searchResults.value.length
  } else {
    selectedIndex.value = (selectedIndex.value - 1 + searchResults.value.length) % searchResults.value.length
  }
  
  // 滚动到选中项
  setTimeout(() => {
    const selectedElement = document.querySelector('.suggestion-item.selected')
    if (selectedElement) {
      const dropdown = document.querySelector('.search-dropdown')
      if (dropdown) {
        const dropdownHeight = dropdown.clientHeight
        const selectedTop = selectedElement.offsetTop
        const selectedHeight = selectedElement.clientHeight
        
        if (selectedTop + selectedHeight > dropdownHeight) {
          dropdown.scrollTop = selectedTop + selectedHeight - dropdownHeight
        } else if (selectedTop < dropdown.scrollTop) {
          dropdown.scrollTop = selectedTop
        }
      }
    }
  }, 0)
}

// 选择游戏
const selectGame = (game) => {
  // 保存到搜索历史
  saveToSearchHistory(searchQuery.value.trim())
  
  // 发送选择事件
  emit('select', game)
  
  // 导航到游戏详情页
  router.push(`/game/${encodeURIComponent(game.name)}`)
  
  // 关闭下拉框并重置状态
  resetSearchState()
}

// 选择历史项
const selectHistoryItem = (query) => {
  searchQuery.value = query
  executeSearch()
}

// 执行搜索
const executeSearch = () => {
  const query = searchQuery.value.trim()
  if (!query) return
  
  // 保存到搜索历史
  saveToSearchHistory(query)
  
  // 发送搜索事件
  emit('search', query)
  
  // 关闭下拉框
  showDropdown.value = false
  
  // 如果有选中项，使用选中项执行搜索
  if (selectedIndex.value >= 0 && searchResults.value.length > 0) {
    selectGame(searchResults.value[selectedIndex.value])
  } else {
    // 否则导航到搜索结果页
    router.push({ path: '/search', query: { q: query } })
  }
}

// 清除搜索
const clearSearch = () => {
  searchQuery.value = ''
  searchResults.value = []
  selectedIndex.value = -1
  emit('clear')
  performSearch() // 触发搜索重置结果
}

// 处理输入
const handleSearchInput = () => {
  performSearch()
}

// 处理焦点
const handleFocus = () => {
  showDropdown.value = true
  emit('focus')
}

// 处理失焦
const handleBlur = () => {
  // 延迟关闭，让点击事件能够触发
  setTimeout(() => {
    showDropdown.value = false
    selectedIndex.value = -1
    emit('blur')
  }, 200)
}

// 保存搜索历史
const saveToSearchHistory = (query) => {
  if (!query || query.length < props.minQueryLength) return
  
  // 移除重复项
  const index = searchHistory.value.indexOf(query)
  if (index > -1) {
    searchHistory.value.splice(index, 1)
  }
  
  // 添加到历史记录开头
  searchHistory.value.unshift(query)
  
  // 限制历史记录数量
  if (searchHistory.value.length > 10) {
    searchHistory.value = searchHistory.value.slice(0, 10)
  }
  
  // 保存到localStorage
  localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value))
}

// 清除搜索历史
const clearSearchHistory = () => {
  searchHistory.value = []
  localStorage.removeItem('searchHistory')
}

// 重置搜索状态
const resetSearchState = () => {
  searchResults.value = []
  selectedIndex.value = -1
  showDropdown.value = false
}

// 从localStorage加载搜索历史
const loadSearchHistory = () => {
  try {
    const saved = localStorage.getItem('searchHistory')
    if (saved) {
      searchHistory.value = JSON.parse(saved)
    }
  } catch (error) {
    console.error('加载搜索历史失败:', error)
    searchHistory.value = []
  }
}

// 监听初始值变化
watch(() => props.initialValue, (newValue) => {
  searchQuery.value = newValue
  if (newValue) {
    performSearch()
  }
})

// 组件挂载时初始化
onMounted(() => {
  loadSearchHistory()
  if (props.initialValue) {
    performSearch()
  }
})
</script>

<style scoped>
.search-bar-container {
  position: relative;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 16px;
  color: var(--text-secondary, #A0A0A0);
  pointer-events: none;
  z-index: 2;
}

.search-input {
  width: 100%;
  padding: 12px 48px 12px 44px;
  border-radius: var(--border-radius-full, 30px);
  border: 2px solid var(--border-color, #333);
  background-color: var(--surface-bg, #2A2A3E);
  color: #F0F0F0; /* 确保默认颜色始终可见 */
  font-size: 16px;
  outline: none;
  transition: all var(--transition-fast, 0.3s ease);
  height: 48px;
  box-sizing: border-box;
}

.search-input:focus {
  border-color: var(--accent-primary, #9D4EDD);
  box-shadow: 0 0 10px rgba(157, 78, 221, 0.3);
}

.search-input::placeholder {
  color: var(--text-secondary, #A0A0A0);
}

.clear-button {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  color: var(--text-secondary, #A0A0A0);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--border-radius-full, 50%);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast, 0.3s ease);
  z-index: 2;
}

.clear-button:hover {
  background-color: var(--hover-bg, #3A3A4E);
  color: var(--text-primary, #F0F0F0);
}

/* 下拉框样式 */
.search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background-color: var(--surface-bg, #2A2A3E);
  border-radius: var(--border-radius-lg, 12px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--border-color, #333);
}

.search-dropdown.has-results,
.search-dropdown.has-history {
  display: block;
}

/* 搜索历史样式 */
.search-history,
.search-suggestions {
  padding: 8px 0;
}

.history-header,
.suggestions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color, #333);
}

.history-title,
.suggestions-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary, #A0A0A0);
}

.clear-history {
  background: none;
  border: none;
  color: var(--accent-primary, #9D4EDD);
  font-size: 14px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--border-radius, 4px);
  transition: all var(--transition-fast, 0.3s ease);
}

.clear-history:hover {
  background-color: var(--hover-bg, #3A3A4E);
}

.result-count {
  font-size: 14px;
  color: var(--text-muted, #666);
}

.history-list,
.suggestions-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.history-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color var(--transition-fast, 0.3s ease);
}

.history-item:hover {
  background-color: var(--hover-bg, #3A3A4E);
}

.history-icon {
  margin-right: 12px;
  color: var(--text-secondary, #A0A0A0);
  flex-shrink: 0;
}

.history-item span {
  color: var(--text-primary, #F0F0F0);
  font-size: 14px;
}

/* 搜索建议样式 */
.suggestion-item {
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color var(--transition-fast, 0.3s ease);
  border-bottom: 1px solid var(--border-color, #333);
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover,
.suggestion-item.selected {
  background-color: var(--hover-bg, #3A3A4E);
}

.suggestion-poster {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: var(--border-radius-md, 8px);
  margin-right: 12px;
  flex-shrink: 0;
}

.suggestion-content {
  flex: 1;
  min-width: 0;
}

.suggestion-title {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #F0F0F0);
  line-height: 1.2;
}

.suggestion-title mark {
  background-color: rgba(157, 78, 221, 0.3);
  color: var(--accent-primary, #9D4EDD);
  padding: 0 2px;
  border-radius: 2px;
}

.suggestion-description {
  margin: 0 0 6px 0;
  font-size: 12px;
  color: var(--text-secondary, #A0A0A0);
  line-height: 1.3;
  display: -webkit-box;
  display: -moz-box;
  display: box;
  -webkit-line-clamp: 1;
  -moz-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  -moz-box-orient: vertical;
  box-orient: vertical;
  overflow: hidden;
}

.suggestion-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.suggestion-tag {
  background-color: var(--accent-bg, #16213E);
  color: var(--accent-secondary, #4CC9F0);
  padding: 2px 8px;
  border-radius: var(--border-radius-full, 10px);
  font-size: 11px;
}

/* 无结果样式 */
.no-results {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-secondary, #A0A0A0);
}

.no-results p {
  margin: 0;
  font-size: 14px;
}

/* 滚动条样式 */
.search-dropdown::-webkit-scrollbar {
  width: 6px;
}

.search-dropdown::-webkit-scrollbar-track {
  background-color: var(--surface-bg, #2A2A3E);
}

.search-dropdown::-webkit-scrollbar-thumb {
  background-color: var(--border-color, #333);
  border-radius: 3px;
}

.search-dropdown::-webkit-scrollbar-thumb:hover {
  background-color: var(--accent-primary, #9D4EDD);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .search-bar-container {
    max-width: 100%;
  }
  
  .search-input {
    height: 44px;
    font-size: 14px;
    padding: 10px 44px 10px 40px;
  }
  
  .search-icon {
    width: 18px;
    height: 18px;
    left: 14px;
  }
  
  .clear-button {
    right: 10px;
    padding: 4px;
  }
  
  .clear-button svg {
    width: 16px;
    height: 16px;
  }
  
  .search-dropdown {
    max-height: 300px;
  }
  
  .suggestion-poster {
    width: 32px;
    height: 32px;
  }
  
  .suggestion-item {
    padding: 10px 14px;
  }
}

@media (max-width: 480px) {
  .search-input {
    height: 40px;
    font-size: 13px;
  }
  
  .history-item,
  .suggestion-item {
    padding: 10px 12px;
  }
  
  .history-header,
  .suggestions-header {
    padding: 8px 12px;
  }
}

/* 触控优化 */
@media (hover: none) and (pointer: coarse) {
  .search-input {
    height: 52px;
    font-size: 16px;
  }
  
  .history-item,
  .suggestion-item,
  .clear-button,
  .clear-history {
    min-height: 48px;
    display: flex;
    align-items: center;
  }
  
  .history-item:hover,
  .suggestion-item:hover {
    background-color: transparent;
  }
  
  .suggestion-item:active,
  .history-item:active,
  .suggestion-item.selected {
    background-color: var(--hover-bg, #3A3A4E);
  }
}
</style>