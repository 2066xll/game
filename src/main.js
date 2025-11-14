import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import VueLazyload from 'vue-lazyload'
import './style.css'
import App from './App.vue'

// 创建路由实例
const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('./views/HomeView.vue')
  },
  {
    path: '/category/:type?/:platform?',
    name: 'Category',
    component: () => import('./views/CategoryView.vue')
  },
  {
    path: '/game/:name',
    name: 'GameDetail',
    component: () => import('./views/GameDetailView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 创建Pinia实例
const pinia = createPinia()

// 创建Vue应用实例
const app = createApp(App)

// 配置vue-lazyload
app.use(VueLazyload, {
  preLoad: 1.3,
  error: '/error-image.png',
  loading: '/loading-image.png',
  attempt: 1
})

// 使用插件
app.use(router)
app.use(pinia)

// 挂载应用
app.mount('#app')
