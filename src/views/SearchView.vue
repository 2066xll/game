<template>
  <ResponsiveContainer class="search-view">
    <div class="search-container">
      <!-- 搜索栏 -->
      <div class="search-header">
        <SearchBar 
          :initial-value="searchQuery"
          @search="handleSearch"
          @select="handleGameSelect"
        />
      </div>
      
      <!-- 搜索结果统计 -->
      <div class="search-stats" v-if="searchQuery">
        <h1 class="search-title">
          搜索结果: 
          <span class="search-keyword">{{ searchQuery }}</span>
        </h1>
        <div class="stats-info">
          <span class="result-count">找到 {{ searchResults.length }} 个结果</span>
          <span class="search-time">{{ searchTime }}ms</span>
        </div>
      </div>
      
      <!-- 筛选器 -->
      <div class="filter-container" v-if="searchResults.length > 0">
        <ResponsiveFilter 
          :initial-filters="initialFilters"
          @filter-change="handleFilterChange"
        />
      </div>
      
      <!-- 排序选项 -->
      <div class="sort-options" v-if="searchResults.length > 0">
        <label class="sort-label">排序方式:</label>
        <select 
          v-model="sortOption"
          class="sort-select"
          @change="handleSortChange"
        >
          <option value="relevance">相关性</option>
          <option value="name_asc">名称 (A-Z)</option>
          <option value="name_desc">名称 (Z-A)</option>
          <option value="popularity_desc">热门程度</option>
        </select>
      </div>
      
      <!-- 搜索结果网格 -->
      <div class="results-grid" v-if="searchQuery">
        <template v-if="isLoading">
          <div 
            v-for="n in skeletonCount" 
            :key="`skeleton-${n}`"
            class="game-skeleton"
          >
            <div class="skeleton-poster"></div>
            <div class="skeleton-content">
              <div class="skeleton-title"></div>
              <div class="skeleton-tags">
                <div class="skeleton-tag"></div>
                <div class="skeleton-tag"></div>
              </div>
              <div class="skeleton-desc"></div>
              <div class="skeleton-desc"></div>
            </div>
          </div>
        </template>
        
        <template v-else-if="filteredResults.length > 0">
          <GameCard 
            v-for="game in filteredResults" 
            :key="`game-${game.name}`"
            :game="game"
            @click="navigateToGame(game)"
          />
        </template>
        
        <template v-else-if="!isLoading">
          <div class="no-results">
            <div class="no-results-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="8" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="8" y2="12"></line>
              </svg>
            </div>
            <h2 class="no-results-title">未找到匹配的游戏</h2>
            <p class="no-results-description">
              尝试使用不同的关键词，或者清除筛选条件
            </p>
            <button class="clear-filters-btn" @click="clearAllFilters">
              清除所有筛选
            </button>
          </div>
        </template>
      </div>
      
      <!-- 分页 -->
      <div class="pagination" v-if="filteredResults.length > 0 && paginatedResults.length < filteredResults.length">
        <button 
          class="page-btn prev-btn"
          :disabled="currentPage === 1"
          @click="prevPage"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="15" y1="18" x2="9" y2="12"></line>
            <line x1="9" y1="18" x2="15" y2="12"></line>
          </svg>
          上一页
        </button>
        
        <div class="page-numbers">
          <button 
            v-for="page in pageCount" 
            :key="page"
            class="page-number"
            :class="{ active: page === currentPage }"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>
        </div>
        
        <button 
          class="page-btn next-btn"
          :disabled="currentPage === pageCount"
          @click="nextPage"
        >
          下一页
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="9" y1="18" x2="15" y2="12"></line>
            <line x1="15" y1="18" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>
      
      <!-- 相关搜索建议 -->
      <div class="related-searches" v-if="!isLoading && searchResults.length === 0 && searchQuery">
        <h3 class="related-title">您可能想搜索</h3>
        <div class="related-tags">
          <button 
            v-for="(tag, index) in popularSearches" 
            :key="`related-${index}`"
            class="related-tag"
            @click="handleRelatedSearch(tag)"
          >
            {{ tag }}
          </button>
        </div>
      </div>
    </div>
  </ResponsiveContainer>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '../store/gameStore'
import { useCategoryStore } from '../store/categoryStore'
import { useTagStore } from '../store/tagStore'
import SearchBar from '../components/SearchBar.vue'
import GameCard from '../components/GameCard.vue'
import ResponsiveContainer from '../components/ResponsiveContainer.vue'
import ResponsiveFilter from '../components/ResponsiveFilter.vue'

// 路由和状态管理
const route = useRoute()
const router = useRouter()
const gameStore = useGameStore()
const categoryStore = useCategoryStore()
const tagStore = useTagStore()

// 响应式数据
const searchQuery = ref('')
const searchResults = ref([])
const filteredResults = ref([])
const sortOption = ref('relevance')
const isLoading = ref(false)
const searchTime = ref(0)
const currentPage = ref(1)
const itemsPerPage = ref(12)
const filters = ref({
  types: [],
  platforms: [],
  tags: []
})

// 预设的热门搜索
const popularSearches = ref([
  '动作游戏', '冒险游戏', '休闲游戏', '免费游戏', '多人联机',
  '超级马里奥', 'Flappy Bird', 'Getting Over It', 'GunTower', 'Hill Climb Racing'
])

// 计算属性
const initialFilters = computed(() => ({
  types: filters.value.types,
  platforms: filters.value.platforms,
  tags: filters.value.tags,
  sortBy: sortOption.value
}))

// 根据响应式布局计算骨架屏数量
const skeletonCount = computed(() => {
  const width = window.innerWidth
  if (width >= 1200) return 12
  if (width >= 768) return 9
  return 6
})

// 过滤后的结果
const paginatedResults = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredResults.value.slice(start, end)
})

// 计算总页数
const pageCount = computed(() => {
  return Math.ceil(filteredResults.value.length / itemsPerPage.value)
})

// 执行搜索
const performSearch = async (query) => {
  if (!query.trim()) {
    searchResults.value = []
    filteredResults.value = []
    return
  }
  
  isLoading.value = true
  currentPage.value = 1
  const startTime = performance.now()
  
  try {
    // 确保游戏数据已加载
    if (!gameStore.games || gameStore.games.length === 0) {
      await gameStore.loadGames()
    }
    
    // 使用gameStore的搜索方法
    const results = gameStore.searchGames(query.trim())
    searchResults.value = results
    
    // 应用当前筛选器和排序
    applyFiltersAndSort(results)
  } catch (error) {
    console.error('搜索执行失败:', error)
    searchResults.value = []
    filteredResults.value = []
  } finally {
    const endTime = performance.now()
    searchTime.value = Math.round(endTime - startTime)
    isLoading.value = false
  }
}

// 应用筛选器和排序
const applyFiltersAndSort = (results) => {
  let filtered = [...results]
  
  // 应用类型筛选
  if (filters.value.types.length > 0) {
    filtered = filtered.filter(game => 
      filters.value.types.some(type => 
        game.type?.toLowerCase() === type.toLowerCase()
      )
    )
  }
  
  // 应用平台筛选
  if (filters.value.platforms.length > 0) {
    filtered = filtered.filter(game => 
      filters.value.platforms.some(platform => 
        game.platform?.toLowerCase() === platform.toLowerCase()
      )
    )
  }
  
  // 应用标签筛选
  if (filters.value.tags.length > 0) {
    filtered = filtered.filter(game => 
      filters.value.tags.some(tag => 
        game.tags?.map(t => t.toLowerCase()).includes(tag.toLowerCase())
      )
    )
  }
  
  // 应用排序
  switch (sortOption.value) {
    case 'name_asc':
      filtered.sort((a, b) => a.name.localeCompare(b.name))
      break
    case 'name_desc':
      filtered.sort((a, b) => b.name.localeCompare(a.name))
      break
    case 'popularity_desc':
      filtered.sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      break
    case 'relevance':
    default:
      // 默认保持搜索结果的相关性排序
      break
  }
  
  filteredResults.value = filtered
  currentPage.value = 1 // 重置到第一页
}

// 处理搜索
const handleSearch = (query) => {
  searchQuery.value = query
  updateRoute(query)
  performSearch(query)
}

// 处理游戏选择
const handleGameSelect = (game) => {
  navigateToGame(game)
}

// 处理筛选器变化
const handleFilterChange = (newFilters) => {
  filters.value = {
    types: newFilters.types || [],
    platforms: newFilters.platforms || [],
    tags: newFilters.tags || []
  }
  
  // 更新路由参数
  updateRoute(searchQuery.value)
  
  // 重新应用筛选和排序
  applyFiltersAndSort(searchResults.value)
}

// 处理排序变化
const handleSortChange = () => {
  // 更新路由参数
  updateRoute(searchQuery.value)
  
  // 重新应用筛选和排序
  applyFiltersAndSort(searchResults.value)
}

// 处理相关搜索
const handleRelatedSearch = (tag) => {
  searchQuery.value = tag
  handleSearch(tag)
}

// 清除所有筛选
const clearAllFilters = () => {
  filters.value = {
    types: [],
    platforms: [],
    tags: []
  }
  sortOption.value = 'relevance'
  currentPage.value = 1
  
  // 更新路由
  updateRoute(searchQuery.value)
  
  // 重新应用筛选和排序
  applyFiltersAndSort(searchResults.value)
}

// 分页控制
const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    scrollToTop()
  }
}

const nextPage = () => {
  if (currentPage.value < pageCount.value) {
    currentPage.value++
    scrollToTop()
  }
}

const goToPage = (page) => {
  currentPage.value = page
  scrollToTop()
}

// 滚动到顶部
const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}

// 导航到游戏详情
const navigateToGame = (game) => {
  router.push(`/game/${encodeURIComponent(game.name)}`)
}

// 更新路由参数
const updateRoute = (query) => {
  const routeParams = {
    q: query
  }
  
  // 添加筛选参数
  if (filters.value.types.length > 0) {
    routeParams.types = filters.value.types.join(',')
  }
  
  if (filters.value.platforms.length > 0) {
    routeParams.platforms = filters.value.platforms.join(',')
  }
  
  if (filters.value.tags.length > 0) {
    routeParams.tags = filters.value.tags.join(',')
  }
  
  if (sortOption.value !== 'relevance') {
    routeParams.sort = sortOption.value
  }
  
  router.replace({
    query: routeParams
  })
}

// 从路由参数加载搜索状态
const loadFromRoute = () => {
  const query = route.query.q || ''
  
  if (query && query !== searchQuery.value) {
    searchQuery.value = query
    
    // 加载筛选参数
    if (route.query.types) {
      filters.value.types = Array.isArray(route.query.types) 
        ? route.query.types 
        : route.query.types.split(',')
    }
    
    if (route.query.platforms) {
      filters.value.platforms = Array.isArray(route.query.platforms) 
        ? route.query.platforms 
        : route.query.platforms.split(',')
    }
    
    if (route.query.tags) {
      filters.value.tags = Array.isArray(route.query.tags) 
        ? route.query.tags 
        : route.query.tags.split(',')
    }
    
    if (route.query.sort) {
      sortOption.value = route.query.sort
    }
    
    performSearch(query)
  }
}

// 监听路由变化
watch(
  () => route.query,
  () => {
    loadFromRoute()
  },
  { immediate: true }
)

// 响应式调整每页显示数量
const updateItemsPerPage = () => {
  const width = window.innerWidth
  if (width >= 1200) {
    itemsPerPage.value = 12
  } else if (width >= 768) {
    itemsPerPage.value = 8
  } else {
    itemsPerPage.value = 4
  }
  
  // 重新计算分页
  currentPage.value = 1
}

// 组件挂载时初始化
onMounted(() => {
  // 加载游戏数据
  gameStore.loadGames().then(() => {
    loadFromRoute()
  })
  
  // 初始化响应式布局
  updateItemsPerPage()
  window.addEventListener('resize', updateItemsPerPage)
})
</script>

<style scoped>
.search-view {
  min-height: 100vh;
  padding: 24px 0;
}

.search-container {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
}

.search-header {
  margin-bottom: 32px;
}

.search-stats {
  margin-bottom: 24px;
}

.search-title {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary, #F0F0F0);
  margin: 0 0 8px 0;
  line-height: 1.3;
}

.search-keyword {
  color: var(--accent-primary, #9D4EDD);
  font-weight: 700;
}

.stats-info {
  display: flex;
  gap: 16px;
  align-items: center;
  font-size: 14px;
  color: var(--text-secondary, #A0A0A0);
}

.result-count {
  font-weight: 500;
}

.search-time {
  background-color: var(--accent-bg, #16213E);
  padding: 4px 10px;
  border-radius: var(--border-radius-full, 12px);
  font-size: 12px;
}

.filter-container {
  margin-bottom: 24px;
}

.sort-options {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color, #333);
}

.sort-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary, #A0A0A0);
}

.sort-select {
  background-color: var(--surface-bg, #2A2A3E);
  border: 1px solid var(--border-color, #333);
  border-radius: var(--border-radius, 8px);
  color: var(--text-primary, #F0F0F0);
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  outline: none;
  transition: all var(--transition-fast, 0.3s ease);
}

.sort-select:hover {
  border-color: var(--accent-primary, #9D4EDD);
}

.sort-select:focus {
  border-color: var(--accent-primary, #9D4EDD);
  box-shadow: 0 0 0 2px rgba(157, 78, 221, 0.2);
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

/* 骨架屏样式 */
.game-skeleton {
  background-color: var(--card-bg, #1E1E2E);
  border-radius: var(--border-radius-lg, 12px);
  overflow: hidden;
  box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.2));
  animation: skeleton-loading 1.5s infinite;
}

.skeleton-poster {
  height: 160px;
  background-color: var(--surface-bg, #2A2A3E);
  margin-bottom: 16px;
}

.skeleton-content {
  padding: 16px;
}

.skeleton-title {
  height: 20px;
  width: 70%;
  background-color: var(--surface-bg, #2A2A3E);
  border-radius: var(--border-radius-sm, 4px);
  margin-bottom: 12px;
}

.skeleton-tags {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.skeleton-tag {
  height: 24px;
  width: 60px;
  background-color: var(--surface-bg, #2A2A3E);
  border-radius: var(--border-radius-full, 12px);
}

.skeleton-desc {
  height: 16px;
  background-color: var(--surface-bg, #2A2A3E);
  border-radius: var(--border-radius-sm, 4px);
  margin-bottom: 8px;
}

.skeleton-desc:last-child {
  width: 80%;
}

@keyframes skeleton-loading {
  0% {
    opacity: 0.6;
  }
  50% {
    opacity: 0.8;
  }
  100% {
    opacity: 0.6;
  }
}

/* 无结果样式 */
.no-results {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
}

.no-results-icon {
  color: var(--text-secondary, #A0A0A0);
  margin-bottom: 24px;
}

.no-results-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary, #F0F0F0);
  margin: 0 0 12px 0;
}

.no-results-description {
  font-size: 16px;
  color: var(--text-secondary, #A0A0A0);
  margin: 0 0 24px 0;
  max-width: 500px;
  line-height: 1.5;
}

.clear-filters-btn {
  background-color: var(--accent-primary, #9D4EDD);
  color: white;
  border: none;
  border-radius: var(--border-radius-md, 8px);
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast, 0.3s ease);
}

.clear-filters-btn:hover {
  background-color: var(--accent-secondary, #8A43B8);
  transform: translateY(-1px);
}

/* 分页样式 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 40px;
}

.page-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: var(--surface-bg, #2A2A3E);
  border: 1px solid var(--border-color, #333);
  border-radius: var(--border-radius-md, 8px);
  color: var(--text-primary, #F0F0F0);
  padding: 10px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: all var(--transition-fast, 0.3s ease);
}

.page-btn:hover:not(:disabled) {
  background-color: var(--card-bg, #1E1E2E);
  border-color: var(--accent-primary, #9D4EDD);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  gap: 4px;
}

.page-number {
  background-color: var(--surface-bg, #2A2A3E);
  border: 1px solid var(--border-color, #333);
  border-radius: var(--border-radius-md, 8px);
  color: var(--text-primary, #F0F0F0);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  cursor: pointer;
  transition: all var(--transition-fast, 0.3s ease);
}

.page-number:hover {
  border-color: var(--accent-primary, #9D4EDD);
}

.page-number.active {
  background-color: var(--accent-primary, #9D4EDD);
  border-color: var(--accent-primary, #9D4EDD);
  color: white;
}

/* 相关搜索样式 */
.related-searches {
  margin-top: 48px;
  padding-top: 32px;
  border-top: 1px solid var(--border-color, #333);
}

.related-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #F0F0F0);
  margin: 0 0 16px 0;
}

.related-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.related-tag {
  background-color: var(--surface-bg, #2A2A3E);
  border: 1px solid var(--border-color, #333);
  border-radius: var(--border-radius-full, 20px);
  color: var(--text-primary, #F0F0F0);
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: all var(--transition-fast, 0.3s ease);
}

.related-tag:hover {
  background-color: var(--accent-bg, #16213E);
  border-color: var(--accent-primary, #9D4EDD);
  transform: translateY(-1px);
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .results-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 20px;
  }
  
  .search-container {
    padding: 0 20px;
  }
}

@media (max-width: 768px) {
  .search-view {
    padding: 16px 0;
  }
  
  .search-container {
    padding: 0 16px;
  }
  
  .search-header {
    margin-bottom: 24px;
  }
  
  .search-title {
    font-size: 24px;
  }
  
  .results-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 16px;
  }
  
  .stats-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .sort-options {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .pagination {
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .page-btn {
    padding: 8px 12px;
    font-size: 12px;
  }
  
  .page-number {
    width: 32px;
    height: 32px;
    font-size: 12px;
  }
  
  .no-results {
    padding: 40px 16px;
  }
  
  .no-results-title {
    font-size: 20px;
  }
  
  .related-tags {
    gap: 8px;
  }
  
  .related-tag {
    padding: 6px 12px;
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .results-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }
  
  .search-container {
    padding: 0 12px;
  }
  
  .search-title {
    font-size: 20px;
  }
  
  .page-numbers {
    gap: 2px;
  }
}
</style>