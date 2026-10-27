import path from "path"
import type { ConfigEnv } from "vite"
import { defineConfig, loadEnv } from "vite" // 帮手函数，这样不用 jsdoc 注解也可以获取类型提示
import vue from "@vitejs/plugin-vue"
import eslintPlugin from "vite-plugin-eslint"
import { mars3dPlugin } from "vite-plugin-mars3d"
import { VitePWA } from "vite-plugin-pwa"

import { createStyleImportPlugin, AndDesignVueResolve } from "vite-plugin-style-import"

export default ({ mode }: ConfigEnv) => {
  const root = process.cwd()
  // 获取 .env 文件里定义的环境变量
  const ENV = loadEnv(mode, root)

  console.log(`当前环境信息：`, mode)
  console.log(`ENV：`, ENV)

  const hmrHost = ENV.VITE_HMR_HOST || ENV.VITE_DEV_HOST || ""
  const hmrClientPort = ENV.VITE_HMR_CLIENT_PORT ? Number(ENV.VITE_HMR_CLIENT_PORT) : undefined
  const hmrPort = ENV.VITE_HMR_PORT ? Number(ENV.VITE_HMR_PORT) : undefined
  const hmrProtocol = ENV.VITE_HMR_PROTOCOL || ""

  const cliPort = (() => {
    const argv = process.argv || []
    const idx = argv.findIndex((a) => a === "--port" || a === "-p")
    if (idx !== -1) {
      const v = Number(argv[idx + 1])
      return Number.isFinite(v) ? v : undefined
    }
    const arg = argv.find((a) => a.startsWith("--port="))
    if (arg) {
      const v = Number(arg.split("=").slice(1).join("="))
      return Number.isFinite(v) ? v : undefined
    }
    return undefined
  })()
  const useCliHmr = typeof cliPort === "number" && cliPort > 0

  return defineConfig({
    base: ENV.VITE_BASE_URL,
    cacheDir: path.join("node_modules", `.vite-${mode}-${cliPort || 5280}`),
    server: {
      host: "0.0.0.0",
      port: cliPort || 5280,
      strictPort: true,
      hmr: {
        host: useCliHmr ? undefined : hmrHost || undefined,
        clientPort: useCliHmr ? cliPort : hmrClientPort,
        port: useCliHmr ? undefined : hmrPort,
        protocol: (hmrProtocol as "ws" | "wss") || undefined
      },
      proxy: {
        // datasets-api 代理 - 数据集/成果管理、附件、发布审核（优先匹配，必须在 eoapi 之前）
        "/api/eoapi/datasets": {
          target: "http://192.168.10.15:5960",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/eoapi/, "")
        },
        "/api/eoapi/artifacts": {
          target: "http://192.168.10.15:5960",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/eoapi/, "")
        },
        "/api/eoapi/uploads": {
          target: "http://192.168.10.15:5960",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/eoapi/, "")
        },
        "/api/eoapi/favorites": {
          target: "http://192.168.10.15:5960",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/eoapi/, "")
        },
        "/api/eoapi/metrics": {
          target: "http://192.168.10.15:5960",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/eoapi/, "")
        },
        "/api/eoapi/imports": {
          target: "http://192.168.10.15:5960",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/eoapi/, "")
        },
        // eoAPI STAC API 代理配置 - 指向 STAC API 端口
        "/api/eoapi": {
          target: "http://192.168.10.15:5951",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/eoapi/, "")
        },
        // TiTiler 代理配置 - 用于加载 STAC 影像 tiles
        "/api/titiler": {
          target: "http://192.168.10.15:5952",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/titiler/, "")
        },
        "/api/titiler-cog": {
          target: "http://192.168.10.15:5955",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/titiler-cog/, "")
        }
      }
    },
    define: {
      "process.env": {
        mode,
        BASE_URL: ENV.VITE_BASE_URL,
        API_BASE: ENV.VITE_API_URL,
        API_LOCAL: ENV.VITE_LOCAL_API
      },
      buildTime: new Date()
    },
    resolve: {
      alias: {
        "@/core/commandBus": path.join(__dirname, "src/cui-bridge/commandBus.ts"),
        "@": path.join(__dirname, "src"),
        "@mars": path.join(__dirname, "src")
      },
      extensions: [".js", ".ts", ".jsx", ".tsx", ".json"]
    },
    optimizeDeps: {
      include: ["kml-geojson"]
    },
    json: {
      // 支持从 .json 文件中进行按名导入
      namedExports: true,
      stringify: false
    },
    css: {
      preprocessorOptions: {
        less: {
          javascriptEnabled: true,
          additionalData: `@import "${path.resolve(__dirname, "src/components/mars-ui/base.less")}";`
        }
      }
    },
    build: {
      // 输出路径
      outDir: path.join("./dist", ENV.VITE_BASE_URL),
      // 小于此阈值的导入或引用资源将内联为 base64 编码， 以避免额外的http请求， 设置为 0, 可以完全禁用此项，
      assetsInlineLimit: 4096,
      // 启动 / 禁用 CSS 代码拆分
      cssCodeSplit: true,
      chunkSizeWarningLimit: 20000,
      // 构建后是否生成 soutrce map 文件
      sourcemap: false,
      // 自定义rollup-commonjs插件选项
      commonjsOptions: {
        include: /node_modules|packages/
      },
      // 静态资源目录
      assetsDir: "assets",
      // 自定义底层的 Rollup 打包配置
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning && warning.code === "CHUNK_SIZE_LIMIT") {
            return
          }
          warn(warning)
        },
        input: {
          index: path.resolve(__dirname, "index.html"),
        },
        output: {
          manualChunks: (id) => {
            if (!id || !id.includes("node_modules")) {
              const normalizedLocalId = id?.replaceAll("\\\\", "/") || ""
              if (normalizedLocalId.includes("/src/cui-bridge/CuiChatPage.vue")) {
                return "cui-chat.bundle"
              }
              return
            }
            const normalizedId = id.replaceAll("\\\\", "/")
            if (normalizedId.includes("/node_modules/mars3d-cesium/")) {
              const afterPkg = normalizedId.split("/node_modules/mars3d-cesium/")[1] || ""
              if (afterPkg.includes("Source/")) {
                const dir = afterPkg.split("Source/")[1]?.split("/")?.[0]
                if (dir) {
                  return `mars3d-cesium-${dir.toLowerCase()}`
                }
              }
              if (afterPkg.includes("Build/")) {
                const dir = afterPkg.split("Build/")[1]?.split("/")?.[0]
                if (dir) {
                  return `mars3d-cesium-${dir.toLowerCase()}`
                }
              }
              return "mars3d-cesium"
            }
            if (normalizedId.includes("/node_modules/mars3d/")) {
              return "mars3d"
            }
            if (normalizedId.includes("/node_modules/ant-design-vue/")) {
              return "antdv"
            }
            const afterLastNodeModules = normalizedId.split("/node_modules/").pop() || ""
            if (!afterLastNodeModules) {
              return "vendor"
            }
            const segments = afterLastNodeModules.split("/")
            let pkgName = segments[0]
            if (pkgName && pkgName.startsWith("@") && segments.length > 1) {
              pkgName = `${pkgName}/${segments[1]}`
            }
            if (!pkgName) {
              return "vendor"
            }
            return `vendor-${pkgName.replaceAll("@", "").replace("/", "-")}`
          },
          chunkFileNames: (chunkInfo) => {
            if (chunkInfo.name === "cui-chat.bundle") {
              return "assets/js/cui-chat.bundle.js"
            }
            return "assets/js/[name]-[hash].js"
          },
          entryFileNames: "assets/js/[name]-[hash].js",
          assetFileNames: "assets/[ext]/[name]-[hash].[ext]"
        }
      },
      // 当设置为 true, 构建后将会生成 manifest.json 文件
      manifest: false,
      // 设置为 false 可以禁用最小化混淆,或是用来指定是应用哪种混淆器 boolean | 'terser' | 'esbuild'
      minify: "terser",
      // 传递给 Terser 的更多 minify 选项
      terserOptions: {
        compress: {
          drop_console: false, // 在生产环境移除console.log
          drop_debugger: true // 在生产环境移除debugger
        }
      },
      // 设置为false 来禁用将构建好的文件写入磁盘
      write: true,
      // 默认情况下 若 outDir 在 root 目录下， 则 Vite 会在构建时清空该目录。
      emptyOutDir: true
    },
    plugins: [
      vue(),
      eslintPlugin(),
      mars3dPlugin({ useStatic: mode === "production" }) as any,
      createStyleImportPlugin({
        resolves: [AndDesignVueResolve()],
        libs: [
          {
            libraryName: "ant-design-vue",
            esModule: true,
            resolveStyle: (name) => {
              if (name === "auto-complete") {
                return `ant-design-vue/es/${name}/index`
              }
              return `ant-design-vue/es/${name}/style/index`
            }
          }
        ]
      }),
      // VitePWA 插件配置 - Service Worker 静态资源缓存
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "logo.svg", "logo.png"],
        manifest: {
          name: "地震灾害损失评估系统",
          short_name: "Mars3D",
          description: "基于 Mars3D 平台的三维 GIS 地震灾害评估系统",
          theme_color: "#1890ff",
          background_color: "#ffffff",
          display: "standalone",
          scope: "/",
          start_url: "/",
          icons: [
            {
              src: "logo.png",
              sizes: "192x192",
              type: "image/png"
            },
            {
              src: "logo.png",
              sizes: "512x512",
              type: "image/png"
            }
          ]
        },
        workbox: {
          // 预缓存配置
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,json}"],
          // 最大文件大小限制 (15MB)
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
          // 运行时缓存策略
          runtimeCaching: [
            // Mars3D 资源 - CacheFirst
            {
              urlPattern: /data\.mars3d\.cn/,
              handler: "CacheFirst",
              options: {
                cacheName: "mars3d-resources",
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 30 * 24 * 60 * 60
                }
              }
            },
            // 地形数据 - CacheFirst
            {
              urlPattern: /\.(terrain|quantized-mesh)/i,
              handler: "CacheFirst",
              options: {
                cacheName: "terrain-data",
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 30 * 24 * 60 * 60
                }
              }
            },
            // 高德瓦片 - StaleWhileRevalidate
            {
              urlPattern: /(webst0[1-4]|webst0[1-4])\.is\.autonavi\.com/,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "gaode-tiles",
                expiration: {
                  maxEntries: 1000,
                  maxAgeSeconds: 24 * 60 * 60
                }
              }
            },
            // 天地图瓦片 - StaleWhileRevalidate
            {
              urlPattern: /t[0-7]\.tianditu\.gov\.cn/,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "tianditu-tiles",
                expiration: {
                  maxEntries: 1000,
                  maxAgeSeconds: 24 * 60 * 60
                }
              }
            },
            // 字体文件 - CacheFirst
            {
              urlPattern: /\.(woff2?|ttf|eot)$/i,
              handler: "CacheFirst",
              options: {
                cacheName: "fonts-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 365 * 24 * 60 * 60
                }
              }
            },
            // 图片资源 - CacheFirst
            {
              urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/i,
              handler: "CacheFirst",
              options: {
                cacheName: "images-cache",
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 30 * 24 * 60 * 60
                }
              }
            }
          ],
          // 清理旧缓存
          cleanupOutdatedCaches: true,
          // 跳过等待
          skipWaiting: true
        },
        // 开发环境禁用
        devOptions: {
          enabled: false
        }
      })
    ]
  })
}
