import { readTemplateDocument, TEMPLATE_CONTRACTS, type TemplateDocument } from "./template-renderer"
import { coordEach, featureCollection } from "@turf/turf"
import type { GeoBounds } from "./earthquake-analysis"

export const CATALOG_SAMPLE_BOUNDS = { west: 104.8, south: 28.2, east: 106.6, north: 29.7 }
function validBounds(bounds: GeoBounds) {
  return bounds && [bounds.west, bounds.south, bounds.east, bounds.north].every(Number.isFinite) &&
    bounds.west >= -180 && bounds.east <= 180 && bounds.south >= -90 && bounds.north <= 90 &&
    bounds.east > bounds.west && bounds.north > bounds.south
}
// Only explicitly selected synthetic fixtures may be placed in another extent.
export function fitTemplateSampleToBounds(sample: TemplateDocument, bounds: GeoBounds): TemplateDocument {
  if (sample.metadata.usage !== "test" || !TEMPLATE_CONTRACTS[sample.metadata.templateKind]) { throw new Error("仅内置合成测试数据可以按框选范围生成；业务数据必须保持原坐标") }
  const original = sample.metadata.bounds as GeoBounds
  if (!validBounds(bounds) || !validBounds(original)) { throw new Error("测试数据或框选范围无效") }
  const copy = structuredClone(sample)
  const projectAxis = (value: number, min: number, max: number, targetMin: number, targetMax: number) => {
    const fraction = (value - min) / (max - min)
    if (Math.abs(fraction) < 1e-10) { return targetMin }
    if (Math.abs(fraction - 1) < 1e-10) { return targetMax }
    return targetMin + fraction * (targetMax - targetMin)
  }
  const transform = (position: number[]) => {
    position[0] = projectAxis(position[0], original.west, original.east, bounds.west, bounds.east)
    position[1] = projectAxis(position[1], original.south, original.north, bounds.south, bounds.north)
  }
  coordEach(copy, transform)
  if (copy.metadata.context?.length) { coordEach(featureCollection(copy.metadata.context), transform) }
  if (copy.metadata.event?.coordinates) { transform(copy.metadata.event.coordinates) }
  copy.metadata = {
    ...copy.metadata,
    bounds: { ...bounds },
    originalSampleBounds: copy.metadata.originalSampleBounds || { ...original },
    extentMode: "selection",
    source: "按当前框选范围生成的合成测试数据；非真实观测、非业务成果"
  }
  return readTemplateDocument(copy)
}
export function templateSampleUrl(kind: string) {
  if (!TEMPLATE_CONTRACTS[kind]) { throw new Error("未知模板") }
  return `${import.meta.env.BASE_URL}data/dbt116-test/templates/${kind}.geojson`
}
const samples = new Map<string, Promise<TemplateDocument>>()
export function loadTemplateSample(kind: string) {
  if (!samples.has(kind)) {
    const request = fetch(templateSampleUrl(kind)).then(async response => {
      if (!response.ok) { throw new Error("测试数据加载失败") }
      const data = readTemplateDocument(await response.json())
      if (data.metadata.usage !== "test" || data.metadata.templateKind !== kind) { throw new Error("测试数据与模板不匹配") }
      return data
    }).catch(error => { samples.delete(kind); throw error })
    samples.set(kind, request)
  }
  return samples.get(kind)!
}
