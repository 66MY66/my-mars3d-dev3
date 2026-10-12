import { expect, test } from "@playwright/test"

test("sidebar collapse persists", async ({ page }) => {
  await page.goto("/")
  const toggleHandle = page.locator(".sidebar .edge-handle")
  await expect(toggleHandle).toBeVisible()

  const before = await page.evaluate(() => localStorage.getItem("sidebar_collapsed"))
  await toggleHandle.click()
  const after = await page.evaluate(() => localStorage.getItem("sidebar_collapsed"))
  expect(after).not.toBe(before)

  await page.reload()
  const persisted = await page.evaluate(() => localStorage.getItem("sidebar_collapsed"))
  expect(persisted).toBe(after)
})

test("theme toggles from user menu", async ({ page }) => {
  await page.goto("/")
  const settings = page.locator(".settings-btn")
  await expect(settings).toBeVisible()
  await settings.click()
  await page.getByText("深色主题").click()
  await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark")

  await settings.click()
  await page.getByText("浅色主题").click()
  await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).toBe("light")
})

test("CUI iframe can switch theme", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("cui_dock_collapsed", "1")
  })
  await page.goto("/")
  await page.locator(".cui-fab").click()
  await expect(page.locator("iframe.cui-frame")).toBeVisible()
  const frame = page.frameLocator("iframe.cui-frame")
  await frame.getByRole("button", { name: "切换浅色" }).click()
  await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).toBe("light")
})

test("CUI iframe can toggle sidebar", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("cui_dock_collapsed", "1")
  })
  await page.goto("/")
  await page.locator(".cui-fab").click()
  await expect(page.locator("iframe.cui-frame")).toBeVisible()
  const before = await page.evaluate(() => localStorage.getItem("sidebar_collapsed"))
  const frame = page.frameLocator("iframe.cui-frame")
  await frame.getByRole("button", { name: "折叠侧栏" }).click()
  await expect.poll(async () => page.evaluate(() => localStorage.getItem("sidebar_collapsed"))).not.toBe(before)
})

test("widget.refresh failure path returns readable error", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("cui_dock_collapsed", "1")
  })
  await page.goto("/")
  await page.locator(".cui-fab").click()
  await expect(page.locator("iframe.cui-frame")).toBeVisible()
  const frame = page.frameLocator("iframe.cui-frame")
  await frame.locator("input.input").fill('widget.refresh {"id":"__not_exist__"}')
  await frame.getByRole("button", { name: "发送" }).click()
  await expect(frame.getByText(/widget\.refresh\s*->\s*fail/)).toBeVisible({ timeout: 10000 })
})

test("sidebar widgets dialogs do not drift after opening", async ({ page }) => {
  await page.goto("/")

  async function openDialog(title: string) {
    await page.getByRole("button", { name: title }).click()
    const dialog = page.locator(".mars-dialog").filter({
      has: page.locator(".mars-dialog__header .title", { hasText: title })
    })
    await expect(dialog).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1200)
    return dialog
  }

  async function expectStableRect(dialog: any) {
    const samples: Array<{ x: number; y: number; w: number; h: number }> = []
    for (let i = 0; i < 6; i++) {
      const rect = await dialog.evaluate((el: HTMLElement) => {
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, w: r.width, h: r.height }
      })
      samples.push(rect)
      await page.waitForTimeout(80)
    }
    const xs = samples.map((s) => s.x)
    const ys = samples.map((s) => s.y)
    const ws = samples.map((s) => s.w)
    const hs = samples.map((s) => s.h)
    const maxDelta = (arr: number[]) => Math.max(...arr) - Math.min(...arr)
    expect(maxDelta(xs)).toBeLessThanOrEqual(1)
    expect(maxDelta(ys)).toBeLessThanOrEqual(1)
    expect(maxDelta(ws)).toBeLessThanOrEqual(1)
    expect(maxDelta(hs)).toBeLessThanOrEqual(1)
  }

  for (const title of ["数据集仓库", "我的仓库"]) {
    const dialog = await openDialog(title)
    await expectStableRect(dialog)
    const closeBtn = dialog.locator("button.close-btn__flot")
    if (await closeBtn.count()) {
      await closeBtn.click()
      await expect(dialog).toBeHidden({ timeout: 10000 })
    } else {
      await page.getByRole("button", { name: title }).click()
      await expect(dialog).toBeHidden({ timeout: 10000 })
    }
  }
})
