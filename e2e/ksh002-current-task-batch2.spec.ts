import { expect, test } from "@playwright/test"

const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+KxUAAAAASUVORK5CYII="
const tinyPngBuffer = Buffer.from(tinyPngBase64, "base64")

async function reduceMapLoad(page: any) {
  await page.route("**/*", async (route: any) => {
    const req = route.request()
    if (req.resourceType() === "image") {
      await route.fulfill({ status: 200, contentType: "image/png", body: tinyPngBuffer })
      return
    }
    const url = req.url()
    if (/\/thematics\/jobs(\/[^/]+\/result)?(\?.*)?$/.test(url)) {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ success: false }) })
      return
    }
    await route.continue()
  })
}

async function dismissBlockingModals(page: any) {
  const buttons = [
    page.getByRole("button", { name: "OK" }).first(),
    page.getByRole("button", { name: "确 定" }).first()
  ]
  for (const btn of buttons) {
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true }).catch(() => {})
    }
  }
}

async function activateWidgetForAudit(page: any, name: string) {
  await page.evaluate(async (widgetName: string) => {
    const root: any = document.querySelector("#app")
    const app: any = root?.__vue_app__
    const provides: any = app?._context?.provides
    if (!provides) {
      return
    }
    let store: any = null
    for (const k of Reflect.ownKeys(provides)) {
      const v: any = provides[k as any]
      if (
        v &&
        typeof v === "object" &&
        v.state &&
        Array.isArray(v.state.widgets) &&
        Array.isArray(v.state.openAtStart) &&
        typeof v.dispatch === "function"
      ) {
        store = v
        break
      }
    }
    if (!store) {
      return
    }
    await store.dispatch("activate", { name: widgetName, reload: true })
  }, name)
}

async function openCurrentTaskPopover(page: any, datasetId: string, datasetName = "专项回归数据集") {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.addInitScript((input: { datasetId: string; datasetName: string }) => {
    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.removeItem("sidebar_active_tool")
    localStorage.removeItem("ksh002_drawer_folded_current-task")
    localStorage.removeItem("ksh002_current_task_dir_order_v1")
    localStorage.removeItem("ksh002_current_task_lock_v1")
    localStorage.setItem(
      "ksh002_current_dataset_v1",
      JSON.stringify({
        datasetId: input.datasetId,
        name: input.datasetName,
        source: "repository",
        updatedAt: Date.now()
      })
    )
    ;(window as any).__opened_urls = []
    const originalOpen = window.open.bind(window)
    window.open = ((url?: string | URL | undefined, target?: string, features?: string) => {
      try {
        ;(window as any).__opened_urls.push(String(url || ""))
      } catch {
      }
      return originalOpen(url as any, target, features)
    }) as any
  }, { datasetId, datasetName })

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 60_000 })
  await dismissBlockingModals(page)

  const entry = page.getByRole("button", { name: /【当前任务】/ })
  await expect(entry).toBeVisible({ timeout: 20_000 })
  await entry.click({ force: true, position: { x: 20, y: 12 } })
  const popover = page.locator(".task-popover")
  if (!(await popover.isVisible().catch(() => false))) {
    await dismissBlockingModals(page)
    await activateWidgetForAudit(page, "current-task").catch(() => {})
  }
  await expect(popover).toBeVisible({ timeout: 20_000 })
  return { entry, popover }
}

async function seedCurrentTaskSessionLayers(page: any, datasetId: string) {
  return await page.evaluate(async (id: string) => {
    const base = location.pathname.startsWith("/mars3d") ? "/mars3d" : ""
    const mapWork: any = await (0, eval)(`import("${base}/src/widgets/basic/current-task/map.ts")`)
    const map = mapWork.getMap?.()
    if (!map) {
      throw new Error("map not ready")
    }
    const openedAt = Date.now()
    const sessionId = `eoapi_group_${id}_${openedAt}`
    const prefix = `eoapi_${id}_${openedAt}_`
    const manifest = {
      manifestVersion: "1.0",
      viewState: { bbox: [116.38, 39.90, 116.41, 39.93] },
      layers: [],
      drawFeatures: []
    }

    mapWork.ensureGroupLayer(sessionId, "本次导入")
    mapWork.ensureGroupLayer("task_group_a", "分组A", sessionId)
    mapWork.ensureGroupLayer("task_group_b", "分组B", sessionId)
    mapWork.addGeoJsonLayer("task_layer_a1", {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: { id: 1 }, geometry: { type: "Point", coordinates: [116.397389, 39.908722] } }]
    }, { name: "点位-A1", pid: "task_group_a" })
    mapWork.addGeoJsonLayer("task_layer_b1", {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: { id: 2 }, geometry: { type: "Point", coordinates: [116.404, 39.915] } }]
    }, { name: "点位-B1", pid: "task_group_b" })
    mapWork.persistSession({
      datasetId: id,
      groupId: sessionId,
      openedAt,
      source: "repository",
      groupName: "本次导入",
      layerIdPrefix: prefix,
      manifest
    })
    window.dispatchEvent(new CustomEvent("mars3d_layersChanged"))
    return { sessionId, thematicLayerId: `thematics_local_job_${id}` }
  }, datasetId)
}

async function expandLayersPanel(page: any, popover: any) {
  const rootRow = popover.locator(".tree-row.root").first()
  await expect(rootRow).toBeVisible({ timeout: 20_000 })
  for (let i = 0; i < 3; i += 1) {
    const count = await popover.locator(".tree-row", { hasText: /^图层/ }).count()
    if (count > 0) {
      break
    }
    await rootRow.click({ force: true })
    await page.waitForTimeout(150)
  }

  const layersRow = popover.locator(".tree-row", { hasText: /^图层/ }).first()
  await expect(layersRow).toBeVisible({ timeout: 20_000 })
  for (let i = 0; i < 3; i += 1) {
    await layersRow.click({ force: true })
    const count = await popover.locator(".layers-tree").count()
    if (count > 0) {
      break
    }
    await page.waitForTimeout(150)
  }
  await expect(popover.locator(".layers-tree")).toBeVisible({ timeout: 20_000 })
}

async function selectFirstSession(page: any, popover: any) {
  const item = popover.locator(".recent-item").first()
  await expect.poll(async () => popover.locator(".recent-item").count(), { timeout: 20_000 }).toBeGreaterThan(0)
  await item.scrollIntoViewIfNeeded().catch(() => {})
  await item.click({ force: true, position: { x: 20, y: 12 } }).catch(async () => {
    await item.evaluate((el: any) => {
      try {
        ;(el as HTMLElement).click()
      } catch {
      }
    })
  })
  await expandLayersPanel(page, popover)
}

async function reopenCurrentTaskPopover(page: any, entry: any, popover: any) {
  const closeBtn = popover.getByRole("button", { name: "关闭" }).first()
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click({ force: true }).catch(() => {})
  }
  await expect(popover).toBeHidden({ timeout: 20_000 })
  await entry.click({ force: true, position: { x: 20, y: 12 } }).catch(() => {})
  if (!(await popover.isVisible().catch(() => false))) {
    await activateWidgetForAudit(page, "current-task").catch(() => {})
  }
  await expect(popover).toBeVisible({ timeout: 20_000 })
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
      picked.push({ name: text, y: n.getBoundingClientRect().top })
    }
    picked.sort((a, b) => a.y - b.y)
    return picked.map((item) => item.name)
  }, names)
}

async function readCameraCenter(page: any) {
  return await page.evaluate(async () => {
    const base = location.pathname.startsWith("/mars3d") ? "/mars3d" : ""
    const mapWork: any = await (0, eval)(`import("${base}/src/widgets/basic/current-task/map.ts")`)
    const map = mapWork.getMap?.()
    if (!map) {
      return null
    }
    const center = map.getCenter?.()
    if (!center) {
      return null
    }
    return {
      lng: Number(center.lng ?? center.longitude ?? 0).toFixed(3),
      lat: Number(center.lat ?? center.latitude ?? 0).toFixed(3)
    }
  })
}

test.describe("KSH-002 下一批专项回归", () => {
  test("3-27 目录拖拽排序可持久化", async ({ page }) => {
    test.setTimeout(90_000)
    await reduceMapLoad(page)
    const datasetId = `e2e_drag_${Date.now()}`
    const { entry, popover } = await openCurrentTaskPopover(page, datasetId)
    await seedCurrentTaskSessionLayers(page, datasetId)
    await selectFirstSession(page, popover)

    await expect(popover.locator(".ant-tree-treenode", { hasText: "分组A" }).first()).toBeVisible()
    await expect(popover.locator(".ant-tree-treenode", { hasText: "分组B" }).first()).toBeVisible()

    const before = await getTreeOrderByNames(page, ["分组A", "分组B"])
    expect(before.sort()).toEqual(["分组A", "分组B"])

    await page.evaluate(() => {
      const root = document.querySelector(".task-popover .layers-tree") as HTMLElement | null
      if (!root) {
        return
      }
      const nodes = Array.from(root.querySelectorAll(".ant-tree-treenode")) as HTMLElement[]
      const pickNode = (name: string) => {
        for (const node of nodes) {
          const title = node.querySelector(".node-title") as HTMLElement | null
          if (title && (title.textContent || "").trim() === name) {
            return node
          }
        }
        return null
      }
      const srcNode = pickNode("分组B")
      const dstNode = pickNode("分组A")
      if (!srcNode || !dstNode) {
        return
      }
      const src = (srcNode.querySelector('[draggable="true"]') as HTMLElement | null) || (srcNode.querySelector(".ant-tree-node-content-wrapper") as HTMLElement | null) || srcNode
      const dst = (dstNode.querySelector(".ant-tree-node-content-wrapper") as HTMLElement | null) || dstNode
      const dt = new DataTransfer()
      src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }))
      dst.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dt }))
      dst.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }))
      dst.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }))
      src.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: dt }))
    })

    await expect.poll(async () => getTreeOrderByNames(page, ["分组A", "分组B"]), { timeout: 20_000 }).toEqual(["分组B", "分组A"])
    await reopenCurrentTaskPopover(page, entry, popover)
    await selectFirstSession(page, popover)
    await expect.poll(async () => getTreeOrderByNames(page, ["分组A", "分组B"]), { timeout: 20_000 }).toEqual(["分组B", "分组A"])
  })

  test("3-33 目录只读锁生效", async ({ page }) => {
    test.setTimeout(90_000)
    await reduceMapLoad(page)
    const datasetId = `e2e_lock_${Date.now()}`
    const { entry, popover } = await openCurrentTaskPopover(page, datasetId)
    await seedCurrentTaskSessionLayers(page, datasetId)
    await selectFirstSession(page, popover)

    const lockBtn = popover.getByRole("button", { name: /只读：/ }).first()
    await expect(lockBtn).toBeVisible()
    await lockBtn.click({ force: true })

    await expect
      .poll(async () => {
        return await page.evaluate(() => {
          const raw = localStorage.getItem("ksh002_current_task_lock_v1")
          if (!raw) {
            return null
          }
          try {
            return JSON.parse(raw)?.locked ?? null
          } catch {
            return null
          }
        })
      }, { timeout: 20_000 })
      .toBe(true)

    await expect(popover.getByText("只读：开")).toBeVisible()
    await expect(popover.getByRole("button", { name: "批量隐藏" })).toBeDisabled()
    await expect(popover.getByRole("button", { name: "批量显示" })).toBeDisabled()

    const groupBox = popover.locator(".ant-tree-treenode", { hasText: "分组A" }).locator(".ant-tree-checkbox").first()
    await groupBox.click({ force: true })
    await expect(page.locator(".ant-message-notice-content").filter({ hasText: "已禁用" }).first()).toBeVisible({ timeout: 20_000 })
  })

  test("3-31 专题图支持预览/上图/定位/导出", async ({ page }) => {
    test.setTimeout(90_000)
    await reduceMapLoad(page)
    const datasetId = `e2e_thematic_${Date.now()}`
    const { entry, popover } = await openCurrentTaskPopover(page, datasetId, "专题图专项回归数据集")
    const seeded = await seedCurrentTaskSessionLayers(page, datasetId)
    await selectFirstSession(page, popover)

    const thematicsBtn = popover.getByRole("button", { name: /专题图/ }).first()
    await thematicsBtn.scrollIntoViewIfNeeded()
    await thematicsBtn.click({ force: true, position: { x: 20, y: 12 } })
    const panel = popover.locator(".thematics-panel")
    await expect(panel).toBeVisible({ timeout: 20_000 })

    const jobItem = panel.locator(".job-item").first()
    await expect(jobItem).toBeVisible({ timeout: 20_000 })
    await jobItem.click({ force: true })
    const detail = panel.locator(".job-detail-panel")
    await expect(detail).toBeVisible({ timeout: 20_000 })

    await detail.getByRole("button", { name: "预览" }).first().click({ force: true })
    const previewModal = page.locator(".ant-modal", { hasText: "附件预览" })
    await expect(previewModal).toBeVisible({ timeout: 20_000 })
    await previewModal.locator(".ant-modal-close").click({ force: true })
    await expect(previewModal).toBeHidden({ timeout: 20_000 })

    const beforeCenter = await readCameraCenter(page)
    const actions = detail.locator(".service-ref .service-actions")
    await expect(actions).toBeVisible({ timeout: 20_000 })
    await actions.getByRole("button", { name: "上图" }).click({ force: true })
    await expect(page.locator(".ant-message-notice-content").filter({ hasText: "已上图" }).first()).toBeVisible({ timeout: 20_000 })

    await expect
      .poll(async () => {
        return await page.evaluate(async (id: string) => {
          const base = location.pathname.startsWith("/mars3d") ? "/mars3d" : ""
          const mapWork: any = await (0, eval)(`import("${base}/src/widgets/basic/current-task/map.ts")`)
          return !!mapWork.getLayerById?.(id)
        }, seeded.thematicLayerId)
      }, { timeout: 20_000 })
      .toBe(true)

    await actions.getByRole("button", { name: "定位" }).click({ force: true })
    await expect
      .poll(async () => {
        const nextCenter = await readCameraCenter(page)
        return JSON.stringify(nextCenter)
      }, { timeout: 20_000 })
      .not.toBe(JSON.stringify(beforeCenter))

    await actions.getByRole("button", { name: "导出" }).click({ force: true })
    await expect
      .poll(async () => {
        return await page.evaluate(() => (window as any).__opened_urls || [])
      }, { timeout: 20_000 })
      .toContainEqual(expect.stringContaining("data:text/plain"))
  })
})
