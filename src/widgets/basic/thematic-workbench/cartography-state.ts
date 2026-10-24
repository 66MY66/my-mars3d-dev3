import { reactive, shallowRef, watch } from "vue"
import { normalizePreferences, type CartographySnapshot, type AdornmentMetrics } from "./cartography-layout"

const PREFERENCE_KEY = "mars3d:cartography-layout:v1"
function readPreferences() {
  try { return JSON.parse(localStorage.getItem(PREFERENCE_KEY) || "null") } catch { return null }
}
export const cartographySettings = reactive(normalizePreferences(readPreferences()))
export const cartographyEffects = shallowRef<Record<string, unknown>>({})
export const cartographyRenderStyle = shallowRef<Record<string, unknown>>({})
export const cartographyContext = shallowRef<{ legend: CartographySnapshot["legend"]; metrics: AdornmentMetrics | null; symbols: CartographySnapshot["symbols"] }>({ legend: [], metrics: null, symbols: [] })
watch(cartographySettings, value => {
  try { localStorage.setItem(PREFERENCE_KEY, JSON.stringify({ scaleDenominator: value.scaleDenominator, safeMargin: value.safeMargin, elements: value.elements, enabled: value.enabled })) } catch { /* The current session remains usable when storage is unavailable. */ }
}, { deep: true })

export function cartographySnapshot(): CartographySnapshot {
  return JSON.parse(JSON.stringify({ version: 1, settings: cartographySettings, ...cartographyContext.value, effects: cartographyEffects.value, renderStyle: cartographyRenderStyle.value }))
}
export function rememberJobCartography(jobId: string, snapshot: CartographySnapshot) {
  try { localStorage.setItem(`mars3d:cartography-job:${jobId}`, JSON.stringify(snapshot)) } catch { /* Server parameters remain the authoritative copy. */ }
}
export function getJobCartography(job: { jobId: string; parameters?: Record<string, any> }): CartographySnapshot | null {
  const metadata = job.parameters?.cartography
  if (metadata?.version === 1 && metadata.settings) { return JSON.parse(JSON.stringify(metadata)) }
  try {
    const saved = JSON.parse(localStorage.getItem(`mars3d:cartography-job:${job.jobId}`) || "null")
    return saved?.version === 1 && saved.settings ? saved : null
  } catch { return null }
}
