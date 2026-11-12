import { describe, expect, it } from "vitest"
import { annotationIssueSummary, groupCartographyIssues, uniqueCartographyIssues } from "./cartography-release-checks"
import { standardPublicationBlockers } from "./standard-publication"
import type { DbtIssue } from "./dbt116-standard"

describe("actionable release checks without weakening publication gates", () => {
  it("groups repeated per-layer evidence checks but retains every distinct blocker", () => {
    const issues: DbtIssue[] = [
      { clause: "4.9", message: "图层一缺少坐标依据", severity: "error" },
      { clause: "4.9", message: "图层二缺少坐标依据", severity: "error" },
      { clause: "4.6", message: "缺少台网正式震情", severity: "error" },
      { clause: "4.7", message: "图层比例尺需复核", severity: "warning" }
    ]
    const groups = groupCartographyIssues([...issues, issues[0]])
    expect(groups.find(group => group.key === "coordinates")?.blocking).toBe(2)
    expect(groups.flatMap(group => group.issues)).toHaveLength(4)
    expect(uniqueCartographyIssues([...issues, issues[0]])).toEqual(issues)
    expect(groups.filter(group => group.blocking)).toHaveLength(2)
    const blockers = standardPublicationBlockers({ hasDocument: true, usage: "operational", mapDraft: false, renderReady: true, issues, reviewCount: 5, reviewTotal: 5, reviewer: "复核人员", evidence: "复核记录" })
    expect(blockers).toHaveLength(3)
  })
  it("summarizes hundreds of omitted names as one unresolved layout issue, not hundreds of faults", () => {
    const skipped = [...Array.from({ length: 160 }, (_, i) => ({ text: `地名${i}`, reason: "crowded" })), { text: "长注记", reason: "oversize" }, { text: "图外地名", reason: "outside" }]
    const messages = annotationIssueSummary(skipped)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain("冲突未放置 160 条")
    expect(messages[0]).toContain("超过图幅 1 条")
    expect(skipped).toHaveLength(162)
    expect(groupCartographyIssues([{ clause: "9.5", message: messages[0], severity: "error" }])[0].key).toBe("annotations")
    expect(annotationIssueSummary([{ text: "图外", reason: "outside" }, { text: "普通地名取舍", reason: "generalized" }, { text: "同名重复", reason: "duplicate" }])).toEqual([])
  })
  it("keeps real source, missing coverage and editing issues in distinct work queues", () => {
    const issues: DbtIssue[] = [
      { clause: "8", message: "行政区划缺少覆盖整个制图范围的完整性依据", severity: "error" },
      { clause: "4.6", message: "人口为来源待核验的在线数据", severity: "error" },
      { clause: "9", message: "制作单位、制图时间及内容说明必须填写", severity: "error" }
    ]
    expect(groupCartographyIssues(issues).map(group => group.key)).toEqual(["source", "coverage", "layout"])
  })
})
