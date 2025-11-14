<template>
  <div class="home-container">
    <header class="page-header">
      <h1>Sunrize的游戏网站</h1>
      <p>探索最热门的游戏，找到你喜欢的类型</p>
    </header>

    <!-- 桌面端搜索框 -->
    <div class="search-container" v-if="isDesktop">
      <input 
        v-model="searchQuery" 
        type="text" 
        placeholder="搜索游戏名称、类型或描述..."
        class="search-input"
        @input="handleSearch"
      >
    </div>

    <!-- 热门标签 -->
    <div class="tags-container" v-if="isDesktop && !isSearching">
      <span 
        v-for="tag in popularTags" 
        :key="tag" 
        class="tag"
        :class="{ 'active': selectedTags.includes(tag) }"
        @click="toggleTag(tag)"
      >
        {{ tag }}
      </span>
    </div>

    <!-- 游戏展示区 -->
    <div class="games-grid" v-if="!loading">
      <GameCard 
        v-for="game in filteredGames" 
        :key="game.name"
        :game="game"
        @tag-click="handleTagClick"
      />
      
      <!-- 无结果提示 -->
      <div class="no-results" v-if="filteredGames.length === 0">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
          <line x1="10" y1="9" x2="14" y2="9"></line>
          <line x1="10" y1="5" x2="14" y2="5"></line>
        </svg>
        <p>没有找到符合条件的游戏</p>
        <button class="reset-btn" @click="resetFilters">重置筛选条件</button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div class="loading-state" v-else>
      <div class="skeleton-card" v-for="i in skeletonCount" :key="i">
        <div class="skeleton-poster"></div>
        <div class="skeleton-info">
          <div class="skeleton-title"></div>
          <div class="skeleton-tags"></div>
          <div class="skeleton-description"></div>
        </div>
      </div>
    </div>
    
    <!-- 加载更多按钮 -->
    <div class="load-more-container" v-if="!loading && filteredGames.length > 0 && hasMoreGames">
      <button class="load-more-btn" @click="loadMoreGames">
        加载更多
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import GameCard from '../components/GameCard.vue'
import { useGameStore } from '../store/gameStore'

// 响应式状态

const gameStore = useGameStore()
const searchQuery = ref('')
const loading = ref(true)
const selectedTags = ref([])
const currentPage = ref(1)
const gamesPerPage = ref(12)

// 计算属性
const isDesktop = computed(() => {
  return window.innerWidth >= 768
})

const isSearching = computed(() => {
  return searchQuery.value.trim() !== ''
})

const popularTags = computed(() => {
  // 使用内置的标签数组，不再依赖tagStore
  return ['经典', '3D', '多人联机', '免费']
})

const skeletonCount = computed(() => {
  // 根据屏幕宽度计算骨架屏数量
  if (window.innerWidth >= 1200) return 8
  if (window.innerWidth >= 768) return 6
  return 4
})

const filteredGames = computed(() => {
  let games = gameStore.games || []
  
  // 应用搜索过滤
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    games = games.filter(game => {
      return game.name.toLowerCase().includes(query) || 
             (game.description && game.description.toLowerCase().includes(query)) ||
             (game.tags && game.tags.some(tag => tag.toLowerCase().includes(query)))
    })
  }
  
  // 应用标签过滤
  if (selectedTags.value.length > 0 && games.length > 0) {
    games = games.filter(game => {
      return game.tags && selectedTags.value.every(tag => game.tags.includes(tag))
    })
  }
  
  // 分页
  return games.slice(0, currentPage.value * gamesPerPage.value)
})

const hasMoreGames = computed(() => {
  let games = gameStore.games || []
  
  // 应用与filteredGames相同的过滤条件
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    games = games.filter(game => {
      return game.name.toLowerCase().includes(query) || 
             (game.description && game.description.toLowerCase().includes(query)) ||
             (game.tags && game.tags.some(tag => tag.toLowerCase().includes(query)))
    })
  }
  
  if (selectedTags.value.length > 0 && games.length > 0) {
    games = games.filter(game => {
      return game.tags && selectedTags.value.every(tag => game.tags.includes(tag))
    })
  }
  
  return games.length > currentPage.value * gamesPerPage.value
})

// 响应式状态管理完成

// 搜索处理
const handleSearch = () => {
  currentPage.value = 1
}

// 处理标签点击（来自GameCard组件）
const handleTagClick = (tag) => {
  toggleTag(tag)
}

// 标签切换
const toggleTag = (tag) => {
  const index = selectedTags.value.indexOf(tag)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tag)
  }
  currentPage.value = 1
}

// 重置筛选
const resetFilters = () => {
  searchQuery.value = ''
  selectedTags.value = []
  currentPage.value = 1
}

// 加载更多游戏
const loadMoreGames = () => {
  loading.value = true
  
  // 模拟加载延迟
  setTimeout(() => {
    currentPage.value += 1
    loading.value = false
  }, 500)
}

// 响应式网格计算
const calculateGridColumns = () => {
  // 根据屏幕宽度设置适当的每页游戏数量
  if (window.innerWidth >= 1200) {
    gamesPerPage.value = 12
  } else if (window.innerWidth >= 768) {
    gamesPerPage.value = 8
  } else {
    gamesPerPage.value = 6
  }
  // 重置页码以适应新的每页数量
  currentPage.value = 1
}

// 加载游戏数据
onMounted(async () => {
  try {
    await gameStore.loadGames()
    // 初始化标签数据
    if (gameStore.games && gameStore.games.length > 0) {
      // 提取所有标签并统计频率
      const allTags = gameStore.games.flatMap(game => game.tags || [])
      const tagFrequency = {}
      
      allTags.forEach(tag => {
        tagFrequency[tag] = (tagFrequency[tag] || 0) + 1
      })
      
      // 获取热门标签（频率最高的前5个）
      const popular = Object.entries(tagFrequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([tag]) => tag)
      
      // 热门标签已通过计算属性直接定义，无需存储
      console.log('提取的热门标签:', popular)
    }
  } catch (error) {
    console.error('加载游戏数据失败:', error)
  } finally {
    loading.value = false
  }
  
  // 设置响应式网格
  calculateGridColumns()
  window.addEventListener('resize', calculateGridColumns)
})

onUnmounted(() => {
  window.removeEventListener('resize', calculateGridColumns)
})
</script>

<style scoped>
/* 简化的基本样式 */
.home-container {
  width: 100%;
  max-width: 1200px;
  padding: 20px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
  margin-bottom: 40px;
  padding: 30px 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.page-header h1 {
  font-size: 2.5rem;
  margin-bottom: 15px;
  color: #2c3e50;
  font-weight: 700;
  background: linear-gradient(45deg, #4285F4, #34A853);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-header p {
  color: #555;
  font-size: 1.1rem;
  font-weight: 500;
}

/* 搜索框样式 */
.search-container {
  margin-bottom: 20px;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.search-input {
  width: 100%;
  padding: 14px 24px;
  border: 2px solid #e0e0e0;
  border-radius: 30px;
  font-size: 1rem;
  outline: none;
  transition: all 0.3s ease;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.search-input:focus {
  border-color: #4285F4;
  box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.1);
  transform: translateY(-1px);
}

/* 标签样式 */
.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 30px;
  justify-content: center;
}

.tag {
  padding: 10px 20px;
  border-radius: 30px;
  background-color: white;
  color: #333;
  cursor: pointer;
  border: 2px solid #e0e0e0;
  font-weight: 500;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.tag:hover {
  background-color: #4285F4;
  color: white;
  border-color: #4285F4;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(66, 133, 244, 0.2);
}

.tag.active {
  background-color: #4285F4;
  color: white;
  border-color: #4285F4;
  box-shadow: 0 4px 8px rgba(66, 133, 244, 0.3);
}

/* 游戏卡片网格 */
.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 40px;
}

/* 添加卡片过渡动画 */
.games-grid > * {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.games-grid > *:hover {
  transform: translateY(-5px);
}

/* 加载状态 */
.loading-state {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.skeleton-card {
  background-color: #f5f5f5;
  border-radius: 8px;
  overflow: hidden;
  padding: 15px;
  animation: skeleton-loading 1.5s infinite;
}

.skeleton-poster {
  height: 200px;
  background-color: #e0e0e0;
  border-radius: 4px;
  margin-bottom: 15px;
}

.skeleton-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton-title,
.skeleton-tags,
.skeleton-description {
  background-color: #e0e0e0;
  border-radius: 4px;
}

.skeleton-title {
  height: 24px;
  width: 70%;
}

.skeleton-tags {
  height: 20px;
  width: 50%;
}

.skeleton-description {
  height: 60px;
}

@keyframes skeleton-loading {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 0.4;
  }
}

/* 无结果状态 */
.no-results {
  text-align: center;
  padding: 60px 20px;
  grid-column: 1 / -1;
}

.no-results p {
  color: #666;
  margin-bottom: 20px;
}

.reset-btn {
  padding: 12px 24px;
  background-color: #4285F4;
  color: white;
  border: none;
  border-radius: 30px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
}

.reset-btn:hover {
  background-color: #3367d6;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(66, 133, 244, 0.3);
}

/* 加载更多按钮 */
.load-more-container {
  text-align: center;
  margin-top: 30px;
}

.load-more-btn {
  padding: 14px 32px;
  background-color: #4285F4;
  color: white;
  border: none;
  border-radius: 30px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.load-more-btn:hover {
  background-color: #3367d6;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(66, 133, 244, 0.3);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .home-container {
    padding: 15px;
  }
  
  .page-header {
    padding: 20px 15px;
    margin-bottom: 30px;
  }
  
  .page-header h1 {
    font-size: 2rem;
  }
  
  .page-header p {
    font-size: 1rem;
  }
  
  .games-grid,
  .loading-state {
    grid-template-columns: 1fr 1fr;
    gap: 15px;
  }
  
  .tags-container {
    gap: 8px;
  }
  
  .tag {
    padding: 8px 16px;
    font-size: 0.9rem;
  }
}

@media (max-width: 480px) {
  .games-grid,
  .loading-state {
    grid-template-columns: 1fr;
  }
}
</style>