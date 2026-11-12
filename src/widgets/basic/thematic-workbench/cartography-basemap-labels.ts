type Layer = { show: boolean; type?: string; options?: { type?: string; layer?: string; url?: string } }
export function isSeparateBasemapAnnotation(layer: Layer) {
  const o = layer.options || {}; const provider = layer.type || o.type
  if (["gaode", "tdt", "tencent", "baidu"].includes(provider || "") && ["img_z", "cia", "cva", "cta"].includes(o.layer || "")) { return true }
  const url = o.url || ""
  return (/autonavi\.com\/appmaptile/.test(url) && /[?&]style=8(?:&|$)/.test(url)) || /[?&]T=(cia|cva|cta)_[wc](?:&|$)/i.test(url)
}
export function cartographyBasemapLabels(read: () => Layer[]) {
  const hidden = new Map<Layer, boolean>()
  const restore = () => { for (const [layer, before] of hidden) { if (layer.show === false) { layer.show = before } }; hidden.clear() }
  return {
    apply(enabled: boolean) {
      if (!enabled) { restore(); return }
      for (const layer of read()) {
        if (layer.show && isSeparateBasemapAnnotation(layer)) { if (!hidden.has(layer)) { hidden.set(layer, layer.show) }; layer.show = false }
      }
    },
    restore
  }
}
