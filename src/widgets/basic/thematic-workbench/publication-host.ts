import type { InjectionKey } from "vue"

export type PublicationManifest = {
  version: "mars3d.thematic-publication.v1"
  id: string
  title: string
  topic: string
  usage: "internal-reviewed" | "operational"
  createdAt: string
  sourceSha256: string
  files: Array<{ path: string; bytes: number; sha256: string }>
}
export type PublicationPackage = { manifest: PublicationManifest; file: File; sha256: string }
export type PublicationReceipt = { status: "submitted" | "published"; publicationId: string; packageSha256: string; url?: string }
export type ThematicPublicationHost = {
  name: string
  description?: string
  storage?: "browser"
  openPublished?: (receipt: PublicationReceipt) => void
  publish: (input: { publication: PublicationManifest; archive: File; packageSha256: string; idempotencyKey: string; signal: AbortSignal }) => Promise<PublicationReceipt>
}

export const THEMATIC_PUBLICATION_HOST: InjectionKey<ThematicPublicationHost> = Symbol.for("mars3d.thematic.publication-host")

export async function publishToHost(host: ThematicPublicationHost, prepared: PublicationPackage, signal: AbortSignal): Promise<PublicationReceipt> {
  signal.throwIfAborted()
  let abort: () => void = () => undefined
  let result: PublicationReceipt
  try {
    const cancelled = new Promise<never>((_resolve, reject) => { abort = () => reject(new Error("目标平台提交已取消或超时")); signal.addEventListener("abort", abort, { once: true }) })
    result = await Promise.race([host.publish({ publication: structuredClone(prepared.manifest), archive: prepared.file, packageSha256: prepared.sha256, idempotencyKey: prepared.manifest.id, signal }), cancelled])
  } finally { signal.removeEventListener("abort", abort) }
  signal.throwIfAborted()
  if (!result || !["submitted", "published"].includes(result.status) || typeof result.publicationId !== "string" || !result.publicationId.trim() || result.packageSha256 !== prepared.sha256) { throw new Error("目标平台回执与本次发布包不一致，未确认发布成功") }
  let url: string | undefined
  if (result.url) {
    const parsed = new URL(result.url)
    if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) { throw new Error("目标平台返回的成果地址无效") }
    url = parsed.href
  }
  if (result.status === "published" && !url) { throw new Error("目标平台未返回可访问的成果地址，未确认发布成功") }
  return { status: result.status, publicationId: result.publicationId.trim(), packageSha256: result.packageSha256, url }
}
