<template>
  <div class="category-container">
    <header class="page-header">
      <h1>分类浏览</h1>
      <p>按类型和平台筛选游戏</p>
    </header>

    <!-- 分类筛选器 -->
    <div class="filter-container">
      <div class="filter-group">
        <label>游戏类型</label>
        <select v-model="selectedType" class="filter-select" @change="applyFilters">
          <option value="">全部类型</option>
          <option value="动作">动作</option>
          <option value="冒险">冒险</option>
          <option value="休闲">休闲</option>
          <option value="射击">射击</option>
          <option value="竞速">竞速</option>
        </select>
      </div>
      
      <div class="filter-group">
        <label>平台</label>
        <select v-model="selectedPlatform" class="filter-select" @change="applyFilters">
          <option value="">全部平台</option>
          <option value="Web">Web</option>
          <option value="移动端">移动端</option>
          <option value="主机">主机</option>
        </select>
      </div>
      
      <div class="filter-group">
        <label>排序</label>
        <select v-model="sortBy" class="filter-select" @change="applyFilters">
          <option value="popularity">按热度</option>
          <option value="name">按名称</option>
        </select>
      </div>
    </div>

    <!-- 过滤后的游戏列表 -->
    <div class="games-grid" v-if="!loading">
      <div 
        v-for="game in filteredGames" 
        :key="game.name"
        class="game-card"
      >
        <img 
          v-lazy="getGamePosterUrl(game.name)" 
          :alt="game.name"
          class="game-poster"
        >
        <div class="game-info">
          <h3 class="game-title">{{ game.name }}</h3>
          <div class="game-tags">
            <span 
              v-for="tag in game.tags" 
              :key="tag" 
              class="game-tag"
            >
              {{ tag }}
            </span>
          </div>
          <div class="game-meta">
            <span class="game-type">{{ game.type || '未知类型' }}</span>
            <span class="game-platform">{{ game.platform || '全平台' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div class="loading-state" v-else>
      <div class="skeleton-card" v-for="i in 8" :key="i">
        <div class="skeleton-poster"></div>
        <div class="skeleton-info">
          <div class="skeleton-title"></div>
          <div class="skeleton-tags"></div>
          <div class="skeleton-meta"></div>
        </div>
      </div>
    </div>

    <!-- 无结果状态 -->
    <div class="no-results" v-if="!loading && filteredGames.length === 0">
      <p>没有找到符合条件的游戏</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useGameStore } from '../store/gameStore'
import { useCategoryStore } from '../store/categoryStore'

const route = useRoute()
const gameStore = useGameStore()
const categoryStore = useCategoryStore()

const loading = ref(true)
const selectedType = ref(route.params.type || '')
const selectedPlatform = ref(route.params.platform || '')
const sortBy = ref('popularity')

// 监听路由参数变化
watch(() => [route.params.type, route.params.platform], ([type, platform]) => {
  selectedType.value = type || ''
  selectedPlatform.value = platform || ''
  applyFilters()
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

// 应用筛选条件
const applyFilters = () => {
  categoryStore.setFilters({
    type: selectedType.value,
    platform: selectedPlatform.value,
    sortBy: sortBy.value
  })
}

// 计算过滤后的游戏列表
const filteredGames = computed(() => {
  return categoryStore.filteredGames
})

// 加载游戏数据
onMounted(async () => {
  try {
    await gameStore.loadGames()
    applyFilters()
  } catch (error) {
    console.error('加载游戏数据失败:', error)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.category-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  text-align: center;
  margin-bottom: 40px;
}

.page-header h1 {
  color: #F0F0F0;
  font-size: 2.5rem;
  margin-bottom: 10px;
}

.page-header p {
  color: #A0A0A0;
  font-size: 1.1rem;
}

.filter-container {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 30px;
  background-color: #2A2A3E;
  padding: 20px;
  border-radius: 12px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-group label {
  color: #A0A0A0;
  font-size: 0.9rem;
}

.filter-select {
  padding: 10px 15px;
  border: 2px solid #333;
  border-radius: 8px;
  background-color: #1A1A2E;
  color: #F0F0F0;
  font-size: 14px;
  outline: none;
  cursor: pointer;
  transition: all 0.3s ease;
}

.filter-select:hover {
  border-color: #9D4EDD;
}

.filter-select:focus {
  border-color: #4CC9F0;
  box-shadow: 0 0 8px rgba(76, 201, 240, 0.2);
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 25px;
}

.game-card {
  background-color: #2A2A3E;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
}

.game-card:hover {
  transform: scale(1.03);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.game-poster {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.game-info {
  padding: 20px;
}

.game-title {
  color: #F0F0F0;
  font-size: 1.2rem;
  margin-bottom: 10px;
  font-weight: 600;
}

.game-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 15px;
}

.game-tag {
  background-color: #16213E;
  color: #4CC9F0;
  padding: 4px 12px;
  border-radius: 15px;
  font-size: 0.85rem;
}

.game-meta {
  display: flex;
  gap: 15px;
  font-size: 0.9rem;
}

.game-type {
  color: #9D4EDD;
}

.game-platform {
  color: #A0A0A0;
}

.loading-state {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 25px;
}

.skeleton-card {
  background-color: #2A2A3E;
  border-radius: 12px;
  overflow: hidden;
}

.skeleton-poster {
  width: 100%;
  height: 200px;
  background-color: #3A3A4E;
  animation: pulse 1.5s ease-in-out infinite;
}

.skeleton-info {
  padding: 20px;
}

.skeleton-title,
.skeleton-tags,
.skeleton-meta {
  background-color: #3A3A4E;
  animation: pulse 1.5s ease-in-out infinite;
}

.skeleton-title {
  width: 70%;
  height: 24px;
  border-radius: 4px;
  margin-bottom: 15px;
}

.skeleton-tags {
  width: 90%;
  height: 20px;
  border-radius: 10px;
  margin-bottom: 15px;
}

.skeleton-meta {
  width: 50%;
  height: 18px;
  border-radius: 4px;
}

.no-results {
  text-align: center;
  padding: 60px 20px;
  color: #A0A0A0;
  font-size: 1.1rem;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .filter-container {
    flex-direction: column;
  }
  
  .filter-group {
    width: 100%;
  }
  
  .filter-select {
    width: 100%;
  }
}
</style>