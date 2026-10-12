import axios from "axios"

export type QuickIdentifyCategory = "macro" | "precursor" | "deformation"
export type MacroAnomalyType = "groundwater" | "bio" | "geosound" | "geolight" | "electromagnetic" | "meteorology"
export type PrecursorAnomalyType = "deformation" | "electromagnetic" | "fluid" | "seismicity"
export type DeformationMethod = "nonTidal" | "slopeDiff" | "adaptiveThreshold" | "klFit"

export type QuickIdentifyRequest = {
  regionType: "disaster" | "generic"
  ring: Array<[number, number]>
  category?: QuickIdentifyCategory
  macroType?: MacroAnomalyType
  precursorType?: PrecursorAnomalyType
  deformationMethod?: DeformationMethod
  timeRange?: [string, string]
  products?: string[]
  thresholds?: Record<string, any>
  clientContext?: Record<string, any>
}

export type QuickIdentifyJobStatus = {
  jobId: string
  status: "queued" | "running" | "done" | "failed" | "canceled"
  progress: number
  summary?: { anomalyCount?: number; anomalyAreaM2?: number; byType?: Record<string, number> }
  resultLayers?: Array<{ type: "geojson" | "tiles" | "raster"; name: string; url?: string }>
  resultGeojson?: any
  records?: any[]
  reportUrl?: string
  error?: string
}

function joinUrl(base: string, path: string) {
  const b = base.endsWith("/") ? base : `${base}/`
  const p = path.startsWith("/") ? path.slice(1) : path
  return `${b}${p}`
}

const mockJobs = new Map<
  string,
  {
    createdAt: number
    durationMs: number
    request: QuickIdentifyRequest
    canceled: boolean
  }
>()

function randomInRange(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function bboxOfRing(ring: Array<[number, number]>) {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  ring.forEach(([lng, lat]) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return
    }
    minLng = Math.min(minLng, lng)
    minLat = Math.min(minLat, lat)
    maxLng = Math.max(maxLng, lng)
    maxLat = Math.max(maxLat, lat)
  })
  return { minLng, minLat, maxLng, maxLat }
}

function mockMacroGeojson(ring: Array<[number, number]>, count: number, macroType: MacroAnomalyType) {
  const b = bboxOfRing(ring)
  const now = Date.now()
  const features = Array.from({ length: count }, (_, i) => {
    const lng = randomInRange(b.minLng, b.maxLng)
    const lat = randomInRange(b.minLat, b.maxLat)
    const level = 1 + Math.floor(Math.random() * 3)
    let typeText = "气象异常"
    if (macroType === "groundwater") {
      typeText = "地下水异常"
    } else if (macroType === "bio") {
      typeText = "生物异常"
    } else if (macroType === "geosound") {
      typeText = "地声异常"
    } else if (macroType === "geolight") {
      typeText = "地光异常"
    } else if (macroType === "electromagnetic") {
      typeText = "电磁异常"
    }
    const title = `${typeText}#${i + 1}`
    const time = new Date(now - Math.floor(Math.random() * 7) * 24 * 3600 * 1000).toISOString()
    const mediaUrls = [
      "https://data.mars3d.cn/img/marker/mark1.png",
      "https://data.mars3d.cn/img/marker/mark2.png"
    ]
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        idx: i + 1,
        kind: "macro",
        macroType,
        typeText,
        level,
        title,
        time,
        observer: `观测者${(i % 8) + 1}`,
        desc: `${typeText}现象描述（mock）：出现异常变化，建议关注。`,
        mediaUrls
      }
    }
  })
  return { type: "FeatureCollection", features }
}

function mockInstrumentGeojson(
  ring: Array<[number, number]>,
  count: number,
  kind: "precursor" | "deformation",
  subType: string
) {
  const b = bboxOfRing(ring)
  const features = Array.from({ length: count }, (_, i) => {
    const lng = randomInRange(b.minLng, b.maxLng)
    const lat = randomInRange(b.minLat, b.maxLat)
    const level = 1 + Math.floor(Math.random() * 3)
    const value = Math.max(1, Math.min(100, Math.round(10 + 90 * Math.random())))
    const title = kind === "precursor" ? `前兆监测点${i + 1}` : `形变站点${i + 1}`
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        idx: i + 1,
        kind,
        subType,
        level,
        value,
        title,
        confidence: Math.round((0.5 + Math.random() * 0.5) * 100) / 100
      }
    }
  })
  return { type: "FeatureCollection", features }
}

function isMockEnabled() {
  const apiLocal = String((process.env.API_LOCAL as any) ?? "")
  return apiLocal === "1"
}

export async function createQuickIdentifyJob(req: QuickIdentifyRequest) {
  if (isMockEnabled()) {
    const jobId = `qi_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`
    mockJobs.set(jobId, { createdAt: Date.now(), durationMs: 6_000, request: req, canceled: false })
    return { jobId, status: "queued" as const }
  }

  const base = (process.env.API_BASE as string) || "/v1/"
  const url = joinUrl(base, "identify/quick")
  const res = await axios.post(url, req, { timeout: 60_000 })
  return res.data as { jobId: string; status?: string }
}

export async function getQuickIdentifyJob(jobId: string): Promise<QuickIdentifyJobStatus> {
  if (isMockEnabled()) {
    const job = mockJobs.get(jobId)
    if (!job) {
      return { jobId, status: "failed", progress: 1, error: "job not found" }
    }
    if (job.canceled) {
      return { jobId, status: "canceled", progress: 1 }
    }
    const elapsed = Date.now() - job.createdAt
    const progress = Math.max(0, Math.min(1, elapsed / job.durationMs))
    if (progress < 0.12) {
      return { jobId, status: "queued", progress }
    }
    if (progress < 1) {
      return {
        jobId,
        status: "running",
        progress,
        summary: { anomalyCount: Math.floor(10 + progress * 90) }
      }
    }
    const category: QuickIdentifyCategory = (job.request.category as any) || "precursor"
    if (category === "macro") {
      const macroType: MacroAnomalyType = (job.request.macroType as any) || "groundwater"
      const anomalyCount = 35
      return {
        jobId,
        status: "done",
        progress: 1,
        summary: { anomalyCount, byType: { [macroType]: anomalyCount } },
        resultGeojson: mockMacroGeojson(job.request.ring, anomalyCount, macroType)
      }
    }
    if (category === "deformation") {
      const method: DeformationMethod = (job.request.deformationMethod as any) || "nonTidal"
      const anomalyCount = 60
      return {
        jobId,
        status: "done",
        progress: 1,
        summary: { anomalyCount, anomalyAreaM2: 120_000, byType: { [method]: anomalyCount } },
        resultGeojson: mockInstrumentGeojson(job.request.ring, Math.min(180, anomalyCount * 2), "deformation", method)
      }
    }
    const precursorType: PrecursorAnomalyType = (job.request.precursorType as any) || "deformation"
    const anomalyCount = 80
    return {
      jobId,
      status: "done",
      progress: 1,
      summary: { anomalyCount, anomalyAreaM2: 120_000, byType: { [precursorType]: anomalyCount } },
      resultGeojson: mockInstrumentGeojson(job.request.ring, Math.min(180, anomalyCount * 2), "precursor", precursorType)
    }
  }

  const base = (process.env.API_BASE as string) || "/v1/"
  const url = joinUrl(base, `identify/quick/${encodeURIComponent(jobId)}`)
  const res = await axios.get(url, { timeout: 60_000 })
  return res.data as QuickIdentifyJobStatus
}

export async function cancelQuickIdentifyJob(jobId: string) {
  if (isMockEnabled()) {
    const job = mockJobs.get(jobId)
    if (job) {
      job.canceled = true
    }
    return { success: true }
  }
  const base = (process.env.API_BASE as string) || "/v1/"
  const url = joinUrl(base, `identify/quick/${encodeURIComponent(jobId)}`)
  const res = await axios.delete(url, { timeout: 60_000 })
  return res.data as { success: boolean }
}
