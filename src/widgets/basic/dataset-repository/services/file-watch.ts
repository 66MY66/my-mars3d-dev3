export type FileWatchChangeType = "added" | "updated" | "deleted"

export type FileWatchSource =
  | File
  | {
      id?: string
      url: string
      name?: string
    }

export type FileWatchDetail = {
  key: string
  type: FileWatchChangeType
  name: string
  source: "local" | "remote"
  at: number
}

export type FileWatchOptions = {
  intervalMs?: number
  initialType?: FileWatchChangeType
  onChange?: (detail: FileWatchDetail) => void
}

export const FILE_WATCH_EVENT = "mars3d:file-watch-change"

async function fingerprintRemote(url: string) {
  const response = await fetch(url, {
    method: "HEAD",
    cache: "no-store"
  })
  const etag = response.headers.get("etag") || ""
  const modified = response.headers.get("last-modified") || ""
  const length = response.headers.get("content-length") || ""
  return `${response.status}:${etag}:${modified}:${length}`
}

function fingerprintLocal(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`
}

function buildDetail(source: FileWatchSource, key: string, type: FileWatchChangeType): FileWatchDetail {
  if (source instanceof File) {
    return {
      key,
      type,
      name: source.name,
      source: "local",
      at: Date.now()
    }
  }
  return {
    key,
    type,
    name: String(source.name || source.url || key),
    source: "remote",
    at: Date.now()
  }
}

export function emitFileWatchChange(detail: FileWatchDetail) {
  window.dispatchEvent(new CustomEvent(FILE_WATCH_EVENT, { detail }))
}

export function onFileWatchChange(cb: (detail: FileWatchDetail) => void) {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<FileWatchDetail>).detail
    if (!detail?.key) {
      return
    }
    cb(detail)
  }
  window.addEventListener(FILE_WATCH_EVENT, handler as EventListener)
  return () => window.removeEventListener(FILE_WATCH_EVENT, handler as EventListener)
}

export function watchFile(source: FileWatchSource, options: FileWatchOptions = {}) {
  const intervalMs = Math.max(3000, Number(options.intervalMs) || 15000)
  const initialType = options.initialType || "updated"
  const key = source instanceof File ? `local:${source.name}:${source.lastModified}` : `remote:${source.id || source.url}`
  let timer = 0
  let active = true
  let lastFingerprint = ""
  let initialized = false

  const check = async () => {
    if (!active) {
      return
    }
    try {
      const nextFingerprint = source instanceof File ? fingerprintLocal(source) : await fingerprintRemote(String(source.url || ""))
      if (!initialized) {
        initialized = true
        lastFingerprint = nextFingerprint
        return
      }
      if (nextFingerprint !== lastFingerprint) {
        lastFingerprint = nextFingerprint
        const detail = buildDetail(source, key, initialType)
        emitFileWatchChange(detail)
        options.onChange?.(detail)
      }
    } catch {
      if (!initialized) {
        initialized = true
        return
      }
      const detail = buildDetail(source, key, "deleted")
      emitFileWatchChange(detail)
      options.onChange?.(detail)
    }
  }

  check().catch(() => {})
  timer = window.setInterval(() => {
    check().catch(() => {})
  }, intervalMs)

  return () => {
    active = false
    if (timer) {
      window.clearInterval(timer)
      timer = 0
    }
  }
}
