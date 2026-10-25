import type { CartographySnapshot } from "./cartography-layout"

const PREFIX = "mars3d:thematic-job-draft:v1:"

function key(datasetId: string, jobId: string) {
  return `${PREFIX}${encodeURIComponent(datasetId || "global")}:${encodeURIComponent(jobId)}`
}

export function loadThematicJobDraft(datasetId: string, jobId: string): CartographySnapshot | null {
  if (!jobId) { return null }
  try {
    const value = JSON.parse(localStorage.getItem(key(datasetId, jobId)) || "null")
    return value?.version === 1 && value.settings ? value : null
  } catch {
    return null
  }
}

export function saveThematicJobDraft(datasetId: string, jobId: string, snapshot: CartographySnapshot) {
  if (!jobId) { return }
  try { localStorage.setItem(key(datasetId, jobId), JSON.stringify(snapshot)) } catch { /* storage is optional */ }
}

export function clearThematicJobDraft(datasetId: string, jobId: string) {
  if (!jobId) { return }
  try { localStorage.removeItem(key(datasetId, jobId)) } catch { /* storage is optional */ }
}
