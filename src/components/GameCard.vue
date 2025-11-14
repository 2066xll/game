<template>
  <div 
    class="game-card"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    :class="{ 'hovered': isHovered }"
  >
    <!-- 游戏海报 -->
    <div class="poster-container">
      <!-- 使用public/assets/Poster下的图片 -->
      <img 
        :src="getPosterUrl()" 
        :alt="game.title || game.name" 
        class="game-poster" 
        @error="handleImageError"
      >
      <!-- 使用占位色块作为回退 -->
      <div v-if="showPlaceholder" class="poster-placeholder" :style="getPosterStyle()">
        <span class="game-name-placeholder">{{ game.title || game.name }}</span>
      </div>
      <!-- 热度标签 -->
      <div v-if="game.isPopular" class="popular-badge">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
        <span>热门</span>
      </div>
    </div>

    <!-- 游戏信息 -->
    <div class="game-info">
      <h3 class="game-title">{{ game.title || game.name }}</h3>
      
      <!-- 游戏标签 -->
      <div class="game-tags">
        <span 
          v-for="tag in game.tags.slice(0, 3)" 
          :key="tag"
          class="game-tag"
          @click.stop="$emit('tag-click', tag)"
        >
          {{ tag }}
        </span>
      </div>
      
      <!-- 游戏描述 -->
      <p class="game-description">{{ truncateDescription(game.description) }}</p>
      
      <!-- 游戏元数据 -->
      <div class="game-meta">
        <span class="meta-item platform">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          {{ game.platform || '多平台' }}
        </span>
        <span class="meta-item rating">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10.5a9.72 9.72 0 0 1-3.27 2.39c-3.12 1.05-6.47.34-8.73-2.39a9.75 9.75 0 0 1-3.27-2.39 9.75 9.75 0 0 1 1.63-12.15A9.75 9.75 0 0 1 10.5 3c2.43 0 4.71.88 6.36 2.39a9.75 9.75 0 0 1 1.63 12.15Z"></path>
          </svg>
          {{ game.rating || '4.5' }}
        </span>
      </div>
    </div>

    <!-- 快速操作按钮 -->
    <div class="quick-actions">
      <button 
        class="action-btn favorite-btn"
        :class="{ 'active': isFavorite }"
        @click.stop="toggleFavorite"
        aria-label="收藏游戏"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
      </button>
    </div>
    
    <!-- 开始游戏按钮 -->
    <button 
      class="play-game-btn"
      @click="startGame"
      aria-label="开始游戏"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
      开始游戏
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// Props
const props = defineProps({
  game: {
    type: Object,
    required: true
  }
})

// Emits
const emit = defineEmits(['tag-click'])

// 响应式状态
const isHovered = ref(false)
const isFavorite = ref(false)
const showPlaceholder = ref(false)

// 截断描述文本
const truncateDescription = (description) => {
  if (!description) return ''
  return description.length > 100 ? description.substring(0, 100) + '...' : description
}

// 获取游戏海报URL
const getPosterUrl = () => {
  const gameName = props.game.title || props.game.name || ''
  
  // 创建文件名映射，直接匹配Poster目录中的实际文件名
  const fileNameMap = {
    // 精确匹配规则
    '超级马里奥': 'SuperMario',
    'appel': 'Apple',
    'flappy bird': 'Flappy Bird',
    'getting over it': 'Getting Over It',
    'griffpatch': 'Griffpatch\'s 3D Laser Tag v0.8',
    'guntower': 'Guntower',
    'guntower-endless': 'Guntower Of Endless',
    'hill climb racing': 'Hill Climb Racing',
    'super mario': 'SuperMario'
  }
  
  // 尝试找到匹配的文件名
  const normalizedName = gameName.toLowerCase()
  
  // 1. 首先检查精确匹配（包括版本号处理）
  const baseName = normalizedName.replace(/\s+v?\d+\.?\d*/g, '').replace(/\s+beta/g, '')
  if (fileNameMap[baseName]) {
    return `/assets/Poster/${encodeURIComponent(fileNameMap[baseName])}.png`
  }
  
  // 2. 然后检查包含匹配
  for (const [key, value] of Object.entries(fileNameMap)) {
    if (normalizedName.includes(key)) {
      return `/assets/Poster/${encodeURIComponent(value)}.png`
    }
  }
  
  // 3. 特殊处理：对于GunTower-Endless
  if (normalizedName.includes('guntower') && normalizedName.includes('endless')) {
    return `/assets/Poster/Guntower Of Endless.png`
  }
  
  // 4. 对于中文名，尝试英文映射
  const chineseToEnglishMap = {
    '超级马里奥': 'SuperMario',
    '马里奥': 'SuperMario'
  }
  
  for (const [key, value] of Object.entries(chineseToEnglishMap)) {
    if (gameName.includes(key)) {
      return `/assets/Poster/${value}.png`
    }
  }
  
  // 如果没有找到匹配，尝试使用原始游戏名称
  return `/assets/Poster/${encodeURIComponent(gameName)}.png`
}

// 处理图片加载错误
const handleImageError = (event) => {
  // 如果图片加载失败，隐藏图片并显示占位符
  event.target.style.display = 'none'
  showPlaceholder.value = true
}

// 根据游戏名称生成不同的背景色
const getPosterStyle = () => {
  const gameName = props.game.title || props.game.name || ''
  const colors = ['#4285F4', '#34A853', '#FBBC04', '#EA4335', '#9D4EDD']
  let hash = 0
  
  for (let i = 0; i < gameName.length; i++) {
    hash = gameName.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  const colorIndex = Math.abs(hash) % colors.length
  return {
    backgroundColor: colors[colorIndex]
  }
}

// 切换收藏状态
const toggleFavorite = () => {
  isFavorite.value = !isFavorite.value
  try {
    // 简化的收藏逻辑，保存到localStorage
    const favorites = JSON.parse(localStorage.getItem('favoriteGames') || '[]')
    const gameName = props.game.title || props.game.name
    
    if (isFavorite.value) {
      // 添加到收藏
      if (!favorites.includes(gameName)) {
        favorites.push(gameName)
      }
    } else {
      // 移除收藏
      const index = favorites.indexOf(gameName)
      if (index > -1) {
        favorites.splice(index, 1)
      }
    }
    
    localStorage.setItem('favoriteGames', JSON.stringify(favorites))
  } catch (e) {
    console.error('收藏功能出错:', e)
  }
}

// 开始游戏
const startGame = () => {
  const gameName = props.game.title || props.game.name || ''
  // 注意：根据目录结构，游戏在game-website-core/game-main目录下，每个游戏有自己的文件夹
  // 尝试使用原始游戏名称作为文件夹名，如果不存在，可能需要进一步调整
  try {
    // 构建游戏URL，假设游戏文件夹内有index.html
    const gameUrl = `/game-website-core/game-main/${encodeURIComponent(gameName)}/index.html`
    window.open(gameUrl, '_blank')
  } catch (e) {
    console.error('打开游戏时出错:', e)
    alert('无法打开游戏，请稍后重试')
  }
}

// 初始化收藏状态
const initFavoriteStatus = () => {
  try {
    const favorites = JSON.parse(localStorage.getItem('favoriteGames') || '[]')
    const gameName = props.game.title || props.game.name
    isFavorite.value = favorites.includes(gameName)
  } catch (e) {
    console.error('初始化收藏状态出错:', e)
    isFavorite.value = false
  }
}

// 组件挂载时初始化
initFavoriteStatus()
</script>

<style scoped>
.game-card {
  background-color: var(--surface-bg);
  border-radius: var(--border-radius-lg);
  overflow: hidden;
  position: relative;
  transition: all var(--transition-normal);
  border: 1px solid var(--border-color);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.game-card:hover,
.game-card.hovered {
  transform: translateY(-8px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
  border-color: var(--accent-primary);
}

.card-link {
  display: flex;
  flex-direction: column;
  height: 100%;
  text-decoration: none;
}

/* 海报容器 */
.poster-container {
  position: relative;
  aspect-ratio: 3/4;
  overflow: hidden;
  background-color: var(--secondary-bg);
}

.poster-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: transform var(--transition-normal);
}

.game-card:hover .poster-placeholder {
  transform: scale(1.05);
}

.game-name-placeholder {
  color: white;
  font-size: 1.25rem;
  font-weight: 700;
  text-align: center;
  padding: 16px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  word-break: break-word;
  text-overflow: ellipsis;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  line-clamp: 3;
}

.game-poster {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-normal);
}

.game-card:hover .game-poster {
  transform: scale(1.05);
}

/* 骨架屏 */
.poster-skeleton {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: var(--hover-bg);
  overflow: hidden;
}

.skeleton-animation {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, var(--border-color), transparent);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* 热门标签 */
.popular-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: #000;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
  z-index: 10;
}

/* 游戏信息 */
.game-info {
  padding: 1rem;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.game-title {
  color: var(--text-primary);
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 0.75rem 0;
  line-height: 1.3;
  transition: color var(--transition-fast);
}

.game-card:hover .game-title {
  color: var(--accent-primary);
}

/* 游戏标签 */
.game-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.game-tag {
  font-size: 0.75rem;
  padding: 0.25rem 0.625rem;
  background-color: var(--hover-bg);
  color: var(--text-muted);
  border-radius: 1rem;
  border: 1px solid var(--border-color);
  transition: all var(--transition-fast);
  cursor: pointer;
  user-select: none;
}

.game-tag:hover {
  background-color: var(--accent-primary);
  color: var(--text-primary);
  border-color: var(--accent-primary);
  transform: scale(1.05);
}

/* 游戏描述 */
.game-description {
  color: var(--text-secondary);
  font-size: 0.875rem;
  line-height: 1.5;
  margin: 0 0 1rem 0;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  line-clamp: 3;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 游戏元数据 */
.game-meta {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.meta-item.platform {
  color: var(--accent-secondary);
}

.meta-item.rating {
  color: #FFD700;
}

/* 快速操作按钮 */
.quick-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  opacity: 0;
  transform: translateY(-10px);
  transition: all var(--transition-normal);
  z-index: 10;
}

.game-card:hover .quick-actions,
.game-card.hovered .quick-actions {
  opacity: 1;
  transform: translateY(0);
}

.action-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background-color: var(--secondary-bg);
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(4px);
}

.action-btn:hover {
  background-color: var(--hover-bg);
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.favorite-btn:hover {
  color: #FF4757;
}

.favorite-btn.active {
  background-color: #FF4757;
  color: white;
}

.share-btn:hover {
  color: var(--accent-primary);
}

/* 开始游戏按钮 */
.play-game-btn {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #4285F4, #34A853);
  color: white;
  border: none;
  border-radius: 20px;
  padding: 0.5rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: all var(--transition-normal);
  opacity: 0;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.game-card:hover .play-game-btn,
.game-card.hovered .play-game-btn {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.play-game-btn:hover {
  transform: translateX(-50%) translateY(-3px) scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

/* 触摸设备优化 */
@media (hover: none) and (pointer: coarse) {
  .quick-actions {
    opacity: 1;
    transform: translateY(0);
  }
  
  .game-card {
    transform: translateY(0) !important;
  }
  
  .game-poster {
    transform: scale(1) !important;
  }
  
  .play-game-btn {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .game-card:hover {
    transform: translateY(-6px);
  }
}

@media (max-width: 768px) {
  .game-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  }
  
  .game-info {
    padding: 0.875rem;
  }
  
  .game-title {
    font-size: 1rem;
  }
  
  .game-name-placeholder {
    font-size: 1rem;
    padding: 12px;
  }
  
  .popular-badge {
    font-size: 0.7rem;
    padding: 0.25rem 0.5rem;
    top: 8px;
    left: 8px;
  }
  
  .quick-actions {
    top: 8px;
    right: 8px;
  }
  
  .action-btn {
    width: 32px;
    height: 32px;
  }
  
  .action-btn svg {
    width: 16px;
    height: 16px;
  }
}

@media (max-width: 480px) {
  .game-tags {
    gap: 0.375rem;
  }
  
  .game-tag {
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
  }
  
  .game-description {
    font-size: 0.8125rem;
  }
}

/* 动画效果 */
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

.game-card {
  animation: fadeIn 0.4s ease-out;
}

/* 根据延迟添加交错动画 */
.game-card:nth-child(1n) { animation-delay: 0ms; }
.game-card:nth-child(2n) { animation-delay: 50ms; }
.game-card:nth-child(3n) { animation-delay: 100ms; }
.game-card:nth-child(4n) { animation-delay: 150ms; }
.game-card:nth-child(5n) { animation-delay: 200ms; }

/* 触摸设备优化 */
@media (hover: none) and (pointer: coarse) {
  .quick-actions {
    opacity: 1;
    transform: translateY(0);
  }
  
  .game-card {
    transform: translateY(0) !important;
  }
  
  .game-poster {
    transform: scale(1) !important;
  }
}
</style>