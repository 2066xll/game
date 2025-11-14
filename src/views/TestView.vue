<template>
  <div class="test-container">
    <h1>游戏数据测试</h1>
    <p>游戏总数: {{ games.length }}</p>
    
    <div v-if="loading">
      加载中...
    </div>
    
    <div v-else-if="error">
      错误: {{ error }}
    </div>
    
    <div v-else-if="games.length === 0">
      没有游戏数据
    </div>
    
    <div class="games-list" v-else>
      <div v-for="game in games" :key="game.name" class="game-item">
        <h3>{{ game.name }}</h3>
        <p>类型: {{ game.type }}</p>
        <p>平台: {{ game.platform }}</p>
        <p>标签: {{ game.tags.join(', ') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useGameStore } from '../store/gameStore'

const gameStore = useGameStore()
const games = ref([])
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    // 直接加载游戏数据
    await gameStore.loadGames()
    games.value = gameStore.games
    loading.value = false
  } catch (err) {
    error.value = err.message
    loading.value = false
  }
})
</script>

<style scoped>
.test-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.games-list {
  margin-top: 20px;
}

.game-item {
  background-color: #f5f5f5;
  padding: 15px;
  margin-bottom: 10px;
  border-radius: 8px;
}
</style>