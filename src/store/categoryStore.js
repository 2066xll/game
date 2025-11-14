import { defineStore } from 'pinia'
import { useGameStore } from './gameStore'

export const useCategoryStore = defineStore('category', {
  state: () => ({
    filters: {
      type: '',
      platform: '',
      sortBy: 'popularity',
      searchQuery: ''
    },
    selectedTags: []
  }),

  getters: {
    // 获取搜索结果
    searchResults: (state) => {
      const gameStore = useGameStore()
      if (!state.filters.searchQuery || state.filters.searchQuery.trim() === '') {
        return []
      }
      return gameStore.searchGames ? gameStore.searchGames(state.filters.searchQuery) : []
    },
    
    // 获取过滤后的游戏列表
    filteredGames: (state) => {
      const gameStore = useGameStore()
      let games
      
      // 如果有搜索查询，从搜索结果开始过滤
      if (state.filters.searchQuery && state.filters.searchQuery.trim() !== '') {
        games = [...(gameStore.searchGames ? gameStore.searchGames(state.filters.searchQuery) : [])]
      } else {
        games = [...gameStore.games]
      }
      
      // 应用类型过滤
      if (state.filters.type) {
        games = games.filter(game => 
          game.type && game.type.includes(state.filters.type)
        )
      }
      
      // 应用平台过滤
      if (state.filters.platform) {
        games = games.filter(game => 
          game.platform && game.platform.includes(state.filters.platform)
        )
      }
      
      // 按标签筛选
      if (state.selectedTags.length > 0) {
        games = games.filter(game => {
          if (!game.tags || !Array.isArray(game.tags)) return false
          return state.selectedTags.every(tag => 
            game.tags.some(gameTag => gameTag.toLowerCase() === tag.toLowerCase())
          )
        })
      }
      
      // 应用排序
      if (state.filters.sortBy === 'relevance' && state.filters.searchQuery) {
        // 使用搜索分数进行排序
        games.sort((a, b) => (b.searchScore || 0) - (a.searchScore || 0))
      } else if (state.filters.sortBy === 'popularity') {
        games.sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      } else if (state.filters.sortBy === 'name') {
        games.sort((a, b) => a.name.localeCompare(b.name))
      } else if (state.filters.sortBy === 'date') {
        games.sort((a, b) => 
          new Date(b.releaseDate || 0).getTime() - new Date(a.releaseDate || 0).getTime()
        )
      }
      
      return games
    },

    // 获取当前活跃的筛选条件数量
    activeFilterCount: (state) => {
      let count = 0
      if (state.filters.type) count++
      if (state.filters.platform) count++
      if (state.filters.searchQuery) count++
      if (state.selectedTags.length > 0) count++
      return count
    },
    
    // 检查是否有活动的筛选条件
    hasActiveFilters: (state) => {
      return state.filters.type !== '' || 
             state.filters.platform !== '' || 
             state.filters.searchQuery !== '' ||
             state.selectedTags.length > 0 ||
             state.filters.sortBy !== 'popularity'
    },
    
    // 获取所有可用的标签
    availableTags: () => {
      const gameStore = useGameStore()
      const tags = new Map()
      gameStore.games.forEach(game => {
        if (game.tags && Array.isArray(game.tags)) {
          game.tags.forEach(tag => {
            tags.set(tag, (tags.get(tag) || 0) + 1)
          })
        }
      })
      // 转换为排序后的数组并限制数量
      return Array.from(tags.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20) // 限制显示前20个热门标签
    },

    // 获取所有游戏类型
    allTypes: () => {
      const gameStore = useGameStore()
      const types = new Set()
      gameStore.games.forEach(game => {
        if (game.type) {
          const typeArray = game.type.split(',').map(t => t.trim())
          typeArray.forEach(type => types.add(type))
        }
      })
      return Array.from(types)
    },

    // 获取所有平台
    allPlatforms: () => {
      const gameStore = useGameStore()
      const platforms = new Set()
      gameStore.games.forEach(game => {
        if (game.platform) {
          const platformArray = game.platform.split(',').map(p => p.trim())
          platformArray.forEach(platform => platforms.add(platform))
        }
      })
      return Array.from(platforms)
    }
  },

  actions: {
    // 设置筛选条件
    setFilters(newFilters) {
      this.filters = { ...this.filters, ...newFilters }
    },

    // 重置所有筛选条件
    resetFilters() {
      this.filters = {
        type: '',
        platform: '',
        sortBy: 'popularity',
        searchQuery: ''
      }
      this.selectedTags = []
    },
    
    // 设置搜索查询
    setSearchQuery(query) {
      this.filters.searchQuery = query
      // 搜索时自动设置为按相关性排序
      if (query && query.trim() !== '') {
        this.filters.sortBy = 'relevance'
      }
    },
    
    // 清空搜索查询
    clearSearchQuery() {
      this.filters.searchQuery = ''
      // 清空搜索时恢复默认排序
      this.filters.sortBy = 'popularity'
    },
    
    // 添加标签
    addTag(tag) {
      if (!this.selectedTags.includes(tag)) {
        this.selectedTags.push(tag)
      }
    },
    
    // 移除标签
    removeTag(tag) {
      const index = this.selectedTags.indexOf(tag)
      if (index > -1) {
        this.selectedTags.splice(index, 1)
      }
    },
    
    // 清空标签
    clearTags() {
      this.selectedTags = []
    },
    
    // 应用搜索建议
    applySearchSuggestion(suggestion) {
      this.setSearchQuery(suggestion)
      // 清除可能冲突的筛选条件
      this.filters.type = ''
      this.filters.platform = ''
      // 但保留标签筛选，因为用户可能想进一步缩小范围
    },
    
    // 组合搜索和筛选
    combinedSearch(query, filters = {}) {
      // 设置搜索查询
      this.setSearchQuery(query)
      
      // 应用筛选条件
      if (filters.type !== undefined) this.filters.type = filters.type
      if (filters.platform !== undefined) this.filters.platform = filters.platform
      if (filters.tags !== undefined) this.selectedTags = filters.tags
      if (filters.sortBy !== undefined) this.filters.sortBy = filters.sortBy
      
      return this.filteredGames
    },

    // 按标签筛选（用于点击标签时）
    filterByTag(tag) {
      // 这里可以扩展标签筛选逻辑
      // 目前返回包含该标签的游戏
      const gameStore = useGameStore()
      return gameStore.getGamesByTag(tag)
    },

    // 获取筛选条件的查询字符串
    getFilterQueryString() {
      const queryParams = []
      if (this.filters.searchQuery) {
        queryParams.push(`q=${encodeURIComponent(this.filters.searchQuery)}`)
      }
      if (this.filters.type) {
        queryParams.push(`type=${encodeURIComponent(this.filters.type)}`)
      }
      if (this.filters.platform) {
        queryParams.push(`platform=${encodeURIComponent(this.filters.platform)}`)
      }
      if (this.selectedTags.length > 0) {
        queryParams.push(`tags=${encodeURIComponent(this.selectedTags.join(','))}`)
      }
      if (this.filters.sortBy !== 'popularity') {
        queryParams.push(`sort=${encodeURIComponent(this.filters.sortBy)}`)
      }
      return queryParams.length > 0 ? '?' + queryParams.join('&') : ''
    },
    
    // 从URL参数加载筛选条件
    loadFromUrlParams(params) {
      if (params.q) this.setSearchQuery(params.q)
      if (params.type) this.filters.type = params.type
      if (params.platform) this.filters.platform = params.platform
      if (params.tags) this.selectedTags = params.tags.split(',')
      if (params.sort) this.filters.sortBy = params.sort
    },
    
    // 获取当前筛选结果的统计信息
    getFilterStats() {
      const stats = {
        totalGames: this.filteredGames.length,
        searchQuery: this.filters.searchQuery,
        selectedType: this.filters.type || '全部',
        selectedPlatform: this.filters.platform || '全部',
        selectedTagsCount: this.selectedTags.length,
        sortBy: this.filters.sortBy
      }
      
      // 计算匹配率
      if (this.filters.searchQuery) {
        const gameStore = useGameStore()
        const totalPossible = gameStore.games.length
        stats.matchRate = ((stats.totalGames / totalPossible) * 100).toFixed(1)
      }
      
      return stats
    }
  }
})