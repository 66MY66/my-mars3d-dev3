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

test.skip(({ browserName }) => browserName !== "chromium", "requires Cesium/WebGL map runtime and layer manager integration")

test("P0: 我的仓库（列表+打开使用+回退）", async ({ page }) => {
  test.setTimeout(180_000)
  await page.addInitScript(() => {
    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.removeItem("ksh002_drawer_folded_my-repository")
    localStorage.removeItem("ksh002_dataset_metrics_v1")
    localStorage.setItem("TRAE_DEBUG_SERVER_URL", "http://127.0.0.1:17321/log")
    localStorage.setItem("TRAE_DEBUG_SESSION_ID", "ksh002-3x-highrisk")

    const manifests: Record<string, any> = {}
    for (let i = 1; i <= 21; i++) {
      const id = `local_myrepo_${String(i).padStart(2, "0")}`
      manifests[id] = {
        name: `我的仓库-${String(i).padStart(2, "0")}`,
        description: i === 1 ? "用于验证P0主链路" : `描述-${i}`,
        visibility: "private",
        createdAt: Date.now() - i * 60_000,
        updatedAt: Date.now() - i * 30_000,
        manifest: {
          manifestVersion: "1.0",
          viewState: {
            center: { longitude: 101.5, latitude: 26.5 },
            zoom: 5,
            bbox: [97.5, 21.0, 105.5, 32.0]
          },
          layers: [
            {
              id: `layer_${i}`,
              name: `测试图层-${i}`,
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
    }

    localStorage.setItem("eoapi_manifests", JSON.stringify(manifests))
  })

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 40000 })
  await page.getByRole("button", { name: "我的仓库" }).click()
  await report(page, "my-repo.opened", {
    eoapi_manifests_keys: await page.evaluate(() => {
      try {
        return Object.keys(JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")).length
      } catch {
        return -1
      }
    })
  })

  const storeState = await page.evaluate(() => {
    const app: any = (document.querySelector("#app") as any)?.__vue_app__
    const store: any = app?._context?.config?.globalProperties?.$store
    const openAtStart = store?.state?.openAtStart || []
    const widgets = Array.isArray(store?.state?.widgets) ? store.state.widgets : []
    const myRepo = widgets.find((w: any) => w.name === "my-repository")
    return { openAtStart, myRepoVisible: !!myRepo?.visible }
  })

  expect(storeState.openAtStart).toContain("my-repository")
  expect(storeState.myRepoVisible).toBe(true)

  const drawer = page.locator(".mars-dialog.ksh002-drawer", { hasText: "我的仓库" })
  await drawer.waitFor({ state: "visible", timeout: 40000 })

  const search = drawer.locator('input[placeholder="搜索名称/描述"]')
  await expect(search).toBeVisible()

  await search.fill("我的仓库-")
  await expect(drawer.locator(".dataset-card")).toHaveCount(20, { timeout: 20000 })

  await drawer.locator(".ant-pagination-item-2").click()
  await report(page, "my-repo.after-page2-click", {
    currentPageText: await drawer.locator(".ant-pagination-item-active").innerText().catch(() => ""),
    cardCount: await drawer.locator(".dataset-card").count()
  })
  await expect(drawer.locator(".dataset-card")).toHaveCount(1, { timeout: 20000 })

  await drawer.locator(".ant-pagination-item-1").click()
  await search.fill("我的仓库-01")
  await expect(drawer.locator(".dataset-card")).toHaveCount(1, { timeout: 20000 })

  await drawer.locator(".dataset-card", { hasText: "我的仓库-01" }).first().click()
  await expect(drawer.getByText("返回列表")).toBeVisible({ timeout: 20000 })
  await expect(drawer.getByRole("button", { name: "打开使用" })).toBeVisible()

  await drawer.getByRole("button", { name: "打开使用" }).click()
  const modal = page.getByRole("dialog", { name: "打开使用" })
  await expect(modal).toBeVisible({ timeout: 20000 })
  await modal.getByRole("button", { name: "开始打开" }).click()

  await report(page, "my-repo.after-open-click", {
    drawerVisible: await drawer.isVisible().catch(() => false),
    undoBtnCount: await drawer.getByRole("button", { name: "撤销本次打开" }).count().catch(() => -1),
    layerDialogVisible: await page.locator(".mars-dialog.manage-layer_pannel").isVisible().catch(() => false)
  })

  const layerDialog = page.locator(".mars-dialog.manage-layer_pannel")
  await layerDialog.waitFor({ state: "visible", timeout: 20000 })

  await page.getByRole("button", { name: "我的仓库" }).click()
  await drawer.waitFor({ state: "visible", timeout: 20000 })
  const undoBtn = drawer.getByRole("button", { name: "撤销本次打开" })
  await expect(undoBtn).toBeVisible({ timeout: 20000 })

  const selectedNodes = layerDialog.locator(".ant-tree-treenode-selected", { hasText: "我的仓库/我的仓库-01" })
  await expect(selectedNodes).toHaveCount(1, { timeout: 20000 })

  const layerSearch = layerDialog.locator('input[placeholder="搜索图层"]')
  await layerSearch.fill("我的仓库-01")
  const focusNode = layerDialog.getByText("我的仓库/我的仓库-01").first()
  await expect(focusNode).toBeVisible({ timeout: 20000 })
  await focusNode.click({ button: "right" })
  await page.getByRole("menuitem", { name: "重命名" }).click()
  const renameModal = page.getByRole("dialog", { name: "重命名" })
  await expect(renameModal).toBeVisible({ timeout: 20000 })
  await renameModal.locator("input").fill("我的仓库/我的仓库-01-重命名")
  await renameModal.getByRole("button", { name: /确\\s*定/ }).click({ force: true })
  await expect(layerDialog.locator(".ant-tree-title", { hasText: "我的仓库/我的仓库-01-重命名" })).toBeVisible({ timeout: 20000 })

  await layerSearch.fill("测试图层-1")
  const layerNode = layerDialog.getByText("测试图层-1", { exact: true }).first()
  await layerNode.click({ button: "right", force: true })
  const moveItem = page.getByRole("menuitem", { name: "移动" }).first()
  await expect(moveItem).toBeVisible({ timeout: 20000 })
  await moveItem.click()
  const moveModal = page.getByRole("dialog", { name: "移动" })
  await expect(moveModal).toBeVisible({ timeout: 20000 })
  await moveModal.getByRole("button", { name: /确\\s*定/ }).click({ force: true })
  await expect(layerDialog.locator(".ant-tree-title", { hasText: "测试图层-1" })).toHaveCount(1, { timeout: 20000 })

  await layerNode.click({ button: "right", force: true })
  const delItem = page.getByRole("menuitem", { name: "删除" }).first()
  await expect(delItem).toBeVisible({ timeout: 20000 })
  await delItem.click()
  const delModal = page.getByRole("dialog", { name: "删除" })
  await expect(delModal).toBeVisible({ timeout: 20000 })
  await delModal.getByRole("button", { name: /确\\s*定/ }).click({ force: true })
  await expect(layerDialog.locator(".ant-tree-title", { hasText: "测试图层-1" })).toHaveCount(0, { timeout: 20000 })

  await undoBtn.click()
  await expect(undoBtn).toBeHidden({ timeout: 20000 })

  await drawer.getByText("返回列表").click()
  await expect(search).toHaveValue("我的仓库-01")
  await expect(drawer.locator(".dataset-card")).toHaveCount(1, { timeout: 20000 })

  await search.evaluate((el: any) => {
    el.value = ""
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  })
  await expect(drawer.locator(".dataset-card")).toHaveCount(20, { timeout: 20000 })

  const idLoc = drawer.locator(".dataset-card .meta .row").filter({ hasText: "ID" }).locator(".v")
  const id1 = (await idLoc.nth(0).innerText()).trim()
  const id2 = (await idLoc.nth(1).innerText()).trim()

  await page.evaluate(({ id1, id2 }) => {
    const now = Date.now()
    const map: Record<string, any> = {}
    map[id1] = { datasetId: id1, favorite: false, browseCount: 1, importCount: 1, lastUsedAt: now - 1 }
    map[id2] = { datasetId: id2, favorite: false, browseCount: 80, importCount: 0, lastUsedAt: now }
    localStorage.setItem("ksh002_dataset_metrics_v1", JSON.stringify(map))
    window.dispatchEvent(new CustomEvent("datasetMetricsChange"))
  }, { id1, id2 })

  const sortSelect = drawer.locator(".panel-controls .select").nth(1)
  await sortSelect.click()
  await page.getByText("使用热度倒序", { exact: true }).click()

  await expect.poll(async () => (await idLoc.nth(0).innerText()).trim()).toBe(id2)

  await drawer.locator(".dataset-card").first().click({ force: true })
  await expect(drawer.getByRole("button", { name: "设置封面" })).toBeVisible({ timeout: 20000 })
  await drawer.getByRole("button", { name: "设置封面" }).dispatchEvent("click")
  const coverModal = page.getByRole("dialog", { name: "设置封面" })
  await expect(coverModal).toBeVisible({ timeout: 20000 })
  await coverModal.getByRole("radio", { name: "上传图片" }).check({ force: true })
  await coverModal.locator('input[type="file"]').setInputFiles("/program/Mars3D/mars3d/public/img/favicon/favicon.png")
  await coverModal.getByRole("button", { name: /确\\s*定/ }).click({ force: true })
  await expect(drawer.locator(".detail-cover img.cover-img")).toBeVisible({ timeout: 20000 })
})
