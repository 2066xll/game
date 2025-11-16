<template>
  <nav class="navbar">
    <div class="container">
      <!-- 网站Logo -->
      <router-link to="/" class="logo">
        <span class="logo-text">SunRize的游戏网站</span>
      </router-link>
      
      <!-- 移动端菜单按钮 -->
      <button 
        class="mobile-menu-btn"
        @click="toggleMobileMenu"
        aria-label="菜单"
        :aria-expanded="mobileMenuOpen"
      >
        <span class="menu-icon"></span>
        <span class="menu-icon"></span>
        <span class="menu-icon"></span>
      </button>
      
      <!-- 导航菜单 -->
      <div class="nav-menu" :class="{ 'mobile-open': mobileMenuOpen }">
        <router-link to="/" class="nav-item" active-class="active" @click="closeMobileMenu">
          <span class="nav-text">首页</span>
        </router-link>
        
        <!-- 游戏下拉菜单 - 优化版 -->
        <div class="dropdown" 
             @mouseenter="handleMouseEnter"
             @mouseleave="handleMouseLeave"
             @click="toggleDropdownOnMobile">
          <button class="dropdown-toggle" :aria-expanded="isOpen">
            <span class="dropdown-text">其他游戏</span>
            <span class="dropdown-arrow" :class="{ 'rotate': isOpen }">&#9660;</span>
          </button>
          
          <!-- 过渡区域 - 防止菜单意外关闭 -->
          <div class="dropdown-connector" v-show="isOpen || isOpening">
          </div>
          
          <div class="dropdown-content" 
               v-show="isOpen || isOpening"
               @mouseenter="handleMenuMouseEnter"
               @mouseleave="handleMouseLeave">
            <!-- 网页游戏平台 -->
            <div class="dropdown-section-title">网页游戏平台</div>
            
            <!-- CCW平台游戏 -->
            <div class="dropdown-subsection-title">CCW平台游戏</div>
            <a href="https://www.ccw.site/detail/66baf0a24f28411894348777?SubjectAreaGroupId=53&component=0&inviteCode=GDoWAXEMJsC5qovt&module=0" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">MMO联机枪战2（联机）</span>
            </a>
            <a href="https://www.ccw.site/detail/67cd5f03bd76ef296cd90cf9?SubjectAreaGroupId=604&component=0&inviteCode=3bqDLAlXeA9jKJqQ&module=0" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">Frontline（联机）</span>
            </a>
            <a href="https://www.ccw.site/detail/679e0cfeb1f1142657a9b1d6?inviteCode=J3o2PKzn4zV3Tw56" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">散弹之王（联机）</span>
            </a>
            <a href="https://www.ccw.site/detail/6794b617b1f1142657a98541?inviteCode=N3odQgJbriQjl34o" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">东方青取径</span>
            </a>
            <a href="https://www.ccw.site/detail/669e5988e1534b396b2c202e?inviteCode=6NqPPPKpnANyDe8h" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">精灵与湮灭之地</span>
            </a>
            <a href="https://www.ccw.site/detail/625293c2a46435540014e193?inviteCode=8yqm36pNn4p2mRUF" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">国际象棋</span>
            </a>
            
            <!-- 4399平台游戏 -->
            <div class="dropdown-subsection-title">4399平台游戏</div>
            <a href="https://www.4399.com/" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">4399小游戏（需4399账号）</span>
            </a>
            <a href="https://www.4399.com/flash/243372_1.htm" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">只有一道门（需4399账号）</span>
            </a>
            <a href="https://www.4399.com/flash/220014_4.htm" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">火柴人逃亡日记（需4399账号）</span>
            </a>
            <a href="https://www.4399.com/flash/205551_4.htm" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">死神vs火影（需4399账号）</span>
            </a>
            <a href="https://www.4399.com/flash/210650.htm" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">造梦无双（需4399账号）</span>
            </a>
            <a href="https://www.4399.com/flash/18012.htm" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">植物大战僵尸（需4399账号）</span>
            </a>
            <a href="https://news.4399.com/hxjy/" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">火线精英（需4399账号）</span>
            </a>
            <a href="https://ssjj.4399.com/" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">生死狙击（需4399账号）</span>
            </a>
            
            <!-- 云游戏服务 -->
            <div class="dropdown-section-title">云游戏服务</div>
            
            <!-- 米哈游云游戏 -->
            <div class="dropdown-subsection-title">米哈游云游戏</div>
            <a href="https://ys.mihoyo.com/cloud/#/" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">云原神（需米哈游账号）</span>
            </a>
            <a href="https://sr.mihoyo.com/cloud/#/" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">云崩坏:星穹铁道（需米哈游账号）</span>
            </a>
            
            <!-- 4399云游戏 -->
            <div class="dropdown-subsection-title">4399云游戏</div>
            <a href="https://y.4399.com/detail/1?from=1" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">云原神（需4399账号和米哈游账号）</span>
            </a>
            <a href="https://y.4399.com/detail/124?from=1" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">云绝区零（需4399账号和米哈游账号）</span>
            </a>
            <a href="https://y.4399.com/detail/34?from=1#search3-a254" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">云崩坏:星穹铁道（需4399账号和米哈游账号）</span>
            </a>
            
            <!-- 下载游戏资源 -->
            <div class="dropdown-section-title">下载游戏资源</div>
            
            <!-- 游戏客户端 -->
            <div class="dropdown-subsection-title">游戏客户端</div>
            <a href="https://dl.4399ytzg2.com/myp/game/wd/hxjy/ver3/4399%E7%81%AB%E7%BA%BF%E7%B2%BE%E8%8B%B1.exe?v=20251115" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">火线精英下载（Windows）</span>
            </a>
            <a href="https://dl.4399ytzg2.com/myp/game/wd/ssjj/4399%E7%94%9F%E6%AD%BB%E7%8B%99%E5%87%BB.exe?v=20251106&v=20251115" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">生死狙击下载（Windows）</span>
            </a>
            
            <!-- 工具软件 -->
            <div class="dropdown-subsection-title">工具软件</div>
            <a href="https://dl.4399ytzg2.com/microgame/360se+5000577+n761579be99.exe" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">360浏览器</span>
            </a>
            
            <!-- 独立游戏站点 -->
            <div class="dropdown-section-title">独立游戏站点</div>
            <a href="https://www.ra2web.com/" target="_blank" class="dropdown-item" @click="closeMobileMenu">
              <span class="game-title">红警</span>
            </a>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 移动端背景遮罩 -->
    <div 
      class="mobile-menu-overlay" 
      v-if="mobileMenuOpen"
      @click="closeMobileMenu"
    ></div>
  </nav>
</template>

<script setup>
import { useGameStore } from '../store/gameStore'
import { onMounted, ref, onUnmounted } from 'vue'

// 加载游戏数据
const gameStore = useGameStore()

// 状态管理
const isOpen = ref(false)
const isOpening = ref(false) // 用于处理菜单显示的过渡状态
const mobileMenuOpen = ref(false) // 移动端菜单状态
let openTimer = null
let closeTimer = null

// 处理鼠标进入按钮
const handleMouseEnter = () => {
  // 桌面端才执行
  if (window.innerWidth >= 768 && !mobileMenuOpen.value) {
    // 清除关闭计时器
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
    
    // 设置打开延迟，避免误触发
    openTimer = setTimeout(() => {
      isOpening.value = true
      // 短暂延迟后设置为打开状态，让动画更流畅
      setTimeout(() => {
        isOpen.value = true
        isOpening.value = false
      }, 50)
    }, 50) // 很小的打开延迟，几乎是即时的
  }
}

// 处理菜单鼠标进入
const handleMenuMouseEnter = () => {
  // 桌面端才执行
  if (window.innerWidth >= 768 && !mobileMenuOpen.value) {
    // 清除关闭计时器
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
  }
}

// 处理鼠标离开
const handleMouseLeave = () => {
  // 桌面端才执行
  if (window.innerWidth >= 768 && !mobileMenuOpen.value) {
    // 清除打开计时器
    if (openTimer) {
      clearTimeout(openTimer)
      openTimer = null
    }
    
    // 设置关闭延迟，给用户足够时间移动到下拉内容
    closeTimer = setTimeout(() => {
      isOpen.value = false
    }, 300) // 300ms的延迟让用户有时间从按钮移到下拉内容
  }
}

// 移动端菜单切换
const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value
  // 切换移动端菜单时关闭下拉菜单
  if (!mobileMenuOpen.value) {
    isOpen.value = false
  }
  
  // 添加body类以防止滚动
  document.body.classList.toggle('menu-open', mobileMenuOpen.value)
}

// 关闭移动端菜单
const closeMobileMenu = () => {
  mobileMenuOpen.value = false
  isOpen.value = false
  document.body.classList.remove('menu-open')
}

// 移动端点击下拉菜单
const toggleDropdownOnMobile = (event) => {
  // 只有在移动端且菜单打开时处理
  if (window.innerWidth < 768 && mobileMenuOpen.value) {
    event.stopPropagation() // 阻止冒泡到nav-menu
    isOpen.value = !isOpen.value
  }
}

// 处理窗口大小变化，重置状态
const handleResize = () => {
  if (window.innerWidth >= 768) {
    closeMobileMenu() // 在桌面视图下关闭移动端菜单
  }
}

// 清理计时器和事件监听
onUnmounted(() => {
  if (openTimer) clearTimeout(openTimer)
  if (closeTimer) clearTimeout(closeTimer)
  window.removeEventListener('resize', handleResize)
  document.body.classList.remove('menu-open')
})

onMounted(() => {
  // 初始化时加载游戏数据
  gameStore.loadGames()
  // 添加窗口大小变化监听
  window.addEventListener('resize', handleResize)
})
</script>

<style scoped>
.navbar {
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
  padding: 12px 0;
  border-bottom: 2px solid transparent;
  background-clip: padding-box;
  position: sticky;
  top: 0;
  z-index: 1000; /* 增加z-index以确保在移动端菜单上方 */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.navbar:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* 滚动时的导航栏效果 */
.navbar.scrolled {
  padding: 8px 0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%, rgba(42, 42, 42, 0.95) 100%);
}

/* 菜单打开时的body样式 */
body.menu-open {
  overflow: hidden;
  position: fixed;
  width: 100%;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 32px;
  position: relative;
  /* 修改为向左对齐 */
  justify-content: flex-start;
}

.logo {
  text-decoration: none;
  display: inline-block;
  transition: transform 0.3s ease;
  z-index: 10;
}

.logo:hover {
  transform: translateY(-2px) scale(1.02);
}

.logo-text {
  background: linear-gradient(90deg, #4285F4, #34A853);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: transparent;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.5px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}

/* 滚动时的logo文字 */
.navbar.scrolled .logo-text {
  font-size: 22px;
}

.nav-menu {
  display: flex;
  gap: 28px;
  align-items: center;
  transition: all 0.3s ease;
  /* 确保导航项目在容器中占据适当空间 */
  flex: 1;
  /* 在大屏幕上保持适当间距 */
  justify-content: flex-start;
}

/* 移动端菜单样式 */
.mobile-menu-btn {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 12px;
  z-index: 1001;
  position: relative;
}

.menu-icon {
  display: block;
  width: 28px;
  height: 3px;
  background-color: #E0E0E0;
  margin: 5px 0;
  transition: all 0.3s ease;
  border-radius: 2px;
}

/* 移动端菜单打开时的图标变化 */
.mobile-menu-btn.active .menu-icon:nth-child(1) {
  transform: rotate(45deg) translate(8px, 8px);
  background-color: #4285F4;
}

.mobile-menu-btn.active .menu-icon:nth-child(2) {
  opacity: 0;
}

.mobile-menu-btn.active .menu-icon:nth-child(3) {
  transform: rotate(-45deg) translate(8px, -8px);
  background-color: #4285F4;
}

/* 移动端菜单背景遮罩 */
.mobile-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 999;
  transition: opacity 0.3s ease;
  opacity: 1;
}

.mobile-menu-overlay.hidden {
  opacity: 0;
  pointer-events: none;
}

.nav-item {
  text-decoration: none;
  padding: 8px 16px;
  border-radius: 8px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.nav-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(66, 133, 244, 0.2), transparent);
  transition: left 0.5s ease;
}

.nav-item:hover::before {
  left: 100%;
}

.nav-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
  transform: translateY(-2px);
}

.nav-item.active {
  background-color: rgba(66, 133, 244, 0.1);
  box-shadow: 0 2px 8px rgba(66, 133, 244, 0.2);
}

.nav-text {
  color: #E0E0E0;
  font-size: 16px;
  font-weight: 500;
  transition: color 0.3s ease;
}

.nav-item:hover .nav-text,
.nav-item.active .nav-text {
  color: #4285F4;
}

/* 下拉菜单样式 */
.dropdown {
  position: relative;
  z-index: 1000;
}

.dropdown-toggle {
  background: none;
  border: none;
  padding: 8px 16px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  outline: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
  overflow: hidden;
  /* 增大可点击区域 */
  margin: -4px;
  padding: 12px 20px;
}

.dropdown-toggle::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(66, 133, 244, 0.2), transparent);
  transition: left 0.5s ease;
}

.dropdown-toggle:hover::before {
  left: 100%;
}

.dropdown-toggle:hover {
  background-color: rgba(255, 255, 255, 0.05);
  transform: translateY(-2px);
}

.dropdown-text {
  color: #E0E0E0;
  font-weight: 500;
  transition: color 0.3s ease;
}

.dropdown-arrow {
    color: #A0A0A0;
    font-size: 12px;
    margin-left: 6px;
    transition: transform 0.3s ease, color 0.3s ease;
  }

.dropdown-toggle:hover .dropdown-text,
.dropdown-toggle:hover .dropdown-arrow {
  color: #4285F4;
}

.dropdown-arrow.rotate {
  transform: rotate(180deg);
}

/* 过渡区域 - 关键改进 */
.dropdown-connector {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  height: 10px;
  margin-top: -5px;
  z-index: -1;
  background: transparent;
}

.dropdown-content {
  position: absolute;
  top: 100%;
  left: 0;
  background: linear-gradient(135deg, #2a2a2a 0%, #1e1e1e 100%);
  min-width: 320px;
  max-width: 450px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  max-height: 500px;
  overflow-y: auto;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  margin-top: 5px;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.2s ease, transform 0.2s ease;
  /* 添加padding-top增加顶部可点击区域 */
  padding-top: 5px;
  /* 确保下拉菜单不影响其他导航项目的可见性 */
  will-change: transform;
}

/* 当菜单打开时的样式 */
.dropdown-content {
  opacity: 1;
  transform: translateY(0);
}

/* 下拉菜单分类标题 */
.dropdown-section-title {
  color: #4285F4;
  font-weight: 600;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 12px 20px 8px 20px;
  margin-top: 8px;
  margin-bottom: 4px;
  border-bottom: 1px solid rgba(66, 133, 244, 0.2);
  background: rgba(66, 133, 244, 0.05);
  backdrop-filter: blur(10px);
}

.dropdown-subsection-title {
  font-size: 13px;
  font-weight: 500;
  color: #34A853;
  padding: 8px 20px 4px 20px;
  margin: 6px 0 3px;
  border-left: 3px solid #34A853;
  background: rgba(52, 168, 83, 0.05);
  backdrop-filter: blur(10px);
}

.dropdown-section-title:first-of-type {
  margin-top: 0;
}

.dropdown-item {
  color: #E0E0E0;
  padding: 14px 20px;
  text-decoration: none;
  display: block;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  /* 增大点击区域 */
  margin: -4px -10px;
  padding: 16px 30px;
  /* 添加左侧图标占位 */
  padding-left: 40px;
}

.dropdown-item::before {
  content: '🎮';
  position: absolute;
  left: 15px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  opacity: 0;
  transition: all 0.2s ease;
}

.dropdown-item:hover::before {
  opacity: 1;
  left: 20px;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover {
  background-color: rgba(255, 255, 255, 0.08);
  transform: translateX(2px);
}

.dropdown-item:active {
  background-color: rgba(66, 133, 244, 0.1);
}

.game-title {
  font-weight: 500;
  line-height: 1.5;
  transition: color 0.3s ease;
}

.dropdown-item:hover .game-title {
  color: #4285F4;
}

/* 优化下拉菜单的滚动条样式 */
.dropdown-content::-webkit-scrollbar {
  width: 8px;
}

.dropdown-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.dropdown-content::-webkit-scrollbar-thumb {
  background: linear-gradient(to bottom, #4285F4, #34A853);
  border-radius: 4px;
  transition: background 0.3s ease;
}

.dropdown-content::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(to bottom, #5B9BF3, #42BB53);
}

/* 电脑端样式已在上方定义，确保导航菜单保持在左侧 */

/* 响应式设计优化 */
@media (max-width: 768px) {
  .container {
    padding: 0 16px;
    gap: 16px;
  }
  
  .logo-text {
    font-size: 20px;
  }
  
  /* 移动端显示汉堡菜单 */
  .mobile-menu-btn {
    display: block;
  }
  
  /* 移动端导航菜单样式 - 首页和其他游戏导航键移至右侧 */
  .nav-menu {
    position: fixed;
    top: 0;
    right: -100%;
    height: 100vh;
    width: 80%;
    max-width: 300px;
    background: linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 100%);
    flex-direction: column;
    align-items: flex-end;
    justify-content: flex-start;
    padding: 100px 20px 40px;
    gap: 12px;
    box-shadow: -5px 0 20px rgba(0, 0, 0, 0.5);
    z-index: 1000;
    overflow-y: auto;
    transition: right 0.3s ease;
    /* 确保导航项目可见且可点击 */
    display: flex;
    /* 确保内容靠右对齐 */
    text-align: right;
  }
  
  .nav-menu.mobile-open {
    right: 0;
  }
  
  .nav-item,
  .dropdown-toggle {
    width: 100%;
    padding: 12px 16px;
    margin: 0;
    border-radius: 8px;
    text-align: right;
    /* 强制文本右对齐 */
    display: block;
  }
  
  .nav-text,
  .dropdown-text {
    font-size: 16px;
  }
  
  /* 移动端下拉菜单样式 - 优化确保不遮挡首页按钮 */
  .dropdown {
    width: 100%;
    /* 确保下拉按钮和内容形成一个整体 */
    position: relative;
    margin-bottom: 8px;
  }
  
  .dropdown-content {
    position: static;
    width: 100%;
    max-width: none;
    /* 增加顶部间距，确保不会遮挡首页按钮 */
    margin-top: 8px;
    border-radius: 8px;
    border: 1px solid #333;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    max-height: 300px;
    /* 确保在移动端可正常显示且不会覆盖其他元素 */
    z-index: 999;
    /* 添加内边距使内容更清晰 */
    padding: 8px 0;
    /* 使用transform确保不会影响页面布局 */
    transform-origin: top right;
    transition: transform 0.2s ease, opacity 0.2s ease;
  }
  
  /* 确保移动端导航项目样式一致且靠右对齐 */
  .nav-item {
    width: 100%;
    display: block;
    text-align: right;
    /* 确保所有内容都右对齐 */
    direction: rtl;
  }
  
  .nav-item > * {
    direction: ltr;
  }
  
  .dropdown-toggle {
    width: 100%;
    text-align: right;
    justify-content: flex-end;
    /* 确保所有内容都右对齐 */
    direction: rtl;
  }
  
  .dropdown-toggle > * {
    direction: ltr;
  }
  
  .dropdown-section-title {
    font-size: 13px;
    padding: 10px 20px 6px;
  }
  
  .dropdown-item {
    padding: 14px 20px;
    padding-left: 35px;
  }
  
  .dropdown-item::before {
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .nav-menu {
    width: 90%;
  }
  
  .logo-text {
    font-size: 18px;
  }
  
  .container {
    padding: 0 12px;
  }
}
</style>