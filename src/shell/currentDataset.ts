export type CurrentDataset = {
  datasetId: string
  name?: string
  source?: "repository" | "my-repository" | "save" | "unknown"
  updatedAt: number
}

const storageKey = "ksh002_current_dataset_v1"
const eventName = "currentDatasetChange"
const taskLockStorageKey = "ksh002_current_task_lock_v1"
const taskLockEventName = "currentTaskLockChange"

export type CurrentTaskLock = {
  locked: boolean
  reason?: string
  updatedAt: number
}

export function getCurrentDataset(): CurrentDataset | null {
  const raw = localStorage.getItem(storageKey)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as Partial<CurrentDataset>
    if (!parsed || typeof parsed.datasetId !== "string" || !parsed.datasetId) {
      return null
    }
    return {
      datasetId: parsed.datasetId,
      name: typeof parsed.name === "string" ? parsed.name : undefined,
      source: (parsed.source as any) || "unknown",
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now()
    }
  } catch {
    return null
  }
}

export function setCurrentDataset(input: { datasetId: string; name?: string; source?: CurrentDataset["source"] }) {
  const next: CurrentDataset = {
    datasetId: input.datasetId,
    name: input.name,
    source: input.source || "unknown",
    updatedAt: Date.now()
  }
  localStorage.setItem(storageKey, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent(eventName, { detail: next }))
}

export function clearCurrentDataset(matchDatasetId?: string) {
  const cur = getCurrentDataset()
  if (matchDatasetId && cur?.datasetId && cur.datasetId !== matchDatasetId) {
    return
  }
  localStorage.removeItem(storageKey)
  window.dispatchEvent(new CustomEvent(eventName, { detail: null }))
}

export function onCurrentDatasetChange(cb: (dataset: CurrentDataset | null) => void) {
  const handler = (evt: Event) => {
    const detail = (evt as CustomEvent).detail as CurrentDataset | null
    cb(detail || null)
  }
  window.addEventListener(eventName, handler as any)
  return () => window.removeEventListener(eventName, handler as any)
}

export function getCurrentTaskLock(): CurrentTaskLock {
  const raw = localStorage.getItem(taskLockStorageKey)
  if (!raw) {
    return { locked: false, updatedAt: 0 }
  }
  try {
    const parsed = JSON.parse(raw) as Partial<CurrentTaskLock>
    const locked = !!parsed.locked
    const reason = typeof parsed.reason === "string" ? parsed.reason : undefined
    const updatedAt = typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0
    return { locked, reason, updatedAt }
  } catch {
    return { locked: false, updatedAt: 0 }
  }
}

export function setCurrentTaskLock(input: { locked: boolean; reason?: string }) {
  const locked = !!input.locked
  const reason = typeof input.reason === "string" ? input.reason.trim() : ""
  const next: CurrentTaskLock = {
    locked,
    reason: reason || undefined,
    updatedAt: Date.now()
  }
  localStorage.setItem(taskLockStorageKey, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent(taskLockEventName, { detail: next }))
}

export function clearCurrentTaskLock() {
  localStorage.removeItem(taskLockStorageKey)
  window.dispatchEvent(new CustomEvent(taskLockEventName, { detail: { locked: false, updatedAt: Date.now() } }))
}

export function onCurrentTaskLockChange(cb: (lock: CurrentTaskLock) => void) {
  const handler = (evt: Event) => {
    const detail = (evt as CustomEvent).detail as CurrentTaskLock
    cb(detail || { locked: false, updatedAt: 0 })
  }
  window.addEventListener(taskLockEventName, handler as any)
  return () => window.removeEventListener(taskLockEventName, handler as any)
}
