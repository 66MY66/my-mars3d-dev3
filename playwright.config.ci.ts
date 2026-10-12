import { defineConfig } from "@playwright/test"

process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "1"

const baseURL = process.env.PW_BASE_URL || "http://localhost:3100/mars3d"

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  use: {
    baseURL,
    viewport: { width: 1366, height: 768 },
    video: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        channel: "chrome"  // 使用系统安装的 Chrome
      }
    }
  ],
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --port 3100",
        url: "http://localhost:3100/mars3d/",
        reuseExistingServer: true,
        timeout: 180_000
      }
})
