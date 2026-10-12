import { expect, test } from "@playwright/test"

test("KSH-002: 清除导入内容仅删除选中分组（3-25）", async ({ page }) => {
  test.setTimeout(180_000)

  const datasetId = `e2e_clear_import_${Date.now()}`

  await page.addInitScript((id: string) => {
    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.removeItem("ksh002_drawer_folded_dataset-repository")
    localStorage.removeItem("ksh002_drawer_folded_my-repository")
    localStorage.removeItem("ksh002_drawer_folded_save-result")
    localStorage.removeItem("ksh002_drawer_folded_current-task")
    localStorage.setItem(
      "ksh002_current_dataset_v1",
      JSON.stringify({ datasetId: id, name: "3-25 清除导入专项", source: "repository", updatedAt: Date.now() })
    )
    sessionStorage.removeItem("mars_current_task_session_root_v1")
  }, datasetId)

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 60_000 })

  const currentTaskEntry = page.getByRole("button", { name: /【当前任务】/ })
  await expect(currentTaskEntry).toBeVisible({ timeout: 20_000 })
  await currentTaskEntry.click()
  const taskPopover = page.locator(".task-popover")
  await expect(taskPopover).toBeVisible({ timeout: 20_000 })

  const seeded = await page.evaluate(async (id: string) => {
    const base = location.pathname.startsWith("/mars3d") ? "/mars3d" : ""
    const mapWork: any = await (0, eval)(`import("${base}/src/widgets/basic/current-task/map.ts")`)
    const map = mapWork.getMap?.()
    if (!map) {
      throw new Error("map not ready")
    }

    const now = Date.now()
    const openedAtA = now
    const openedAtB = now + 1
    const groupAId = `eoapi_group_${id}_${openedAtA}`
    const groupBId = `eoapi_group_${id}_${openedAtB}`
    const layerAId = `eoapi_${id}_${openedAtA}_a`
    const layerBId = `eoapi_${id}_${openedAtB}_b`

    const manifest = {
      manifestVersion: "1.0",
      viewState: { bbox: [116.38, 39.90, 116.41, 39.93] },
      layers: [],
      drawFeatures: []
    }
    const featureA = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "batch-a" },
          geometry: {
            type: "Polygon",
            coordinates: [[
              [116.389, 39.905],
              [116.397, 39.905],
              [116.397, 39.912],
              [116.389, 39.912],
              [116.389, 39.905]
            ]]
          }
        }
      ]
    }
    const featureB = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "batch-b" },
          geometry: {
            type: "Polygon",
            coordinates: [[
              [116.400, 39.913],
              [116.408, 39.913],
              [116.408, 39.920],
              [116.400, 39.920],
              [116.400, 39.913]
            ]]
          }
        }
      ]
    }

    mapWork.ensureGroupLayer(groupAId, "导入: 第一批")
    mapWork.ensureGroupLayer(groupBId, "导入: 第二批")
    mapWork.addGeoJsonLayer(layerAId, featureA, { name: "批次一图层", pid: groupAId })
    mapWork.addGeoJsonLayer(layerBId, featureB, { name: "批次二图层", pid: groupBId })
    mapWork.persistSession({
      datasetId: id,
      groupId: groupAId,
      openedAt: openedAtA,
      source: "repository",
      groupName: "导入: 第一批",
      layerIdPrefix: `eoapi_${id}_${openedAtA}_`,
      manifest
    })
    mapWork.persistSession({
      datasetId: id,
      groupId: groupBId,
      openedAt: openedAtB,
      source: "repository",
      groupName: "导入: 第二批",
      layerIdPrefix: `eoapi_${id}_${openedAtB}_`,
      manifest
    })
    window.dispatchEvent(new CustomEvent("mars3d_layersChanged"))

    return { groupAId, groupBId, layerAId, layerBId }
  }, datasetId)

  await currentTaskEntry.click()
  await expect(taskPopover).toBeHidden({ timeout: 20_000 }).catch(() => {})

  await page.getByRole("button", { name: "图层", exact: true }).click({ force: true })
  const layerPanel = page.locator(".mars-dialog.manage-layer_pannel", { hasText: "图层" })
  await expect(layerPanel).toBeVisible({ timeout: 20_000 })

  await expect(layerPanel.getByRole("button", { name: "清除导入内容" })).toBeVisible({ timeout: 20_000 })
  await expect(layerPanel.locator(".layer-tree").getByText("导入: 第一批")).toBeVisible({ timeout: 20_000 })
  await expect(layerPanel.locator(".layer-tree").getByText("导入: 第二批")).toBeVisible({ timeout: 20_000 })

  await layerPanel.getByRole("button", { name: "清除导入内容" }).click()
  const menu = page.locator(".ant-dropdown-menu")
  await expect(menu).toBeVisible({ timeout: 10_000 })
  await expect(menu.getByText("第一批", { exact: true })).toBeVisible()
  await expect(menu.getByText("第二批", { exact: true })).toBeVisible()
  await menu.getByText("第一批", { exact: true }).click()

  await expect
    .poll(async () => {
      return await page.evaluate(async (input: { groupAId: string; groupBId: string; layerAId: string; layerBId: string }) => {
        const base = location.pathname.startsWith("/mars3d") ? "/mars3d" : ""
        const mapWork: any = await (0, eval)(`import("${base}/src/widgets/basic/current-task/map.ts")`)
        const raw = sessionStorage.getItem("mars_current_task_session_root_v1") || "[]"
        let sessions: any[] = []
        try {
          sessions = JSON.parse(raw)
        } catch {
          sessions = []
        }
        return {
          groupAExists: !!mapWork.getLayerById?.(input.groupAId),
          layerAExists: !!mapWork.getLayerById?.(input.layerAId),
          groupBExists: !!mapWork.getLayerById?.(input.groupBId),
          layerBExists: !!mapWork.getLayerById?.(input.layerBId),
          sessionGroups: sessions.map((item: any) => String(item?.groupId || "")).sort()
        }
      }, seeded)
    }, { timeout: 20_000 })
    .toEqual({
      groupAExists: false,
      layerAExists: false,
      groupBExists: true,
      layerBExists: true,
      sessionGroups: [seeded.groupBId]
    })

  await expect(layerPanel.locator(".layer-tree").getByText("导入: 第一批")).toHaveCount(0)
  await expect(layerPanel.locator(".layer-tree").getByText("导入: 第二批")).toBeVisible()
})
