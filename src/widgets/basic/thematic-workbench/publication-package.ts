import JSZip from "jszip"
import { activeReviewLayers, internalMapBlockers, internalReviewProblems, internalReviewSubject, type InternalMapReview, type InternalReviewSource } from "./internal-map-review"
import { cartographyFingerprint } from "./cartography-fingerprint"
import { refreshRemoteItem, type RemoteItem } from "./remote-cartography-source"
import { createStandardPublicationArchive } from "./standard-publication-delivery"
import type { StandardPublicationBundle } from "./standard-publication"
import type { PublicationManifest, PublicationPackage } from "./publication-host"

export type PublicationView = { file: File; layout: unknown }
export async function fileSha256(file: Blob) {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
  return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, "0")).join("")
}
export async function validatePublicationSources(source: InternalReviewSource, signal: AbortSignal) {
  const versions = new Map<string, RemoteItem>()
  const layers = activeReviewLayers(source.layers)
  for (const layer of layers) {
    signal.throwIfAborted()
    const binding = layer.onlineSource
    if (!binding) { continue }
    const key = JSON.stringify([binding.collection, binding.itemId])
    const current = versions.get(key) || await refreshRemoteItem({ collection: binding.collection, id: binding.itemId } as RemoteItem, signal)
    versions.set(key, current)
    if (await cartographyFingerprint(current) !== binding.sourceItemSha256) { throw new Error(`${layer.name} 的后台版本已变化，请重新叠加并审核`) }
    if ([current.properties["security:classification"], current.properties["data:security"]].some(value => /^(secret|top[_ -]?secret|classified|confidential|秘密|机密|绝密|涉密)$/i.test(String(value || "")))) { throw new Error(`${layer.name} 明确限制共享，不能交付发布`) }
  }
}
export async function createPublicationPackage(source: InternalReviewSource, input: { review?: InternalMapReview; view?: PublicationView; formal?: StandardPublicationBundle }, signal: AbortSignal): Promise<PublicationPackage> {
  signal.throwIfAborted()
  const sourceSha256 = await cartographyFingerprint(internalReviewSubject(source))
  if (!source.bounds || !source.title.trim() || !source.topic) { throw new Error("当前图件缺少范围或专题信息") }
  if (!input.formal) {
    const issues = [...internalMapBlockers(source), ...internalReviewProblems(input.review, sourceSha256)]
    if (issues.length) { throw new Error(issues.join("；")) }
    if (!input.view?.file.size || input.view.file.type !== "image/png") { throw new Error("请先完成当前图件排版并生成有效图像") }
  }
  const layers = activeReviewLayers(source.layers)
  await validatePublicationSources(source, signal)
  const zip = new JSZip()
  const files: PublicationManifest["files"] = []
  const add = async (path: string, blob: Blob) => { const bytes = new Uint8Array(await blob.arrayBuffer()); zip.file(path, bytes); files.push({ path, bytes: bytes.length, sha256: await fileSha256(blob) }) }
  const json = (value: unknown) => new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })
  if (input.formal) { await add("formal-document.zip", await createStandardPublicationArchive(input.formal)) } else {
    await add("composition.png", input.view!.file)
    await add("layout.json", json(input.view!.layout))
  }
  await add("map.json", json({ title: source.title, topic: source.topic, bounds: source.bounds, documentRevision: source.documentRevision, presentationKey: source.presentationKey, layers: layers.map(layer => ({ ...layer, raster: layer.raster ? { ...layer.raster, image: "" } : undefined })) }))
  await add("review.json", json(input.formal?.review || input.review))
  const manifest: PublicationManifest = { version: "mars3d.thematic-publication.v1", id: `THEMATIC-${crypto.randomUUID()}`, title: source.title.trim(), topic: source.topic, usage: input.formal ? "operational" : "internal-reviewed", createdAt: new Date().toISOString(), sourceSha256, files }
  zip.file("manifest.json", JSON.stringify(manifest, null, 2))
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" })
  signal.throwIfAborted()
  const file = new File([bytes], `${source.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80)}-发布包.zip`, { type: "application/zip" })
  return { manifest, file, sha256: await fileSha256(file) }
}
