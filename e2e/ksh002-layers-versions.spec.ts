import { expect, test } from "@playwright/test"

const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+KxUAAAAASUVORK5CYII="
const tinyPngBuffer = Buffer.from(tinyPngBase64, "base64")

test("KSH-002: 数据集仓库-图层与版本（本地数据集）", async ({ page }) => {
  test.setTimeout(180_000)

  await page.addInitScript(() => {
    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.removeItem("ksh002_drawer_folded_dataset-repository")
    localStorage.removeItem("ksh002_drawer_folded_my-repository")
    localStorage.removeItem("ksh002_drawer_folded_save-result")
    localStorage.removeItem("ksh002_drawer_folded_current-task")

    const datasetId = "local_e2e_ds_01"
    const rev1 = "rev_1"
    const manifest1 = {
      manifestVersion: "1.0",
      viewState: {
        bbox: [97.5, 21.0, 105.5, 32.0]
      },
      layers: [
        {
          id: "g_root",
          name: "目录",
          sourceType: "group",
          sourceRef: "",
          visible: true,
          opacity: 1,
          order: 0
        },
        {
          id: "l_osm",
          name: "OSM",
          sourceType: "xyz",
          sourceRef: "https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}",
          pid: "g_root",
          visible: true,
          opacity: 1,
          order: 1
        }
      ],
      drawFeatures: []
    }

    localStorage.setItem(
      "eoapi_manifests",
      JSON.stringify({
        [datasetId]: {
          name: "本地验收数据集",
          description: "用于验证图层与版本",
          visibility: "private",
          manifest: manifest1,
          revisionManifests: { [rev1]: manifest1 },
          revisions: [{ revisionId: rev1, message: "初始版本", createdAt: Date.now() - 10_000 }],
          createdAt: Date.now() - 20_000
        }
      })
    )
  })

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 40_000 })

  await page.getByRole("button", { name: "数据集仓库" }).click({ force: true })
  const repoDrawer = page.locator(".mars-dialog.ksh002-drawer", { hasText: "数据集仓库" })
  await expect(repoDrawer).toBeVisible({ timeout: 60_000 })

  const repoSearch = repoDrawer.getByPlaceholder("搜索名称/描述")
  if (await repoSearch.isVisible().catch(() => false)) {
    await repoSearch.fill("本地验收数据集")
    await repoSearch.press("Enter").catch(() => {})
  }

  const card = repoDrawer.locator(".dataset-card", { hasText: "本地验收数据集" }).first()
  await expect(card).toBeVisible({ timeout: 40_000 })
  await card.scrollIntoViewIfNeeded()
  await card.click()

  const importBtn = repoDrawer.getByRole("button", { name: "导入使用" })
  await expect(importBtn).toBeEnabled({ timeout: 20_000 })
  await importBtn.click()
  const importModal = page.getByRole("dialog", { name: "导入使用" })
  await expect(importModal).toBeVisible({ timeout: 20_000 })
  await importModal.getByRole("button", { name: "开始导入" }).click()
  await expect
    .poll(async () => {
      return await page.evaluate(() => localStorage.getItem("ksh002_current_dataset_v1"))
    })
    .not.toBeNull()

  await page.getByRole("button", { name: "图层", exact: true }).click()
  const layerPanel = page.locator(".mars-dialog.manage-layer_pannel", { hasText: "图层" })
  await expect(layerPanel).toBeVisible({ timeout: 20_000 })
  const tree = layerPanel.locator(".layer-tree")
  await expect(tree).toBeVisible({ timeout: 20_000 })

  await expect(tree.getByText("导入图层")).toBeVisible({ timeout: 20_000 })
  const resultNodeTitles = tree.locator(".ant-tree-title").filter({ hasText: "导入: 本地验收数据集" })
  const beforeCount = await resultNodeTitles.count()
  expect(beforeCount).toBeGreaterThan(0)

  const importedRootTitle = resultNodeTitles.first()
  const importedRootNode = importedRootTitle.locator("xpath=ancestor::*[contains(@class,'ant-tree-treenode')]").first()
  await importedRootNode.scrollIntoViewIfNeeded()
  const importedCheckbox = importedRootNode.locator(".ant-tree-checkbox").first()

  await expect(importedCheckbox).toHaveClass(/ant-tree-checkbox-checked/)
  await importedCheckbox.click()
  await expect(importedRootTitle).toBeVisible()
  await expect(importedCheckbox).not.toHaveClass(/ant-tree-checkbox-checked/)

  await importedCheckbox.click()
  await expect(importedCheckbox).toHaveClass(/ant-tree-checkbox-checked/)

  const taskPopoverBackdrop = page.locator(".task-popover-backdrop")
  if (await taskPopoverBackdrop.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape").catch(() => {})
    await expect(taskPopoverBackdrop).toBeHidden({ timeout: 5_000 }).catch(() => {})
  }

  const first = resultNodeTitles.first()
  await expect(first).toBeVisible({ timeout: 20_000 })
  await first.scrollIntoViewIfNeeded()
  await first.click({ button: "right", force: true })
  const menu = page.locator(".ant-dropdown-menu")
  await expect(menu).toBeVisible({ timeout: 10_000 })
  await menu.getByText("删除", { exact: true }).click()

  const deleteModal = page.getByRole("dialog", { name: "删除" })
  await expect(deleteModal).toBeVisible({ timeout: 10_000 })
  await deleteModal.getByRole("button", { name: /确\s*定/ }).click()
  await expect(deleteModal).toBeHidden({ timeout: 20_000 })

  const afterCount = await resultNodeTitles.count()
  expect(afterCount).toBeLessThan(beforeCount)
  await layerPanel.getByRole("button", { name: "关闭" }).click()
  await expect(layerPanel).toBeHidden({ timeout: 20_000 })

  await page.getByRole("button", { name: "数据集仓库" }).click({ force: true })
  await expect(repoDrawer).toBeVisible({ timeout: 60_000 })

  const layerVersionBtn = repoDrawer.getByRole("button", { name: "图层/版本" })
  if (!(await layerVersionBtn.isVisible().catch(() => false))) {
    const search = repoDrawer.getByPlaceholder("搜索名称/描述")
    if (await search.isVisible().catch(() => false)) {
      await search.fill("本地验收数据集")
    }
    const card = repoDrawer.locator(".dataset-card", { hasText: "本地验收数据集" }).first()
    if (await card.isVisible().catch(() => false)) {
      await card.click()
    }
  }
  await expect(layerVersionBtn).toBeVisible({ timeout: 20_000 })

  await layerVersionBtn.click()
  const drawer = page.locator(".mars-dialog.ksh002-layer-version-drawer", { hasText: "图层与版本" })
  await expect(drawer).toBeVisible({ timeout: 20_000 })

  await drawer.getByRole("tab", { name: "图层" }).click({ force: true })
  await expect(drawer.getByRole("button", { name: "新建图层" })).toBeEnabled()
  await drawer.getByRole("button", { name: "新建图层" }).click()

  const modal = page.getByRole("dialog", { name: "新建图层/目录" })
  await expect(modal).toBeVisible({ timeout: 20_000 })
  await modal.getByPlaceholder("如：瓦片服务 URL / GeoJSON URL").fill("https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}")
  await modal.getByRole("button", { name: /确\s*定/ }).click()
  await expect(modal).toBeHidden({ timeout: 20_000 })

  await drawer.getByRole("button", { name: "保存为新版本" }).click()

  const itemCards = repoDrawer.locator(".item-card")
  await expect(itemCards).toHaveCount(2, { timeout: 20_000 })

  await page.evaluate(() => {
    const keys = [
      "mars3d_layer_checked_keys",
      "mars3d_layer_expanded_keys",
      "mars3d_layer_opacity_values",
      "mars3d_layers_state_v1",
      "mars3d_basemap_state_v1",
      "ksh003_split_compare_state_v1",
      "ksh003_timeline_player_state_v1",
      "ksh002_current_dataset_v1",
      "ksh002_current_task_lock_v1"
    ]
    keys.forEach((k) => localStorage.setItem(k, JSON.stringify({ k, ts: Date.now() })))
    localStorage.setItem("__should_keep__", "1")
  })

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("mars3d:workspace-clear", { detail: { clearStorage: false } }))
  })
  await expect
    .poll(async () => {
      return await page.evaluate(() => localStorage.getItem("mars3d_layers_state_v1"))
    })
    .not.toBeNull()

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("mars3d:workspace-clear", { detail: { clearStorage: true } }))
  })
  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        const keys = [
          "mars3d_layer_checked_keys",
          "mars3d_layer_expanded_keys",
          "mars3d_layer_opacity_values",
          "mars3d_layers_state_v1",
          "mars3d_basemap_state_v1",
          "ksh003_split_compare_state_v1",
          "ksh003_timeline_player_state_v1",
          "ksh002_current_dataset_v1",
          "ksh002_current_task_lock_v1"
        ]
        return {
          keep: localStorage.getItem("__should_keep__"),
          values: keys.map((k) => localStorage.getItem(k))
        }
      })
    })
    .toEqual({ keep: "1", values: new Array(9).fill(null) })
})

test("KSH-002: 退出登录（清理缓存并重置）", async ({ page }) => {
  test.setTimeout(120_000)

  await page.addInitScript(() => {
    localStorage.setItem("sidebar_collapsed", "0")
    const keys = [
      "mars3d_layer_checked_keys",
      "mars3d_layer_expanded_keys",
      "mars3d_layer_opacity_values",
      "mars3d_layers_state_v1",
      "mars3d_basemap_state_v1",
      "ksh003_split_compare_state_v1",
      "ksh003_timeline_player_state_v1",
      "ksh002_current_dataset_v1",
      "ksh002_current_task_lock_v1"
    ]
    keys.forEach((k) => localStorage.setItem(k, JSON.stringify({ k, ts: Date.now() })))
  })

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 60_000 })

  await page.locator(".settings-btn").click({ force: true })
  await page.getByText("退出登录（清理缓存并重置）", { exact: true }).click()

  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        const keys = [
          "mars3d_layer_checked_keys",
          "mars3d_layer_expanded_keys",
          "mars3d_layer_opacity_values",
          "mars3d_layers_state_v1",
          "mars3d_basemap_state_v1",
          "ksh003_split_compare_state_v1",
          "ksh003_timeline_player_state_v1",
          "ksh002_current_dataset_v1",
          "ksh002_current_task_lock_v1"
        ]
        return keys.map((k) => localStorage.getItem(k))
      })
    })
    .toEqual(new Array(9).fill(null))
})

test("KSH-002: 底图互斥与持久化（2-23）", async ({ page }) => {
  test.setTimeout(120_000)

  const tileHits: string[] = []
  await page.route("**/*", async (route) => {
    const req = route.request()
    const url = req.url()
    if (url.includes("/api/titiler/") || url.includes("appmaptile")) {
      tileHits.push(url)
    }
    if (req.resourceType() === "image") {
      await route.fulfill({ status: 200, contentType: "image/png", body: tinyPngBuffer })
      return
    }
    await route.continue()
  })

  await page.addInitScript(() => {
    localStorage.setItem("sidebar_collapsed", "0")
  })

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 60_000 })

  tileHits.length = 0
  await page.getByRole("button", { name: "底图", exact: true }).click()
  const panel = page.locator(".mars-dialog.manage-basemap-pannel", { hasText: "底图" })
  await expect(panel).toBeVisible({ timeout: 20_000 })

  const candidates = ["eoAPI灰度底图", "eoAPI暗色底图", "eoAPI热力底图", "eoAPI地形底图"]
  let clicked = false
  for (const name of candidates) {
    const card = panel.locator(".basemap-card", { hasText: name }).first()
    if (await card.isVisible().catch(() => false)) {
      await card.click({ force: true })
      clicked = true
      break
    }
  }
  expect(clicked).toBe(true)

  await expect
    .poll(
      async () => {
        return await page.evaluate(() => {
          try {
            return JSON.parse(localStorage.getItem("mars3d_basemap_state_v1") || "{}")?.id || ""
          } catch {
            return ""
          }
        })
      },
      { timeout: 20_000 }
    )
    .not.toBe("")
  const storedId = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("mars3d_basemap_state_v1") || "{}")?.id || ""
    } catch {
      return ""
    }
  })
  expect(storedId).toBeTruthy()

  tileHits.length = 0
  const homeBtn = page.getByRole("button", { name: "初始视图" })
  if (await homeBtn.isVisible().catch(() => false)) {
    await homeBtn.click({ force: true }).catch(() => {})
  }
  await expect
    .poll(() => tileHits.some((u) => u.includes("/api/titiler/")), { timeout: 20_000 })
    .toBe(true)

  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 60_000 })
  tileHits.length = 0
  if (await homeBtn.isVisible().catch(() => false)) {
    await homeBtn.click({ force: true }).catch(() => {})
  }
  await expect
    .poll(() => tileHits.some((u) => u.includes("/api/titiler/")), { timeout: 20_000 })
    .toBe(true)
  const restoredId = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("mars3d_basemap_state_v1") || "{}")?.id || ""
    } catch {
      return ""
    }
  })
  expect(String(restoredId)).toBe(String(storedId))
})

test("KSH-002: 图层状态保留（2-19）", async ({ page }) => {
  test.setTimeout(180_000)

  await page.route("**/*", async (route) => {
    const req = route.request()
    if (req.resourceType() === "image") {
      await route.fulfill({ status: 200, contentType: "image/png", body: tinyPngBuffer })
      return
    }
    await route.continue()
  })

  await page.addInitScript(() => {
    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.removeItem("ksh002_drawer_folded_dataset-repository")
    localStorage.removeItem("ksh002_drawer_folded_my-repository")
    localStorage.removeItem("ksh002_drawer_folded_save-result")
    localStorage.removeItem("ksh002_drawer_folded_current-task")

    const datasetId = "local_e2e_ds_persist"
    const rev1 = "rev_1"
    const manifest = {
      manifestVersion: "1.0",
      viewState: {
        bbox: [97.62, 21.12, 97.72, 21.22]
      },
      layers: [
        {
          id: "g_root",
          name: "目录",
          sourceType: "group",
          sourceRef: "",
          visible: true,
          opacity: 1,
          order: 0
        },
        {
          id: "l_osm",
          name: "OSM",
          sourceType: "xyz",
          sourceRef: "https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}",
          pid: "g_root",
          visible: true,
          opacity: 1,
          order: 1
        }
      ],
      drawFeatures: []
    }
    localStorage.setItem(
      "eoapi_manifests",
      JSON.stringify({
        [datasetId]: {
          name: "本地状态保留验收数据集",
          description: "E2E fixture",
          visibility: "private",
          manifest,
          revisionManifests: { [rev1]: manifest },
          revisions: [{ revisionId: rev1, message: "初始版本", createdAt: Date.now() - 10_000 }],
          createdAt: Date.now() - 20_000
        }
      })
    )
  })

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 60_000 })

  await page.getByRole("button", { name: "数据集仓库" }).click({ force: true })
  const repoDrawer = page.locator(".mars-dialog.ksh002-drawer", { hasText: "数据集仓库" })
  await expect(repoDrawer).toBeVisible({ timeout: 60_000 })

  const search = repoDrawer.getByPlaceholder("搜索名称/描述")
  if (await search.isVisible().catch(() => false)) {
    await search.fill("本地状态保留验收数据集")
  }

  const card = repoDrawer.locator(".dataset-card", { hasText: "本地状态保留验收数据集" }).first()
  await expect(card).toBeVisible({ timeout: 20_000 })
  await card.click()
  const importBtn = repoDrawer.getByRole("button", { name: "导入使用" })
  await expect(importBtn).toBeVisible({ timeout: 20_000 })
  await importBtn.click()
  const importModal = page.getByRole("dialog", { name: "导入使用" })
  await expect(importModal).toBeVisible({ timeout: 20_000 })
  await importModal.getByRole("button", { name: "开始导入" }).click()
  await expect
    .poll(async () => {
      return await page.evaluate(() => localStorage.getItem("ksh002_current_dataset_v1"))
    })
    .not.toBeNull()

  await page.getByRole("button", { name: "图层", exact: true }).click()
  const layerPanel = page.locator(".mars-dialog.manage-layer_pannel", { hasText: "图层" })
  await expect(layerPanel).toBeVisible({ timeout: 20_000 })
  const tree = layerPanel.locator(".layer-tree")
  await expect(tree).toBeVisible({ timeout: 20_000 })

  const importedRootTitle = tree.locator(".ant-tree-title").filter({ hasText: "导入: 本地状态保留验收数据集" }).first()
  await expect(importedRootTitle).toBeVisible({ timeout: 20_000 })
  const importedRootNode = importedRootTitle.locator("xpath=ancestor::*[contains(@class,'ant-tree-treenode')]").first()
  await importedRootNode.scrollIntoViewIfNeeded()
  const importedCheckbox = importedRootNode.locator(".ant-tree-checkbox").first()
  await expect(importedCheckbox).toHaveClass(/ant-tree-checkbox-checked/)

  await importedCheckbox.click()
  await expect(importedCheckbox).not.toHaveClass(/ant-tree-checkbox-checked/)

  await expect
    .poll(async () => {
      return await page.evaluate(() => localStorage.getItem("mars3d_layer_checked_keys"))
    })
    .not.toBeNull()

  await layerPanel.getByRole("button", { name: "关闭" }).click()
  await expect(layerPanel).toBeHidden({ timeout: 20_000 })

  await page.getByRole("button", { name: "数据集仓库" }).click({ force: true })
  await expect(repoDrawer).toBeVisible({ timeout: 20_000 })

  await page.getByRole("button", { name: "图层", exact: true }).click()
  await expect(layerPanel).toBeVisible({ timeout: 20_000 })

  const importedRootTitle2 = tree.locator(".ant-tree-title").filter({ hasText: "导入: 本地状态保留验收数据集" }).first()
  await expect(importedRootTitle2).toBeVisible({ timeout: 20_000 })
  const importedRootNode2 = importedRootTitle2.locator("xpath=ancestor::*[contains(@class,'ant-tree-treenode')]").first()
  const importedCheckbox2 = importedRootNode2.locator(".ant-tree-checkbox").first()
  await expect(importedCheckbox2).not.toHaveClass(/ant-tree-checkbox-checked/)
})

test("KSH-002: 栅格与矢量加载（2-4/2-5）", async ({ page }) => {
  test.setTimeout(180_000)

  let geojsonRequestCount = 0
  await page.route("**/*", async (route) => {
    const req = route.request()
    const url = req.url()
    if (url.includes("demo.geojson")) {
      geojsonRequestCount += 1
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { name: "demo" },
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [97.64, 21.14],
                    [97.70, 21.14],
                    [97.70, 21.20],
                    [97.64, 21.20],
                    [97.64, 21.14]
                  ]
                ]
              }
            }
          ]
        })
      })
      return
    }
    if (req.resourceType() === "image") {
      await route.fulfill({ status: 200, contentType: "image/png", body: tinyPngBuffer })
      return
    }
    await route.continue()
  })

  await page.addInitScript(() => {
    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.removeItem("ksh002_drawer_folded_dataset-repository")
    localStorage.removeItem("ksh002_drawer_folded_my-repository")
    localStorage.removeItem("ksh002_drawer_folded_save-result")
    localStorage.removeItem("ksh002_drawer_folded_current-task")

    const datasetId = "local_e2e_ds_raster_vector"
    const rev1 = "rev_1"
    const manifest = {
      manifestVersion: "1.0",
      viewState: {
        bbox: [97.62, 21.12, 97.72, 21.22]
      },
      layers: [
        {
          id: "g_root",
          name: "目录",
          sourceType: "group",
          sourceRef: "",
          visible: true,
          opacity: 1,
          order: 0
        },
        {
          id: "l_xyz",
          name: "OSM 栅格",
          sourceType: "xyz",
          sourceRef: "https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}",
          pid: "g_root",
          visible: true,
          opacity: 1,
          order: 1
        },
        {
          id: "l_geojson",
          name: "矢量边界",
          sourceType: "geojson",
          sourceRef: "https://example.test/demo.geojson",
          pid: "g_root",
          visible: true,
          opacity: 1,
          order: 2
        }
      ],
      drawFeatures: []
    }
    localStorage.setItem(
      "eoapi_manifests",
      JSON.stringify({
        [datasetId]: {
          name: "本地栅格矢量验收数据集",
          description: "E2E fixture",
          visibility: "private",
          manifest,
          revisionManifests: { [rev1]: manifest },
          revisions: [{ revisionId: rev1, message: "初始版本", createdAt: Date.now() - 10_000 }],
          createdAt: Date.now() - 20_000
        }
      })
    )
  })

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 60_000 })

  await page.getByRole("button", { name: "数据集仓库" }).click({ force: true })
  const repoDrawer = page.locator(".mars-dialog.ksh002-drawer", { hasText: "数据集仓库" })
  await expect(repoDrawer).toBeVisible({ timeout: 60_000 })

  const search = repoDrawer.getByPlaceholder("搜索名称/描述")
  if (await search.isVisible().catch(() => false)) {
    await search.fill("本地栅格矢量验收数据集")
  }

  const card = repoDrawer.locator(".dataset-card", { hasText: "本地栅格矢量验收数据集" }).first()
  await expect(card).toBeVisible({ timeout: 20_000 })
  await card.click()
  const importBtn = repoDrawer.getByRole("button", { name: "导入使用" })
  await expect(importBtn).toBeVisible({ timeout: 20_000 })
  await importBtn.click()
  const importModal = page.getByRole("dialog", { name: "导入使用" })
  await expect(importModal).toBeVisible({ timeout: 20_000 })
  await importModal.getByRole("button", { name: "开始导入" }).click()
  await expect
    .poll(async () => {
      return await page.evaluate(() => localStorage.getItem("ksh002_current_dataset_v1"))
    })
    .not.toBeNull()

  await page.getByRole("button", { name: "图层", exact: true }).click()
  const layerPanel = page.locator(".mars-dialog.manage-layer_pannel", { hasText: "图层" })
  await expect(layerPanel).toBeVisible({ timeout: 20_000 })
  const tree = layerPanel.locator(".layer-tree")
  await expect(tree).toBeVisible({ timeout: 20_000 })

  const importedRootTitle = tree.locator(".ant-tree-title").filter({ hasText: "导入: 本地栅格矢量验收数据集" }).first()
  await expect(importedRootTitle).toBeVisible({ timeout: 20_000 })
  const importedRootNode = importedRootTitle.locator("xpath=ancestor::*[contains(@class,'ant-tree-treenode')]").first()
  const switcher = importedRootNode.locator(".ant-tree-switcher").first()
  await switcher.click({ force: true }).catch(() => {})

  await expect.poll(() => geojsonRequestCount, { timeout: 20_000 }).toBeGreaterThan(0)
  const searchInput = layerPanel.getByPlaceholder("搜索图层")
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill("OSM 栅格").catch(() => {})
  }
  const rasterTitle = tree.locator(".ant-tree-title").filter({ hasText: "OSM 栅格" }).first()
  await expect(rasterTitle).toBeVisible({ timeout: 20_000 })

  const rasterWrapper = rasterTitle.locator("xpath=ancestor::*[contains(@class,'ant-tree-node-content-wrapper')]").first()
  const rasterCheckbox = rasterWrapper.locator("xpath=preceding-sibling::*[contains(@class,'ant-tree-checkbox')]").first()
  await expect(rasterCheckbox).toHaveClass(/ant-tree-checkbox-checked/)
  await rasterCheckbox.click()
  await expect(rasterCheckbox).not.toHaveClass(/ant-tree-checkbox-checked/)
  await rasterCheckbox.click()
  await expect(rasterCheckbox).toHaveClass(/ant-tree-checkbox-checked/)

  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill("矢量").catch(() => {})
  }
  let vectorTitle = tree.locator(".ant-tree-title").filter({ hasText: /矢量边界/ }).first()
  if (!(await vectorTitle.isVisible().catch(() => false))) {
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill("demo").catch(() => {})
    }
    vectorTitle = tree.locator(".ant-tree-title").filter({ hasText: /demo\.geojson/ }).first()
  }
  await expect(vectorTitle).toBeVisible({ timeout: 20_000 })

  const vectorWrapper = vectorTitle.locator("xpath=ancestor::*[contains(@class,'ant-tree-node-content-wrapper')]").first()
  const vectorCheckbox = vectorWrapper.locator("xpath=preceding-sibling::*[contains(@class,'ant-tree-checkbox')]").first()
  await expect(vectorCheckbox).toHaveClass(/ant-tree-checkbox-checked/)
  await vectorCheckbox.click()
  await expect(vectorCheckbox).not.toHaveClass(/ant-tree-checkbox-checked/)
  await vectorCheckbox.click()
  await expect(vectorCheckbox).toHaveClass(/ant-tree-checkbox-checked/)
})
