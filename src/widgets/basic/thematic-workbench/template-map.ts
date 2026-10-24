import { buildColorMapping, defaultRenderStyle, type RenderStyle } from "./render-style"
import { clipPolygons, type readPolygonDocument } from "./polygon-source"
import type { RectInfo } from "./map"
import type { DisplayPolygon } from "./display-model"
import { mapTemplatePalettes, sampleTemplatePalette } from "./template-palettes"

export const templateColors: Record<string, [string, string]> = {
  "sequential-blue": ["#d8f3ff", "#0b3f6b"],
categorical: ["#46c2cb", "#ef476f"],
  "blue-red": ["#2166ac", "#b2182b"],
heat: ["#3b0f70", "#fcfdbf"],
terrain: ["#173f5f", "#f9844a"],
  threshold: ["#2f80ed", "#d1495b"],
contour: ["#cfe8ff", "#083f6e"],
velocity: ["#0b3954", "#ff6b35"],
  risk: ["#27925d", "#d83b36"],
compare: ["#1f9d8a", "#7e22ce"],
dashboard: ["#41c7d9", "#e64980"],
  "seismic-anomaly": ["#22d3c5", "#d9469f"],
"thermal-infrared": ["#fee08b", "#a50026"],
  "post-quake-risk": ["#27925d", "#d83b36"],
"quake-swarm": ["#193b73", "#f94144"],
  "insar-cycle": ["#3a0ca3", "#f72585"],
intensity: ["#3a86a8", "#a4133c"],
  "multi-hazard": ["#3288bd", "#9b2226"],
resilience: ["#c1121f", "#168aad"],
  exposure: ["#fff3b0", "#7b2cbf"],
emergency: ["#2ec4d6", "#e63946"],
  "green-yellow": ["#1b5e20", "#fdd835"],
"purple-orange": ["#5b2a86", "#dd6b20"]
}

export function classifyTemplatePolygons(document: ReturnType<typeof readPolygonDocument>["document"], field: string, bounds: RectInfo, palette: string, method: RenderStyle["method"], count: number, unique = false) {
  if (unique && document.features.some(f => typeof f.properties[field] === "string")) {
    const categories = [...new Set(document.features.map(f => f.properties[field]).filter(value => (typeof value === "string" && value.trim()) || (typeof value === "number" && Number.isFinite(value))))]
    const coded = { ...document, features: document.features.filter(feature => categories.includes(feature.properties[field])).map(feature => ({ ...feature, properties: { ...feature.properties, [field]: categories.indexOf(feature.properties[field]) } })) }
    const polygons = clipPolygons(coded, field, bounds).map(item => ({ ...item, category: String(categories[item.value]) }))
    return recolorTemplatePolygons(polygons, palette, method, count, true)
  }
  const polygons = clipPolygons(document, field, bounds)
  return recolorTemplatePolygons(polygons, palette, method, count, unique)
}

export function templateMapping(values: number[], palette: string, method: RenderStyle["method"], count: number, mode: RenderStyle["mode"]) {
  const [low, high] = templateColors[palette] || templateColors["sequential-blue"]
  const base = buildColorMapping(values, { ...defaultRenderStyle(), mode, method, count, low, high })
  const stops = mapTemplatePalettes[palette] || [low, high]
  const ramp = (value: number) => sampleTemplatePalette(stops, value / 255)
  const legend = base.legend.map((entry, index) => {
    const fraction = index / Math.max(1, base.legend.length - 1)
    let color = sampleTemplatePalette(stops, fraction)
    if (mode === "raster") { color = ramp(fraction * 255) }
    if (mode === "unique" && palette === "categorical" && base.legend.length <= stops.length) { color = stops[index] }
    return { ...entry, color }
  })
  const colors = new Map(base.legend.map((entry, index) => [entry.color, legend[index].color]))
  return {
 legend,
color: (value: number) => {
    const original = base.color(value)
    if (!original) { return null }
    return mode === "raster" ? ramp(value) : colors.get(original)!
  } 
}
}

export function recolorTemplatePolygons(polygons: DisplayPolygon[], palette: string, method: RenderStyle["method"], count: number, unique = false) {
  if (!polygons.length || polygons.some(item => !Number.isFinite(item.value))) { throw new Error("没有可用的分区数值") }
  const mapping = templateMapping(polygons.map(item => item.value), palette, method, count, unique ? "unique" : "classified")
  const result = {
 polygons: polygons.map(item => {
    const color = mapping.color(item.value)!
    return { ...item, color, band: mapping.legend.find(entry => entry.color === color)?.label || String(item.value) }
  }),
legend: mapping.legend 
}
  if (unique && polygons.every(item => typeof item.category === "string")) {
    result.polygons = result.polygons.map(item => ({ ...item, band: item.category! }))
    result.legend = [...new Map(result.polygons.map(item => [item.category!, item.color])).entries()].map(([label, color]) => ({ label, color }))
  }
  return result
}

// Screenshot brightness is a display variable, never a physical observation.
export function colorTemplatePixels(data: Uint8ClampedArray, palette: string, threshold: boolean, count = 5) {
  const values = Array.from({ length: data.length / 4 }, (_, i) => data[i * 4 + 3]
    ? Math.round(data[i * 4] * 0.2126 + data[i * 4 + 1] * 0.7152 + data[i * 4 + 2] * 0.0722)
: NaN)
  const mapping = templateMapping(values, palette, "equal", count, threshold ? "classified" : "raster")
  const output = new Uint8ClampedArray(data)
  const lookup = Array.from({ length: 256 }, (_, value) => {
    const color = mapping.color(value)
    return color ? [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16)) : null
  })
  values.forEach((value, index) => { if (Number.isFinite(value) && lookup[value]) { output.set(lookup[value]!, index * 4) } })
  return { data: output, legend: mapping.legend.map(entry => ({ ...entry, label: `RGB 亮度 ${entry.label}` })) }
}
