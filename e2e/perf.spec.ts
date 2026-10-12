import { expect, test } from "@playwright/test"

test.skip(({ browserName }) => browserName !== "chromium", "requires stable WebGL map runtime for performance checks")

test("performance: page load under threshold", async ({ page }, testInfo) => {
  const started = Date.now()
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 40000 })
  await page.waitForTimeout(800)

  const dcl = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
    if (!nav) {
      return null
    }
    return nav.domContentLoadedEventEnd
  })

  const elapsed = Date.now() - started
  const strict = process.env.CI_STRICT_PERF === "1"

  if (typeof dcl === "number" && strict) {
    expect(dcl).toBeLessThanOrEqual(3000)
  } else {
    expect(elapsed).toBeLessThanOrEqual(20000)
  }

  testInfo.attach("page-load.json", {
    body: JSON.stringify({ dclMs: dcl, elapsedMs: elapsed, strict }, null, 2),
    contentType: "application/json"
  })
  process.stdout.write(`PERF page-load dclMs=${dcl} elapsedMs=${elapsed} strict=${strict}\n`)
})

test("readability: dataset repository drawer has visible text contrast", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("sidebar_collapsed", "0")
  })
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: "数据集仓库" }).click()
  const drawer = page.locator(".mars-dialog.ksh002-drawer", { hasText: "数据集仓库" })
  await expect(drawer).toBeVisible({ timeout: 20000 })

  const textColor = await drawer.evaluate((el) => getComputedStyle(el).color)
  expect(textColor).not.toBe("rgba(0, 0, 0, 0)")

  const search = drawer.locator('input[placeholder="搜索名称/描述"]')
  await expect(search).toBeVisible()
  const placeholderColor = await search.evaluate((el) => getComputedStyle(el).getPropertyValue("color"))
  expect(placeholderColor).not.toBe("rgba(0, 0, 0, 0)")
})

test("performance: my repository P0 flow under threshold", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.removeItem("ksh002_drawer_folded_my-repository")
    localStorage.setItem(
      "eoapi_manifests",
      JSON.stringify({
        local_perf_myrepo: {
          name: "性能测试-我的仓库",
          description: "用于测量列表/打开/回退性能",
          visibility: "private",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          manifest: {
            manifestVersion: "1.0",
            viewState: {
              center: { longitude: 101.5, latitude: 26.5 },
              zoom: 5,
              bbox: [97.5, 21.0, 105.5, 32.0]
            },
            layers: [
              {
                id: "layer_perf_1",
                name: "性能图层-1",
                sourceType: "xyz",
                sourceRef: "https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}",
                visible: true,
                opacity: 1,
                order: 0
              }
            ],
            drawFeatures: []
          }
        }
      })
    )
  })

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 40000 })

  const strict = process.env.CI_STRICT_PERF === "1"

  const t1 = Date.now()
  await page.getByRole("button", { name: "我的仓库" }).click()
  const drawer = page.locator(".mars-dialog.ksh002-drawer", { hasText: "我的仓库" })
  await expect(drawer).toBeVisible({ timeout: 20000 })
  await expect(drawer.locator(".dataset-card")).toHaveCount(1, { timeout: 20000 })
  const listMs = Date.now() - t1

  await drawer.locator(".dataset-card").first().click()
  await expect(drawer.getByRole("button", { name: "打开使用" })).toBeVisible({ timeout: 20000 })

  await drawer.getByRole("button", { name: "打开使用" }).click()
  const modal = page.locator(".ant-modal", { hasText: "打开使用" })
  await expect(modal).toBeVisible()

  const t2 = Date.now()
  await modal.getByRole("button", { name: "开始打开" }).click()
  await expect(drawer.getByRole("button", { name: "撤销本次打开" })).toBeVisible({ timeout: 20000 })
  const openMs = Date.now() - t2

  const t3 = Date.now()
  await drawer.getByText("返回列表").click()
  await expect(drawer.locator('input[placeholder="搜索名称/描述"]')).toBeVisible({ timeout: 20000 })
  const backMs = Date.now() - t3

  if (strict) {
    expect(listMs).toBeLessThanOrEqual(800)
    expect(openMs).toBeLessThanOrEqual(500)
    expect(backMs).toBeLessThanOrEqual(200)
  } else {
    expect(listMs).toBeLessThanOrEqual(20000)
    expect(openMs).toBeLessThanOrEqual(20000)
    expect(backMs).toBeLessThanOrEqual(20000)
  }

  testInfo.attach("my-repository-p0.json", {
    body: JSON.stringify({ listMs, openMs, backMs, strict }, null, 2),
    contentType: "application/json"
  })
  process.stdout.write(`PERF my-repository listMs=${listMs} openMs=${openMs} backMs=${backMs} strict=${strict}\n`)
})
