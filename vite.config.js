import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // 图片优化插件已移除，以解决安全漏洞问题
  ],
  // 路径解析
  resolve: {
    alias: {
      '@': '/src',
      '@assets': '/src/assets',
      '@components': '/src/components',
      '@views': '/src/views',
      '@store': '/src/store',
      '@utils': '/src/utils'
    }
  },
  // 服务器配置
  server: {
    port: 3000,
    open: true,
    cors: true
  },
  // 依赖优化
  optimizeDeps: {
    include: ['vue', 'vue-router', 'pinia', 'lodash-es', 'axios'],
    exclude: []
  },
  // 构建配置
  build: {
    // 构建优化配置
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'esbuild', // 使用esbuild替代terser，esbuild速度更快
    esbuildOptions: {
      drop: ['console', 'debugger'],
      target: ['es2020'] // 正确设置target在esbuildOptions中
    },
    cacheDir: '.vite',
    cssCodeSplit: true,
    sourcemap: false,
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000, // 增大警告限制，减少不必要的检查
    // 加快构建速度的配置
    ssr: false,
    rollupOptions: {
      // 移除manualChunks配置，使用默认的代码分割行为
      // 优化Rollup选项，减少不必要的检查
      treeshake: true,
      output: {
        // 简化文件名命名规则，减少计算复杂度
        assetFileNames: 'assets/[name]-[hash][extname]',
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/chunk-[name].[hash].js',
        // 优化chunks生成
        compact: true,
        hoistTransitiveImports: true
      }
    }
  }
})
