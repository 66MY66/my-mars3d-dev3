import { defineConfig } from "vitest/config"
import path from "path"
import vue from "@vitejs/plugin-vue"

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: "@/core/commandBus", replacement: path.resolve(__dirname, "src/cui-bridge/commandBus.ts") },
      { find: "@mars", replacement: path.resolve(__dirname, "src") },
      { find: "@", replacement: path.resolve(__dirname, "src") }
    ]
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    exclude: ["e2e/**", "src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      all: false,
      include: ["src/shell/**/*.ts", "src/cui-bridge/**/*.ts"],
      exclude: ["src/**/*.d.ts"]
    }
  }
})
