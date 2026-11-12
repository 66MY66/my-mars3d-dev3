const prefix = "mars3d:thematic-job-draft:"

export function loadThematicJobDraft(datasetId: string, jobId: string) {
  try {
    const raw = localStorage.getItem(`${prefix}${datasetId}:${jobId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveThematicJobDraft(datasetId: string, jobId: string | undefined, draft: unknown) {
  if (!jobId) { return }
  try {
    localStorage.setItem(`${prefix}${datasetId}:${jobId}`, JSON.stringify(draft))
  } catch {
    // Draft persistence is best-effort and must not block the workbench.
  }
}
