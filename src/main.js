import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueLazyload from 'vue-lazyload'
import './style.css'
import App from './App.vue'
import router from './router/index.js' // 导入路由实例

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
