import { expect, it } from "vitest"
import type { DbtLayer } from "./dbt116-standard"
import { onlineLayerDescription, onlineMapDescription, onlineProofTitle } from "./online-layer-description"

it("groups repeated base geography provenance without dropping uncertainty or changing source records", () => {
  const base = { id: "base", name: "基础地理", publishedAt: "", data: { type: "FeatureCollection", features: [], metadata: { rejectedCount: 3 } }, onlineSource: { itemId: "SP-swchina-basegeo-250k" } } as unknown as DbtLayer
  const layers = [...Array.from({ length: 6 }, (_, i) => ({ ...base, id: `base${i}` })), { ...base, onlineSource: { ...base.onlineSource!, itemId: "SP-jiuzhaigou2017-intensity" } }, { ...base, onlineSource: { ...base.onlineSource!, itemId: "SP-china-active-faults" } }]
  const original = structuredClone(layers)
  const text = onlineLayerDescription(layers)
  expect(text.match(/基础地理1:25万/g)).toHaveLength(1)
  expect(text).toContain("方法、来源单位和版本待核验")
  expect(text).toContain("退化或无效几何未绘制")
  expect(text).toContain("非正式应急成果")
  expect(text.length).toBeLessThan(160)
  expect(layers).toEqual(original)
})
it("does not label a base-only reference as a completed earthquake thematic product", () => {
  const base = { role: "boundary", enabled: true } as DbtLayer
  expect(onlineProofTitle("基本情况专题图", [base])).toBe("基础地理参考图 · 在线数据校样")
  const population = { role: "population" } as DbtLayer
  expect(onlineProofTitle("社会经济分布专题图", [base, population])).toContain("社会经济分布专题图")
  expect(onlineProofTitle("社会经济分布专题图", [base, { ...population, enabled: false }])).toContain("基础地理参考图")
})
it("separates map copy from full provenance without dropping layers or editing source records", () => {
  const roles = ["event", "intensity", "boundary", "boundary", "settlement", "settlement", "water", "water", "transport", "transport", "population", "economy"]
  const layers = roles.map((role, i) => ({ id: String(i), role, name: `完整后台图层${i}`, publishedAt: "2020-01-01T00:00:00Z", data: { type: "FeatureCollection", features: [], metadata: { rejectedCount: i === 2 ? 1 : 0 } }, onlineSource: { itemId: `backend-source-${i}` } })) as unknown as DbtLayer[]
  const original = structuredClone(layers)
  const description = onlineMapDescription(layers)
  expect(description).toContain("人口")
  expect(description).toContain("经济")
  expect(description.match(/基础地理/g)).toHaveLength(1)
  expect(description).toContain("未绘制的源几何")
  expect(description).toContain("不据此推算总量或损失")
  expect(description.length).toBeLessThan(150)
  const full = onlineLayerDescription(layers)
  expect(full).toContain("完整后台图层11")
  expect(full.length).toBeGreaterThan(description.length)
  expect(layers).toEqual(original)
  expect(onlineMapDescription(layers.map(layer => ({ ...layer, enabled: false })))).toBe("当前尚未叠加专题图层。")
})
