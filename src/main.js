import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import VueLazyload from 'vue-lazyload'
import { useAuthStore } from './store/authStore.js'
import { useChatStore } from './store/chatStore.js'
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
    path: '/favorites',
    name: 'Favorites',
    component: () => import('./views/FavoritesView.vue')
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
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('./views/LoginView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('./views/RegisterView.vue'),
    meta: { requiresAuth: false }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫 - 延迟到pinia初始化后设置
let setupRouterGuard = false

function setupGuard() {
  if (setupRouterGuard) return
  
  // 初始化store实例
  const authStore = useAuthStore()
  const chatStore = useChatStore()
  
  router.beforeEach((to, from, next) => {
    // 检查路由是否需要认证
    if (to.meta.requiresAuth === true && !authStore.isAuthenticated) {
      // 需要认证但未登录，跳转到登录页
      next({ name: 'Login', query: { redirect: to.fullPath } })
    } else if ((to.name === 'Login' || to.name === 'Register') && authStore.isAuthenticated) {
      // 已登录用户不能访问登录和注册页
      next({ name: 'Home' })
    } else {
      // 其他情况正常通过
      next()
    }
  })
  
  setupRouterGuard = true
}

// 创建Pinia实例
const pinia = createPinia()

// 创建Vue应用实例
const app = createApp(App)

// 配置vue-lazyload
app.use(VueLazyload, {
  preLoad: 1.3,
  attempt: 1
})

// 使用插件
app.use(router)
app.use(pinia)

// 挂载应用
app.mount('#app')

// 挂载应用后设置路由守卫
setupGuard()
