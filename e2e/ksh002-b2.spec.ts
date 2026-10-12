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

async function acceptNextDialog(page: any) {
  page.once("dialog", async (dialog: any) => {
    await dialog.accept()
  })
}

test.skip(({ browserName }) => browserName !== "chromium", "requires Cesium/WebGL map runtime to import and undo")

test("KSH-002 B2: 导入使用（保存时/最新 + 撤销导入）", async ({ page }) => {
  await page.addInitScript(() => {
    const oldManifest = {
      manifestVersion: "1.0.0",
      viewState: {
        center: { longitude: 103.5, latitude: 35.5 },
        zoom: 6,
        bbox: [102.0, 34.0, 105.0, 37.0]
      },
      layers: [
        {
          id: "g_old",
          name: "历史组",
          sourceType: "group",
          sourceRef: "",
          visible: true,
          opacity: 1,
          order: 0
        },
        {
          id: "l_old_xyz",
          name: "历史光学影像",
          sourceType: "xyz",
          sourceRef: "https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}",
          pid: "g_old",
          visible: true,
          opacity: 1,
          order: 1
        },
        {
          id: "l_old_geojson",
          name: "历史矢量边界",
          sourceType: "geojson",
          sourceRef: "",
          data: { type: "FeatureCollection", features: [] },
          visible: true,
          opacity: 1,
          order: 2
        }
      ],
      drawFeatures: []
    }
    const latestManifest = {
      manifestVersion: "1.0.0",
      viewState: {
        center: { longitude: 104.2, latitude: 36.2 },
        zoom: 7,
        bbox: [103.0, 35.0, 105.5, 37.5]
      },
      layers: [
        {
          id: "g_latest",
          name: "最新组",
          sourceType: "group",
          sourceRef: "",
          visible: true,
          opacity: 1,
          order: 0
        },
        {
          id: "l_latest_xyz",
          name: "最新光学影像",
          sourceType: "xyz",
          sourceRef: "https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}",
          pid: "g_latest",
          visible: true,
          opacity: 1,
          order: 1
        }
      ],
      drawFeatures: []
    }

    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.removeItem("ksh002_dataset_metrics_v1")
    localStorage.setItem("TRAE_DEBUG_SERVER_URL", "http://127.0.0.1:17321/log")
    localStorage.setItem("TRAE_DEBUG_SESSION_ID", "ksh002-3x-highrisk")
    localStorage.setItem(
      "eoapi_manifests",
      JSON.stringify({
        local_import_test: {
          name: "本地导入测试",
          description: "用于验证导入弹窗与撤销导入",
          visibility: "private",
          createdAt: Date.now(),
          manifest: latestManifest,
          revisionManifests: {
            rev_001: oldManifest,
            rev_002: latestManifest
          },
          revisions: [
            {
              revisionId: "rev_001",
              message: "历史版本",
              createdAt: Date.now() - 10_000
            },
            {
              revisionId: "rev_002",
              message: "最新版本",
              createdAt: Date.now()
            }
          ]
        }
      })
    )
  })

  await page.goto("/")
  await page.getByRole("button", { name: "数据集仓库" }).click()

  const drawer = page.locator(".mars-dialog.ksh002-drawer", { hasText: "数据集仓库" })
  await expect(drawer).toBeVisible({ timeout: 20000 })

  await drawer.getByPlaceholder("搜索名称/描述").fill("本地导入测试")
  await page.waitForTimeout(500)
  const card = drawer.locator(".dataset-card", { hasText: "本地导入测试" }).first()
  await expect(card).toBeVisible({ timeout: 10000 })
  await card.click()

  await expect(drawer.getByRole("button", { name: "导入使用" })).toBeVisible()
  await drawer.getByRole("button", { name: "导入使用" }).click()

  const modal = page.getByRole("dialog", { name: "导入使用" })
  await expect(modal).toBeVisible()
  await report(page, "ksh002-b2.modal.visible", {
    dialogCount: await page.getByRole("dialog").count().catch(() => -1),
    antModalCount: await page.locator(".ant-modal").count().catch(() => -1),
    marsTaskModalCount: await page.locator(".task-popover").count().catch(() => -1),
    comboboxCount: await modal.getByRole("combobox").count().catch(() => -1)
  })

  await expect(modal.getByText("图层选择（可选）")).toBeVisible()
  const revisionSelection = modal
    .locator(".ant-form-item")
    .filter({ hasText: "版本选择" })
    .locator(".ant-select-selection-item")
    .first()
  await modal.locator(".ant-select-selector").first().click()
  await report(page, "ksh002-b2.revision.dropdown.open", {
    optionTexts: await page.getByRole("option").allInnerTexts().catch(() => []),
    selectorText: await revisionSelection.innerText().catch(() => "")
  })
  await page.locator(".ant-select-item-option-content", { hasText: "历史版本" }).click()
  await report(page, "ksh002-b2.revision.after-select", {
    selectorText: await revisionSelection.innerText().catch(() => ""),
    helpText: await modal
      .locator(".ant-form-item")
      .filter({ hasText: "版本选择" })
      .locator(".layer-pick-hint")
      .innerText()
      .catch(() => "")
  })
  await expect(revisionSelection).toContainText("历史版本")
  await expect(modal.locator(".ant-tree-treenode", { hasText: "历史矢量边界" })).toBeVisible()
  await modal.locator(".ant-tree-treenode", { hasText: "历史矢量边界" }).locator(".ant-tree-checkbox").click()
  await expect(modal.getByText("已选 1/2")).toBeVisible()

  await modal.getByRole("button", { name: "开始导入" }).click()

  // 等待导入成功提示（显示"导入成功"文本和"撤销导入"按钮）
  const importToast = drawer.locator(".import-toast")
  await expect(importToast.getByText(/导入成功/)).toBeVisible({ timeout: 20000 })
  await expect(importToast.locator(".toast-name")).toContainText("历史版本")

  const undo = drawer.getByRole("button", { name: "撤销导入" })
  await expect(undo).toBeVisible()
  await acceptNextDialog(page)
  await undo.click()
  await expect(undo).toBeHidden({ timeout: 20000 })

  await drawer.getByRole("button", { name: "导入使用" }).click()
  await expect(modal).toBeVisible()
  const latestModeRevisionSelection = modal
    .locator(".ant-form-item")
    .filter({ hasText: "版本选择" })
    .locator(".ant-select-selection-item")
    .first()
  await modal.locator(".ant-select-selector").first().click()
  await report(page, "ksh002-b2.latest.dropdown.open", {
    optionTexts: await page.getByRole("option").allInnerTexts().catch(() => [])
  })
  await page.locator(".ant-select-item-option-content", { hasText: "历史版本" }).click()
  await expect(latestModeRevisionSelection).toContainText("历史版本")
  await modal.getByText("使用最新数据", { exact: true }).click()
  await report(page, "ksh002-b2.latest.mode.enabled", {
    selectorText: await latestModeRevisionSelection.innerText().catch(() => ""),
    helpText: await modal
      .locator(".ant-form-item")
      .filter({ hasText: "版本选择" })
      .locator(".layer-pick-hint")
      .innerText()
      .catch(() => ""),
    disabledSelectCount: await modal.locator(".ant-select.ant-select-disabled").count().catch(() => -1)
  })
  await expect(modal.getByText("当前将导入最新版本：最新版本")).toBeVisible()
  await expect(modal.locator(".ant-select.ant-select-disabled")).toBeVisible()
  await expect(modal.locator(".ant-tree-treenode", { hasText: "最新光学影像" })).toBeVisible()
  await modal.getByRole("button", { name: "开始导入" }).click()

  await expect(importToast.getByText(/导入成功/)).toBeVisible({ timeout: 20000 })
  await expect(importToast.locator(".toast-name")).toContainText("最新版本")
  await expect(importToast).toContainText("1 图层")

  await acceptNextDialog(page)
  await undo.click()
  await expect(undo).toBeHidden({ timeout: 20000 })
})
