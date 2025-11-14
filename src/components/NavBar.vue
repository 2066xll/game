<template>
  <nav class="navbar">
    <div class="container">
      <!-- 网站Logo -->
      <router-link to="/" class="logo">SunRize的游戏网站</router-link>
      
      <!-- 导航菜单 -->
      <div class="nav-menu">
        <router-link to="/" class="nav-item" active-class="active">首页</router-link>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { useGameStore } from '../store/gameStore'
import { onMounted } from 'vue'

// 加载游戏数据
const gameStore = useGameStore()

onMounted(() => {
  // 初始化时加载游戏数据
  gameStore.loadGames()
})
</script>

<style scoped>
.navbar {
  background-color: #1e1e1e;
  padding: 15px 0;
  border-bottom: 1px solid #333;
  position: sticky;
  top: 0;
  z-index: 100;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  color: #F0F0F0;
  font-size: 24px;
  font-weight: bold;
  text-decoration: none;
}

.nav-menu {
  display: flex;
  gap: 20px;
}

.nav-item {
  color: #A0A0A0;
  text-decoration: none;
  padding: 5px 10px;
  transition: color 0.3s ease;
}

.nav-item:hover,
.nav-item.active {
  color: #4285F4;
}
</style>