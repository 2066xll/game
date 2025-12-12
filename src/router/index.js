import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import RegisterView from '../views/RegisterView.vue'
import LoginView from '../views/LoginView.vue'
import ProfileView from '../views/ProfileView.vue'
import EmailBindView from '../views/EmailBindView.vue'
import GroupManagementView from '../views/GroupManagementView.vue'
import ChatView from '../views/ChatView.vue'
import TestView from '../views/TestView.vue'
import ChatTestView from '../views/ChatTestView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { requiresAuth: true }
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterView,
    meta: { requiresGuest: true }
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { requiresGuest: true }
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileView,
    meta: { requiresAuth: true }
  },
  {
    path: '/groups',
    name: 'groups',
    component: GroupManagementView,
    meta: { requiresAuth: true }
  },
  {
    path: '/chat/:id',
    name: 'chat',
    component: ChatView,
    meta: { requiresAuth: true },
    props: true
  },
  {
    path: '/test',
    name: 'test',
    component: TestView
  },
  {
    path: '/chat-test',
    name: 'chat-test',
    component: ChatTestView
  },
  {
    path: '/profile/email-bind',
    name: 'email-bind',
    component: EmailBindView,
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// 全局路由守卫
router.beforeEach((to, from, next) => {
  // 从localStorage获取用户认证状态（临时解决方案，稍后会改为使用authStore）
  const isAuthenticated = localStorage.getItem('auth_token') !== null
  
  // 检查路由是否需要认证
  if (to.meta.requiresAuth && !isAuthenticated) {
    // 需要认证但未登录，重定向到登录页
    next({ name: 'login' })
  } 
  // 检查路由是否需要访客状态
  else if (to.meta.requiresGuest && isAuthenticated) {
    // 需要访客状态但已登录，重定向到首页
    next({ name: 'home' })
  } 
  // 正常访问
  else {
    next()
  }
})

export default router