import { defineConfig } from "@playwright/test"

process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS || "1"
process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE = process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE || "ubuntu24.04-x64"
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || "/program/Mars3D/.pw-browsers"

const baseURL = process.env.PW_BASE_URL || "http://localhost:5280/mars3d"

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  use: {
    baseURL,
    viewport: { width: 1366, height: 768 }
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    {
      name: "firefox",
      use: {
        browserName: "firefox",
        launchOptions: {
          firefoxUserPrefs: {
            "webgl.disabled": false,
            "webgl.force-enabled": true,
            "layers.acceleration.force-enabled": true,
            "gfx.webrender.all": true
          },
          env: {
            PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS: "1",
            MOZ_DISABLE_CONTENT_SANDBOX: "1",
            MOZ_DISABLE_GMP_SANDBOX: "1",
            MOZ_DISABLE_RDD_SANDBOX: "1",
            MOZ_DISABLE_GPU_SANDBOX: "1"
          }
        }
      }
    },
    {
      name: "webkit",
      use: {
        browserName: "webkit",
        launchOptions: {
          env: {
            PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS: "1"
          }
        }
      }
    }
  ],
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: "vite --port 5280",
        url: "http://localhost:5280/mars3d/",
        reuseExistingServer: true,
        timeout: 120_000
      }
})
