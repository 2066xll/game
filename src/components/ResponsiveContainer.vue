<template>
  <div class="responsive-container" :class="containerClasses">
    <slot></slot>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

// Props
const props = defineProps({
  // 容器类型：默认、流体、紧凑、宽屏
  type: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'fluid', 'compact', 'wide'].includes(value)
  },
  // 是否需要侧边栏布局
  hasSidebar: {
    type: Boolean,
    default: false
  },
  // 侧边栏位置
  sidebarPosition: {
    type: String,
    default: 'left',
    validator: (value) => ['left', 'right'].includes(value)
  },
  // 侧边栏宽度
  sidebarWidth: {
    type: String,
    default: '280px'
  }
})

// 响应式状态
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 0)

// 计算当前屏幕尺寸类型
const screenSize = computed(() => {
  if (windowWidth.value >= 1200) return 'desktop'
  if (windowWidth.value >= 768) return 'tablet'
  return 'mobile'
})

// 计算容器类名
const containerClasses = computed(() => {
  return {
    [`container-${props.type}`]: true,
    [`has-sidebar-${props.sidebarPosition}`]: props.hasSidebar,
    'has-sidebar': props.hasSidebar,
    'screen-desktop': screenSize.value === 'desktop',
    'screen-tablet': screenSize.value === 'tablet',
    'screen-mobile': screenSize.value === 'mobile'
  }
})

// 监听窗口大小变化
const handleResize = () => {
  windowWidth.value = window.innerWidth
}

// 生命周期钩子
onMounted(() => {
  window.addEventListener('resize', handleResize)
  // 初始计算
  handleResize()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

// 暴露计算属性给父组件使用
defineExpose({
  screenSize,
  windowWidth,
  isMobile: computed(() => screenSize.value === 'mobile'),
  isTablet: computed(() => screenSize.value === 'tablet'),
  isDesktop: computed(() => screenSize.value === 'desktop')
})
</script>

<style scoped>
/* 基础容器样式 */
.responsive-container {
  width: 100%;
  margin-right: auto;
  margin-left: auto;
  padding-right: var(--container-padding);
  padding-left: var(--container-padding);
  position: relative;
}

/* 容器类型变体 */
.container-default {
  max-width: 1200px;
}

.container-fluid {
  max-width: 100%;
}

.container-compact {
  max-width: 960px;
}

.container-wide {
  max-width: 1440px;
}

/* 侧边栏布局 */
.has-sidebar {
  display: flex;
  gap: var(--spacing-lg);
}

.has-sidebar-left .sidebar {
  order: 0;
}

.has-sidebar-left .main-content {
  order: 1;
}

.has-sidebar-right .sidebar {
  order: 1;
}

.has-sidebar-right .main-content {
  order: 0;
}

.sidebar {
  width: v-bind('props.sidebarWidth');
  flex-shrink: 0;
}

.main-content {
  flex: 1;
  min-width: 0;
}

/* 响应式调整 */
@media (max-width: 1200px) {
  .container-wide,
  .container-default {
    max-width: 100%;
  }
}

@media (max-width: 992px) {
  .container-compact {
    max-width: 100%;
  }
}

@media (max-width: 768px) {
  /* 平板设备：折叠侧边栏为顶部 */
  .has-sidebar {
    flex-direction: column;
    gap: var(--spacing-md);
  }
  
  .sidebar {
    width: 100%;
    order: 0 !important;
  }
  
  .main-content {
    order: 1 !important;
  }
  
  .responsive-container {
    padding-right: var(--container-padding-mobile);
    padding-left: var(--container-padding-mobile);
  }
}

@media (max-width: 480px) {
  /* 移动端：进一步减小边距 */
  .responsive-container {
    padding-right: var(--container-padding-mobile-small);
    padding-left: var(--container-padding-mobile-small);
  }
}

/* 断点特定样式 */
.screen-desktop .hide-on-desktop {
  display: none !important;
}

.screen-tablet .hide-on-tablet {
  display: none !important;
}

.screen-mobile .hide-on-mobile {
  display: none !important;
}

.screen-desktop .show-on-mobile,
.screen-desktop .show-on-tablet {
  display: none !important;
}

.screen-tablet .show-on-mobile {
  display: none !important;
}

.screen-mobile .show-on-desktop,
.screen-mobile .show-on-tablet {
  display: none !important;
}

/* 网格系统辅助类 */
.grid-cols-1 {
  grid-template-columns: repeat(1, minmax(0, 1fr));
}

.grid-cols-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.grid-cols-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.grid-cols-4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.grid-cols-5 {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

/* 响应式网格列 */
@media (max-width: 767px) {
  .grid-cols-2,
  .grid-cols-3,
  .grid-cols-4,
  .grid-cols-5 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 768px) and (max-width: 1199px) {
  .grid-cols-4,
  .grid-cols-5 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1200px) {
  .grid-cols-5 {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

/* 间距辅助类 */
.gap-sm {
  gap: var(--spacing-sm);
}

.gap-md {
  gap: var(--spacing-md);
}

.gap-lg {
  gap: var(--spacing-lg);
}

.gap-xl {
  gap: var(--spacing-xl);
}

/* 响应式间距 */
@media (max-width: 767px) {
  .gap-lg,
  .gap-xl {
    gap: var(--spacing-md);
  }
}

/* 触控区域优化 */
@media (hover: none) and (pointer: coarse) {
  .touch-friendly {
    min-width: 48px;
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
}

/* 滚动行为优化 */
@media (max-width: 767px) {
  .no-scrollbar-mobile {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  
  .no-scrollbar-mobile::-webkit-scrollbar {
    display: none;
  }
}
</style>