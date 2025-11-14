import { defineStore } from 'pinia'
import { useGameStore } from './gameStore'

export const useTagStore = defineStore('tag', {
  state: () => ({
    // 预设标签库
    presetTags: [
      '经典', '3D', '多人联机', '免费', '动作', '冒险',
      '休闲', '射击', '策略', '竞速', '平台跳跃', '物理', '挑战性',
      'Beta', '简约', '塔防', '无尽', '全球排行榜'
    ],
    
    // 当前选中的标签
    selectedTags: [],
    
    // 最近使用的标签（用于快速访问）
    recentTags: []
  }),

  getters: {
    // 获取热门标签（基于游戏使用频率）
    popularTags: () => {
      const gameStore = useGameStore()
      const tagCount = {}
      
      // 统计每个标签的使用次数
      gameStore.games.forEach(game => {
        if (game.tags && Array.isArray(game.tags)) {
          game.tags.forEach(tag => {
            tagCount[tag] = (tagCount[tag] || 0) + 1
          })
        }
      })
      
      // 按使用频率排序并返回前10个
      return Object.entries(tagCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag]) => tag)
    },

    // 获取所有游戏使用的标签
    allUsedTags: () => {
      const gameStore = useGameStore()
      const tags = new Set()
      
      gameStore.games.forEach(game => {
        if (game.tags && Array.isArray(game.tags)) {
          game.tags.forEach(tag => tags.add(tag))
        }
      })
      
      return Array.from(tags)
    },

    // 获取包含选中标签的游戏
    filteredGamesByTags: (state) => {
      if (state.selectedTags.length === 0) return useGameStore().games
      
      return useGameStore().games.filter(game => {
        if (!game.tags || !Array.isArray(game.tags)) return false
        // 使用"且"逻辑：游戏必须包含所有选中的标签
        return state.selectedTags.every(tag => game.tags.includes(tag))
      })
    }
  },

  actions: {
    // 添加选中标签
    addSelectedTag(tag) {
      if (!this.selectedTags.includes(tag)) {
        this.selectedTags.push(tag)
        this.updateRecentTags(tag)
      }
    },

    // 移除选中标签
    removeSelectedTag(tag) {
      this.selectedTags = this.selectedTags.filter(t => t !== tag)
    },

    // 切换标签选中状态
    toggleTag(tag) {
      const index = this.selectedTags.indexOf(tag)
      if (index > -1) {
        this.removeSelectedTag(tag)
      } else {
        this.addSelectedTag(tag)
      }
    },

    // 清空选中标签
    clearSelectedTags() {
      this.selectedTags = []
    },

    // 更新最近使用的标签
    updateRecentTags(tag) {
      // 移除已存在的相同标签
      this.recentTags = this.recentTags.filter(t => t !== tag)
      // 添加到开头
      this.recentTags.unshift(tag)
      // 保持最多5个最近使用的标签
      if (this.recentTags.length > 5) {
        this.recentTags.pop()
      }
    },

    // 获取标签对应的颜色
    getTagColor(tag) {
      // 为不同类别的标签定义不同的颜色
      const tagColors = {
        '经典': '#FFD700', // 金色
        '3D': '#9370DB',   // 紫色
        '多人联机': '#32CD32', // 绿黄色
        '免费': '#4CC9F0',  // 亮蓝
        // 付费标签已删除
        '动作': '#FF6B6B',  // 红色
        '冒险': '#FF9F1C',  // 橙色
        '休闲': '#4ECDC4',  // 青绿色
        '射击': '#F28482',  // 淡珊瑚色
        '策略': '#7209B7',  // 深紫色
        '竞速': '#F72585',  // 粉红色
        '平台跳跃': '#3A86FF', // 蓝色
        '物理': '#4361EE',  // 深蓝
        '挑战性': '#FF006E', // 霓虹粉
        'Beta': '#A41623',  // 深红色
        '简约': '#4A5568',  // 深灰色
        '塔防': '#1E3A8A',  // 深蓝色
        '无尽': '#8B5CF6',  // 紫色
        '全球排行榜': '#06D6A0' // 薄荷绿
      }
      
      return tagColors[tag] || '#9D4EDD' // 默认亮紫色
    },

    // 搜索标签（用于标签输入自动完成）
    searchTags(query) {
      if (!query) return this.presetTags
      
      const lowerQuery = query.toLowerCase()
      return this.presetTags.filter(tag => 
        tag.toLowerCase().includes(lowerQuery)
      )
    },

    // 从tags.json加载标签（预留功能）
    async loadTagsFromConfig() {
      try {
        // 预留从配置文件加载标签的功能
        // const response = await import('../assets/config/tags.json')
        // this.presetTags = response.default || this.presetTags
      } catch (error) {
        console.warn('无法加载标签配置文件，使用默认标签')
      }
    }
  }
})