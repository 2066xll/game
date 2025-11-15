import { defineStore } from 'pinia'
import { useGameStore } from './gameStore'

export const useTagStore = defineStore('tag', {
  state: () => ({
    // 预设标签库，按类别分组
    presetTags: [
      '经典', '3D', '多人联机', '免费', '动作', '冒险',
      '休闲', '射击', '策略', '竞速', '平台跳跃', '物理', '挑战性',
      'Beta', '简约', '塔防', '无尽', '全球排行榜', '独立游戏', '角色扮演',
      '解谜', '生存', '模拟', '卡牌', '音乐', '格斗'
    ],
    
    // 当前选中的标签
    selectedTags: [],
    
    // 最近使用的标签（用于快速访问）
    recentTags: [],
    
    // 标签过滤逻辑：'and'（且）或 'or'（或）
    filterLogic: 'and',
    
    // 标签类别分组
    tagCategories: {
      '类型': ['动作', '冒险', '休闲', '射击', '策略', '竞速', '平台跳跃', 
              '角色扮演', '解谜', '生存', '模拟', '卡牌', '音乐', '格斗'],
      '特性': ['经典', '3D', '多人联机', '免费', '物理', '挑战性', 'Beta', 
              '简约', '塔防', '无尽', '全球排行榜', '独立游戏']
    }
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
      
      // 按使用频率排序并返回前10个，包含使用次数
      return Object.entries(tagCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count }))
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
      
      return Array.from(tags).sort()
    },

    // 获取包含选中标签的游戏，支持且/或逻辑切换
    filteredGamesByTags: (state) => {
      if (state.selectedTags.length === 0) return useGameStore().games
      
      return useGameStore().games.filter(game => {
        if (!game.tags || !Array.isArray(game.tags)) return false
        
        if (state.filterLogic === 'and') {
          // 使用"且"逻辑：游戏必须包含所有选中的标签
          return state.selectedTags.every(tag => game.tags.includes(tag))
        } else {
          // 使用"或"逻辑：游戏至少包含一个选中的标签
          return state.selectedTags.some(tag => game.tags.includes(tag))
        }
      })
    },
    
    // 获取按类别分组的标签
    groupedTags: (state) => {
      const grouped = {}
      
      // 初始化类别分组
      Object.keys(state.tagCategories).forEach(category => {
        grouped[category] = []
      })
      
      // 为每个标签分配到相应类别
      state.presetTags.forEach(tag => {
        let assigned = false
        for (const [category, tags] of Object.entries(state.tagCategories)) {
          if (tags.includes(tag)) {
            grouped[category].push(tag)
            assigned = true
            break
          }
        }
        // 未分类的标签放入"其他"类别
        if (!assigned) {
          if (!grouped['其他']) {
            grouped['其他'] = []
          }
          grouped['其他'].push(tag)
        }
      })
      
      return grouped
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
      // 保持最多8个最近使用的标签
      if (this.recentTags.length > 8) {
        this.recentTags.pop()
      }
      
      // 存储到localStorage以便在页面刷新后保持
      try {
        localStorage.setItem('recentTags', JSON.stringify(this.recentTags))
      } catch (error) {
        console.warn('无法保存最近使用的标签:', error)
      }
    },

    // 获取标签对应的颜色
    getTagColor(tag) {
      // 按标签类别组织颜色，使相似类别的标签有相似的颜色范围
      const tagColors = {
        // 类型标签
        '动作': '#FF6B6B',  // 红色
        '冒险': '#FF9F1C',  // 橙色
        '休闲': '#4ECDC4',  // 青绿色
        '射击': '#F28482',  // 淡珊瑚色
        '策略': '#7209B7',  // 深紫色
        '竞速': '#F72585',  // 粉红色
        '平台跳跃': '#3A86FF', // 蓝色
        '角色扮演': '#FF7D00', // 深橙色
        '解谜': '#6A0572',  // 紫色
        '生存': '#2D3E50',  // 深灰蓝色
        '模拟': '#1ABC9C',  // 绿松石色
        '卡牌': '#9B59B6',  // 紫罗兰色
        '音乐': '#E74C3C',  // 鲜红色
        '格斗': '#F1C40F',  // 黄色
        
        // 特性标签
        '经典': '#FFD700', // 金色
        '3D': '#9370DB',   // 紫色
        '多人联机': '#32CD32', // 绿黄色
        '免费': '#4CC9F0',  // 亮蓝
        '物理': '#4361EE',  // 深蓝
        '挑战性': '#FF006E', // 霓虹粉
        'Beta': '#A41623',  // 深红色
        '简约': '#4A5568',  // 深灰色
        '塔防': '#1E3A8A',  // 深蓝色
        '无尽': '#8B5CF6',  // 紫色
        '全球排行榜': '#06D6A0', // 薄荷绿
        '独立游戏': '#3730A3' // 靛蓝色
      }
      
      return tagColors[tag] || '#9D4EDD' // 默认亮紫色
    },

    // 获取标签背景渐变
    getTagGradient(tag) {
      const baseColor = this.getTagColor(tag)
      // 创建从颜色到其淡化版本的渐变
      const lighterColor = this.lightenColor(baseColor, 20)
      return `linear-gradient(135deg, ${baseColor}, ${lighterColor})`
    },
    
    // 辅助函数：将颜色变亮
    lightenColor(color, percent) {
      const num = parseInt(color.replace('#', ''), 16)
      const amt = Math.round(2.55 * percent)
      const R = (num >> 16) + amt
      const G = (num >> 8 & 0x00FF) + amt
      const B = (num & 0x0000FF) + amt
      
      return '#' + (0x1000000 + 
        (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + 
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + 
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1)
    },

    // 优化的标签搜索功能，支持模糊匹配和相关性排序
    searchTags(query) {
      if (!query) return this.presetTags
      
      const lowerQuery = query.toLowerCase().trim()
      
      // 计算标签与查询的相关性分数
      const scoredTags = this.presetTags.map(tag => {
        const lowerTag = tag.toLowerCase()
        let score = 0
        
        // 精确匹配给最高分数
        if (lowerTag === lowerQuery) score = 3
        // 开始匹配给次高分数
        else if (lowerTag.startsWith(lowerQuery)) score = 2
        // 包含匹配给基本分数
        else if (lowerTag.includes(lowerQuery)) score = 1
        
        return { tag, score }
      })
      
      // 过滤掉分数为0的标签，并按分数降序排序
      return scoredTags
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.tag)
    },

    // 设置过滤逻辑
    setFilterLogic(logic) {
      if (['and', 'or'].includes(logic)) {
        this.filterLogic = logic
      }
    },
    
    // 初始化：从localStorage加载最近使用的标签
    initRecentTags() {
      try {
        const savedRecentTags = localStorage.getItem('recentTags')
        if (savedRecentTags) {
          this.recentTags = JSON.parse(savedRecentTags)
        }
      } catch (error) {
        console.warn('无法加载最近使用的标签:', error)
        this.recentTags = []
      }
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