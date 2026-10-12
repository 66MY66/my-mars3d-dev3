import JSZip from "jszip"
import type { Manifest, StacCollection, StacItem } from "../types/eoapi-types"
import { getRevisionManifest } from "../services/eoapi-datasets"

function safeFilenamePart(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || "untitled"
}

function guessExtension(mime?: string): string {
  if (!mime) {
    return ""
  }
  const m = mime.toLowerCase()
  if (m.includes("application/pdf")) {
    return ".pdf"
  }
  if (m.includes("application/geo+json") || m.includes("application/json")) {
    return ".json"
  }
  if (m.includes("text/csv")) {
    return ".csv"
  }
  if (m.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) {
    return ".xlsx"
  }
  if (m.includes("image/png")) {
    return ".png"
  }
  if (m.includes("image/jpeg")) {
    return ".jpg"
  }
  if (m.includes("text/plain")) {
    return ".txt"
  }
  return ""
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function fetchAsArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return await res.arrayBuffer()
}

export async function downloadDatasetZip(params: {
  dataset: StacCollection
  revision: StacItem
  filenamePrefix?: string
}): Promise<void> {
  const datasetId = params.dataset.id
  const revisionId = params.revision.id
  const title = params.dataset.title || params.dataset.id
  const revisionTitle = params.revision.properties?.title || revisionId

  const manifestResult = await getRevisionManifest(datasetId, revisionId)
  if (!manifestResult.success || !manifestResult.data) {
    throw new Error(manifestResult.message || "无法获取 manifest")
  }

  const manifest: Manifest = manifestResult.data
  const zip = new JSZip()

  zip.file("manifest.json", JSON.stringify(manifest, null, 2))
  zip.file("layer-config.json", JSON.stringify(manifest.layers || [], null, 2))
  zip.file(
    "dataset.json",
    JSON.stringify(
      {
        datasetId,
        title,
        revisionId,
        revisionTitle,
        exportedAt: Date.now()
      },
      null,
      2
    )
  )

  const artifactIndex: Array<{
    id: string
    name: string
    url: string
    mime: string
    size?: number
    fetched?: boolean
    error?: string
  }> = []

  const artifacts = manifest.artifacts || []
  for (const a of artifacts) {
    const nameBase = safeFilenamePart(a.name || a.id)
    const ext = guessExtension(a.mime)
    const path = `artifacts/${nameBase}${ext}`

    const entry = {
      id: a.id,
      name: a.name,
      url: a.url,
      mime: a.mime,
      size: a.size,
      fetched: false as boolean,
      error: "" as string
    }

    try {
      const buf = await fetchAsArrayBuffer(a.url)
      zip.file(path, buf)
      entry.fetched = true
    } catch (e: any) {
      entry.error = e?.message || "fetch failed"
      const fallbackTxt = `无法下载附件：${a.name}\nURL：${a.url}\n原因：${entry.error}\n`
      zip.file(`${path}.txt`, fallbackTxt)
    }

    artifactIndex.push(entry)
  }

  zip.file("artifacts/index.json", JSON.stringify(artifactIndex, null, 2))

  const blob = await zip.generateAsync({ type: "blob" })
  const prefix = safeFilenamePart(params.filenamePrefix || title)
  const filename = `${prefix}-${safeFilenamePart(revisionTitle)}.zip`
  triggerDownload(blob, filename)
}
