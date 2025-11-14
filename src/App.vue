<script setup>
import NavBar from './components/NavBar.vue'
import HomeView from './views/HomeView.vue'
</script>

<template>
  <div class="app-container">
    <!-- 导航栏 -->
    <NavBar />
    
    <!-- 主页视图 -->
    <main class="main-content">
      <HomeView />
    </main>
    
    <!-- 页脚 -->
    <footer class="app-footer">
      <p>© 2024 游戏门户网站</p>
    </footer>
  </div>
</template>

<style>
/* 全局重置样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --bg-primary: #121212;
  --bg-secondary: #1e1e1e;
  --text-primary: #F0F0F0;
  --text-secondary: #A0A0A0;
  --accent-color: #4285F4;
  --border-color: #333;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
}

.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
}

.app-footer {
  text-align: center;
  padding: 20px;
  background-color: var(--bg-secondary);
  color: var(--text-secondary);
  border-top: 1px solid var(--border-color);
}

/* 链接样式 */
a {
  color: var(--accent-color);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* 按钮基础样式 */
button {
  cursor: pointer;
  border: none;
  outline: none;
  transition: all 0.3s ease;
}

/* 响应式容器 */
@media (max-width: 768px) {
  .main-content {
    padding: 10px;
  }
}
</style>
