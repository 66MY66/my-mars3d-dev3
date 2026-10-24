import { ADORNMENT_KEYS, type AdornmentSettings, type CartographySnapshot, type Corner } from "./cartography-layout"
import { PAGE, compositionMargin, constrainItem, createCompositionItem, useCompositionRaster, type CompositionItem } from "./composition-model"

export function placeInCorner(item: CompositionItem, corner: Corner, margin: number): CompositionItem {
  const bounds = constrainItem(item, [], false, margin)
  return {
    ...item,
    ...constrainItem({
      ...item,
      ...bounds,
      x: corner.endsWith("right") ? PAGE.width - margin - bounds.w : margin,
      y: corner.startsWith("bottom") ? PAGE.height - margin - bounds.h : margin
    }, [], false, margin),
    positioned: true
  }
}

export function setCompositionMargin(items: CompositionItem[], value: number): CompositionItem[] {
  const margin = compositionMargin(value)
  return items.map(item => ({ ...item, ...constrainItem(item, [], false, margin), ...(item.kind === "map" ? { safeMargin: margin } : {}) }))
}

// Explicit, one-way migration. Existing composer drafts are never replaced on open.
export function migrateAdornments(items: CompositionItem[], settings: AdornmentSettings): CompositionItem[] {
  const margin = compositionMargin(settings.safeMargin)
  let result = setCompositionMargin(items, margin)
  const text = { title: settings.title, legend: settings.legendTitle, time: settings.time, source: settings.source }
  const offsets = new Map<Corner, number>()
  for (const kind of ADORNMENT_KEYS) {
    let item = result.find(entry => entry.kind === kind)
    if (!item) {
      if (result.length >= 60) { continue }
      item = createCompositionItem(kind); result.push(item)
    }
    const style = settings.elements[kind]
    const copy = text[kind as keyof typeof text]
    Object.assign(item, {
      font: style.font,
      fontSize: style.fontSize,
      color: style.color,
      align: style.align,
      hidden: settings.enabled?.[kind] === false,
      ...(copy?.trim() ? { text: copy } : {})
    })
    Object.assign(item, placeInCorner(item, style.corner, margin))
    if (!item.hidden) {
      const offset = offsets.get(style.corner) || 0
      const y = item.y + (style.corner.startsWith("bottom") ? -offset : offset)
      Object.assign(item, constrainItem({ ...item, y }, [], false, margin))
      offsets.set(style.corner, offset + item.h + 16)
    }
  }
  if (settings.enabled?.text && settings.text?.trim() && result.length < 60 && !result.some(item => item.kind === "text" && item.text === settings.text)) {
    result.push(createCompositionItem("text", settings.text))
  }
  if (settings.enabled?.image && settings.image && !result.some(item => item.kind === "image" && item.raster?.image === settings.image)) {
    result = useCompositionRaster(result, { image: settings.image, label: "附加图片", detail: "", legend: [] }, "inset")
  }
  return setCompositionMargin(result, margin)
}

export function compositionMetadata(items: CompositionItem[], base: CartographySnapshot) {
  const snapshot: CartographySnapshot = JSON.parse(JSON.stringify(base))
  snapshot.settings.enabled = {}
  for (const key of ADORNMENT_KEYS) {
    const item = items.find(item => item.kind === key)
    snapshot.settings.enabled[key] = !!item && !item.hidden
    if (item) { Object.assign(snapshot.settings.elements[key], { font: item.font, fontSize: item.fontSize, color: item.color, align: item.align }) }
  }
  for (const key of ["title", "source", "time"] as const) { snapshot.settings[key] = items.find(item => item.kind === key)?.text || "" }
  snapshot.settings.legendTitle = items.find(item => item.kind === "legend")?.text || "图例"
  snapshot.settings.safeMargin = compositionMargin(items.find(item => item.kind === "map")?.safeMargin)
  snapshot.settings.enabled.text = items.some(item => item.kind === "text" && !item.hidden)
  snapshot.settings.enabled.image = items.some(item => item.kind === "image" && !item.hidden)
  snapshot.settings.text = items.filter(item => item.kind === "text" && !item.hidden).map(item => item.text).join("\n")
  delete snapshot.settings.image
  return { ...snapshot, composition: { version: 1, usage: "proof", page: PAGE, elements: items.map(({ raster, ...item }) => ({ ...item, imageLabel: raster?.label })) } }
}
