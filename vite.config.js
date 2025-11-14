import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import viteImagemin from 'vite-plugin-imagemin'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // 图片优化
    viteImagemin({
      gifsicle: {
        optimizationLevel: 7,
        interlaced: false,
      },
      optipng: {
        optimizationLevel: 7,
      },
      mozjpeg: {
        quality: 80,
      },
      pngquant: {
        quality: [0.8, 0.9],
        speed: 4,
      },
      svgo: {
        plugins: [
          {
            name: 'removeViewBox',
          },
          {
            name: 'removeEmptyAttrs',
            active: false,
          },
        ],
      },
    }),
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
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    cacheDir: '.vite',
    cssCodeSplit: true,
    sourcemap: false,
    emptyOutDir: true,
    rollupOptions: {
      // 代码分割配置
      manualChunks: {
        // 拆分vue和vue-router等核心库
        'vue-vendor': ['vue', 'vue-router'],
        'utils': ['lodash', 'axios'],
        'store': ['pinia']
      },
      output: {
        // 静态资源文件命名规则
        assetFileNames: 'assets/[hash][extname]',
        // 入口文件名命名规则
        entryFileNames: 'assets/[name].[hash].js',
        // 非入口文件名命名规则
        chunkFileNames: 'assets/chunk-[hash].js'
      }
    }
  }
})
