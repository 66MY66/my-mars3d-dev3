import { jsPDF } from "jspdf"
import { GIFEncoder, quantize, applyPalette } from "gifenc"
import { Muxer, ArrayBufferTarget } from "mp4-muxer"
import type { CartographySnapshot } from "./cartography-layout"
import { embedCartographyMetadata } from "./cartography-png"

export const EXPORT_QUALITY = { standard: { label: "标准", width: 1280 }, high: { label: "高清", width: 2560 }, print: { label: "印刷", width: 3840 } } as const
export type ExportQuality = keyof typeof EXPORT_QUALITY
export type ExportFormat = "png" | "jpg" | "pdf"
export function canvasBlob(canvas: HTMLCanvasElement, mime = "image/png") {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("图像编码失败")), mime, 0.95))
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url; link.download = name.replace(/[\\/:*?"<>|]/g, "_")
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
export async function encodeMap(canvas: HTMLCanvasElement, format: ExportFormat, metadata: CartographySnapshot): Promise<Blob> {
  if (format === "png") { return embedCartographyMetadata(await canvasBlob(canvas), metadata) }
  if (format === "jpg") { return canvasBlob(canvas, "image/jpeg") }
  const width = canvas.width * 0.75; const height = canvas.height * 0.75
  const pdf = new jsPDF({ orientation: width > height ? "landscape" : "portrait", unit: "pt", format: [width, height], compress: true })
  pdf.setProperties({ title: metadata.settings.title, subject: metadata.settings.source, keywords: JSON.stringify(metadata) })
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, width, height)
  return pdf.output("blob")
}
export function mp4Mime(): string {
  return typeof VideoEncoder === "undefined" ? "" : "video/mp4"
}

// Draw fresh scene frames into one recording surface; never relabel WebM as MP4.
export async function recordMap(format: "mp4" | "gif", capture: () => Promise<HTMLCanvasElement>, seconds: number, signal: AbortSignal, progress: (value: number) => void): Promise<Blob> {
  if (!Number.isFinite(seconds)) { throw new Error("请输入有效的录制时长") }
  if (signal.aborted) { throw new DOMException("录制已取消", "AbortError") }
  const duration = Math.max(1, Math.min(15, seconds)) * 1000
  const first = await capture()
  const canvas = document.createElement("canvas")
  const scale = format === "gif" ? Math.min(1, 640 / first.width, 640 / first.height) : Math.min(1, 1920 / first.width, 1080 / first.height)
  canvas.width = Math.max(2, Math.floor(first.width * scale / 2) * 2)
  canvas.height = Math.max(2, Math.round(first.height * canvas.width / first.width / 2) * 2)
  const ctx = canvas.getContext("2d", { willReadFrequently: format === "gif" })!
  ctx.drawImage(first, 0, 0, canvas.width, canvas.height)
  const mime = format === "mp4" ? mp4Mime() : ""
  if (format === "mp4" && !mime) { throw new Error("当前浏览器不支持 MP4 编码，请使用新版 Chrome/Edge 或选择 GIF") }
  const gif = format === "gif" ? GIFEncoder() : null
  let recordingError: Error | null = null
  const target = new ArrayBufferTarget()
  const muxer = format === "mp4" ? new Muxer({ target, video: { codec: "avc", width: canvas.width, height: canvas.height }, fastStart: "in-memory", firstTimestampBehavior: "offset" }) : null
  const encoder = muxer ? new VideoEncoder({ output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata), error: err => { recordingError = err } }) : null
  if (encoder) {
    const config: VideoEncoderConfig = { codec: "avc1.42002a", width: canvas.width, height: canvas.height, bitrate: 6000000, framerate: 10, hardwareAcceleration: "prefer-software" }
    if (!(await VideoEncoder.isConfigSupported(config)).supported) { encoder.close(); throw new Error("当前设备不支持 H.264 编码，请选择 GIF") }
    try { encoder.configure(config) } catch (err) { encoder.close(); throw err }
  }
  const started = performance.now()
  let frameCount = 0
  try {
    while (performance.now() - started < duration) {
      if (signal.aborted) { throw new DOMException("录制已取消", "AbortError") }
      if (recordingError) { throw recordingError }
      const before = performance.now()
      const frame = await capture()
      ctx.drawImage(frame, 0, 0, canvas.width, canvas.height)
      if (encoder) {
        const videoFrame = new VideoFrame(canvas, { timestamp: Math.round((before - started) * 1000), duration: 100000 })
        encoder.encode(videoFrame, { keyFrame: frameCount % 20 === 0 }); videoFrame.close(); frameCount++
        if (encoder.encodeQueueSize > 5) { await encoder.flush() }
      }
      if (gif) {
        const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        const palette = quantize(rgba, 128)
        const indices = applyPalette(rgba, palette)
        const delay = Math.max(100, performance.now() - before)
        gif.writeFrame(indices, canvas.width, canvas.height, { palette, delay, repeat: 0 })
      }
      progress(Math.min(99, Math.round((performance.now() - started) / duration * 100)))
      await new Promise(resolve => setTimeout(resolve, Math.max(0, 100 - (performance.now() - before))))
    }
    if (signal.aborted) { throw new DOMException("录制已取消", "AbortError") }
    if (gif) { gif.finish(); return new Blob([gif.bytes()], { type: "image/gif" }) }
    await encoder!.flush()
    if (recordingError || !frameCount) { throw recordingError || new Error("录制内容为空") }
    muxer!.finalize()
    return new Blob([target.buffer], { type: "video/mp4" })
  } finally {
    if (encoder && encoder.state !== "closed") { encoder.close() }
  }
}
