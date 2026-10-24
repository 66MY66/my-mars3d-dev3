import type { CartographySnapshot } from "./cartography-layout"

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) { crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0) }
  }
  return (crc ^ 0xffffffff) >>> 0
}

export async function embedCartographyMetadata(blob: Blob, metadata: CartographySnapshot): Promise<Blob> {
  const png = new Uint8Array(await blob.arrayBuffer())
  if (png.length < 20 || new DataView(png.buffer).getUint32(0) !== 0x89504e47) { throw new Error("导出图像不是有效 PNG") }
  const content = new TextEncoder().encode(`Cartography\0\0\0\0\0${JSON.stringify(metadata)}`)
  const chunk = new Uint8Array(content.length + 12)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, content.length)
  chunk.set(new TextEncoder().encode("iTXt"), 4)
  chunk.set(content, 8)
  view.setUint32(chunk.length - 4, crc32(chunk.subarray(4, chunk.length - 4)))
  return new Blob([png.subarray(0, png.length - 12), chunk, png.subarray(png.length - 12)], { type: "image/png" })
}
