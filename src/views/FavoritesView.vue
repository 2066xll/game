<template>
  <div class="favorites-container">
    <h1 class="favorites-title">我的收藏</h1>
    
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载收藏中...</p>
    </div>
    
    <div v-else-if="favoriteGames.length === 0" class="empty-favorites">
      <div class="empty-icon">❤️</div>
      <h2>暂无收藏</h2>
      <p>浏览游戏并点击收藏按钮，将喜欢的游戏添加到收藏夹中</p>
      <router-link to="/" class="browse-btn">浏览游戏</router-link>
    </div>
    
    <div v-else class="favorites-grid">
      <GameCard 
        v-for="game in favoriteGames" 
        :key="game.id" 
        :game="game"
        class="favorite-card"
      />
    </div>
    
    <div v-if="favoriteGames.length > 0" class="favorites-stats">
      <p>共收藏 {{ favoriteGames.length }} 个游戏</p>
      <button @click="clearAllFavorites" class="clear-btn" :disabled="isProcessing">
        {{ isProcessing ? '处理中...' : '清空收藏' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import GameCard from '../components/GameCard.vue'
import { useGameStore } from '../store/gameStore'

const gameStore = useGameStore()
const isLoading = ref(true)
const isProcessing = ref(false)

// 获取当前用户ID（这里简化处理，实际应用中应从认证系统获取）
const getCurrentUserId = () => {
  // 从localStorage获取当前用户ID，如果没有则默认为'user1'
  return localStorage.getItem('currentUserId') || 'user1'
}

const favoriteGames = computed(() => {
    try {
      const userId = getCurrentUserId()
      // 确保获取的是当前用户的收藏数据
      const userFavorites = JSON.parse(localStorage.getItem('userFavorites') || '{}')
      const favorites = Array.isArray(userFavorites[userId]) ? userFavorites[userId] : []
      
      // 确保收藏列表不为空，否则直接返回空数组
      if (favorites.length === 0) {
        console.log('当前用户没有收藏游戏')
        return []
      }
      
      // 提取收藏游戏的ID或名称，确保数据类型一致性
      const favoriteIdsOrNames = favorites
        .filter(fav => fav && (fav.id || fav.title || fav.name)) // 过滤掉无效收藏项
        .map(fav => String(fav.id || fav.title || fav.name).toLowerCase().trim()) // 统一转换为小写字符串并去除空白
      
      console.log('收藏的游戏标识符:', favoriteIdsOrNames)
      
      // 确保gameStore.games是数组
      if (!Array.isArray(gameStore.games)) {
        console.warn('游戏列表数据格式错误')
        return []
      }
      
      // 筛选收藏的游戏，支持通过ID、title或name匹配
      const filteredGames = gameStore.games.filter(game => {
        if (!game) return false
        
        // 获取游戏标识符（优先使用ID，如果没有则使用title或name）并标准化
        const gameId = game.id ? String(game.id).toLowerCase().trim() : null
        const gameTitle = game.title ? String(game.title).toLowerCase().trim() : null
        const gameName = game.name ? String(game.name).toLowerCase().trim() : null
        
        // 严格检查：只有当游戏标识符确实存在收藏列表中时才返回true
        // 尝试多种匹配方式，确保准确匹配
        const isMatch = favoriteIdsOrNames.includes(gameId) || 
                        favoriteIdsOrNames.includes(gameTitle) || 
                        favoriteIdsOrNames.includes(gameName)
        
        // 调试日志
        if (isMatch) {
          console.log(`匹配成功: 游戏标识符=${gameId || gameTitle || gameName}`)
        }
        
        return isMatch
      })
      
      console.log(`过滤后的收藏游戏数量: ${filteredGames.length}`)
      return filteredGames
    } catch (error) {
      console.error('筛选收藏游戏时出错:', error)
      // 关键修复：出错时确保返回空数组，而不是所有游戏
      return []
    }
  })

// 加载游戏数据
onMounted(async () => {
  try {
    isLoading.value = true
    if (gameStore.games.length === 0) {
      await gameStore.loadGames()
    }
  } catch (error) {
    console.error('加载游戏数据失败:', error)
  } finally {
    isLoading.value = false
  }
})

// 清空所有收藏（用户隔离）
const clearAllFavorites = () => {
  if (confirm('确定要清空所有收藏吗？此操作不可恢复。')) {
    isProcessing.value = true
    try {
      const userId = getCurrentUserId()
      // 获取所有用户的收藏数据
      const allFavorites = JSON.parse(localStorage.getItem('userFavorites') || '{}')
      // 清空当前用户的收藏
      delete allFavorites[userId]
      // 保存更新后的数据
      localStorage.setItem('userFavorites', JSON.stringify(allFavorites))
      // 触发GameCard组件的响应式更新
      window.dispatchEvent(new StorageEvent('storage', { key: 'userFavorites' }))
      alert('收藏已清空')
    } catch (error) {
      console.error('清空收藏失败:', error)
      alert('清空收藏失败，请重试')
    } finally {
      isProcessing.value = false
    }
  }
}
</script>

<style scoped>
.favorites-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.favorites-title {
  background: linear-gradient(90deg, #4285F4, #34A853);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: transparent;
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 2rem;
  text-align: center;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 1rem;
  color: #E0E0E0;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  border-top: 4px solid #4285F4;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-favorites {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
  gap: 1rem;
  color: #A0A0A0;
}

.empty-icon {
  font-size: 5rem;
  opacity: 0.6;
}

.empty-favorites h2 {
  font-size: 1.8rem;
  color: #E0E0E0;
  margin-bottom: 0.5rem;
}

.browse-btn {
  margin-top: 1rem;
  padding: 0.8rem 2rem;
  background: linear-gradient(135deg, #4285F4, #34A853);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.browse-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
}

.favorites-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.favorite-card {
  animation: fadeIn 0.5s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.favorites-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.favorites-stats p {
  color: #E0E0E0;
  font-size: 1.1rem;
  font-weight: 500;
}

.clear-btn {
  padding: 0.6rem 1.5rem;
  background-color: rgba(234, 67, 53, 0.1);
  color: #EA4335;
  border: 1px solid rgba(234, 67, 53, 0.3);
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.clear-btn:hover:not(:disabled) {
  background-color: rgba(234, 67, 53, 0.2);
  border-color: rgba(234, 67, 53, 0.5);
}

.clear-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .favorites-container {
    padding: 1rem;
  }
  
  .favorites-title {
    font-size: 2rem;
  }
  
  .favorites-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1.5rem;
  }
  
  .favorites-stats {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
}

@media (max-width: 480px) {
  .favorites-grid {
    grid-template-columns: 1fr;
  }
  
  .empty-icon {
    font-size: 4rem;
  }
  
  .empty-favorites h2 {
    font-size: 1.5rem;
  }
}
</style>