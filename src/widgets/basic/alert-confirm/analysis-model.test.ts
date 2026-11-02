import { describe, expect, it } from "vitest"
import {
  calculateSpatialAnalysis,
  calculateTemporalAnalysis,
  getAlertAnalysisDataset,
  type AlertAnalysisDataset
} from "./analysis-model"

describe("告警真实日序列分析", () => {
  it("从days字段生成观测、预报、温差统计", () => {
    const result = calculateTemporalAnalysis(getAlertAnalysisDataset("ALT-20261101-001"))

    expect(result.status).toBe("ok")
    expect(result.records).toHaveLength(6)
    expect(result.records[0]).toEqual({ date: "2026-06-30", obsC: 24.1, fcC: 24.8, diffC: -0.7 })
    expect(result.metrics.latestDiffC).toBe(-3.284)
    expect(result.metrics.maxAbsDiffC).toBe(3.284)
    expect(result.metrics.validDays).toBe(6)
    expect(result.trend).toBe("平稳")
  })

  it("保留空值且不生成NaN指标", () => {
    const base = getAlertAnalysisDataset("ALT-20261101-001")!
    const dataset: AlertAnalysisDataset = {
      ...base,
      days: [{ date: "2026-07-05", obs_c: null, fc_c: 25.2, diff_c: null, task_name: base.taskName }]
    }
    const result = calculateTemporalAnalysis(dataset)

    expect(result.status).toBe("ok")
    expect(result.records[0].obsC).toBeNull()
    expect(result.metrics.latestDiffC).toBeNull()
    expect(result.metrics.validDays).toBe(0)
  })
})

describe("告警异常点空间分布", () => {
  it("从points字段计算点位数量、确认状态和温差范围", () => {
    const result = calculateSpatialAnalysis(getAlertAnalysisDataset("ALT-20261101-001"))

    expect(result.status).toBe("ok")
    expect(result.points).toHaveLength(12)
    expect(result.metrics.total).toBe(12)
    expect(result.metrics.pending).toBe(9)
    expect(result.metrics.confirmed).toBe(3)
    expect(result.metrics.maxDiffC).toBe(4.6)
    expect(result.metrics.minDiffC).toBe(-3.2)
    expect(result.extent.minLng).toBeLessThan(result.extent.maxLng)
  })

  it("过滤无效坐标但保留无温差的有效点位", () => {
    const base = getAlertAnalysisDataset("ALT-20261101-001")!
    const dataset: AlertAnalysisDataset = {
      ...base,
      points: [
        { id: 1, lon: 116.4, lat: 39.9, date: "2026-07-05", diff_c: null, confirmed: false, task_name: base.taskName },
        { id: 2, lon: 999, lat: 39.9, date: "2026-07-05", diff_c: 2, confirmed: false, task_name: base.taskName }
      ]
    }
    const result = calculateSpatialAnalysis(dataset)

    expect(result.points.map((point) => point.id)).toEqual([1])
    expect(result.metrics.maxDiffC).toBeNull()
  })
})
