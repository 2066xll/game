import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // 图片优化配置
  ],
  // 路径解析
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@assets': resolve(__dirname, 'src/assets'),
      '@components': resolve(__dirname, 'src/components'),
      '@views': resolve(__dirname, 'src/views'),
      '@store': resolve(__dirname, 'src/store')
    }
  },
  // 开发服务器配置
  server: {
    port: 3000,
    open: true,
    host: true,
    // 优化开发服务器性能
    hmr: {
      overlay: true,
      clientPort: 3000
    },
    // 添加API代理配置，解决注册超时问题
    proxy: {
      '/api/auth': {
        // 开发环境中代理到本地的Cloudflare Worker模拟环境
        // 注意：实际部署时需要调整为真实的后端地址
        target: 'http://localhost:8787',
        changeOrigin: true
        // 移除rewrite规则，确保后端接收到完整的/api/auth路径
      }
    },
    // 优化服务器响应时间
    optimizeDeps: {
      include: ['vue', 'vue-router', 'pinia', 'vue-lazyload']
    }
  },
  // 依赖优化
  optimizeDeps: {
    // 预构建依赖
    include: ['vue', 'vue-router', 'pinia', 'vue-lazyload', 'axios'],
    exclude: ['vue-demi'],
    // 增加并发数，提高构建速度
    esbuildOptions: {
      // 设置target在esbuildOptions中
      target: ['es2020']
    }
  },
  // 静态资源处理
  assetsInclude: ['**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.svg', '**/*.webp', '**/*.ico'],
  // 构建配置
  build: {
    // 构建优化配置
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'esbuild', // 使用esbuild替代terser，esbuild速度更快
    esbuildOptions: {
      drop: ['console', 'debugger'],
      target: ['es2020'], // 正确设置target在esbuildOptions中
      // 增强压缩配置
      minifyIdentifiers: true,
      minifySyntax: true,
      minifyWhitespace: true
    },
    cacheDir: '.vite',
    cssCodeSplit: true,
    sourcemap: false,
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000, // 增大警告限制，减少不必要的检查
    // 优化资源预加载
    manifest: true,
    // 加快构建速度的配置
    ssr: false
  },
  // Rollup配置
  rollupOptions: {
    // 优化Rollup选项
    treeshake: true,
    output: {
      // 文件名命名规则 - 长缓存策略
      assetFileNames: 'assets/[name]-[hash:8][extname]',
      entryFileNames: 'assets/[name]-[hash:8].js',
      chunkFileNames: 'assets/chunk-[name]-[hash:8].js',
      // 优化chunks生成
      compact: true,
      hoistTransitiveImports: true,
      // 代码分割配置
      manualChunks: {
        // 将第三方库分割成单独的chunk
        vendor: ['vue', 'vue-router', 'pinia'],
        utils: ['axios', 'lodash-es'],
        // 将大型组件分割成单独的chunk
        'game-components': ['@/components/GameCard.vue'],
        // 将store分割成单独的chunk
        'game-store': ['@/store/gameStore.js']
      }
    }
  }
})