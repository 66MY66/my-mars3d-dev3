import { describe, expect, it } from "vitest"

import { buildThematicProgressSteps, getThematicProgressMessage, getThematicProgressStageLabel, resolveThematicProgressStepKey } from "./thematic-progress"

describe("thematic-progress", () => {
  it("maps raw stage names to chinese progress labels", () => {
    expect(resolveThematicProgressStepKey({ stage: "prepare_data" } as any, "running")).toBe("data")
    expect(resolveThematicProgressStepKey({ stage: "rendering" } as any, "running")).toBe("render")
    expect(resolveThematicProgressStepKey({ stage: "tiling" } as any, "running")).toBe("tiling")
    expect(resolveThematicProgressStepKey({ stage: "publish_service" } as any, "running")).toBe("publish")
    expect(resolveThematicProgressStepKey({ stage: "archive_push" } as any, "running")).toBe("archive")
    expect(getThematicProgressStageLabel({ stage: "tiling" } as any, "running")).toBe("切片")
  })

  it("builds ordered step states for running job", () => {
    expect(buildThematicProgressSteps({ stage: "tiling" } as any, "running")).toEqual([
      { key: "data", label: "数据", state: "done" },
      { key: "render", label: "渲染", state: "done" },
      { key: "tiling", label: "切片", state: "active" },
      { key: "publish", label: "发布", state: "pending" },
      { key: "archive", label: "归档", state: "pending" }
    ])
  })

  it("marks current step as error for failed job", () => {
    expect(buildThematicProgressSteps({ stage: "publish_service" } as any, "failed")).toEqual([
      { key: "data", label: "数据", state: "done" },
      { key: "render", label: "渲染", state: "done" },
      { key: "tiling", label: "切片", state: "done" },
      { key: "publish", label: "发布", state: "error" },
      { key: "archive", label: "归档", state: "pending" }
    ])
  })

  it("formats display message with mapped stage label", () => {
    expect(getThematicProgressMessage({ stage: "archive_push", message: "正在入库" } as any, "running")).toBe("归档: 正在入库")
    expect(getThematicProgressMessage({ stage: "queued" } as any, "queued")).toBe("数据: 等待中")
  })
})
