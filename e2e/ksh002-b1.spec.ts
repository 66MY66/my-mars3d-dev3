import { expect, test } from "@playwright/test"

async function report(page: any, type: string, data?: Record<string, unknown>) {
  const payload = {
    t: Date.now(),
    sessionId: "ksh002-3x-highrisk",
    level: "info",
    type,
    message: type,
    data: data || {}
  }
  await page.request
    .post("http://127.0.0.1:17321/log", {
      headers: { "content-type": "text/plain" },
      data: JSON.stringify(payload)
    })
    .catch(() => {})
}

test("KSH-002 B1: 数据集仓库列表（收藏/最近使用/筛选/分页）", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.removeItem("ksh002_dataset_metrics_v1")
    localStorage.setItem("TRAE_DEBUG_SERVER_URL", "http://127.0.0.1:17321/log")
    localStorage.setItem("TRAE_DEBUG_SESSION_ID", "ksh002-3x-highrisk")
    const tinyPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
    localStorage.setItem(
      "eoapi_manifests",
      JSON.stringify({
        local_repo_b1_01: {
          name: "本地列表测试-01",
          description: "用于验证收藏/最近使用",
          visibility: "private",
          coverUrl: tinyPng,
          createdAt: Date.now() - 60_000,
          manifest: { manifestVersion: "1.0", viewState: { bbox: [0, 0, 0, 0] }, layers: [], drawFeatures: [] },
          revisions: [{ revisionId: "rev_1", message: "init", createdAt: Date.now() - 60_000 }]
        },
        local_repo_b1_02: {
          name: "本地列表测试-02",
          description: "用于验证分页/筛选",
          visibility: "private",
          coverUrl: tinyPng,
          createdAt: Date.now() - 120_000,
          manifest: { manifestVersion: "1.0", viewState: { bbox: [0, 0, 0, 0] }, layers: [], drawFeatures: [] },
          revisions: [{ revisionId: "rev_1", message: "init", createdAt: Date.now() - 120_000 }]
        }
      })
    )
  })

  await page.goto("/")
  await page.getByRole("button", { name: "数据集仓库" }).click()

  const drawer = page.locator(".mars-dialog.ksh002-drawer", { hasText: "数据集仓库" })
  await expect(drawer).toBeVisible({ timeout: 20000 })

  await expect(drawer.getByPlaceholder("搜索名称/描述")).toBeVisible()
  await expect(drawer.getByRole("button", { name: "我的收藏" })).toBeVisible()
  await expect(drawer.getByRole("button", { name: "最近使用" })).toBeVisible()

  const firstCard = drawer.locator(".dataset-card").first()
  await expect(firstCard).toBeVisible()
  await expect(firstCard.locator("img.cover-img")).toBeVisible({ timeout: 15000 })

  const favBtn = firstCard.locator(".fav-btn")
  const beforeIcon = await firstCard.locator(".fav-icon").innerText()
  await report(page, "ksh002-b1.favorite.before", {
    icon: beforeIcon,
    metrics: await page.evaluate(() => localStorage.getItem("ksh002_dataset_metrics_v1") || "")
  })
  await favBtn.click()
  const expectedIcon = beforeIcon.includes("★") ? "☆" : "★"
  await report(page, "ksh002-b1.favorite.after-click", {
    icon: await firstCard.locator(".fav-icon").innerText().catch(() => ""),
    metrics: await page.evaluate(() => localStorage.getItem("ksh002_dataset_metrics_v1") || "")
  })
  await page.waitForTimeout(800)
  await report(page, "ksh002-b1.favorite.after-800ms", {
    icon: await firstCard.locator(".fav-icon").innerText().catch(() => ""),
    metrics: await page.evaluate(() => localStorage.getItem("ksh002_dataset_metrics_v1") || "")
  })
  await expect(firstCard.locator(".fav-icon")).toContainText(expectedIcon)

  await drawer.getByRole("button", { name: "我的收藏" }).click()
  await expect(drawer.locator(".dataset-card")).toHaveCount(1, { timeout: 10000 })

  await drawer.getByRole("button", { name: "全部" }).click()
  await firstCard.click()
  await expect(drawer.getByText("返回列表")).toBeVisible({ timeout: 20000 })
  await drawer.getByText("返回列表").click()

  await drawer.getByRole("button", { name: "最近使用" }).click()
  await expect(drawer.locator(".dataset-card")).toHaveCount(1, { timeout: 20000 })
})
