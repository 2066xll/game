import { defineStore } from 'pinia'
import ErrorHandler from '../utils/ErrorHandler.js'

// 简单的控制台日志函数
const log = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
  error: (msg, error) => console.error(`[ERROR] ${msg}`, error || '')
}

export const useGameStore = defineStore('game', {
  state: () => ({
    games: [],
    loading: false,
    error: null,
    // 缓存搜索结果，提高性能
    _searchCache: new Map(),
    // 索引游戏名称，提高搜索效率
    _gameNameIndex: new Map(),
    // 缓存热门游戏列表
    _popularGamesCache: null,
    // 缓存游戏统计信息
    _gamesStatsCache: null
  }),

  getters: {
    // 添加缓存的热门游戏列表
    popularGames: (state) => {
      // 使用缓存结果或计算新结果
      if (!state._popularGamesCache || state._popularGamesCache.timestamp < Date.now() - 60000) {
        state._popularGamesCache = {
          data: [...state.games].sort((a, b) => (b.popularity || 0) - (a.popularity || 0)),
          timestamp: Date.now()
        }
      }
      return state._popularGamesCache.data
    },
    
    gameCount: (state) => state.games.length,
    
    // 缓存的游戏统计信息
    gamesStats: (state) => {
      if (!state._gamesStatsCache || state._gamesStatsCache.timestamp < Date.now() - 300000) {
        const stats = {
          totalGames: state.games.length,
          gameTypes: new Set(),
          gamePlatforms: new Set(),
          popularTags: {}
        }
        
        state.games.forEach(game => {
          if (game.type) stats.gameTypes.add(game.type)
          if (game.platform) stats.gamePlatforms.add(game.platform)
          
          if (game.tags && Array.isArray(game.tags)) {
            game.tags.forEach(tag => {
              stats.popularTags[tag] = (stats.popularTags[tag] || 0) + 1
            })
          }
        })
        
        // 转换为数组格式
        stats.gameTypes = Array.from(stats.gameTypes)
        stats.gamePlatforms = Array.from(stats.gamePlatforms)
        
        // 排序热门标签
        stats.popularTags = Object.entries(stats.popularTags)
          .sort((a, b) => b[1] - a[1])
          .map(([tag, count]) => ({ tag, count }))
          .slice(0, 10)
        
        state._gamesStatsCache = {
          data: stats,
          timestamp: Date.now()
        }
      }
      return state._gamesStatsCache.data
    }
  },

  actions: {
    // 加载游戏数据
    async loadGames() {
      this.loading = true
      this.error = null
      
      try {
        log.info('开始加载游戏数据')
        
        // 直接使用模拟游戏数据
        this.games = this.getMockGameData()
        
        // 构建游戏名称索引，提高搜索性能
        this._buildGameIndex()
        
        // 清除缓存，确保数据刷新
        this._clearCache()
        
        log.info(`成功加载${this.games.length}个游戏数据`)
      } catch (error) {
        log.error('加载游戏失败', error)
        
        // 设置用户友好的错误信息
        this.error = error.message || '加载游戏数据失败'
        
        // 抛出标准化的错误，使用500作为默认状态码
        ErrorHandler.throwApiError(
          '无法加载游戏数据', 
          'GAME_LOAD_ERROR', 
          error.status || 500
        )
      } finally {
        this.loading = false
      }
    },
    
    // 构建游戏索引
    _buildGameIndex() {
      this._gameNameIndex.clear()
      this.games.forEach(game => {
        // 为每个游戏名称创建小写索引
        this._gameNameIndex.set(game.name.toLowerCase(), game)
      })
    },
    
    // 清除缓存
    _clearCache() {
      this._searchCache.clear()
      delete this._popularGamesCache
      delete this._gamesStatsCache
    },

    // 根据名称获取游戏（优化版本）
    getGameByName(name) {
      log.info(`查找游戏: ${name}`)
      
      // 参数验证
      if (!name || typeof name !== 'string') {
        log.error('无效的游戏名称参数')
        return null
      }
      
      try {
        // 使用索引直接查找，O(1) 时间复杂度
        const exactMatch = this._gameNameIndex.get(name.toLowerCase())
        if (exactMatch && exactMatch.name === name) {
          log.info(`找到游戏: ${name}`)
          return exactMatch
        }
        
        // 如果索引匹配失败（可能是大小写问题），使用线性查找
        const game = this.games.find(game => game.name === name)
        
        if (game) {
          log.info(`找到游戏: ${name}`)
        } else {
          log.info(`未找到游戏: ${name}`)
        }
        
        return game
      } catch (error) {
        log.error(`查找游戏失败: ${name}`, error)
        return null
      }
    },

    // 根据标签获取游戏
    getGamesByTag(tag) {
      return this.games.filter(game => game.tags && game.tags.includes(tag))
    },

    // 获取模拟游戏数据
    getMockGameData() {
      // 模拟游戏数据，基于game-website-core/game-main目录下的游戏
      return [
        {
          name: '超级马里奥',
          type: '动作',
          platform: 'Web',
          description: '经典的超级马里奥游戏，带你回到童年的回忆。控制马里奥跳跃、顶砖块，收集金币！',
          tags: ['经典', '动作', '平台跳跃', '免费'],
          popularity: 95,
          features: [
            '原汁原味的马里奥玩法',
            '多种关卡挑战',
            '收集金币解锁成就',
            '支持键盘和触摸操作'
          ],
          minRequirements: [
            '浏览器支持HTML5',
            '2GB RAM',
            '1GHz处理器'
          ],
          recommendedRequirements: [
            'Chrome/Firefox/Safari最新版',
            '4GB RAM',
            '多核处理器'
          ],
          version: 'v1.0'
        },
        {
          name: 'Flappy Bird',
          type: '休闲',
          platform: 'Web,移动端',
          description: '简单而又具有挑战性的休闲游戏。点击屏幕控制小鸟飞行，穿过水管间隙获取高分。',
          tags: ['休闲', '简单', '免费'],
          popularity: 90,
          features: [
            '简单易上手的操作',
            '无限挑战模式',
            '全球排行榜',
            '分享你的高分'
          ],
          minRequirements: [
            '支持触摸或鼠标点击',
            '任何现代浏览器'
          ],
          recommendedRequirements: [
            '稳定的网络连接',
            '响应式设备'
          ],
          version: 'v1.0'
        },
        {
          name: 'Getting Over It v1.4',
          type: '冒险',
          platform: 'Web,移动端',
          description: '一款充满哲学意味的攀岩游戏。你将控制一个坐在缸里的人，用锤子攀爬各种地形。',
          tags: ['冒险', '挑战性', '物理'],
          popularity: 85,
          features: [
            '独特的物理系统',
            '极具挑战性的关卡设计',
            '深刻的游戏体验',
            '原声音乐'
          ],
          minRequirements: [
            'WebGL支持',
            '2GB RAM',
            '中等性能GPU'
          ],
          recommendedRequirements: [
            '高性能GPU',
            '4GB RAM',
            '低延迟输入设备'
          ],
          version: 'v1.4'
        },
        {
          name: 'Appel v1.4',
          type: '休闲',
          platform: 'Web',
          description: '一款简约风格的休闲游戏，按方向键使方块移动，收集苹果获取分数。',
          tags: ['休闲', '简约', '免费'],
          popularity: 75,
          features: [
            '简约清新的界面',
            '简单的游戏规则',
            '逐渐增加的难度',
            '成就系统'
          ],
          minRequirements: [
            '任何现代浏览器',
            '基本的图形支持'
          ],
          recommendedRequirements: [
            '最新版浏览器',
            '稳定的网络'
          ],
          version: 'v1.4'
        },
        {
          name: 'GunTower',
          type: '射击',
          platform: 'Web,移动端',
          description: '塔防射击游戏，建造防御塔，阻止敌人入侵你的基地。',
          tags: ['射击', '塔防', '策略', '免费'],
          popularity: 80,
          features: [
            '多种防御塔选择',
            '不同类型的敌人',
            '关卡进度系统',
            '升级机制'
          ],
          minRequirements: [
            'WebGL支持',
            '2GB RAM',
            '中等性能CPU'
          ],
          recommendedRequirements: [
            '高性能CPU',
            '4GB RAM',
            '支持游戏手柄'
          ],
          version: 'v1.0'
        },
        {
          name: 'GunTower-Endless',
          type: '射击',
          platform: 'Web,移动端',
          description: 'GunTower的无尽模式版本，挑战你的极限生存能力。',
          tags: ['射击', '塔防', '无尽', '免费'],
          popularity: 82,
          features: [
            '无限波次的敌人',
            '随机生成的地图',
            '更加强大的防御塔',
            '全球高分榜'
          ],
          minRequirements: [
            'WebGL支持',
            '3GB RAM',
            '中高端CPU'
          ],
          recommendedRequirements: [
            '高性能CPU和GPU',
            '8GB RAM',
            '稳定的帧率'
          ],
          version: 'v1.0'
        },
        {
          name: 'Hill Climb Racing v1.0',
          type: '竞速',
          platform: 'Web',
          description: '攀爬赛车游戏，驾驶各种车辆在崎岖的山路上行驶，收集金币。',
          tags: ['竞速', '物理', '休闲', '免费'],
          popularity: 88,
          features: [
            '多种车辆选择',
            '物理驱动的游戏机制',
            '升级系统',
            '多个场景'
          ],
          minRequirements: [
            '支持触摸或键盘控制',
            '任何现代浏览器'
          ],
          recommendedRequirements: [
            '多点触控支持',
            '高性能移动设备'
          ],
          version: 'v1.0'
        },
        {
          name: 'Griffpatch\'s 3D Laser Tag v0.8',
          type: '射击',
          platform: 'Web',
          description: '3D激光枪战游戏，在虚拟竞技场中与其他玩家对战。',
          tags: ['3D', '射击', '多人联机', 'Beta'],
          popularity: 87,
          features: [
            '3D图形和音效',
            '多人联机模式',
          ],
          minRequirements: [
            'WebGL 2.0支持',
            '4GB RAM',
            '独立显卡'
          ],
          recommendedRequirements: [
            '高性能游戏GPU',
            '8GB RAM',
            '低延迟网络连接'
          ],
          version: 'v0.8 Beta'
        }
      ]
    },

    // 高级搜索功能（优化版本）
    searchGames(query) {
      log.info(`执行高级搜索: ${query}`)
      
      try {
        if (!query || query.trim() === '') {
          log.info('搜索查询为空，返回空结果')
          return []
        }
        
        const searchTerm = query.trim().toLowerCase()
        
        // 检查缓存
        const cacheKey = `search:${searchTerm}`
        if (this._searchCache.has(cacheKey)) {
          const cached = this._searchCache.get(cacheKey)
          // 缓存有效期5分钟
          if (Date.now() - cached.timestamp < 300000) {
            log.info(`从缓存返回搜索结果: ${searchTerm}`)
            return cached.data
          }
        }
        
        const results = []
        
        // 对每个游戏进行搜索相关性评分
        this.games.forEach(game => {
        let score = 0
        
        // 1. 游戏名称全字匹配（最高优先级）
        if (game.name.toLowerCase() === searchTerm) {
          score += 100
        }
        // 2. 游戏名称包含匹配
        else if (game.name.toLowerCase().includes(searchTerm)) {
          score += 50
          // 名称开头匹配给予更高分数
          if (game.name.toLowerCase().startsWith(searchTerm)) {
            score += 30
          }
        }
        
        // 3. 游戏描述包含关键词
        if (game.description && game.description.toLowerCase().includes(searchTerm)) {
          // 优化正则表达式性能
          const descriptionLower = game.description.toLowerCase()
          let count = 0
          let index = descriptionLower.indexOf(searchTerm)
          while (index !== -1) {
            count++
            index = descriptionLower.indexOf(searchTerm, index + searchTerm.length)
            // 限制最大计数，避免极端情况下的性能问题
            if (count > 10) break
          }
          score += count * 10
        }
        
        // 4. 游戏类型匹配
        if (game.type && game.type.toLowerCase().includes(searchTerm)) {
          score += 25
        }
        
        // 5. 游戏平台匹配
        if (game.platform && game.platform.toLowerCase().includes(searchTerm)) {
          score += 20
        }
        
        // 6. 标签匹配
        if (game.tags && Array.isArray(game.tags)) {
          game.tags.forEach(tag => {
            const tagLower = tag.toLowerCase()
            if (tagLower === searchTerm) {
              score += 35 // 完全匹配标签
            } else if (tagLower.includes(searchTerm)) {
              score += 15 // 部分匹配标签
            }
          })
        }
        
        // 7. 考虑游戏热度作为辅助因素
        score += (game.popularity || 0) * 0.1
        
        // 只添加有匹配的游戏
        if (score > 0) {
          results.push({
            ...game,
            searchScore: score
          })
        }
      })
      
      // 根据搜索分数排序（从高到低）
      const sortedResults = results.sort((a, b) => b.searchScore - a.searchScore)
      
      // 缓存结果
      this._searchCache.set(cacheKey, {
        data: sortedResults,
        timestamp: Date.now()
      })
      
      // 限制缓存大小
      if (this._searchCache.size > 50) {
        const firstKey = this._searchCache.keys().next().value
        this._searchCache.delete(firstKey)
      }
      
      log.info(`搜索完成: "${searchTerm}", 找到${sortedResults.length}个结果`)
      return sortedResults
    } catch (error) {
      log.error(`搜索失败: ${query}`, error)
      // 发生错误时返回空数组，确保应用不会崩溃
      return []
    }
  },
    
    // 获取搜索建议（优化版本）
    getSearchSuggestions(query, limit = 5) {
      log.info(`获取搜索建议: ${query}, 限制数量: ${limit}`)
      
      try {
        // 参数验证
        limit = parseInt(limit) || 5
        if (limit < 1) limit = 5
        if (limit > 50) limit = 50 // 设置最大限制
        
        if (!query || query.trim().length < 2) {
          log.info('搜索查询为空或过短，返回空结果')
          return []
        }
        
        const searchTerm = query.trim().toLowerCase()
        
        // 检查缓存
        const cacheKey = `suggest:${searchTerm}`
        if (this._searchCache.has(cacheKey)) {
          const cached = this._searchCache.get(cacheKey)
          // 搜索建议缓存有效期更短，1分钟
          if (Date.now() - cached.timestamp < 60000) {
            log.info(`从缓存返回搜索建议: ${searchTerm}`)
            return cached.data
          }
        }
        
        const suggestions = new Set()
        
        // 优化：合并遍历，减少循环次数
        this.games.forEach(game => {
        // 从游戏名称中提取建议
        if (game.name.toLowerCase().includes(searchTerm) && !suggestions.has(game.name)) {
          suggestions.add(game.name)
          if (suggestions.size >= limit) return
        }
        
        // 从标签中提取建议
        if (game.tags && Array.isArray(game.tags)) {
          game.tags.forEach(tag => {
            if (tag.toLowerCase().includes(searchTerm) && !suggestions.has(tag)) {
              suggestions.add(tag)
              if (suggestions.size >= limit) return
            }
          })
          // 如果已经收集了足够的建议，提前退出
          if (suggestions.size >= limit) return
        }
      })
      
      const result = Array.from(suggestions).slice(0, limit)
      
      // 缓存结果
          this._searchCache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
          })
          
          log.info(`搜索建议生成完成: "${searchTerm}", 生成${result.length}个建议`)
          return result
        } catch (error) {
          log.error(`生成搜索建议失败: ${query}`, error)
          // 发生错误时返回空数组，确保应用不会崩溃
          return []
        }
      },
    
    // 批量搜索（多关键词优化版）
    searchGamesByKeywords(keywords) {
      log.info(`批量关键词搜索: ${JSON.stringify(keywords)}`)
      
      try {
        if (!keywords || keywords.length === 0) {
          return this.games
        }
        
        // 检查缓存
        const cacheKey = `multi:${keywords.sort().join(',')}`
        if (this._searchCache.has(cacheKey)) {
          const cached = this._searchCache.get(cacheKey)
          if (Date.now() - cached.timestamp < 300000) {
            log.info(`从缓存返回关键词搜索结果: ${cacheKey}`)
            return cached.data
          }
        }
        
        // 预计算所有关键词的小写形式
        const lowerCaseKeywords = keywords.map(keyword => keyword.toLowerCase())
      
      const results = this.games.filter(game => {
        // 预计算游戏属性的小写形式，避免多次调用toLowerCase()
        const gameNameLower = game.name ? game.name.toLowerCase() : ''
        const gameDescLower = game.description ? game.description.toLowerCase() : ''
        const gameTypeLower = game.type ? game.type.toLowerCase() : ''
        const gamePlatformLower = game.platform ? game.platform.toLowerCase() : ''
        
        // 对每个游戏，检查是否匹配所有关键词（AND逻辑）
        return lowerCaseKeywords.every(term => {
          // 名称匹配
          if (gameNameLower.includes(term)) return true
          // 描述匹配
          if (gameDescLower.includes(term)) return true
          // 类型匹配
          if (gameTypeLower.includes(term)) return true
          // 平台匹配
          if (gamePlatformLower.includes(term)) return true
          // 标签匹配
          if (game.tags && Array.isArray(game.tags)) {
            for (let i = 0; i < game.tags.length; i++) {
              if (game.tags[i].toLowerCase().includes(term)) {
                return true
              }
            }
          }
          return false
        })
      })
      
      // 缓存结果
      this._searchCache.set(cacheKey, {
        data: results,
        timestamp: Date.now()
      })
      
      log.info(`关键词搜索完成: ${JSON.stringify(keywords)}, 找到${results.length}个结果`)
      return results
    } catch (error) {
      log.error(`关键词搜索失败: ${JSON.stringify(keywords)}`, error)
      // 发生错误时返回空数组，确保应用不会崩溃
      return []
    }
  },
    
    // 获取搜索统计信息（优化版本，使用缓存的getter）
    getSearchStats() {
      log.info('获取搜索统计信息')
      
      try {
        // 直接返回缓存的计算属性，避免重复计算
        const stats = this.gamesStats
        
        log.info(`搜索统计信息: ${JSON.stringify(stats)}`)
        return stats
      } catch (error) {
        log.error('获取搜索统计信息失败', error)
        // 发生错误时返回默认统计信息，确保应用不会崩溃
        return {
          totalGames: 0,
          gameTypes: [],
          gamePlatforms: [],
          popularTags: []
        }
      }
    }
  }
})