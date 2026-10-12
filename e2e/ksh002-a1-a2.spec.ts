import { expect, test } from "@playwright/test"
import { truncateSync, writeFileSync } from "node:fs"

test.use({ video: "on", screenshot: "on" })
test.skip(({ browserName }) => browserName !== "chromium", "requires Cesium/WebGL map runtime and complex widget interactions")

async function getPopoverContrastRatio(page: any) {
  return page.evaluate(() => {
    const popover = document.querySelector(".task-popover") as HTMLElement | null
    if (!popover) {
      return null
    }
    const popStyle = window.getComputedStyle(popover)
    const bodyStyle = window.getComputedStyle(document.body)

    const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
    const parse = (input: string) => {
      const s = String(input || "").trim().toLowerCase()
      const m = s.match(/^rgba?\((.+)\)$/)
      if (!m) { return null }
      const parts = m[1].split(",").map((x) => x.trim())
      if (parts.length < 3) { return null }
      const r = Number(parts[0])
      const g = Number(parts[1])
      const b = Number(parts[2])
      const a = parts.length >= 4 ? Number(parts[3]) : 1
      if (![r, g, b, a].every((n) => Number.isFinite(n))) { return null }
      return { r, g, b, a: clamp01(a) }
    }
    const blend = (over: any, under: any) => {
      const a = clamp01(over.a + under.a * (1 - over.a))
      if (a <= 0) { return { r: 0, g: 0, b: 0, a: 0 } }
      const r = Math.round((over.r * over.a + under.r * under.a * (1 - over.a)) / a)
      const g = Math.round((over.g * over.a + under.g * under.a * (1 - over.a)) / a)
      const b = Math.round((over.b * over.a + under.b * under.a * (1 - over.a)) / a)
      return { r, g, b, a }
    }
    const srgbToLinear = (c: number) => {
      const v = c / 255
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    const luminance = (c: any) => 0.2126 * srgbToLinear(c.r) + 0.7152 * srgbToLinear(c.g) + 0.0722 * srgbToLinear(c.b)
    const contrast = (a: any, b: any) => {
      const la = luminance(a)
      const lb = luminance(b)
      const hi = Math.max(la, lb)
      const lo = Math.min(la, lb)
      return (hi + 0.05) / (lo + 0.05)
    }

    const fg = parse(popStyle.color) || { r: 0, g: 0, b: 0, a: 1 }
    const bg = parse(popStyle.backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }
    const bodyBg = parse(bodyStyle.backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }
    const effectiveBg = bg.a < 1 ? blend(bg, bodyBg) : bg
    return {
      ratio: contrast(fg, effectiveBg),
      fg: popStyle.color,
      bg: popStyle.backgroundColor,
      bodyBg: bodyStyle.backgroundColor
    }
  })
}

async function getAchievementOrder(page: any) {
  return page.evaluate(() => {
    const titles = Array.from(document.querySelectorAll(".sidebar .group-title")) as HTMLElement[]
    const idx = titles.findIndex((el) => (el.textContent || "").trim() === "成果管理")
    if (idx === -1) {
      return null
    }
    const titleEl = titles[idx]
    const groupItems = titleEl.nextElementSibling as HTMLElement | null
    if (!groupItems || !groupItems.classList.contains("group-items")) {
      return null
    }
    const parts: string[] = []
    Array.from(groupItems.children).forEach((child) => {
      const el = child as HTMLElement
      if (el.classList.contains("menu-divider")) {
        parts.push("DIVIDER")
        return
      }
      if (el.classList.contains("menu-placeholder")) {
        parts.push("PLACEHOLDER")
        return
      }
      const directBtn = el.matches("button.menu-item") ? (el as HTMLButtonElement) : null
      const btn = directBtn || ((el.querySelector("button.menu-item") as HTMLButtonElement | null) ?? null)
      if (btn) {
        parts.push(btn.getAttribute("aria-label") || "")
      }
    })
    return parts
  })
}

async function setThemeMode(page: any, mode: "light" | "dark") {
  await page.addInitScript((m: "light" | "dark") => {
    try {
      localStorage.setItem("mars3d_theme_mode", m)
    } catch {
    }
  }, mode)
}

async function seedLocalDatasetForAudit(page: any, datasetId: string, datasetTitle: string) {
  await page.addInitScript(
    (args: { id: string; title: string }) => {
      const now = Date.now()
      const payload = {
        [args.id]: {
          name: args.title,
          description: "contrast-audit",
          visibility: "private",
          createdAt: now,
          updatedAt: now,
          revisions: [{ revisionId: `rev_${now}`, message: "本地版本", createdAt: now }],
          manifest: {
            manifestVersion: "1.0.0",
            viewState: {
              center: { longitude: 104.0, latitude: 36.0 },
              zoom: 6,
              bbox: [103.0, 35.0, 105.0, 37.0]
            },
            layers: [
              { id: "dir_vector", name: "矢量", sourceType: "group", sourceRef: "", visible: true, opacity: 1, order: 0 },
              { id: "dir_raster", name: "栅格", sourceType: "group", sourceRef: "", visible: true, opacity: 1, order: 1 },
              {
                id: "l_vector",
                name: "矢量边界",
                sourceType: "geojson",
                sourceRef: "",
                pid: "dir_vector",
                visible: true,
                opacity: 1,
                order: 2,
                data: { type: "FeatureCollection", features: [] }
              },
              {
                id: "l_raster",
                name: "光学影像",
                sourceType: "xyz",
                sourceRef: "https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}",
                pid: "dir_raster",
                visible: true,
                opacity: 1,
                order: 3
              }
            ],
            drawFeatures: []
          }
        }
      }
      localStorage.setItem("eoapi_manifests", JSON.stringify(payload))
      localStorage.removeItem("ksh002_current_task_dir_order_v1")
      localStorage.removeItem("ksh002_current_dataset_v1")
      localStorage.removeItem("ksh002_current_task_lock_v1")
      localStorage.setItem("sidebar_collapsed", "0")
      localStorage.removeItem("sidebar_active_tool")
    },
    { id: datasetId, title: datasetTitle }
  )
}

async function importLocalDatasetAndOpenTaskForAudit(page: any, datasetTitle: string) {
  await page.goto("/")
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 60_000 })

  await page.getByRole("button", { name: "数据集仓库" }).click()
  const repoDrawer = page.locator(".mars-dialog.ksh002-drawer", { hasText: "数据集仓库" })
  await expect(repoDrawer).toBeVisible({ timeout: 20_000 })

  await repoDrawer.getByPlaceholder("搜索名称/描述").fill(datasetTitle)
  const card = repoDrawer.locator(".dataset-card", { hasText: datasetTitle }).first()
  await expect(card).toBeVisible({ timeout: 20_000 })
  await card.click()

  const importBtn = repoDrawer.getByRole("button", { name: "导入使用" })
  await expect(importBtn).toBeEnabled({ timeout: 20_000 })
  await importBtn.click()

  const modal = page.getByRole("dialog", { name: "导入使用" })
  await expect(modal).toBeVisible({ timeout: 20_000 })
  await modal.getByRole("button", { name: "开始导入" }).click()
  const importToast = repoDrawer.locator(".import-toast")
  await expect(importToast.getByText(/导入成功/)).toBeVisible({ timeout: 20_000 })

  await repoDrawer.locator(".close-btn").first().click({ force: true }).catch(async () => {
    await page.keyboard.press("Escape").catch(() => {})
  })
  await expect(repoDrawer).toBeHidden({ timeout: 20_000 }).catch(() => {})

  const entry = page.getByRole("button", { name: /【当前任务】/ })
  await expect(entry).toBeVisible({ timeout: 20_000 })
  await entry.click({ force: true, position: { x: 20, y: 12 } })

  await activateWidgetForAudit(page, "current-task").catch(() => {})

  await page.evaluate(() => {
    ;(window as any).__e2e_widget_visible = (window as any).__e2e_widget_visible || {}
    window.addEventListener("mars3d:widget-visible", (e: any) => {
      try {
        const name = e?.detail?.name
        const visible = e?.detail?.visible
        ;(window as any).__e2e_widget_visible[name] = visible
      } catch {
      }
    })
  })
  await page.waitForFunction(() => (window as any).__e2e_widget_visible?.["current-task"] === true, null, { timeout: 10_000 }).catch(() => {})
  await page.evaluate(async () => {
    const root: any = document.querySelector("#app")
    const app: any = root?.__vue_app__
    const provides: any = app?._context?.provides
    if (!provides) {
      return
    }
    let store: any = null
    for (const k of Reflect.ownKeys(provides)) {
      const v: any = provides[k as any]
      if (v && typeof v === "object" && v.state && Array.isArray(v.state.widgets) && Array.isArray(v.state.openAtStart)) {
        store = v
        break
      }
    }
    if (!store) {
      return
    }
    const w: any = store.state.widgets.find((x: any) => x?.name === "current-task")
    const loader: any = w?.component?.__asyncLoader
    if (typeof loader !== "function") {
      return
    }
    await loader()
  }).catch(() => {})

  const popover = page.locator(".task-popover")
  if (!(await popover.isVisible())) {
    await activateWidgetForAudit(page, "current-task").catch(() => {})
    await entry.click({ force: true, position: { x: 20, y: 12 } })
  }
  await expect(popover).toBeVisible({ timeout: 60_000 })
  return { popover }
}

type ContrastIssue = {
  ratio: number
  required: number
  largeText: boolean
  text: string
  tag: string
  selector: string
  fg: string
  bg: string
  fontSize: string
  fontWeight: string
}

async function collectContrastIssues(
  page: any,
  options: {
    include: string[]
    exclude?: string[]
    limit?: number
  }
) {
  const issues: ContrastIssue[] = await page.evaluate((opts: any) => {
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
    const parse = (input: string) => {
      const s = String(input || "").trim().toLowerCase()
      const m = s.match(/^rgba?\((.+)\)$/)
      if (!m) { return null }
      const parts = m[1].split(",").map((x) => x.trim())
      if (parts.length < 3) { return null }
      const r = Number(parts[0])
      const g = Number(parts[1])
      const b = Number(parts[2])
      const a = parts.length >= 4 ? Number(parts[3]) : 1
      if (![r, g, b, a].every((n) => Number.isFinite(n))) { return null }
      return { r, g, b, a: clamp01(a) }
    }
    const blend = (over: any, under: any) => {
      const a = clamp01(over.a + under.a * (1 - over.a))
      if (a <= 0) { return { r: 0, g: 0, b: 0, a: 0 } }
      const r = (over.r * over.a + under.r * under.a * (1 - over.a)) / a
      const g = (over.g * over.a + under.g * under.a * (1 - over.a)) / a
      const b = (over.b * over.a + under.b * under.a * (1 - over.a)) / a
      return { r, g, b, a }
    }
    const srgbToLinear = (c: number) => {
      const v = c / 255
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    const luminance = (c: any) => 0.2126 * srgbToLinear(c.r) + 0.7152 * srgbToLinear(c.g) + 0.0722 * srgbToLinear(c.b)
    const contrast = (a: any, b: any) => {
      const la = luminance(a)
      const lb = luminance(b)
      const hi = Math.max(la, lb)
      const lo = Math.min(la, lb)
      return (hi + 0.05) / (lo + 0.05)
    }
    const isVisible = (el: Element) => {
      const style = window.getComputedStyle(el)
      if (style.visibility === "hidden" || style.display === "none") { return false }
      const op = Number(style.opacity || "1")
      if (!Number.isFinite(op) || op <= 0.01) { return false }
      const rect = (el as HTMLElement).getBoundingClientRect?.()
      if (!rect) { return false }
      if (rect.width < 2 || rect.height < 2) { return false }
      return true
    }
    const getBg = (el: Element) => {
      let cur: Element | null = el
      const bodyBg = parse(window.getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }
      let bg = { ...bodyBg }
      while (cur) {
        const s = window.getComputedStyle(cur)
        const c = parse(s.backgroundColor)
        if (c && c.a > 0) {
          bg = c.a < 1 ? blend(c, bg) : c
          if (bg.a >= 0.98) {
            return bg
          }
        }
        cur = cur.parentElement
      }
      return bg
    }
    const cssEscape = (v: string) => {
      try {
        return (window as any).CSS?.escape ? (window as any).CSS.escape(v) : v.replace(/[^a-zA-Z0-9_-]/g, "_")
      } catch {
        return v.replace(/[^a-zA-Z0-9_-]/g, "_")
      }
    }
    const buildSelector = (el: Element) => {
      const parts: string[] = []
      let cur: Element | null = el
      while (cur && parts.length < 5) {
        const tag = cur.tagName.toLowerCase()
        const id = (cur as HTMLElement).id
        if (id) {
          parts.unshift(`${tag}#${cssEscape(id)}`)
          break
        }
        const cls = (cur as HTMLElement).className
        const classToken = typeof cls === "string" && cls.trim() ? cls.trim().split(/\s+/).slice(0, 2).map(cssEscape).join(".") : ""
        parts.unshift(classToken ? `${tag}.${classToken}` : tag)
        cur = cur.parentElement
      }
      return parts.join(" > ")
    }

    const out: any[] = []
    const elements: Element[] = []
    const seenEl = new Set<Element>()
    const roots = (Array.isArray(opts?.include) ? opts.include : [])
      .map((s: any) => String(s || "").trim())
      .filter(Boolean)
    const excludes = (Array.isArray(opts?.exclude) ? opts.exclude : [])
      .map((s: any) => String(s || "").trim())
      .filter(Boolean)
    const limit = Number.isFinite(Number(opts?.limit)) ? Number(opts.limit) : 200

    const resolvedRoots = roots.length
      ? roots.flatMap((sel: string) => Array.from(document.querySelectorAll(sel)))
      : [document.documentElement]
    for (const r of resolvedRoots) {
      const list = [r, ...Array.from(r.querySelectorAll("*"))]
      for (const el of list) {
        if (!seenEl.has(el)) {
          seenEl.add(el)
          elements.push(el)
        }
      }
    }

    for (const node of elements) {
      const el = node as HTMLElement
      if (!el) { continue }
      if (el.closest("[aria-hidden='true']")) { continue }
      if (excludes.length && excludes.some((sel: string) => el.closest(sel))) { continue }
      const tag = el.tagName.toLowerCase()
      if (tag === "script" || tag === "style" || tag === "svg") { continue }
      if (!isVisible(el)) { continue }
      const text = (el.innerText || "").replace(/\s+/g, " ").trim()
      if (!text) { continue }
      if (text.length > 120) { continue }
      const style = window.getComputedStyle(el)
      const fg = parse(style.color)
      if (!fg || fg.a <= 0) { continue }
      const bg = getBg(el)
      const ratio = contrast(fg, bg)
      const fontSizePx = Number(String(style.fontSize || "").replace("px", ""))
      const fontWeight = Number(style.fontWeight || "400")
      const largeText = (Number.isFinite(fontSizePx) && fontSizePx >= 24) || (Number.isFinite(fontSizePx) && fontSizePx >= 18.66 && fontWeight >= 700)
      const required = largeText ? 3 : 4.5
      if (ratio + 1e-6 < required) {
        out.push({
          ratio,
          required,
          largeText,
          text,
          tag,
          selector: buildSelector(el),
          fg: style.color,
          bg: `rgba(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)}, ${Math.round(bg.a * 1000) / 1000})`,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight
        })
      }
    }

    out.sort((a, b) => a.ratio - b.ratio)
    return out.slice(0, Math.max(10, Math.min(2000, limit)))
  }, options)
  return issues
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

test("KSH-002 A1: 成果管理入口（空状态显示虚线占位）", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.removeItem("sidebar_active_tool")
    localStorage.removeItem("ksh002_current_dataset_v1")
  })
  await page.goto("/")
  await expect(page.getByText("成果管理")).toBeVisible()

  const order = await getAchievementOrder(page)

  expect(order).toEqual(["数据集仓库", "我的仓库", "PLACEHOLDER", "保存成果", "成果回放"])

  const before = await page.evaluate(() => localStorage.getItem("sidebar_active_tool"))
  await page.locator(".sidebar .menu-placeholder").first().click({ force: true })
  const after = await page.evaluate(() => localStorage.getItem("sidebar_active_tool"))
  expect(after).toBe(before)
})

test("KSH-002 A1: 成果管理入口（有当前数据集时显示按钮组件）", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.removeItem("sidebar_active_tool")
    localStorage.setItem(
      "ksh002_current_dataset_v1",
      JSON.stringify({ datasetId: "demo_dataset", name: "示范数据集", source: "repository", updatedAt: Date.now() })
    )
  })
  await page.goto("/")
  await expect(page.getByRole("button", { name: "【当前任务】示范数据集" })).toBeVisible()
  const order = await getAchievementOrder(page)
  expect(order).toEqual(["数据集仓库", "我的仓库", "DIVIDER", "【当前任务】示范数据集", "DIVIDER", "保存成果", "成果回放"])
})

test("KSH-002 A2: 右侧抽屉统一规范（宽度/互斥/收起展开）", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.removeItem("ksh002_drawer_folded_dataset-repository")
    localStorage.removeItem("ksh002_drawer_folded_my-repository")
    localStorage.removeItem("ksh002_drawer_folded_save-result")
    localStorage.removeItem("ksh002_drawer_folded_current-task")
    localStorage.removeItem("ksh002_current_dataset_v1")
  })
  await page.goto("/")
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 40000 })

  await page.getByRole("button", { name: "数据集仓库" }).click()
  const repo = page.locator(".mars-dialog.ksh002-drawer", { hasText: "数据集仓库" })
  await expect(repo).toBeVisible({ timeout: 20000 })

  await page.getByRole("button", { name: "我的仓库" }).click()
  await expect(repo).not.toBeVisible()
  const myRepo = page.locator(".mars-dialog.ksh002-drawer", { hasText: "我的仓库" })
  await expect(myRepo).toBeVisible({ timeout: 20000 })

  const box = await myRepo.boundingBox()
  expect(box).not.toBeNull()
  if (box) {
    expect(box.x + box.width).toBeGreaterThanOrEqual(1366 - 2)
    expect(box.width).toBeGreaterThan(300)
    expect(box.width).toBeLessThan(700)
  }

  await myRepo.locator(".ksh002-drawer-toggle").click()
  const thumb = page.locator(".mars-dialog-thumb").first()
  await expect(thumb).toBeVisible()

  await thumb.click()
  await expect(myRepo).toBeVisible()

  await page.locator(".sidebar .edge-handle").click()
  await expect(page.locator(".sidebar.collapsed")).toBeVisible()
  await expect(page.locator(".sidebar .menu-divider")).toHaveCount(0)
})

test("KSH-002 A3: 左侧【当前任务】点击可打开当前任务抽屉（无控制台错误/模块请求成功/桌面+移动）", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.removeItem("sidebar_active_tool")
    localStorage.setItem(
      "ksh002_current_dataset_v1",
      JSON.stringify({ datasetId: "demo_dataset", name: "示范数据集", source: "repository", updatedAt: Date.now() })
    )
  })

  const errors: string[] = []
  page.on("pageerror", (e) => {
    const text = String(e)
    if (text.includes("WebSocket closed without opened")) {
      return
    }
    errors.push(text)
  })
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text()
      if (
        text.includes("[vite] failed to connect to websocket") ||
        text.includes("WebSocket connection to") ||
        text.includes("WebSocket closed without opened") ||
        text.includes("Failed to load resource")
      ) {
        return
      }
      errors.push(text)
    }
  })

  const moduleResponses: Array<{ url: string; status: number }> = []
  page.on("response", (res) => {
    const url = res.url()
    if (url.includes("/src/widgets/basic/current-task/index.vue")) {
      moduleResponses.push({ url, status: res.status() })
    }
  })

  await page.goto("/")
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 40000 })

  const entry = page.getByRole("button", { name: "【当前任务】示范数据集" })
  await expect(entry).toBeVisible()
  await entry.click()

  const popover = page.locator(".task-popover")
  await expect(popover).toBeVisible({ timeout: 20000 })
  await expect(popover.getByText("当前任务")).toBeVisible()

  await expect(page.evaluate(() => localStorage.getItem("sidebar_active_tool"))).resolves.toBe("current-task")
  expect(moduleResponses.some((x) => x.status >= 200 && x.status < 400)).toBeTruthy()
  expect(errors).toEqual([])

  await entry.click()
  await expect(popover).toBeHidden({ timeout: 20000 })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole("button", { name: "【当前任务】示范数据集" }).click()
  await expect(popover).toBeVisible({ timeout: 20000 })
  expect(errors).toEqual([])
})

test("KSH-002 A4: 当前任务浮窗主题自适应（light）", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("mars3d_theme_mode", "light")
    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.removeItem("sidebar_active_tool")
    localStorage.setItem(
      "ksh002_current_dataset_v1",
      JSON.stringify({ datasetId: "demo_dataset", name: "示范数据集", source: "repository", updatedAt: Date.now() })
    )
  })
  await page.goto("/")
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 40000 })
  await page.getByRole("button", { name: "【当前任务】示范数据集" }).click()
  await expect(page.locator(".task-popover")).toBeVisible({ timeout: 20000 })
  const res = await getPopoverContrastRatio(page)
  expect(res).not.toBeNull()
  if (res) {
    expect(res.ratio).toBeGreaterThanOrEqual(4.5)
  }
})

test("KSH-002 A4: 当前任务浮窗主题自适应（dark）", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("mars3d_theme_mode", "dark")
    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.removeItem("sidebar_active_tool")
    localStorage.setItem(
      "ksh002_current_dataset_v1",
      JSON.stringify({ datasetId: "demo_dataset", name: "示范数据集", source: "repository", updatedAt: Date.now() })
    )
  })
  await page.goto("/")
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 40000 })
  await page.getByRole("button", { name: "【当前任务】示范数据集" }).click()
  await expect(page.locator(".task-popover")).toBeVisible({ timeout: 20000 })
  const res = await getPopoverContrastRatio(page)
  expect(res).not.toBeNull()
  if (res) {
    expect(res.ratio).toBeGreaterThanOrEqual(4.5)
  }
})

test("KSH-002 C1: 当前任务目录交互（导入后搜索高亮与重开）", async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1366, height: 1200 })
  await page.addInitScript(() => {
    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.removeItem("sidebar_active_tool")
    localStorage.removeItem("ksh002_current_task_lock_v1")
    localStorage.setItem("TRAE_DEBUG_SERVER_URL", "http://127.0.0.1:17323/log")
    localStorage.setItem("TRAE_DEBUG_SESSION_ID", "current-task-import")

    const datasetId = "local_task_tree"
    const now = Date.now()
    localStorage.setItem(
      "eoapi_manifests",
      JSON.stringify({
        [datasetId]: {
          name: "当前任务树测试",
          description: "用于验证当前任务目录交互",
          visibility: "private",
          createdAt: now,
          updatedAt: now,
          revisions: [{ revisionId: `rev_${now}`, message: "本地版本", createdAt: now }],
          manifest: {
            manifestVersion: "1.0.0",
            viewState: {
              center: { longitude: 104.0, latitude: 36.0 },
              zoom: 6,
              bbox: [103.0, 35.0, 105.0, 37.0]
            },
            layers: [
              { id: "dir_vector", name: "矢量", sourceType: "group", sourceRef: "", visible: true, opacity: 1, order: 0 },
              { id: "dir_raster", name: "栅格", sourceType: "group", sourceRef: "", visible: true, opacity: 1, order: 1 },
              { id: "l_vector", name: "矢量边界", sourceType: "geojson", sourceRef: "", pid: "dir_vector", visible: true, opacity: 1, order: 2, data: { type: "FeatureCollection", features: [] } },
              { id: "l_raster", name: "光学影像", sourceType: "xyz", sourceRef: "https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}", pid: "dir_raster", visible: true, opacity: 1, order: 3 }
            ],
            drawFeatures: []
          }
        }
      })
    )
  })

  await page.goto("/")
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 40000 })

  await page.getByRole("button", { name: "数据集仓库" }).click()
  const repoDrawer = page.locator(".mars-dialog.ksh002-drawer", { hasText: "数据集仓库" })
  await expect(repoDrawer).toBeVisible({ timeout: 20000 })

  await repoDrawer.getByPlaceholder("搜索名称/描述").fill("当前任务树测试")
  const card = repoDrawer.locator(".dataset-card", { hasText: "当前任务树测试" }).first()
  await expect(card).toBeVisible({ timeout: 20000 })
  await card.click()

  const importBtn = repoDrawer.getByRole("button", { name: "导入使用" })
  await expect(importBtn).toBeEnabled({ timeout: 30000 })
  await importBtn.click()
  const modal = page.getByRole("dialog", { name: "导入使用" })
  await expect(modal).toBeVisible({ timeout: 20000 })
  await modal.getByRole("button", { name: "开始导入" }).click()
  const importToast = repoDrawer.locator(".import-toast")
  await expect(importToast.getByText(/导入成功/)).toBeVisible({ timeout: 20000 })

  const entry = page.getByRole("button", { name: /【当前任务】/ })
  await expect(entry).toBeVisible({ timeout: 20000 })
  await entry.click()

  const popover = page.locator(".task-popover")
  await expect(popover).toBeVisible({ timeout: 20000 })
  await expect(popover.getByText("图层", { exact: false })).toBeVisible()

  await expect(popover.locator(".layers-tree .ant-tree-node-content-wrapper", { hasText: "矢量" }).first()).toBeVisible()
  await expect(popover.locator(".layers-tree .ant-tree-node-content-wrapper", { hasText: "栅格" }).first()).toBeVisible()

  const search = popover.locator('input[placeholder="搜索名称/标签"]')
  await expect(search).toBeVisible()
  await search.fill("光学")
  await expect(popover.locator(".node-highlight", { hasText: "光学" })).toBeVisible({ timeout: 20000 })

  await search.fill("")

  await entry.click()
  await expect(popover).toBeHidden({ timeout: 20000 })
  await entry.click()
  await expect(popover).toBeVisible({ timeout: 20000 })
  await expect(popover.locator(".layers-tree .ant-tree-node-content-wrapper", { hasText: "栅格" }).first()).toBeVisible()
})

test("KSH-003 D1: 交互基线（ESC 关闭顶层面板）", async ({ page }) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => {
    localStorage.setItem("sidebar_collapsed", "0")
    localStorage.removeItem("sidebar_active_tool")
  })
  await page.goto("/")
  await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 40000 })

  await page.getByRole("button", { name: "分屏对比" }).click()
  const split = page.locator(".mars-dialog", { hasText: "分屏对比" })
  await expect(split).toBeVisible({ timeout: 20000 })

  await page.keyboard.press("Escape")
  await expect(split).toBeHidden({ timeout: 20000 })
})

test.describe("Evidence 0516", () => {
  async function seedLocalDataset(page: any, datasetId: string) {
    await page.addInitScript((id: string) => {
      const now = Date.now()
      const payload = {
        [id]: {
          name: "当前任务树测试",
          description: "用于验收 3-27/3-28/3-30/3-33",
          visibility: "private",
          createdAt: now,
          updatedAt: now,
          revisions: [{ revisionId: `rev_${now}`, message: "本地版本", createdAt: now }],
          manifest: {
            manifestVersion: "1.0.0",
            viewState: {
              center: { longitude: 104.0, latitude: 36.0 },
              zoom: 6,
              bbox: [103.0, 35.0, 105.0, 37.0]
            },
            layers: [
              { id: "dir_vector", name: "矢量", sourceType: "group", sourceRef: "", visible: true, opacity: 1, order: 0 },
              { id: "dir_raster", name: "栅格", sourceType: "group", sourceRef: "", visible: true, opacity: 1, order: 1 },
              {
                id: "l_vector",
                name: "矢量边界",
                sourceType: "geojson",
                sourceRef: "",
                pid: "dir_vector",
                visible: true,
                opacity: 1,
                order: 2,
                data: { type: "FeatureCollection", features: [] }
              },
              {
                id: "l_raster",
                name: "光学影像",
                sourceType: "xyz",
                sourceRef: "https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}",
                pid: "dir_raster",
                visible: true,
                opacity: 1,
                order: 3
              }
            ],
            drawFeatures: []
          }
        }
      }
      localStorage.setItem("eoapi_manifests", JSON.stringify(payload))
      localStorage.removeItem("ksh002_current_task_dir_order_v1")
      localStorage.removeItem("ksh002_current_dataset_v1")
      localStorage.removeItem("ksh002_current_task_lock_v1")
      localStorage.setItem("sidebar_collapsed", "0")
      localStorage.removeItem("sidebar_active_tool")
    }, datasetId)
  }

  async function importLocalDatasetAndOpenTask(page: any, datasetTitle = "当前任务树测试") {
    await page.goto("/")
    await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 40000 })

    await page.getByRole("button", { name: "数据集仓库" }).click()
    const repoDrawer = page.locator(".mars-dialog.ksh002-drawer", { hasText: "数据集仓库" })
    await expect(repoDrawer).toBeVisible({ timeout: 20000 })

    await repoDrawer.getByPlaceholder("搜索名称/描述").fill(datasetTitle)
    const card = repoDrawer.locator(".dataset-card", { hasText: datasetTitle }).first()
    await expect(card).toBeVisible({ timeout: 20000 })
    await card.click()

    const importBtn = repoDrawer.getByRole("button", { name: "导入使用" })
    await expect(importBtn).toBeEnabled({ timeout: 20000 })
    await importBtn.click()

    const modal = page.getByRole("dialog", { name: "导入使用" })
    await expect(modal).toBeVisible({ timeout: 20000 })
    await modal.getByRole("button", { name: "开始导入" }).click()
    const importToast = repoDrawer.locator(".import-toast")
    await expect(importToast.getByText(/导入成功/)).toBeVisible({ timeout: 20000 })

    const entry = page.getByRole("button", { name: /【当前任务】/ })
    await expect(entry).toBeVisible({ timeout: 20000 })
    await entry.click()

    const popover = page.locator(".task-popover")
    await expect(popover).toBeVisible({ timeout: 20000 })
    await expect(popover.getByText("图层", { exact: false })).toBeVisible()
    return { repoDrawer, popover, entry }
  }

  test("3-27 目录拖拽排序（视频/截图）", async ({ page }, testInfo) => {
    const datasetId = `local_evidence_${Date.now()}`
    await seedLocalDataset(page, datasetId)
    const { popover, entry } = await importLocalDatasetAndOpenTask(page)

    await expect(popover.locator(".ant-tree-treenode", { hasText: "矢量" }).first()).toBeVisible()
    await expect(popover.locator(".ant-tree-treenode", { hasText: "栅格" }).first()).toBeVisible()

    const before = testInfo.outputPath("3-27_before_drag.png")
    await page.screenshot({ path: before, fullPage: true })
    await testInfo.attach("3-27_before_drag", { path: before, contentType: "image/png" })

    await page.evaluate(() => {
      const root = document.querySelector(".task-popover .layers-tree") as HTMLElement | null
      if (!root) { return }
      const nodes = Array.from(root.querySelectorAll(".ant-tree-treenode")) as HTMLElement[]
      const pickNode = (name: string) => {
        for (const n of nodes) {
          const title = n.querySelector(".node-title") as HTMLElement | null
          if (title && (title.textContent || "").trim() === name) {
            return n
          }
        }
        return null
      }
      const srcNode = pickNode("栅格")
      const dstNode = pickNode("矢量")
      if (!srcNode || !dstNode) { return }
      const src = (srcNode.querySelector('[draggable="true"]') as HTMLElement | null) || (srcNode.querySelector(".ant-tree-node-content-wrapper") as HTMLElement | null) || srcNode
      const dst = (dstNode.querySelector(".ant-tree-node-content-wrapper") as HTMLElement | null) || dstNode
      const dt = new DataTransfer()
      src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }))
      dst.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dt }))
      dst.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }))
      dst.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }))
      src.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: dt }))
    })
    await page.waitForTimeout(800)
    const state = await page.evaluate(() => localStorage.getItem("ksh002_current_task_dir_order_v1") || "")
    await testInfo.attach("3-27_dir_order_state", { body: state || "(empty)", contentType: "text/plain" })

    const shot1 = testInfo.outputPath("3-27_after_drag.png")
    await page.screenshot({ path: shot1, fullPage: true })
    await testInfo.attach("3-27_after_drag", { path: shot1, contentType: "image/png" })

    await entry.click()
    await expect(popover).toBeHidden({ timeout: 20000 })
    await entry.click()
    await expect(popover).toBeVisible({ timeout: 20000 })

    const shot2 = testInfo.outputPath("3-27_after_reopen.png")
    await page.screenshot({ path: shot2, fullPage: true })
    await testInfo.attach("3-27_after_reopen", { path: shot2, contentType: "image/png" })
  })

  test("3-28 目录搜索高亮（视频/截图）", async ({ page }, testInfo) => {
    const datasetId = `local_evidence_${Date.now()}`
    await seedLocalDataset(page, datasetId)
    const { popover } = await importLocalDatasetAndOpenTask(page)

    const search = popover.locator('input[placeholder="搜索名称/标签"]')
    await expect(search).toBeVisible()
    await search.fill("光学")
    await expect(popover.locator(".node-highlight", { hasText: "光学" })).toBeVisible({ timeout: 20000 })

    const shot = testInfo.outputPath("3-28_search_highlight.png")
    await page.screenshot({ path: shot, fullPage: true })
    await testInfo.attach("3-28_search_highlight", { path: shot, contentType: "image/png" })
  })

  test("3-30 批量显隐控制（视频/截图）", async ({ page }, testInfo) => {
    const datasetId = `local_evidence_${Date.now()}`
    await seedLocalDataset(page, datasetId)
    const { popover } = await importLocalDatasetAndOpenTask(page)

    const layerNode = popover.locator(".layers-tree .ant-tree-title", { hasText: "光学影像" }).first()
    await expect(layerNode).toBeVisible({ timeout: 20000 })
    await layerNode.hover()
    await expect(popover.getByRole("button", { name: "隐藏", exact: true })).toBeVisible({ timeout: 20000 })

    const groupBox = popover.locator(".ant-tree-treenode", { hasText: "栅格" }).locator(".ant-tree-checkbox").first()
    await groupBox.click({ force: true })

    await layerNode.hover()
    await expect(popover.getByRole("button", { name: "显示", exact: true })).toBeVisible({ timeout: 20000 })

    const shot = testInfo.outputPath("3-30_batch_visibility.png")
    await page.screenshot({ path: shot, fullPage: true })
    await testInfo.attach("3-30_batch_visibility", { path: shot, contentType: "image/png" })
  })

  test("3-33 目录锁定（只读）生效（视频/截图）", async ({ page }, testInfo) => {
    const datasetId = `local_evidence_${Date.now()}`
    await seedLocalDataset(page, datasetId)
    const { popover } = await importLocalDatasetAndOpenTask(page)

    await expect(popover.getByText("只读：关")).toBeVisible()
    await popover.getByText("只读：关").click({ force: true })
    await expect(popover.getByText("只读：开")).toBeVisible({ timeout: 20000 })

    const groupNode = popover.locator(".ant-tree-treenode", { hasText: "栅格" }).first()
    await groupNode.evaluate((el: any) => el.scrollIntoView({ block: "center", inline: "center" }))
    const groupBox = groupNode.locator(".ant-tree-checkbox").first()
    await groupBox.click({ force: true, position: { x: 6, y: 6 } })
    await expect(page.locator(".ant-message-notice-content")).toContainText("已禁用", { timeout: 20000 })

    const shot = testInfo.outputPath("3-33_lock_effect.png")
    await page.screenshot({ path: shot, fullPage: true })
    await testInfo.attach("3-33_lock_effect", { path: shot, contentType: "image/png" })
  })

  test("4-1 基础工具入口（左侧 + 右键菜单）（视频/截图）", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.setItem("sidebar_collapsed", "0")
      localStorage.removeItem("sidebar_active_tool")
    })
    await page.goto("/")
    await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 40000 })

    await expect(page.getByRole("button", { name: "分屏对比" })).toBeVisible()
    await expect(page.getByRole("button", { name: "时间轴演化" })).toBeVisible()
    const shot1 = testInfo.outputPath("4-1_sidebar_entries.png")
    await page.screenshot({ path: shot1, fullPage: true })
    await testInfo.attach("4-1_sidebar_entries", { path: shot1, contentType: "image/png" })

    const canvas = page.locator(".mars3d-container").first()
    await expect(canvas).toBeVisible({ timeout: 20000 })

    await canvas.click({ position: { x: 560, y: 360 }, button: "right" })
    const menu = page.locator(".mars3d-contextmenu-ul").first()
    await expect(menu).toBeVisible({ timeout: 20000 })
    const drawLink = menu.getByRole("link", { name: /绘制/ }).first()
    await drawLink.hover()
    await page.locator(".mars3d-sub-menu").getByRole("link", { name: /绘制面/ }).first().click()

    await canvas.click({ position: { x: 520, y: 320 } })
    await canvas.click({ position: { x: 640, y: 320 } })
    await canvas.dblclick({ position: { x: 600, y: 420 } })

    await canvas.click({ position: { x: 600, y: 360 }, button: "right" })
    await expect(page.locator(".mars3d-contextmenu-ul").locator("li", { hasText: "空间分析" })).toBeVisible({ timeout: 20000 })
    await expect(page.locator(".mars3d-contextmenu-ul").locator("li", { hasText: "查看统计" })).toBeVisible({ timeout: 20000 })

    const shot2 = testInfo.outputPath("4-1_context_menu_entries.png")
    await page.screenshot({ path: shot2, fullPage: true })
    await testInfo.attach("4-1_context_menu_entries", { path: shot2, contentType: "image/png" })
  })

  test("4-2 交互基线（ESC/置顶/拖拽缩放/记忆）（视频/截图）", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.setItem("sidebar_collapsed", "0")
      localStorage.removeItem("sidebar_active_tool")
    })
    await page.goto("/")
    await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 40000 })

    await page.getByRole("button", { name: "分屏对比" }).click()
    const split = page.locator(".mars-dialog.split-compare-panel")
    await expect(split).toBeVisible({ timeout: 20000 })

    const box1 = await split.boundingBox()
    expect(box1).not.toBeNull()

    await split.locator(".mars-dialog__header").first().dragTo(page.locator("body"), { targetPosition: { x: 900, y: 140 } })
    await split.locator(".handle-rb").first().dragTo(page.locator("body"), { targetPosition: { x: 1080, y: 600 } })

    const shot1 = testInfo.outputPath("4-2_after_drag_resize.png")
    await page.screenshot({ path: shot1, fullPage: true })
    await testInfo.attach("4-2_after_drag_resize", { path: shot1, contentType: "image/png" })

    await page.keyboard.press("Escape")
    await expect(split).toBeHidden({ timeout: 20000 })

    await page.reload()
    await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 40000 })
    await page.getByRole("button", { name: "分屏对比" }).click()
    await expect(split).toBeVisible({ timeout: 20000 })

    const box2 = await split.boundingBox()
    expect(box2).not.toBeNull()

    const shot2 = testInfo.outputPath("4-2_after_reload_persisted.png")
    await page.screenshot({ path: shot2, fullPage: true })
    await testInfo.attach("4-2_after_reload_persisted", { path: shot2, contentType: "image/png" })

    if (box1 && box2) {
      expect(Math.abs(box2.x - box1.x) + Math.abs(box2.y - box1.y)).toBeGreaterThan(5)
    }
  })
})

test.describe("Evidence 0517", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err: any) => {
      console.log("[pageerror]", err?.message || String(err))
    })
    page.on("console", (msg: any) => {
      if (msg.type?.() === "error") {
        try {
          const loc = msg.location?.()
          const where = loc?.url ? ` ${loc.url}:${loc.lineNumber}:${loc.columnNumber}` : ""
          console.log("[console.error]", (msg.text?.() || "") + where)
        } catch {
          console.log("[console.error]", msg.text?.() || "")
        }
      }
    })
    page.on("response", (res: any) => {
      try {
        const status = res.status?.()
        const url = res.url?.() || ""
        if (status >= 400 && (url.includes(".js") || url.includes(".css") || url.includes("@vite"))) {
          console.log("[response]", status, url)
        }
      } catch {
      }
    })
  })

  async function seedLocalDataset(page: any, datasetId: string) {
    await page.addInitScript((id: string) => {
      const now = Date.now()
      const payload = {
        [id]: {
          name: "本地验收数据集",
          description: "用于验收 3-29/3-31/3-38/3-39/3-41/3-42",
          visibility: "private",
          createdAt: now,
          updatedAt: now,
          revisions: [
            { revisionId: `rev_${now - 2 * 24 * 3600 * 1000}`, message: "版本-1", createdAt: now - 2 * 24 * 3600 * 1000 },
            { revisionId: `rev_${now - 1 * 24 * 3600 * 1000}`, message: "版本-2", createdAt: now - 1 * 24 * 3600 * 1000 },
            { revisionId: `rev_${now}`, message: "版本-3", createdAt: now }
          ],
          manifest: {
            manifestVersion: "1.0.0",
            viewState: {
              center: { longitude: 104.0, latitude: 36.0 },
              zoom: 6,
              bbox: [103.0, 35.0, 105.0, 37.0]
            },
            layers: [
              { id: "dir_vector", name: "矢量", sourceType: "group", sourceRef: "", visible: true, opacity: 1, order: 0 },
              { id: "dir_raster", name: "栅格", sourceType: "group", sourceRef: "", visible: true, opacity: 1, order: 1 },
              {
                id: "l_vector",
                name: "矢量边界",
                sourceType: "geojson",
                sourceRef: "",
                pid: "dir_vector",
                visible: true,
                opacity: 1,
                order: 2,
                data: { type: "FeatureCollection", features: [] }
              },
              {
                id: "l_raster",
                name: "光学影像",
                sourceType: "xyz",
                sourceRef: "https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}",
                pid: "dir_raster",
                visible: true,
                opacity: 1,
                order: 3
              }
            ],
            drawFeatures: []
          }
        }
      }
      localStorage.setItem("eoapi_manifests", JSON.stringify(payload))
      localStorage.removeItem("ksh002_current_task_dir_order_v1")
      localStorage.removeItem("ksh002_current_dataset_v1")
      localStorage.removeItem("ksh002_current_task_lock_v1")
      localStorage.removeItem("eoapi_local_artifacts_v1")
      localStorage.removeItem("mars3d_result_playback_records_v1")
      localStorage.setItem("sidebar_collapsed", "0")
      localStorage.removeItem("sidebar_active_tool")
    }, datasetId)
  }

  async function importLocalDatasetAndOpenTask(page: any, datasetTitle = "本地验收数据集") {
    await page.goto("/")
    await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 40000 })
    await page.evaluate(() => {
      ;(window as any).__e2e_widget_visible = (window as any).__e2e_widget_visible || {}
      window.addEventListener("mars3d:widget-visible", (e: any) => {
        try {
          const name = e?.detail?.name
          const visible = e?.detail?.visible
          ;(window as any).__e2e_widget_visible[name] = visible
        } catch {
        }
      })
    })

    await page.getByRole("button", { name: "数据集仓库" }).click()
    const repoDrawer = page.locator(".mars-dialog.ksh002-drawer", { hasText: "数据集仓库" })
    await expect(repoDrawer).toBeVisible({ timeout: 20000 })

    await repoDrawer.getByPlaceholder("搜索名称/描述").fill(datasetTitle)
    const card = repoDrawer.locator(".dataset-card", { hasText: datasetTitle }).first()
    await expect(card).toBeVisible({ timeout: 20000 })
    await card.click()

    const importBtn = repoDrawer.getByRole("button", { name: "导入使用" })
    await expect(importBtn).toBeEnabled({ timeout: 20000 })
    await importBtn.click()

    const modal = page.getByRole("dialog", { name: "导入使用" })
    await expect(modal).toBeVisible({ timeout: 20000 })
    await modal.getByRole("button", { name: "开始导入" }).click()
    const importToast = repoDrawer.locator(".import-toast")
    await expect(importToast.getByText(/导入成功/)).toBeVisible({ timeout: 20000 })

    const entry = page.getByRole("button", { name: /【当前任务】/ })
    await expect(entry).toBeVisible({ timeout: 20000 })
    await entry.scrollIntoViewIfNeeded()
    await entry.click({ force: true, position: { x: 20, y: 12 } })
    await page.waitForFunction(() => (window as any).__e2e_widget_visible?.["current-task"] === true, null, { timeout: 10000 }).catch(() => {})
    const currentTaskVisible = await page.evaluate(() => (window as any).__e2e_widget_visible?.["current-task"])
    console.log("[e2e] current-task visible:", currentTaskVisible)
    const hasTaskApi = await page.evaluate(() => !!(window as any).__mars_current_task)
    console.log("[e2e] __mars_current_task exists:", hasTaskApi)
    const widgetSnapshot = await page.evaluate(() => {
      const root: any = document.querySelector("#app")
      const app: any = root?.__vue_app__
      const provides: any = app?._context?.provides
      const out: any = {
        hasApp: !!app,
        providesKeys: provides ? Reflect.ownKeys(provides).length : 0,
        openAtStart: null as any,
        widgets: null as any,
        dom: {
          marsWidgetTags: document.querySelectorAll("mars-widget").length,
          taskPopoverCount: document.querySelectorAll(".task-popover").length
        }
      }
      if (!provides) {
        return out
      }
      for (const k of Reflect.ownKeys(provides)) {
        const v: any = provides[k as any]
        if (v && typeof v === "object" && v.state && Array.isArray(v.state.widgets) && Array.isArray(v.state.openAtStart)) {
          out.openAtStart = v.state.openAtStart.slice()
          out.widgets = v.state.widgets.map((w: any) => ({ name: w?.name, visible: w?.visible }))
          break
        }
      }
      return out
    })
    console.log("[e2e] widget snapshot:", JSON.stringify(widgetSnapshot))
    const asyncLoaderState = await page.evaluate(async () => {
      const root: any = document.querySelector("#app")
      const app: any = root?.__vue_app__
      const provides: any = app?._context?.provides
      if (!provides) {
        return { ok: false, reason: "no-provides" }
      }
      let store: any = null
      for (const k of Reflect.ownKeys(provides)) {
        const v: any = provides[k as any]
        if (v && typeof v === "object" && v.state && Array.isArray(v.state.widgets)) {
          store = v
          break
        }
      }
      if (!store) {
        return { ok: false, reason: "no-store" }
      }
      const w: any = store.state.widgets.find((x: any) => x?.name === "current-task")
      const loader: any = w?.component?.__asyncLoader
      if (typeof loader !== "function") {
        return { ok: false, reason: "no-async-loader" }
      }
      try {
        await loader()
        return { ok: true }
      } catch (e: any) {
        return { ok: false, reason: e?.message || String(e) }
      }
    })
    console.log("[e2e] current-task async loader:", JSON.stringify(asyncLoaderState))

    const popover = page.locator(".task-popover")
    if (!(await popover.isVisible())) {
      await entry.click({ force: true, position: { x: 20, y: 12 } })
    }
    await expect(popover).toBeVisible({ timeout: 60000 })
    await expect(popover.getByText("图层", { exact: false })).toBeVisible()
    return { popover, entry }
  }

  test("3-29 点击目录图层联动定位+闪烁（视频/截图）", async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    const datasetId = `local_evidence_${Date.now()}`
    await seedLocalDataset(page, datasetId)
    const { popover } = await importLocalDatasetAndOpenTask(page)

    const node = popover.locator(".layers-tree .node-title", { hasText: "光学影像" }).first()
    await expect(node).toBeVisible({ timeout: 20000 })
    await node.scrollIntoViewIfNeeded()
    await node.click({ force: true, position: { x: 10, y: 10 } })
    await page.waitForTimeout(900)

    const shot = testInfo.outputPath("3-29_click_flash_fly.png")
    await page.screenshot({ path: shot, fullPage: true })
    await testInfo.attach("3-29_click_flash_fly", { path: shot, contentType: "image/png" })
  })

  test("3-31 专题图：预览/上图/定位/导出（视频/截图）", async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    const datasetId = `local_evidence_${Date.now()}`
    await seedLocalDataset(page, datasetId)
    const { popover } = await importLocalDatasetAndOpenTask(page)

    const layersRow = popover.getByRole("button", { name: /图层/ }).first()
    const layersCaret = layersRow.locator(".tree-caret")
    if ((await layersCaret.getAttribute("class"))?.includes("open")) {
      await layersRow.click({ force: true, position: { x: 20, y: 12 } })
    }
    const thematicsBtn = popover.getByRole("button", { name: /专题图/ })
    await thematicsBtn.scrollIntoViewIfNeeded()
    await thematicsBtn.click({ force: true, position: { x: 20, y: 12 } })
    const panel = popover.locator(".thematics-panel")
    await expect(panel).toBeAttached({ timeout: 20000 })
    await panel.scrollIntoViewIfNeeded()

    const jobItem = panel.locator(".job-item").first()
    await expect(jobItem).toBeAttached({ timeout: 20000 })
    await jobItem.evaluate((el: any) => {
      try {
        ;(el as HTMLElement).click()
      } catch {
      }
    })
    const detail = panel.locator(".job-detail-panel")
    await expect(detail).toBeAttached({ timeout: 20000 })

    await detail.getByRole("button", { name: "预览" }).first().click()
    const previewModal = page.locator(".ant-modal", { hasText: "附件预览" })
    await expect(previewModal).toBeVisible({ timeout: 20000 })
    const shot1 = testInfo.outputPath("3-31_preview.png")
    await page.screenshot({ path: shot1, fullPage: true })
    await testInfo.attach("3-31_preview", { path: shot1, contentType: "image/png" })
    await previewModal.locator(".ant-modal-close").click({ force: true })
    await expect(previewModal).toBeHidden({ timeout: 20000 })

    const actions = detail.locator(".service-ref .service-actions")
    await expect(actions).toBeVisible({ timeout: 20000 })
    await actions.getByRole("button", { name: "上图" }).click()
    await actions.getByRole("button", { name: "定位" }).click()
    await actions.getByRole("button", { name: "导出" }).click()
    await page.waitForTimeout(500)

    const shot2 = testInfo.outputPath("3-31_add_locate_export.png")
    await page.screenshot({ path: shot2, fullPage: true })
    await testInfo.attach("3-31_add_locate_export", { path: shot2, contentType: "image/png" })
  })

  test("3-38/3-42 附件分类上传（含≥50MB分支）（视频/截图）", async ({ page }, testInfo) => {
    test.setTimeout(180_000)
    const datasetId = `local_evidence_${Date.now()}`
    await seedLocalDataset(page, datasetId)
    const { popover } = await importLocalDatasetAndOpenTask(page)

    const layersRow = popover.getByRole("button", { name: /图层/ }).first()
    const layersCaret = layersRow.locator(".tree-caret")
    if ((await layersCaret.getAttribute("class"))?.includes("open")) {
      await layersRow.click({ force: true, position: { x: 20, y: 12 } })
    }
    const artifactsBtn = popover.getByRole("button", { name: /附件/ })
    await artifactsBtn.scrollIntoViewIfNeeded()
    await artifactsBtn.click({ force: true, position: { x: 20, y: 12 } })
    const panel = popover.locator(".artifacts")
    await expect(panel).toBeVisible({ timeout: 20000 })

    const typeSelect = panel.locator(".artifacts-header .ant-select").nth(0)
    const filterSelect = panel.locator(".artifacts-header .ant-select").nth(1)
    const input = panel.locator(".ant-upload input[type=file]").first()

    const uploadAs = async (typeLabel: string, name: string, mimeType: string, size: number) => {
      await typeSelect.click({ force: true })
      await page.locator(".ant-select-dropdown:visible").getByText(typeLabel, { exact: true }).click({ force: true })
      if (size > 50 * 1024 * 1024) {
        const filePath = testInfo.outputPath(name)
        writeFileSync(filePath, "")
        truncateSync(filePath, size)
        await input.setInputFiles(filePath)
      } else {
        const buf = Buffer.alloc(size)
        await input.setInputFiles({ name, mimeType, buffer: buf })
      }
      await expect(page.locator(".ant-message-notice-content").filter({ hasText: "上传成功" }).first()).toBeVisible({ timeout: 60000 })
    }

    await uploadAs("封面", "cover.png", "image/png", 8 * 1024)
    await uploadAs("报告", "report.html", "text/html", 4 * 1024)
    await uploadAs("导出", "export.txt", "text/plain", 2 * 1024)
    await uploadAs("日志", "log.txt", "text/plain", 2 * 1024)
    await uploadAs("其他", "other.bin", "application/octet-stream", 2 * 1024)
    await uploadAs("数据", "big.bin", "application/octet-stream", 51 * 1024 * 1024)

    await filterSelect.click({ force: true })
    await page.locator(".ant-select-dropdown:visible").getByText("封面", { exact: true }).click({ force: true })
    await expect(panel.locator(".ant-list-item")).toHaveCount(1, { timeout: 20000 })
    await expect(panel.locator(".ant-list-item")).toContainText("封面截图")

    await filterSelect.click({ force: true })
    await page.locator(".ant-select-dropdown:visible").getByText("数据", { exact: true }).click({ force: true })
    await expect(panel.locator(".ant-list-item")).toHaveCount(1, { timeout: 20000 })
    await expect(panel.locator(".ant-list-item")).toContainText("数据文件")

    const shot = testInfo.outputPath("3-42_artifacts_types.png")
    await page.screenshot({ path: shot, fullPage: true })
    await testInfo.attach("3-42_artifacts_types", { path: shot, contentType: "image/png" })
  })

  test("3-39 断网草稿：保存失败→恢复→重提交（视频/截图）", async ({ page }, testInfo) => {
    test.setTimeout(220_000)
    const datasetId = `local_evidence_${Date.now()}`
    await seedLocalDataset(page, datasetId)
    const { popover } = await importLocalDatasetAndOpenTask(page)
    console.log("[e2e][3-39] task opened")

    await expect(popover.locator(".layers-tree")).toBeVisible({ timeout: 40000 })
    await popover.getByRole("button", { name: "提交发布" }).click({ force: true })
    const modal = page.locator(".ksh002-save-manifest-modal .ant-modal")
    await expect(modal).toBeVisible({ timeout: 20000 })
    await modal.getByPlaceholder("请输入成果名称").fill(`发布草稿-${Date.now()}`)
    console.log("[e2e][3-39] submit modal opened")

    const submitOk = { value: false }
    const remoteDatasetId = `ds_${Date.now()}`
    const remoteRevisionId = `rev_${Date.now()}`
    await page.route("**/api/eoapi/datasets", async (route: any) => {
      const req = route.request()
      if (req.method() !== "POST") {
        return route.continue()
      }
      if (!submitOk.value) {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "offline" })
        })
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ datasetId: remoteDatasetId, createdAt: Date.now() })
      })
    })
    await page.route(/.*\/api\/eoapi\/datasets\/[^/]+\/revisions$/, async (route: any) => {
      const req = route.request()
      if (req.method() !== "POST") {
        return route.continue()
      }
      if (!submitOk.value) {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "offline" })
        })
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ revisionId: remoteRevisionId, createdAt: Date.now() })
      })
    })
    await page.route(/.*\/api\/datasets\/[^/]+\/publish-request$/, async (route: any) => {
      const req = route.request()
      if (req.method() !== "POST") {
        return route.continue()
      }
      if (!submitOk.value) {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "offline" })
        })
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true })
      })
    })

    await modal.getByRole("button", { name: "提交发布" }).click()
    await expect(modal.getByRole("button", { name: "确认提交发布" })).toBeVisible({ timeout: 20000 })
    await modal.getByRole("button", { name: "确认提交发布" }).click()
    await expect(page.locator(".ant-message-notice-content")).toContainText("已保存草稿", { timeout: 20000 })
    console.log("[e2e][3-39] draft saved")
    console.log(
      "[e2e][3-39] draft ls exists:",
      await page.evaluate(() => localStorage.getItem("save_manifest_draft_ls_v1") != null)
    )

    const shot1 = testInfo.outputPath("3-39_draft_saved.png")
    await page.screenshot({ path: shot1, fullPage: true })
    await testInfo.attach("3-39_draft_saved", { path: shot1, contentType: "image/png" })

    await page.evaluate(() => {
      localStorage.setItem("sidebar_collapsed", "0")
      localStorage.removeItem("sidebar_active_tool")
    })
    await page.reload()
    await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 40000 })
    console.log("[e2e][3-39] reloaded")
    console.log(
      "[e2e][3-39] draft ls exists after reload:",
      await page.evaluate(() => localStorage.getItem("save_manifest_draft_ls_v1") != null)
    )
    console.log(
      "[e2e][3-39] draft ls snapshot:",
      await page.evaluate(() => {
        try {
          const raw = localStorage.getItem("save_manifest_draft_ls_v1")
          const v = raw ? JSON.parse(raw) : null
          return { has: !!v, updatedAt: v?.updatedAt, updatedAtType: typeof v?.updatedAt, action: v?.action }
        } catch (e: any) {
          return { has: false, error: e?.message || String(e) }
        }
      })
    )
    const { popover: popover2 } = await importLocalDatasetAndOpenTask(page)
    console.log("[e2e][3-39] task opened again")

    await expect(popover2.locator(".layers-tree")).toBeVisible({ timeout: 40000 })
    await popover2.getByRole("button", { name: "提交发布" }).click({ force: true })
    const modal2 = page.locator(".ksh002-save-manifest-modal .ant-modal")
    await expect(modal2).toBeVisible({ timeout: 20000 })
    const modal2Debug = await page.evaluate(() => {
      const root = document.querySelector(".ksh002-save-manifest-modal") as any
      const alertEls = Array.from(document.querySelectorAll(".ksh002-save-manifest-modal .ant-alert"))
      const bodyEl = document.querySelector(".ksh002-save-manifest-modal .ant-modal-body") as HTMLElement | null
      const bodyText = bodyEl ? bodyEl.innerText.trim().slice(0, 200) : null
      const bodyHtml = bodyEl ? bodyEl.innerHTML.trim().slice(0, 400) : null
      const btnTexts = Array.from(document.querySelectorAll(".ksh002-save-manifest-modal button"))
        .map((b) => (b as HTMLButtonElement).innerText.trim())
        .filter(Boolean)
      let inst = root?.__vueParentComponent || null
      const seen = new Set<any>()
      while (inst && !seen.has(inst)) {
        seen.add(inst)
        const ss: any = inst.setupState || inst.ctx || null
        const hasDraftTip = ss && typeof ss === "object" && "draftTipVisible" in ss
        if (hasDraftTip) {
          const draftTipVisible = ss.draftTipVisible?.value ?? ss.draftTipVisible
          const draftTipMessage = ss.draftTipMessage?.value ?? ss.draftTipMessage
          const draftInfo = ss.draftInfo?.value ?? ss.draftInfo ?? null
          const draftLoaded = ss.draftLoaded?.value ?? ss.draftLoaded
          const draftRestored = ss.draftRestored?.value ?? ss.draftRestored
          const formState = ss.formState ?? null
          const coverLen = ss.coverFileList?.value?.length ?? -1
          const attachLen = ss.attachmentFileList?.value?.length ?? -1
          const scopeGraphic = ss.scopeGraphic?.value ?? null
          const safe = typeof ss.isDraftPromptSafe === "function" ? ss.isDraftPromptSafe() : null
          return {
            found: true,
            dom: {
              alerts: alertEls.length,
              firstAlertText: alertEls[0] ? (alertEls[0] as HTMLElement).innerText.trim() : null,
              buttons: btnTexts.slice(0, 20),
              bodyText,
              bodyHtml
            },
            draftTipVisible,
            draftTipMessage,
            draftInfo,
            draftLoaded,
            draftRestored,
            formName: formState?.name ?? null,
            formDesc: formState?.description ?? null,
            formTagsLen: Array.isArray(formState?.tags) ? formState.tags.length : null,
            coverLen,
            attachLen,
            hasScopeGraphic: !!scopeGraphic,
            safe
          }
        }
        inst = inst.parent || null
      }
      return { found: false }
    })
    console.log("[e2e][3-39] modal2 debug:", JSON.stringify(modal2Debug))
    const restoreBtn = modal2.getByRole("button", { name: "恢复草稿" })
    await expect(restoreBtn).toBeVisible({ timeout: 30000 })
    await restoreBtn.click()
    await expect(page.locator(".ant-message-notice-content")).toContainText("草稿已恢复", { timeout: 20000 })
    console.log("[e2e][3-39] draft restored")
    submitOk.value = true

    await modal2.getByRole("button", { name: "提交发布" }).scrollIntoViewIfNeeded()
    await modal2.getByRole("button", { name: "提交发布" }).click()
    await expect(modal2.getByRole("button", { name: "确认提交发布" })).toBeVisible({ timeout: 20000 })
    await modal2.getByRole("button", { name: "确认提交发布" }).click()
    await expect(page.locator(".ant-message-notice-content")).toContainText("已提交发布", { timeout: 60000 })

    const shot2 = testInfo.outputPath("3-39_resubmit_ok.png")
    await page.screenshot({ path: shot2, fullPage: true })
    await testInfo.attach("3-39_resubmit_ok", { path: shot2, contentType: "image/png" })
  })

  test("3-41 回放：时间轴演化 + 成果回放（视频/截图）", async ({ page }, testInfo) => {
    test.setTimeout(160_000)
    const datasetId = `local_evidence_${Date.now()}`
    await seedLocalDataset(page, datasetId)
    await page.goto("/")
    await page.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 40000 })

    await page.getByRole("button", { name: "时间轴演化" }).click()
    const panel = page.locator(".mars-dialog", { hasText: "时间轴演化" })
    await expect(panel).toBeVisible({ timeout: 20000 })
    const player = panel.locator(".player")
    await expect(player).toBeVisible({ timeout: 40000 }).catch(async () => {
      await panel.locator(".collection-select").click({ force: true })
      await page.keyboard.press("ArrowDown")
      await page.keyboard.press("Enter")
      await expect(player).toBeVisible({ timeout: 20000 })
    })

    const shot1 = testInfo.outputPath("3-41_timeline.png")
    await page.screenshot({ path: shot1, fullPage: true })
    await testInfo.attach("3-41_timeline", { path: shot1, contentType: "image/png" })

    await page.getByRole("button", { name: "成果回放" }).click()
    const playback = page.locator(".mars-dialog", { hasText: "成果回放" })
    await expect(playback).toBeVisible({ timeout: 20000 })
    await page.evaluate(() => history.pushState({}, "", "/?playback_test=1"))
    await playback.getByRole("button", { name: "保存当前URL" }).click()
    await expect(playback.locator(".ant-list-item")).toHaveCount(1, { timeout: 20000 })

    await page.evaluate(() => history.pushState({}, "", "/?playback_test=2"))
    await playback.locator(".ant-list-item").first().getByText("回放").click()
    await page.waitForTimeout(800)
    await expect(page).toHaveURL(/playback_test=1/)

    const shot2 = testInfo.outputPath("3-41_playback_list.png")
    await page.screenshot({ path: shot2, fullPage: true })
    await testInfo.attach("3-41_playback_list", { path: shot2, contentType: "image/png" })
  })
})

test.describe("Contrast Audit", () => {
  test("Contrast Audit (WCAG 2.1 AA)", async ({ page }, testInfo) => {
    test.skip(process.env.PW_CONTRAST_AUDIT !== "1", "set PW_CONTRAST_AUDIT=1 to run")
    test.setTimeout(420_000)

    const fast = process.env.PW_CONTRAST_FAST === "1"
    const viewports = fast ? [{ width: 1366, height: 768 }] : [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1366, height: 768 }]
    const modes: Array<"light" | "dark"> = ["light", "dark"]

    const results: any[] = []

    for (const mode of modes) {
      for (const vp of viewports) {
        const p = await page.context().newPage()
        await p.setViewportSize(vp)

        const datasetId = `local_contrast_${mode}_${vp.width}x${vp.height}_${Date.now()}`
        const datasetTitle = `对比度验收数据集_${mode}_${vp.width}x${vp.height}`
        await p.addInitScript(
          (args: any) => {
            try {
              localStorage.setItem("mars3d_theme_mode", args.mode)
            } catch {
            }
            try {
              const now = Date.now()
              const payload = {
                [args.id]: {
                  name: args.title,
                  description: "contrast-audit",
                  visibility: "private",
                  createdAt: now,
                  updatedAt: now,
                  revisions: [{ revisionId: `rev_${now}`, message: "本地版本", createdAt: now }],
                  manifest: {
                    manifestVersion: "1.0.0",
                    viewState: {
                      center: { longitude: 104.0, latitude: 36.0 },
                      zoom: 6,
                      bbox: [103.0, 35.0, 105.0, 37.0]
                    },
                    layers: [
                      { id: "dir_vector", name: "矢量", sourceType: "group", sourceRef: "", visible: true, opacity: 1, order: 0 },
                      { id: "dir_raster", name: "栅格", sourceType: "group", sourceRef: "", visible: true, opacity: 1, order: 1 },
                      {
                        id: "l_vector",
                        name: "矢量边界",
                        sourceType: "geojson",
                        sourceRef: "",
                        pid: "dir_vector",
                        visible: true,
                        opacity: 1,
                        order: 2,
                        data: { type: "FeatureCollection", features: [] }
                      },
                      {
                        id: "l_raster",
                        name: "光学影像",
                        sourceType: "xyz",
                        sourceRef: "https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}",
                        pid: "dir_raster",
                        visible: true,
                        opacity: 1,
                        order: 3
                      }
                    ],
                    drawFeatures: []
                  }
                }
              }
              localStorage.setItem("eoapi_manifests", JSON.stringify(payload))
              localStorage.setItem("sidebar_collapsed", "0")
              localStorage.removeItem("sidebar_active_tool")
              localStorage.removeItem("ksh002_current_dataset_v1")
              localStorage.removeItem("ksh002_current_task_lock_v1")
            } catch {
            }
          },
          { mode, id: datasetId, title: datasetTitle }
        )

        await p.goto("/")
        await p.waitForFunction(() => (window as any).__mars_map_loaded === true, null, { timeout: 60_000 })

        const modeKey = `${mode}_${vp.width}x${vp.height}`
        const bucket: any = { mode, viewport: vp, containers: {} as any }

        const sidebarIssues = await collectContrastIssues(p, { include: [".sidebar"], limit: 500 })
        bucket.containers.sidebar = { count: sidebarIssues.length, issues: sidebarIssues }

        const bodyIssues = await collectContrastIssues(p, {
          include: ["body"],
          exclude: [".sidebar", ".mars-dialog", ".ant-modal-root", ".ant-dropdown", ".ant-select-dropdown", ".ant-picker-dropdown", ".task-popover-layer"],
          limit: 800
        })
        bucket.containers.body = { count: bodyIssues.length, issues: bodyIssues }

        await activateWidgetForAudit(p, "dataset-repository")
        const repo = p.locator(".mars-dialog.ksh002-drawer", { hasText: "数据集仓库" })
        await expect(repo).toBeVisible({ timeout: 20_000 })
        const repoIssues = await collectContrastIssues(p, { include: [".mars-dialog.ksh002-drawer"], limit: 800 })
        bucket.containers["mars-dialog:dataset-repository"] = { count: repoIssues.length, issues: repoIssues }

        await repo.getByPlaceholder("搜索名称/描述").fill(datasetTitle)
        const card = repo.locator(".dataset-card", { hasText: datasetTitle }).first()
        await expect(card).toBeVisible({ timeout: 20_000 })
        await card.click({ force: true })
        const importBtn = repo.getByRole("button", { name: "导入使用" })
        await expect(importBtn).toBeEnabled({ timeout: 20_000 })
        await importBtn.click({ force: true })

        const importModal = p.getByRole("dialog", { name: "导入使用" })
        await expect(importModal).toBeVisible({ timeout: 20_000 })
        const modalIssues = await collectContrastIssues(p, { include: [".ant-modal-root"], limit: 800 })
        bucket.containers["ant-modal:import"] = { count: modalIssues.length, issues: modalIssues }
        await importModal.locator(".ant-modal-close").click({ force: true }).catch(() => {})
        await expect(importModal).toBeHidden({ timeout: 20_000 }).catch(() => {})

        await repo.locator(".close-btn").first().click({ force: true }).catch(() => {})
        await expect(repo).toBeHidden({ timeout: 20_000 }).catch(() => {})

        await activateWidgetForAudit(p, "eoapi-timeline-player")
        const timeline = p.locator(".mars-dialog", { hasText: "时间轴演化" })
        await expect(timeline).toBeVisible({ timeout: 20_000 })
        const timelineIssues = await collectContrastIssues(p, { include: [".mars-dialog"], limit: 800 })
        bucket.containers["mars-dialog:timeline"] = { count: timelineIssues.length, issues: timelineIssues }
        await timeline.locator(".close-btn").click({ force: true }).catch(() => {})
        await expect(timeline).toBeHidden({ timeout: 20_000 }).catch(() => {})

        await activateWidgetForAudit(p, "result-playback")
        const playback = p.locator(".mars-dialog", { hasText: "成果回放" })
        await expect(playback).toBeVisible({ timeout: 20_000 })
        const playbackIssues = await collectContrastIssues(p, { include: [".mars-dialog"], limit: 800 })
        bucket.containers["mars-dialog:playback"] = { count: playbackIssues.length, issues: playbackIssues }
        await playback.locator(".close-btn").click({ force: true }).catch(() => {})
        await expect(playback).toBeHidden({ timeout: 20_000 }).catch(() => {})

        const totalCount = Object.values(bucket.containers).reduce((s: number, v: any) => s + (v?.count || 0), 0)
        results.push({ ...bucket, count: totalCount })

        const jsonPath = testInfo.outputPath(`contrast_${modeKey}.json`)
        writeFileSync(jsonPath, JSON.stringify(bucket, null, 2))
        await testInfo.attach(`contrast_${modeKey}`, { path: jsonPath, contentType: "application/json" })

        await p.close().catch(() => {})
      }
    }

    const total = results.reduce((s, r) => s + (r.count || 0), 0)
    const summaryPath = testInfo.outputPath("contrast_summary.json")
    writeFileSync(summaryPath, JSON.stringify(results, null, 2))
    await testInfo.attach("contrast_summary", { path: summaryPath, contentType: "application/json" })
    expect(total, "contrast issues should be 0 across modes/viewports").toBe(0)
  })
})
