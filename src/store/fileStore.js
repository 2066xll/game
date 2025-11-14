import { defineStore } from 'pinia'

export const useFileStore = defineStore('file', {
  state: () => ({
    // 文件历史版本记录
    fileHistory: {},
    // 正在跟踪的文件列表
    trackedFiles: [],
    // 文件自动保存定时器
    autoSaveTimer: null,
    // 上次保存时间
    lastSaveTime: null
  }),

  getters: {
    // 获取指定游戏的文件历史
    getGameFileHistory: (state) => (gameName) => {
      return state.fileHistory[gameName] || []
    },

    // 检查是否有待保存的更改
    hasUnsavedChanges: (state) => {
      return state.trackedFiles.length > 0
    },

    // 获取上次保存时间
    getLastSaveTimeDisplay: (state) => {
      if (!state.lastSaveTime) return '从未保存'
      return new Date(state.lastSaveTime).toLocaleString()
    }
  },

  actions: {
    // 初始化文件存储
    initializeFileStore() {
      // 从localStorage恢复文件历史记录
      this.restoreFromStorage()
      // 设置定期自动保存
      this.setupAutoSave()
    },

    // 跟踪文件变更
    trackFile(gameName, filePath, content) {
      // 添加到跟踪列表
      const fileKey = `${gameName}_${filePath}`
      if (!this.trackedFiles.includes(fileKey)) {
        this.trackedFiles.push(fileKey)
      }

      // 10秒后自动保存（防抖）
      if (this.autoSaveTimer) {
        clearTimeout(this.autoSaveTimer)
      }

      this.autoSaveTimer = setTimeout(() => {
        this.saveFile(gameName, filePath, content)
      }, 10000)

      console.log(`文件变更已跟踪: ${gameName}/${filePath}`)
    },

    // 保存文件
    saveFile(gameName, filePath, content) {
      try {
        // 生成版本号
        const version = `v${(this.getGameFileHistory(gameName).length + 1).toString().padStart(3, '0')}`
        const timestamp = new Date().toISOString()
        const fileSize = new Blob([content]).size

        // 文件元数据
        const fileMetadata = {
          version,
          timestamp,
          fileSize,
          gameName,
          filePath
        }

        // 确定存储位置（小文件<5MB用localStorage，大文件用IndexedDB）
        if (fileSize < 5 * 1024 * 1024) {
          // 使用localStorage
          this.saveToLocalStorage(gameName, filePath, content, fileMetadata)
        } else {
          // 使用IndexedDB（预留功能）
          this.saveToIndexedDB(gameName, filePath, content, fileMetadata)
        }

        // 从跟踪列表移除
        const fileKey = `${gameName}_${filePath}`
        this.trackedFiles = this.trackedFiles.filter(key => key !== fileKey)

        this.lastSaveTime = timestamp
        console.log(`文件已保存: ${gameName}/${filePath} (${version})`)
      } catch (error) {
        console.error('保存文件失败:', error)
      }
    },

    // 保存到localStorage
    saveToLocalStorage(gameName, filePath, content, metadata) {
      // 确保gameName存在于fileHistory中
      if (!this.fileHistory[gameName]) {
        this.fileHistory[gameName] = []
      }

      // 添加版本记录
      this.fileHistory[gameName].push(metadata)

      // 保存内容
      const contentKey = `file_${gameName}_${filePath}_${metadata.version}`
      localStorage.setItem(contentKey, content)

      // 保存历史记录
      localStorage.setItem('fileHistory', JSON.stringify(this.fileHistory))
    },

    // 保存到IndexedDB（预留功能）
    async saveToIndexedDB(gameName, filePath, content, metadata) {
      // 这里是预留的IndexedDB实现，用于大文件存储
      console.warn('IndexedDB存储功能尚未完全实现，使用localStorage替代')
      // 临时使用localStorage作为备份
      this.saveToLocalStorage(gameName, filePath, content, metadata)
    },

    // 从历史版本恢复文件
    restoreFromVersion(gameName, version) {
      const history = this.getGameFileHistory(gameName)
      const targetVersion = history.find(h => h.version === version)
      
      if (!targetVersion) {
        console.error(`未找到版本: ${gameName} ${version}`)
        return null
      }

      const contentKey = `file_${gameName}_${targetVersion.filePath}_${version}`
      const content = localStorage.getItem(contentKey)
      
      if (content) {
        console.log(`已恢复文件: ${gameName}/${targetVersion.filePath} 到版本 ${version}`)
        return content
      }
      
      return null
    },

    // 删除文件历史版本
    deleteFileVersion(gameName, version) {
      const history = this.getGameFileHistory(gameName)
      const versionIndex = history.findIndex(h => h.version === version)
      
      if (versionIndex > -1) {
        const fileToDelete = history[versionIndex]
        const contentKey = `file_${gameName}_${fileToDelete.filePath}_${version}`
        
        // 删除内容
        localStorage.removeItem(contentKey)
        // 删除历史记录
        history.splice(versionIndex, 1)
        
        // 更新存储
        localStorage.setItem('fileHistory', JSON.stringify(this.fileHistory))
        console.log(`已删除版本: ${gameName} ${version}`)
      }
    },

    // 清空游戏文件历史
    clearGameHistory(gameName) {
      if (this.fileHistory[gameName]) {
        // 删除所有版本的内容
        this.fileHistory[gameName].forEach(version => {
          const contentKey = `file_${gameName}_${version.filePath}_${version.version}`
          localStorage.removeItem(contentKey)
        })
        
        // 删除历史记录
        delete this.fileHistory[gameName]
        localStorage.setItem('fileHistory', JSON.stringify(this.fileHistory))
        console.log(`已清空游戏历史: ${gameName}`)
      }
    },

    // 从localStorage恢复
    restoreFromStorage() {
      try {
        const savedHistory = localStorage.getItem('fileHistory')
        if (savedHistory) {
          this.fileHistory = JSON.parse(savedHistory)
          console.log('文件历史记录已恢复')
        }
      } catch (error) {
        console.error('恢复文件历史失败:', error)
        this.fileHistory = {}
      }
    },

    // 设置自动保存
    setupAutoSave() {
      // 每5分钟保存一次所有跟踪的文件
      setInterval(() => {
        if (this.hasUnsavedChanges) {
          console.log('执行定时自动保存...')
          // 这里可以触发所有待保存文件的保存
          // 对于实际应用，可以根据trackedFiles列表进行批量保存
        }
      }, 5 * 60 * 1000)
    },

    // 获取文件差异（预留功能）
    getFileDiff(gameName, version1, version2) {
      // 预留功能：比较两个版本之间的差异
      console.warn('文件差异比较功能尚未实现')
      return { diff: 'No diff available' }
    },

    // 检查文件是否已被修改
    checkFileModified(gameName, filePath, currentContent) {
      const history = this.getGameFileHistory(gameName)
      if (history.length === 0) return false

      // 获取最新版本
      const latestVersion = history[history.length - 1]
      const contentKey = `file_${gameName}_${filePath}_${latestVersion.version}`
      const savedContent = localStorage.getItem(contentKey)

      return savedContent !== currentContent
    }
  }
})