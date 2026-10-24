import { jsPDF } from "jspdf"
import { canvasBlob } from "./export-media"
import { DBT_STANDARD, DBT_CLASSIFICATION } from "./dbt116-standard"

export function jpegWithDpi(bytes: Uint8Array, dpi: number) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || !Number.isInteger(dpi) || dpi < 300 || dpi > 1200) { throw new Error("JPEG 或输出 DPI 无效") }
  const copy = bytes.slice()
  let offset = 2
  while (offset + 18 < copy.length && copy[offset] === 0xff) {
    const marker = copy[offset + 1]
    if (marker === 0xda || marker === 0xd9) { break }
    const length = (copy[offset + 2] << 8) | copy[offset + 3]
    if (length < 2) { break }
    if (marker === 0xe0 && new TextDecoder().decode(copy.subarray(offset + 4, offset + 9)) === "JFIF\0") {
      copy[offset + 11] = 1
      const view = new DataView(copy.buffer); view.setUint16(offset + 12, dpi); view.setUint16(offset + 14, dpi)
      return copy
    }
    offset += 2 + length
  }
  const app0 = new Uint8Array([255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 2, 1, dpi >> 8, dpi & 255, dpi >> 8, dpi & 255, 0, 0])
  const output = new Uint8Array(bytes.length + app0.length); output.set(bytes.subarray(0, 2)); output.set(app0, 2); output.set(bytes.subarray(2), 20); return output
}
export async function encodeDbtMap(canvas: HTMLCanvasElement, format: "jpg" | "pdf", dpi: number, title: string, subject = `${DBT_STANDARD}; ${DBT_CLASSIFICATION}`) {
  if (dpi < 300 || canvas.width < Math.round(420 / 25.4 * dpi) || canvas.height < Math.round(297 / 25.4 * dpi)) { throw new Error("A3 输出必须达到所选 DPI，且不低于 300 DPI") }
  const jpeg = jpegWithDpi(new Uint8Array(await (await canvasBlob(canvas, "image/jpeg")).arrayBuffer()), dpi)
  if (format === "jpg") { return new Blob([jpeg], { type: "image/jpeg" }) }
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3", compress: true })
  pdf.setProperties({ title, subject: `${subject}; A3; ${dpi} DPI`, creator: "专题制图工作台" })
  pdf.addImage(jpeg, "JPEG", 0, 0, 420, 297)
  return pdf.output("blob")
}
