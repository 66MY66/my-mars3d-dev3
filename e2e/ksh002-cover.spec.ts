import { expect, test } from "@playwright/test"

test.skip(({ browserName }) => browserName !== "chromium", "requires map render/screenshot for cover generation")

test("cover: auto generates from map when not set", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.removeItem("eoapi_manifests")
    localStorage.removeItem("ksh002_cover_cache_v1")
  })

  await page.route("**/datasets", async (route) => {
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "not found" }) })
  })
  await page.route("**/datasets/**/revisions", async (route) => {
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "not found" }) })
  })

  await page.goto("/", { waitUntil: "domcontentloaded" })

  await page.getByRole("button", { name: "保存成果" }).click()
  const modal = page.locator(".ant-modal", { hasText: /保存成果|提交发布/ })
  const saveDrawer = page.locator(".mars-dialog.ksh002-drawer", { hasText: "保存成果" })
  const appeared = await Promise.race([
    modal.waitFor({ state: "visible", timeout: 20000 }).then(() => "modal" as const).catch(() => "none" as const),
    saveDrawer.waitFor({ state: "visible", timeout: 20000 }).then(() => "drawer" as const).catch(() => "none" as const)
  ])
  if (appeared === "drawer" && !(await modal.isVisible())) {
    await saveDrawer.getByRole("button", { name: "打开保存弹窗" }).click()
  }
  await expect(modal).toBeVisible({ timeout: 20000 })

  const nameInput = modal.locator("input").first()
  await nameInput.fill("封面自动生成测试")
  await modal.getByRole("button", { name: "保存成果" }).click()
  await expect(modal.getByText("保存前预览")).toBeVisible({ timeout: 20000 })
  await modal.getByRole("button", { name: "确认保存成果" }).click()

  await expect(modal).toBeHidden({ timeout: 20000 })

  await page.getByRole("button", { name: "数据集仓库" }).click()
  const repoDrawer = page.locator(".mars-dialog.ksh002-drawer", { hasText: "数据集仓库" })
  await expect(repoDrawer).toBeVisible({ timeout: 20000 })

  await repoDrawer.getByPlaceholder("搜索名称/描述").fill("封面自动生成测试")
  await repoDrawer.getByPlaceholder("搜索名称/描述").press("Enter")

  const card = repoDrawer.locator(".dataset-card", { hasText: "封面自动生成测试" }).first()
  await expect(card).toBeVisible({ timeout: 20000 })
  await expect(card.locator("img.cover-img")).toBeVisible()
})
