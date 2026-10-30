import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const source = readFileSync(path.resolve(process.cwd(), "src/components/mars-work/mars-map.vue"), "utf8")

describe("综合统计面板旧上图功能", () => {
  it("保留五张统计卡片的纯 UI 上图按钮和切换文案", () => {
    expect(source).toContain("上图展示")
    expect(source).toContain("取消上图")
    expect(source).toContain("toggleStatsOnMapUi(c.key)")
    expect(source).toContain("statsOnMapUi[c.key]")
  })

  it("不再创建统计地表、柱体或相机 LOD 副作用", () => {
    expect(source).not.toContain("statsAnalysisSurfaceOverlay")
    expect(source).not.toContain("statsOverlayLayer")
    expect(source).not.toContain("renderOverlayForCard")
    expect(source).not.toContain("bindStatsOverlayCameraAdapter")
  })
})
