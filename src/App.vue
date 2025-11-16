<script setup>
import NavBar from './components/NavBar.vue'
</script>

<template>
  <div class="app-container">
    <!-- 导航栏 -->
    <NavBar />
    
    <!-- 路由视图容器 -->
    <main class="main-content">
      <router-view />
    </main>
    
    <!-- 页脚 -->
    <footer class="app-footer">
      <p>© {{ new Date().getFullYear() }} SunRize的游戏网站 | 专注为玩家提供高质量游戏内容</p>
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

/* 移除组件内的重复变量定义，使用全局样式系统 */
/* 组件样式将完全依赖style.css中的变量定义 */

body {
  margin: 0;
  min-height: 100vh;
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
  color: var(--text-primary);
  font-family: var(--font-family);
  line-height: var(--line-height-normal);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden;
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
  padding: 0 var(--spacing-lg, 1.5rem);
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
