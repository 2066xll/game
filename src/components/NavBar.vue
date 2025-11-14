<template>
  <nav class="navbar">
    <div class="container">
      <!-- 网站Logo -->
      <router-link to="/" class="logo">SunRize的游戏网站</router-link>
      
      <!-- 导航菜单 -->
      <div class="nav-menu">
        <router-link to="/" class="nav-item" active-class="active">首页</router-link>
        
        <!-- 游戏下拉菜单 -->
        <div class="dropdown">
          <button class="dropdown-toggle">游戏</button>
          <div class="dropdown-content">
            <a href="https://www.ccw.site/detail/66baf0a24f28411894348777?SubjectAreaGroupId=53&component=0&inviteCode=GDoWAXEMJsC5qovt&module=0" target="_blank" class="dropdown-item">MMO联机枪战2（联机）</a>
            <a href="https://www.ccw.site/detail/67cd5f03bd76ef296cd90cf9?SubjectAreaGroupId=604&component=0&inviteCode=3bqDLAlXeA9jKJqQ&module=0" target="_blank" class="dropdown-item">Frontline（联机）</a>
            <a href="https://www.ccw.site/detail/679e0cfeb1f1142657a9b1d6?inviteCode=J3o2PKzn4zV3Tw56" target="_blank" class="dropdown-item">散弹之王（联机）</a>
            <a href="https://www.ccw.site/detail/6794b617b1f1142657a98541?inviteCode=N3odQgJbriQjl34o" target="_blank" class="dropdown-item">东方青取径</a>
            <a href="https://www.ccw.site/detail/669e5988e1534b396b2c202e?inviteCode=6NqPPPKpnANyDe8h" target="_blank" class="dropdown-item">精灵与湮灭之地</a>
            <a href="https://www.ccw.site/detail/625293c2a46435540014e193?inviteCode=8yqm36pNn4p2mRUF" target="_blank" class="dropdown-item">国际象棋</a>
          </div>
        </div>
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
  align-items: center;
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

/* 下拉菜单样式 */
.dropdown {
  position: relative;
}

.dropdown-toggle {
  background: none;
  border: none;
  color: #A0A0A0;
  padding: 5px 10px;
  font-size: 16px;
  cursor: pointer;
  transition: color 0.3s ease;
  outline: none;
}

.dropdown-toggle:hover,
.dropdown-toggle:focus {
  color: #4285F4;
}

.dropdown-content {
  position: absolute;
  top: 100%;
  left: 0;
  background-color: #2a2a2a;
  min-width: 200px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
  z-index: 101;
  max-height: 400px;
  overflow-y: auto;
  display: none;
}

.dropdown:hover .dropdown-content {
  display: block;
}

.dropdown-item {
  color: #A0A0A0;
  padding: 12px 16px;
  text-decoration: none;
  display: block;
  transition: background-color 0.3s ease, color 0.3s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-item:hover {
  background-color: #3a3a3a;
  color: #4285F4;
}
</style>