<template>
  <div class="detail-container">
    <!-- 游戏详情头部 -->
    <div class="game-header" v-if="game">
      <div class="game-banner">
        <img 
          v-lazy="getGamePosterUrl(game.name)" 
          :alt="game.name"
          class="game-banner-img"
        >
        <div class="banner-overlay"></div>
        <div class="banner-content">
          <h1 class="game-name">{{ game.name }}</h1>
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
            <span class="meta-item">{{ game.type || '未知类型' }}</span>
            <span class="meta-item">{{ game.platform || '全平台' }}</span>
            <span class="meta-item">{{ game.version || '最新版' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 游戏详情内容 -->
    <div class="game-content" v-if="game">
      <div class="content-tabs">
        <button 
          :class="['tab-button', { active: activeTab === 'info' }]"
          @click="activeTab = 'info'"
        >
          游戏介绍
        </button>
        <button 
          :class="['tab-button', { active: activeTab === 'files' }]"
          @click="activeTab = 'files'"
        >
          文件管理
        </button>
      </div>

      <!-- 游戏介绍面板 -->
      <div class="tab-panel" v-if="activeTab === 'info'">
        <div class="info-section">
          <h2>游戏简介</h2>
          <p class="game-description">
            {{ game.description || '暂无详细介绍' }}
          </p>
        </div>

        <div class="info-section">
          <h2>游戏特性</h2>
          <ul class="features-list">
            <li v-for="(feature, index) in game.features" :key="index">
              {{ feature }}
            </li>
          </ul>
        </div>

        <div class="info-section">
          <h2>系统要求</h2>
          <div class="system-requirements">
            <div class="req-column">
              <h3>最低配置</h3>
              <ul class="req-list">
                <li v-for="(req, index) in game.minRequirements" :key="index">
                  {{ req }}
                </li>
              </ul>
            </div>
            <div class="req-column">
              <h3>推荐配置</h3>
              <ul class="req-list">
                <li v-for="(req, index) in game.recommendedRequirements" :key="index">
                  {{ req }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- 文件管理面板 -->
      <div class="tab-panel" v-if="activeTab === 'files'">
        <div class="files-section">
          <h2>游戏文件</h2>
          <div class="file-list">
            <div 
              v-for="file in gameFiles" 
              :key="file.name"
              class="file-item"
            >
              <div class="file-info">
                <span class="file-name">{{ file.name }}</span>
                <span class="file-size">{{ formatFileSize(file.size) }}</span>
              </div>
              <div class="file-actions">
                <button class="action-button view-button">查看</button>
                <button class="action-button backup-button" @click="backupFile(file)">
                  备份
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="backup-history" v-if="backupHistory.length > 0">
          <h2>备份历史</h2>
          <div class="history-list">
            <div 
              v-for="backup in backupHistory" 
              :key="backup.id"
              class="history-item"
            >
              <div class="history-info">
                <span class="history-file">{{ backup.fileName }}</span>
                <span class="history-time">{{ formatDate(backup.timestamp) }}</span>
                <span class="history-version">{{ backup.version }}</span>
              </div>
              <button class="action-button restore-button" @click="restoreFile(backup)">
                恢复
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div class="loading-state" v-else>
      <div class="skeleton-header">
        <div class="skeleton-banner"></div>
        <div class="skeleton-title"></div>
        <div class="skeleton-tags"></div>
      </div>
      <div class="skeleton-content">
        <div class="skeleton-section"></div>
        <div class="skeleton-section"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useGameStore } from '../store/gameStore'
import { useFileStore } from '../store/fileStore'

const route = useRoute()
const gameStore = useGameStore()
const fileStore = useFileStore()

const game = ref(null)
const gameFiles = ref([])
const backupHistory = ref([])
const activeTab = ref('info')

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

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化日期
const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleString()
}

// 备份文件
const backupFile = (file) => {
  fileStore.backupFile(file)
    .then(() => {
      loadBackupHistory()
      alert('文件备份成功')
    })
    .catch(error => {
      console.error('备份失败:', error)
      alert('备份失败，请重试')
    })
}

// 恢复文件
const restoreFile = (backup) => {
  if (confirm(`确定要恢复文件 ${backup.fileName} 到版本 ${backup.version} 吗？`)) {
    fileStore.restoreFile(backup)
      .then(() => {
        alert('文件恢复成功')
      })
      .catch(error => {
        console.error('恢复失败:', error)
        alert('恢复失败，请重试')
      })
  }
}

// 加载备份历史
const loadBackupHistory = () => {
  backupHistory.value = fileStore.getBackupHistory(route.params.name)
}

// 加载游戏详情
onMounted(async () => {
  const gameName = route.params.name
  try {
    await gameStore.loadGames()
    game.value = gameStore.getGameByName(gameName)
    
    // 模拟加载游戏文件
    if (game.value) {
      // 这里应该是实际读取游戏目录的逻辑
      gameFiles.value = [
        { name: `${gameName}.html`, size: 102400, path: `/game-website-core/game-main/${gameName}/${gameName}.html` },
        { name: 'resources.js', size: 51200, path: `/game-website-core/game-main/${gameName}/resources.js` },
        { name: 'assets.json', size: 2048, path: `/game-website-core/game-main/${gameName}/assets.json` }
      ]
      
      loadBackupHistory()
    }
  } catch (error) {
    console.error('加载游戏详情失败:', error)
  }
})
</script>

<style scoped>
.detail-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.game-banner {
  position: relative;
  height: 400px;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 30px;
}

.game-banner-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.banner-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.8));
}

.banner-content {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 40px;
  color: #F0F0F0;
}

.game-name {
  font-size: 2.5rem;
  margin-bottom: 15px;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
}

.game-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 15px;
}

.game-tag {
  background-color: rgba(76, 201, 240, 0.2);
  color: #4CC9F0;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.9rem;
  backdrop-filter: blur(10px);
}

.game-meta {
  display: flex;
  gap: 20px;
  font-size: 1rem;
  color: #A0A0A0;
}

.content-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
  background-color: #2A2A3E;
  padding: 10px;
  border-radius: 12px;
}

.tab-button {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  background-color: #1A1A2E;
  color: #A0A0A0;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tab-button:hover {
  background-color: #16213E;
  color: #F0F0F0;
}

.tab-button.active {
  background-color: #9D4EDD;
  color: #FFFFFF;
}

.tab-panel {
  background-color: #2A2A3E;
  border-radius: 12px;
  padding: 30px;
}

.info-section {
  margin-bottom: 40px;
}

.info-section h2 {
  color: #4CC9F0;
  font-size: 1.5rem;
  margin-bottom: 15px;
  border-bottom: 2px solid #16213E;
  padding-bottom: 10px;
}

.game-description {
  color: #F0F0F0;
  line-height: 1.6;
  font-size: 1.1rem;
}

.features-list {
  list-style: none;
  padding: 0;
}

.features-list li {
  color: #F0F0F0;
  margin-bottom: 10px;
  padding-left: 25px;
  position: relative;
}

.features-list li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: #9D4EDD;
  font-weight: bold;
}

.system-requirements {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.req-column h3 {
  color: #9D4EDD;
  font-size: 1.2rem;
  margin-bottom: 15px;
}

.req-list {
  list-style: none;
  padding: 0;
}

.req-list li {
  color: #A0A0A0;
  margin-bottom: 8px;
}

.file-list,
.history-list {
  background-color: #1A1A2E;
  border-radius: 8px;
  overflow: hidden;
}

.file-item,
.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #333;
}

.file-item:last-child,
.history-item:last-child {
  border-bottom: none;
}

.file-info,
.history-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.file-name,
.history-file {
  color: #F0F0F0;
  font-weight: 500;
}

.file-size,
.history-time,
.history-version {
  color: #A0A0A0;
  font-size: 0.9rem;
}

.file-actions {
  display: flex;
  gap: 10px;
}

.action-button {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.view-button {
  background-color: #4CC9F0;
  color: #FFFFFF;
}

.backup-button {
  background-color: #9D4EDD;
  color: #FFFFFF;
}

.restore-button {
  background-color: #10B981;
  color: #FFFFFF;
}

.action-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.backup-history {
  margin-top: 40px;
}

/* 加载状态样式 */
.loading-state {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.skeleton-header {
  background-color: #2A2A3E;
  border-radius: 12px;
  padding: 20px;
}

.skeleton-banner {
  height: 300px;
  background-color: #3A3A4E;
  border-radius: 8px;
  margin-bottom: 20px;
  animation: pulse 1.5s ease-in-out infinite;
}

.skeleton-title,
.skeleton-tags,
.skeleton-section {
  background-color: #3A3A4E;
  border-radius: 8px;
  animation: pulse 1.5s ease-in-out infinite;
}

.skeleton-title {
  height: 40px;
  width: 50%;
  margin-bottom: 15px;
}

.skeleton-tags {
  height: 30px;
  width: 80%;
}

.skeleton-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.skeleton-section {
  height: 200px;
  width: 100%;
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
  .game-banner {
    height: 250px;
  }
  
  .banner-content {
    padding: 20px;
  }
  
  .game-name {
    font-size: 1.8rem;
  }
  
  .system-requirements {
    grid-template-columns: 1fr;
  }
  
  .file-item,
  .history-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .file-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>