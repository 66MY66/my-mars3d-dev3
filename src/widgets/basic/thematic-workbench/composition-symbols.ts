import { Aiming, Abnormal, Mountain, Water, Flag } from "@icon-park/svg"
import { cartographySymbolDefinitions, type CartographySymbolKind } from "./template-icon-registry"
import pngManifest from "./symbol-assets/dbt116-png.json"

const legacyRenderers: Record<string, typeof Aiming> = { aiming: Aiming, abnormal: Abnormal, mountain: Mountain, water: Water, flag: Flag }
const assets = import.meta.glob<string>("./symbol-assets/ocha-*.svg", { eager: true, query: "?raw", import: "default" })
const standardAssets = import.meta.glob<string>("./symbol-assets/dbt116-*.png", { eager: true, query: "?inline", import: "default" })
const templates = new Map<string, Element>()

function ochaTemplate(asset: string) {
  const cached = templates.get(asset)
  if (cached) { return cached }
  const raw = assets[`./symbol-assets/ocha-${asset}.svg`]
  if (!raw) { throw new Error(`Missing OCHA symbol: ${asset}`) }
  const svg = new DOMParser().parseFromString(raw, "image/svg+xml").documentElement
  svg.querySelectorAll("defs, title").forEach(node => node.remove())
  for (const node of [svg, ...svg.querySelectorAll("*")]) {
    node.removeAttribute("id"); node.removeAttribute("class"); node.removeAttribute("style")
  }
  svg.setAttribute("width", "512"); svg.setAttribute("height", "512")
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet")
  templates.set(asset, svg)
  return svg
}

export function compositionSymbolSvg(kind: CartographySymbolKind, color: string) {
  const binding = cartographySymbolDefinitions[kind]
  if (binding.standardAsset) {
    const file = binding.standardAsset.replace(/\.svg$/, ".png") as keyof typeof pngManifest
    const size = pngManifest[file]
    const height = 512 * size.height / size.width
    return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="${height}" viewBox="0 0 512 ${height}"><image width="100%" height="100%" href="${compositionSymbolImage(kind, color)}"/></svg>`
  }
  const fill = /^#[\da-f]{6}$/i.test(color) ? color : binding.accent
  if (binding.asset) {
    const svg = ochaTemplate(binding.asset).cloneNode(true) as Element
    svg.setAttribute("fill", fill)
    return new XMLSerializer().serializeToString(svg)
  }
  return legacyRenderers[binding.icon]({ theme: "outline", fill, size: 512 })
}

export function compositionSymbolImage(kind: CartographySymbolKind, color: string) {
  const binding = cartographySymbolDefinitions[kind]
  if (binding.standardAsset) {
    const file = binding.standardAsset.replace(/\.svg$/, ".png")
    const url = standardAssets[`./symbol-assets/${file}`]
    if (!url) { throw new Error(`Missing standard PNG: ${file}`) }
    return url
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(compositionSymbolSvg(kind, color))}`
}
