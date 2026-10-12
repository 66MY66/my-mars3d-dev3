import { expect, test } from "@playwright/test"

async function mockStacForKsh003(page: any) {
  const collections = {
    collections: [
      {
        id: "c_e2e_001",
        title: "E2E数据集",
        description: "E2E fixture",
        links: []
      }
    ],
    links: []
  }

  const items = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: "item_001",
        properties: { datetime: "2026-06-01T00:00:00Z", title: "影像-1" },
        assets: {},
        links: []
      },
      {
        type: "Feature",
        id: "item_002",
        properties: { datetime: "2026-06-02T00:00:00Z", title: "影像-2" },
        assets: {},
        links: []
      }
    ],
    links: []
  }

  await page.route("**/*", async (route: any) => {
    const req = route.request()
    const url = req.url()
    let path = url
    try {
      path = new URL(url).pathname
    } catch {
      path = url.split("?")[0]
    }
    if (req.method() === "GET" && path.endsWith("/collections") && !path.includes("/items")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(collections) })
      return
    }
    if (req.method() === "GET" && /\/collections\/[^/]+\/items$/.test(path)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(items) })
      return
    }
    if (req.method() === "POST" && path.endsWith("/search")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(items) })
      return
    }
    await route.continue()
  })
}

async function openCurrentTaskPopover(page: any, datasetId: string) {
  await page.setViewportSize({ width: 1366, height: 1200 })
  await page.addInitScript((id: string) => {
    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.removeItem("sidebar_active_tool")
    localStorage.removeItem("ksh002_drawer_folded_current-task")
    localStorage.removeItem("ksh002_current_task_dir_order_v1")
    localStorage.removeItem("ksh002_current_task_lock_v1")
    localStorage.setItem(
      "ksh002_current_dataset_v1",
      JSON.stringify({ datasetId: id, name: "专项回归数据集", source: "unknown", updatedAt: Date.now() })
    )
  }, datasetId)

  await page.goto("/")
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 120_000 })

  const entry = page.getByRole("button", { name: /【当前任务】/ })
  await expect(entry).toBeVisible({ timeout: 20_000 })
  await entry.click()
  await page.waitForFunction(() => localStorage.getItem("sidebar_active_tool") === "current-task", null, { timeout: 10_000 }).catch(() => {})

  const popover = page.locator(".task-popover")
  await expect(popover).toBeVisible({ timeout: 20_000 })

  return { entry, popover }
}

async function seedCurrentTaskSessionLayers(page: any, datasetId: string) {
  const result = await page.evaluate(async (id: string) => {
    const base = location.pathname.startsWith("/mars3d") ? "/mars3d" : ""
    const mapWork: any = await (0, eval)(`import("${base}/src/widgets/basic/current-task/map.ts")`)
    const map = mapWork.getMap?.()
    if (!map) {
      throw new Error("map not ready")
    }

    const openedAt = Date.now()
    const sessionId = `eoapi_group_${id}_${openedAt}`
    mapWork.ensureGroupLayer(sessionId, "本次导入")

    const groupAId = `task_group_${openedAt}_a`
    const groupBId = `task_group_${openedAt}_b`
    mapWork.ensureGroupLayer(groupAId, "分组A", sessionId)
    mapWork.ensureGroupLayer(groupBId, "分组B", sessionId)

    const point = { type: "Point", coordinates: [116.397389, 39.908722] }
    const point2 = { type: "Point", coordinates: [116.404, 39.915] }
    const geojson = { type: "FeatureCollection", features: [{ type: "Feature", properties: { id: 1 }, geometry: point }] }
    const geojson2 = { type: "FeatureCollection", features: [{ type: "Feature", properties: { id: 2 }, geometry: point2 }] }

    const layerA1 = `task_layer_${openedAt}_a1`
    const layerB1 = `task_layer_${openedAt}_b1`
    mapWork.addGeoJsonLayer(layerA1, geojson, { name: "点位-A1", pid: groupAId })
    mapWork.addGeoJsonLayer(layerB1, geojson2, { name: "点位-B1", pid: groupBId })

    window.dispatchEvent(new CustomEvent("mars3d_layersChanged"))
    return { sessionId, groupAId, groupBId, layerA1, layerB1 }
  }, datasetId)

  return result as {
    sessionId: string
    groupAId: string
    groupBId: string
    layerA1: string
    layerB1: string
  }
}

async function getLayerShow(page: any, layerIds: string[]) {
  return await page.evaluate(async (ids: string[]) => {
    const base = location.pathname.startsWith("/mars3d") ? "/mars3d" : ""
    const mapWork: any = await (0, eval)(`import("${base}/src/widgets/basic/current-task/map.ts")`)
    return ids.map((id) => {
      const layer = mapWork.getLayerById?.(id)
      const show = layer ? !!layer.show : null
      return { id, show }
    })
  }, layerIds)
}

async function getTreeOrderByNames(page: any, names: string[]) {
  return await page.evaluate((targetNames: string[]) => {
    const root = document.querySelector(".task-popover .layers-tree") as HTMLElement | null
    if (!root) {
      return []
    }
    const nodes = Array.from(root.querySelectorAll(".ant-tree-treenode")) as HTMLElement[]
    const picked: Array<{ name: string; y: number }> = []
    for (const n of nodes) {
      const title = n.querySelector(".node-title") as HTMLElement | null
      const text = (title?.textContent || "").trim()
      if (!targetNames.includes(text)) {
        continue
      }
      const rect = n.getBoundingClientRect()
      picked.push({ name: text, y: rect.top })
    }
    picked.sort((a, b) => a.y - b.y)
    return picked.map((p) => p.name)
  }, names)
}

async function expandLayersPanel(page: any, popover: any) {
  const rootRow = popover.locator(".tree-row.root").first()
  await expect(rootRow).toBeVisible({ timeout: 20_000 })
  for (let i = 0; i < 3; i += 1) {
    const count = await popover.locator(".tree-row", { hasText: /^图层/ }).count()
    if (count > 0) {
      break
    }
    await rootRow.click()
    await page.waitForTimeout(150)
  }

  const layersRow = popover.locator(".tree-row", { hasText: /^图层/ }).first()
  await expect(layersRow).toBeVisible({ timeout: 20_000 })
  for (let i = 0; i < 3; i += 1) {
    await layersRow.click()
    const count = await popover.locator(".layers-tree").count()
    if (count > 0) {
      break
    }
    await page.waitForTimeout(150)
  }
  await expect(popover.locator(".layers-tree")).toBeVisible({ timeout: 20_000 })
}

async function reopenAndSelectFirstSession(page: any, entry: any, popover: any) {
  await entry.click()
  await expect(popover).toBeHidden({ timeout: 20_000 })
  await entry.click()
  await expect(popover).toBeVisible({ timeout: 20_000 })

  await expect.poll(async () => popover.locator(".recent-item").count(), { timeout: 20_000 }).toBeGreaterThan(0)
  await popover.locator(".recent-item").first().click()
  await expandLayersPanel(page, popover)
}

test("当前任务专项回归：拖拽排序（不绑定 2-24 导入链）", async ({ page }) => {
  test.setTimeout(240_000)
  const datasetId = `e2e_current_task_drag_${Date.now()}`
  const { entry, popover } = await openCurrentTaskPopover(page, datasetId)
  await seedCurrentTaskSessionLayers(page, datasetId)
  await reopenAndSelectFirstSession(page, entry, popover)

  await expect(popover.locator(".ant-tree-treenode", { hasText: "分组A" }).first()).toBeVisible({ timeout: 20_000 })
  await expect(popover.locator(".ant-tree-treenode", { hasText: "分组B" }).first()).toBeVisible({ timeout: 20_000 })

  const beforeOrder = await getTreeOrderByNames(page, ["分组A", "分组B"])
  expect(beforeOrder.sort()).toEqual(["分组A", "分组B"])

  const groupA = popover.locator(".ant-tree-treenode", { hasText: "分组A" }).first().locator(".ant-tree-node-content-wrapper")
  const groupB = popover.locator(".ant-tree-treenode", { hasText: "分组B" }).first().locator(".ant-tree-node-content-wrapper")
  await groupB.dragTo(groupA, { targetPosition: { x: 10, y: 2 } })

  await expect.poll(async () => getTreeOrderByNames(page, ["分组A", "分组B"]), { timeout: 20_000 }).toEqual(["分组B", "分组A"])
  const orderAfterDrag = ["分组B", "分组A"]

  await reopenAndSelectFirstSession(page, entry, popover)
  await expect.poll(async () => getTreeOrderByNames(page, ["分组A", "分组B"]), { timeout: 20_000 }).toEqual(orderAfterDrag)
})

test("当前任务专项回归：批量显隐（不绑定 2-24 导入链）", async ({ page }) => {
  test.setTimeout(240_000)
  const datasetId = `e2e_current_task_batch_${Date.now()}`
  const { entry, popover } = await openCurrentTaskPopover(page, datasetId)
  const seed = await seedCurrentTaskSessionLayers(page, datasetId)
  await reopenAndSelectFirstSession(page, entry, popover)

  const nodeA = popover.locator(".ant-tree-treenode", { hasText: "点位-A1" }).first()
  const nodeB = popover.locator(".ant-tree-treenode", { hasText: "点位-B1" }).first()
  await expect(nodeA.locator(".ant-tree-checkbox-checked")).toBeVisible()
  await expect(nodeB.locator(".ant-tree-checkbox-checked")).toBeVisible()

  await popover.getByRole("button", { name: "批量隐藏" }).click()
  await expect
    .poll(async () => getLayerShow(page, [seed.layerA1, seed.layerB1]), { timeout: 20_000 })
    .toEqual([
      { id: seed.layerA1, show: false },
      { id: seed.layerB1, show: false }
    ])

  await popover.getByRole("button", { name: "批量显示" }).click()
  await expect
    .poll(async () => getLayerShow(page, [seed.layerA1, seed.layerB1]), { timeout: 20_000 })
    .toEqual([
      { id: seed.layerA1, show: true },
      { id: seed.layerB1, show: true }
    ])
})

test("当前任务专项回归：只读锁（不绑定 2-24 导入链）", async ({ page }) => {
  test.setTimeout(240_000)
  const datasetId = `e2e_current_task_lock_${Date.now()}`
  const { entry, popover } = await openCurrentTaskPopover(page, datasetId)
  await seedCurrentTaskSessionLayers(page, datasetId)
  await reopenAndSelectFirstSession(page, entry, popover)

  const lockBtn = popover.getByRole("button", { name: /只读：/ }).first()
  await expect(lockBtn).toBeVisible()
  await lockBtn.click()

  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        const raw = localStorage.getItem("ksh002_current_task_lock_v1")
        if (!raw) {
          return null
        }
        try {
          const parsed = JSON.parse(raw)
          return parsed && typeof parsed === "object" ? !!parsed.locked : null
        } catch {
          return null
        }
      })
    })
    .toBe(true)

  await expect(popover.getByText("只读：开")).toBeVisible({ timeout: 20_000 })
  await expect(popover.getByRole("button", { name: "批量隐藏" })).toBeDisabled()
  await expect(popover.getByRole("button", { name: "批量显示" })).toBeDisabled()
})

test("KSH-003: 分屏对比（基础回归）", async ({ page }) => {
  test.setTimeout(240_000)
  await page.setViewportSize({ width: 1366, height: 900 })
  await mockStacForKsh003(page)
  await page.addInitScript(() => {
    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.setItem(
      "ksh003_split_compare_state_v1",
      JSON.stringify({
        ts: Date.now(),
        sliderValue: 50,
        leftCollection: "c_e2e_001",
        leftItem: "item_001",
        leftOpacity: 100,
        rightCollection: "c_e2e_001",
        rightItem: "item_002",
        rightOpacity: 100,
        panel: { width: 520, height: 480, position: { top: 60, right: 10 } }
      })
    )
  })

  await page.goto("/")
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 120_000 })

  await page.getByRole("button", { name: "分屏对比", exact: true }).click({ force: true })
  const panel = page.locator(".mars-dialog.split-compare-panel", { hasText: "分屏对比" })
  await expect(panel).toBeVisible({ timeout: 20_000 })

  const leftSection = panel.locator(".layer-section").nth(0)
  const rightSection = panel.locator(".layer-section").nth(1)

  const leftItemSelect = leftSection.locator(".ant-select").nth(1)
  await expect(leftItemSelect).not.toHaveClass(/ant-select-disabled/, { timeout: 20_000 })

  const rightItemSelect = rightSection.locator(".ant-select").nth(1)
  await expect(rightItemSelect).not.toHaveClass(/ant-select-disabled/, { timeout: 20_000 })

  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        const raw = localStorage.getItem("ksh003_split_compare_state_v1")
        if (!raw) {
          return null
        }
        try {
          return JSON.parse(raw)
        } catch {
          return null
        }
      })
    })
    .not.toBeNull()
})

test("KSH-003: 时间轴演化（基础回归）", async ({ page }) => {
  test.setTimeout(240_000)
  await page.setViewportSize({ width: 1366, height: 900 })
  await mockStacForKsh003(page)
  await page.addInitScript(() => {
    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.removeItem("ksh003_timeline_player_state_v1")
  })

  await page.goto("/")
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 120_000 })

  await page.getByRole("button", { name: "时间轴演化", exact: true }).click({ force: true })
  const panel = page.locator(".mars-dialog.eoapi-timeline-player-panel", { hasText: "时间轴演化" })
  await expect(panel).toBeVisible({ timeout: 20_000 })

  await panel.locator(".collection-select").getByRole("combobox").click({ force: true })
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")

  await panel.locator(".granularity-select").getByRole("combobox").click({ force: true })
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")

  const listBtn = panel.locator("button", { hasText: "影像列表" }).first()
  await expect(listBtn).toBeVisible({ timeout: 20_000 })
  await listBtn.click({ force: true })
  const drawer = page.locator(".mars-task-modal", { hasText: "影像列表" })
  await expect(drawer).toBeVisible({ timeout: 20_000 })

  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        const raw = localStorage.getItem("ksh003_timeline_player_state_v1")
        if (!raw) {
          return null
        }
        try {
          return JSON.parse(raw)
        } catch {
          return null
        }
      })
    })
    .not.toBeNull()
})
