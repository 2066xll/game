<template>
  <div class="filter-container">
    <!-- 桌面端侧边栏筛选 -->
    <div class="desktop-filter" v-if="isDesktop">
      <div class="filter-section">
        <h3>游戏类型</h3>
        <div class="filter-options">
          <label 
            v-for="type in gameTypes" 
            :key="type"
            class="filter-option"
          >
            <input 
              type="checkbox" 
              :value="type"
              v-model="localFilters.types"
              @change="updateFilters"
            />
            <span>{{ type }}</span>
          </label>
        </div>
      </div>

      <div class="filter-section">
        <h3>平台</h3>
        <div class="filter-options">
          <label 
            v-for="platform in platforms" 
            :key="platform"
            class="filter-option"
          >
            <input 
              type="radio" 
              name="platform" 
              :value="platform"
              v-model="localFilters.platform"
              @change="updateFilters"
            />
            <span>{{ platform }}</span>
          </label>
        </div>
      </div>

      <div class="filter-section">
        <h3>排序方式</h3>
        <select 
          v-model="localFilters.sort"
          class="sort-select"
          @change="updateFilters"
        >
          <option 
            v-for="option in sortOptions" 
            :key="option.value" 
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="filter-section">
        <h3>热门标签</h3>
        <div class="tag-cloud">
          <span 
            v-for="tag in popularTags" 
            :key="tag"
            class="tag"
            :class="{ 'active': localFilters.tags.includes(tag) }"
            @click="toggleTag(tag)"
          >
            {{ tag }}
          </span>
        </div>
      </div>

      <div class="filter-actions">
        <button class="reset-btn" @click="resetFilters">重置筛选</button>
        <button class="apply-btn" @click="applyFilters">应用筛选</button>
      </div>
    </div>

    <!-- 移动端折叠筛选 -->
    <div class="mobile-filter" v-else>
      <div class="filter-header">
        <button class="filter-toggle" @click="toggleFilterPanel">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
          筛选
        </button>
        <div class="active-filters" v-if="hasActiveFilters">
          <span class="filter-count">{{ activeFilterCount }}</span>
          <span v-for="filter in activeFilterLabels" :key="filter" class="active-filter-tag">
            {{ filter }}
            <button @click="removeFilter(filter)" class="remove-filter">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </span>
        </div>
      </div>

      <!-- 移动端筛选面板 -->
      <transition name="slide-down">
        <div class="filter-panel" v-if="showFilterPanel">
          <div class="filter-panel-header">
            <h3>筛选条件</h3>
            <button class="close-btn" @click="toggleFilterPanel">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <div class="filter-panel-content">
            <!-- 移动端筛选内容 - 与桌面端相同但布局适配移动端 -->
            <div class="filter-section">
              <h4>游戏类型</h4>
              <div class="filter-options">
                <label 
                  v-for="type in gameTypes" 
                  :key="type"
                  class="filter-option mobile"
                >
                  <input 
                    type="checkbox" 
                    :value="type"
                    v-model="localFilters.types"
                    @change="updateFilters"
                  />
                  <span>{{ type }}</span>
                </label>
              </div>
            </div>

            <div class="filter-section">
              <h4>平台</h4>
              <div class="filter-options">
                <label 
                  v-for="platform in platforms" 
                  :key="platform"
                  class="filter-option mobile"
                >
                  <input 
                    type="radio" 
                    name="platform" 
                    :value="platform"
                    v-model="localFilters.platform"
                    @change="updateFilters"
                  />
                  <span>{{ platform }}</span>
                </label>
              </div>
            </div>

            <div class="filter-section">
              <h4>排序方式</h4>
              <select 
                v-model="localFilters.sort"
                class="sort-select mobile"
                @change="updateFilters"
              >
                <option 
                  v-for="option in sortOptions" 
                  :key="option.value" 
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>

            <div class="filter-section">
              <h4>热门标签</h4>
              <div class="tag-cloud mobile">
                <span 
                  v-for="tag in popularTags" 
                  :key="tag"
                  class="tag"
                  :class="{ 'active': localFilters.tags.includes(tag) }"
                  @click="toggleTag(tag)"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
          </div>
          
          <div class="filter-panel-footer">
            <button class="reset-btn" @click="resetFilters">重置</button>
            <button class="apply-btn" @click="applyFilters">应用筛选</button>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useCategoryStore } from '../store/categoryStore'
import { useTagStore } from '../store/tagStore'

// Props
const props = defineProps({
  initialFilters: {
    type: Object,
    default: () => ({})
  }
})

// Emits
const emit = defineEmits(['filters-changed'])

// 响应式状态
const showFilterPanel = ref(false)
const localFilters = ref({
  types: [],
  platform: '全部',
  sort: 'popularity',
  tags: []
})

// 路由和状态管理
const router = useRouter()
const route = useRoute()
const categoryStore = useCategoryStore()
const tagStore = useTagStore()

// 数据
const gameTypes = ['动作', '冒险', '休闲', '策略', '角色扮演', '模拟', '竞技']
const platforms = ['全部', 'PC', '移动端', '主机', 'Web']
const sortOptions = [
  { label: '热门优先', value: 'popularity' },
  { label: '评分最高', value: 'rating' },
  { label: '最新发布', value: 'release' },
  { label: '名称排序', value: 'name' }
]

// 计算属性
const popularTags = computed(() => {
  return tagStore.popularTags.length > 0 
    ? tagStore.popularTags 
    : ['经典', '3D', '多人联机', '免费', '独立游戏']
})

const isDesktop = computed(() => {
  return window.innerWidth >= 1024
})

const hasActiveFilters = computed(() => {
  return localFilters.value.types.length > 0 || 
         localFilters.value.platform !== '全部' || 
         localFilters.value.tags.length > 0
})

const activeFilterCount = computed(() => {
  return localFilters.value.types.length + 
         (localFilters.value.platform !== '全部' ? 1 : 0) + 
         localFilters.value.tags.length
})

const activeFilterLabels = computed(() => {
  const labels = []
  
  // 添加类型标签
  localFilters.value.types.forEach(type => {
    labels.push(`类型: ${type}`)
  })
  
  // 添加平台标签
  if (localFilters.value.platform !== '全部') {
    labels.push(`平台: ${localFilters.value.platform}`)
  }
  
  // 添加排序标签
  const sortLabel = sortOptions.find(option => option.value === localFilters.value.sort)
  if (sortLabel && sortLabel.value !== 'popularity') {
    labels.push(`排序: ${sortLabel.label}`)
  }
  
  // 添加标签标签
  localFilters.value.tags.forEach(tag => {
    labels.push(`标签: ${tag}`)
  })
  
  return labels
})

// 方法
const toggleFilterPanel = () => {
  showFilterPanel.value = !showFilterPanel.value
}

const updateFilters = () => {
  // 通知父组件筛选条件变化
  emit('filters-changed', { ...localFilters.value })
}

const toggleTag = (tag) => {
  const index = localFilters.value.tags.indexOf(tag)
  if (index > -1) {
    localFilters.value.tags.splice(index, 1)
  } else {
    localFilters.value.tags.push(tag)
  }
  updateFilters()
}

const resetFilters = () => {
  localFilters.value = {
    types: [],
    platform: '全部',
    sort: 'popularity',
    tags: []
  }
  updateFilters()
  
  // 如果在移动端，关闭筛选面板
  if (!isDesktop.value) {
    showFilterPanel.value = false
  }
}

const applyFilters = () => {
  // 更新categoryStore的筛选条件
  categoryStore.setFilters({
    types: localFilters.value.types,
    platform: localFilters.value.platform === '全部' ? null : localFilters.value.platform,
    sort: localFilters.value.sort,
    tags: localFilters.value.tags
  })
  
  // 更新URL参数
  router.push({
    query: categoryStore.getFilterQuery()
  })
  
  // 如果在移动端，关闭筛选面板
  if (!isDesktop.value) {
    showFilterPanel.value = false
  }
}

const removeFilter = (filterLabel) => {
  // 解析标签并移除对应的筛选条件
  if (filterLabel.startsWith('类型: ')) {
    const type = filterLabel.replace('类型: ', '')
    const index = localFilters.value.types.indexOf(type)
    if (index > -1) {
      localFilters.value.types.splice(index, 1)
    }
  } else if (filterLabel.startsWith('平台: ')) {
    localFilters.value.platform = '全部'
  } else if (filterLabel.startsWith('排序: ')) {
    localFilters.value.sort = 'popularity'
  } else if (filterLabel.startsWith('标签: ')) {
    const tag = filterLabel.replace('标签: ', '')
    const index = localFilters.value.tags.indexOf(tag)
    if (index > -1) {
      localFilters.value.tags.splice(index, 1)
    }
  }
  
  updateFilters()
}

// 从路由参数加载筛选条件
const loadFiltersFromRoute = () => {
  const query = route.query
  
  // 加载类型筛选
  if (query.types) {
    localFilters.value.types = Array.isArray(query.types) ? query.types : [query.types]
  }
  
  // 加载平台筛选
  if (query.platform) {
    localFilters.value.platform = query.platform
  }
  
  // 加载排序方式
  if (query.sort) {
    localFilters.value.sort = query.sort
  }
  
  // 加载标签筛选
  if (query.tags) {
    localFilters.value.tags = Array.isArray(query.tags) ? query.tags : [query.tags]
  }
}

// 监听路由变化，更新筛选条件
watch(() => route.query, () => {
  loadFiltersFromRoute()
}, { immediate: false })

// 生命周期钩子
onMounted(() => {
  // 加载筛选条件
  if (props.initialFilters && Object.keys(props.initialFilters).length > 0) {
    localFilters.value = { ...localFilters.value, ...props.initialFilters }
  } else {
    // 尝试从路由加载筛选条件
    loadFiltersFromRoute()
  }
  
  // 初始化时通知父组件
  updateFilters()
  
  // 监听窗口大小变化
  window.addEventListener('resize', () => {
    // 窗口变大到桌面尺寸时，自动关闭移动端筛选面板
    if (isDesktop.value && showFilterPanel.value) {
      showFilterPanel.value = false
    }
  })
})
</script>

<style scoped>
.filter-container {
  display: flex;
  flex-direction: column;
}

/* 桌面端侧边栏筛选 */
.desktop-filter {
  width: 100%;
  max-width: 280px;
  background-color: var(--secondary-bg);
  border-radius: var(--border-radius-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
  height: fit-content;
  position: sticky;
  top: 2rem;
}

.filter-section {
  margin-bottom: 2rem;
}

.filter-section h3 {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.filter-section h4 {
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.filter-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.filter-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: var(--border-radius-md);
  transition: background-color var(--transition-fast);
}

.filter-option:hover {
  background-color: var(--hover-bg);
}

.filter-option input[type="checkbox"],
.filter-option input[type="radio"] {
  accent-color: var(--accent-primary);
}

.filter-option span {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.sort-select {
  width: 100%;
  padding: 0.5rem;
  background-color: var(--surface-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
}

.sort-select:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px rgba(157, 78, 221, 0.2);
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag {
  padding: 0.375rem 0.75rem;
  background-color: var(--surface-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-full);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tag.active {
  background-color: var(--accent-primary);
  border-color: var(--accent-primary);
  color: white;
}

.tag:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.filter-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}

.reset-btn,
.apply-btn {
  padding: 0.75rem;
  border-radius: var(--border-radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.reset-btn {
  background-color: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.reset-btn:hover {
  background-color: var(--hover-bg);
}

.apply-btn {
  background-color: var(--accent-primary);
  border: 1px solid var(--accent-primary);
  color: white;
}

.apply-btn:hover {
  background-color: var(--accent-primary-dark);
  border-color: var(--accent-primary-dark);
}

/* 移动端筛选 */
.mobile-filter {
  margin-bottom: 1rem;
}

.filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background-color: var(--secondary-bg);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
}

.filter-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: var(--accent-primary);
  border: 1px solid var(--accent-primary);
  border-radius: var(--border-radius-full);
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-height: 44px;
}

.filter-toggle:hover {
  background-color: var(--accent-primary-dark);
  border-color: var(--accent-primary-dark);
}

.active-filters {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-count {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  background-color: var(--accent-primary);
  color: white;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.active-filter-tag {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background-color: var(--surface-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-full);
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.remove-filter {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 移动端筛选面板 */
.filter-panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--secondary-bg);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    transform: translateY(-100%);
  }
  to {
    transform: translateY(0);
  }
}

.filter-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  background-color: var(--secondary-bg);
  z-index: 1010;
}

.filter-panel-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.filter-panel-content .filter-options {
  flex-direction: row;
  flex-wrap: wrap;
}

.filter-option.mobile {
  width: calc(50% - 0.375rem);
  justify-content: flex-start;
  padding: 0.75rem;
}

.sort-select.mobile {
  width: 100%;
}

.tag-cloud.mobile {
  gap: 0.375rem;
}

.filter-panel-footer {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border-top: 1px solid var(--border-color);
  position: sticky;
  bottom: 0;
  background-color: var(--secondary-bg);
  z-index: 1010;
}

.filter-panel-footer .reset-btn,
.filter-panel-footer .apply-btn {
  flex: 1;
  padding: 0.875rem;
  font-size: 0.9375rem;
  min-height: 48px;
}

/* 动画 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: transform 0.3s ease-out;
}

.slide-down-enter-from {
  transform: translateY(-100%);
}

.slide-down-leave-to {
  transform: translateY(-100%);
}

/* 响应式布局 */
@media (min-width: 768px) {
  .mobile-filter {
    display: none;
  }
}

@media (max-width: 767px) {
  .desktop-filter {
    display: none;
  }
}

/* 触控区域优化 */
@media (hover: none) and (pointer: coarse) {
  .filter-option,
  .filter-toggle,
  .active-filter-tag,
  .tag {
    min-height: 44px;
  }
}
</style>