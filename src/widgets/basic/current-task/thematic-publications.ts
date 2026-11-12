import { createStore, get, set, keys } from "idb-keyval"
import JSZip from "jszip"
import type { PublicationManifest, ThematicPublicationHost } from "../thematic-workbench/publication-host"

const storage = createStore("mars3d-current-task-publications-v1", "publications")
export const TASK_PUBLICATION_EVENT = "mars3d:task-publication-saved"
const prefix = "publication:"
export const DEFAULT_PUBLICATION_DATASET = "local_thematic_publications"
export type TaskPublication = {
  id: string
  datasetId: string
  datasetName: string
  manifest: PublicationManifest
  packageSha256: string
  fileName: string
  bytes: number
  savedAt: string
}
type PublishInput = Parameters<ThematicPublicationHost["publish"]>[0]
export type PublicationContext = { datasetId?: string; name?: string }
const inFlight = new Map<string, Promise<TaskPublication>>()

async function digest(blob: Blob) {
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("")
}

async function verifyArchive(archive: Blob, manifest: PublicationManifest, expectedHash: string, signal: AbortSignal) {
  signal.throwIfAborted()
  if (await digest(archive) !== expectedHash) { throw new Error("专题图发布包校验失败，未保存到当前任务") }
  const zip = await JSZip.loadAsync(new Uint8Array(await archive.arrayBuffer()))
  const savedManifest = zip.file("manifest.json")
  if (!savedManifest || JSON.stringify(JSON.parse(await savedManifest.async("string"))) !== JSON.stringify(manifest)) {
    throw new Error("发布包清单与当前图件不一致")
  }
  for (const entry of manifest.files) {
    signal.throwIfAborted()
    const file = zip.file(entry.path)
    if (!file) { throw new Error(`发布包缺少 ${entry.path}`) }
    const bytes = await file.async("uint8array")
    if (bytes.byteLength !== entry.bytes || await digest(new Blob([bytes])) !== entry.sha256) {
      throw new Error(`发布包中的 ${entry.path} 校验失败`)
    }
  }
  signal.throwIfAborted()
  return zip
}

export async function listTaskPublications(datasetId: string): Promise<TaskPublication[]> {
  if (!datasetId) { return [] }
  const recordKeys = (await keys(storage)).filter(key => typeof key === "string" && key.startsWith(prefix))
  const records = await Promise.all(recordKeys.map(key => get<TaskPublication>(key, storage)))
  return records.filter((record): record is TaskPublication => !!record && record.datasetId === datasetId)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export async function readTaskPublication(id: string, datasetId: string) {
  const record = await get<TaskPublication>(prefix + id, storage)
  if (!record || record.datasetId !== datasetId) { throw new Error("当前任务中没有这份专题图") }
  const archive = await get<Blob>("archive:" + id, storage)
  if (!archive) { throw new Error("专题图文件缺失，请重新发布") }
  const zip = await verifyArchive(archive, record.manifest, record.packageSha256, new AbortController().signal)
  return { record, archive, zip }
}

export async function saveTaskPublication(input: PublishInput, context: PublicationContext): Promise<TaskPublication> {
  const { publication, archive, packageSha256, idempotencyKey, signal } = input
  signal.throwIfAborted()
  if (publication.version !== "mars3d.thematic-publication.v1" || !publication.id || !publication.title?.trim() ||
      !Array.isArray(publication.files) || !publication.files.length || idempotencyKey !== publication.id || !/^[a-f0-9]{64}$/.test(packageSha256)) {
    throw new Error("专题图发布清单无效")
  }
  const datasetId = context.datasetId?.trim() || DEFAULT_PUBLICATION_DATASET
  const running = inFlight.get(publication.id)
  if (running) {
    const saved = await running
    signal.throwIfAborted()
    if (saved.datasetId !== datasetId || saved.packageSha256 !== packageSha256) { throw new Error("同一发布编号已用于另一份图件") }
    return saved
  }
  const work = async () => {
    const previous = await get<TaskPublication>(prefix + publication.id, storage)
    if (previous) {
      if (previous.datasetId !== datasetId || previous.packageSha256 !== packageSha256) { throw new Error("同一发布编号已用于另一份图件") }
      await readTaskPublication(previous.id, datasetId)
      signal.throwIfAborted()
      return previous
    }
    await verifyArchive(archive, publication, packageSha256, signal)
    // Commit the list entry only after the complete archive was persisted and read back.
    await set("archive:" + publication.id, archive, storage)
    const stored = await get<Blob>("archive:" + publication.id, storage)
    if (!stored) { throw new Error("专题图文件保存失败") }
    await verifyArchive(stored, publication, packageSha256, signal)
    const record: TaskPublication = {
      id: publication.id,
datasetId,
datasetName: context.name?.trim() || context.datasetId || "专题制图成果",
      manifest: structuredClone(publication),
packageSha256,
fileName: archive.name,
      bytes: archive.size,
savedAt: new Date().toISOString()
    }
    signal.throwIfAborted()
    await set(prefix + record.id, record, storage)
    const saved = await get<TaskPublication>(prefix + record.id, storage)
    if (!saved || saved.packageSha256 !== packageSha256 || saved.datasetId !== datasetId) { throw new Error("当前任务发布记录保存失败") }
    signal.throwIfAborted()
    window.dispatchEvent(new CustomEvent(TASK_PUBLICATION_EVENT, { detail: saved }))
    return saved
  }
  const pending = work()
  inFlight.set(publication.id, pending)
  try { return await pending } finally { inFlight.delete(publication.id) }
}
