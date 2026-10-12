import { expect, test } from "@playwright/test"

test("dataset repository backs off management api after favorites 500", async ({ page }) => {
  let favoritesHits = 0
  let metricsHits = 0

  await page.route("**/api/eoapi/favorites", async (route) => {
    favoritesHits += 1
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ detail: "management api unavailable" })
    })
  })

  await page.route("**/api/eoapi/metrics/**", async (route) => {
    metricsHits += 1
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([])
    })
  })

  await page.goto("/")
  await page.getByText("数据集仓库", { exact: false }).first().click()

  const drawer = page.locator(".mars-dialog.ksh002-drawer", { hasText: "数据集仓库" })
  await expect(drawer).toBeVisible({ timeout: 20_000 })
  await expect(drawer.locator(".dataset-card").first()).toBeVisible({ timeout: 20_000 })

  await page.waitForTimeout(3_000)

  expect(favoritesHits).toBe(1)
  expect(metricsHits).toBe(0)
})
