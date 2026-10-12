export const MARS3D_BRANDING_SELECTOR = [
  ".cesium-widget-credits",
  ".cesium-credit-logoContainer",
  ".cesium-credit-textContainer",
  ".cesium-credit-expand-link",
  ".cesium-credit-lightbox",
  'a[href*="mars3d.cn"]',
  'a[href*="marsgis"]',
  'a[href*="mars3d"]',
  'img[src*="mars3d.cn"]',
  'img[src*="marsgis"]',
  'img[src*="mars3d"]'
].join(",")

const MARS3D_BRANDING_TEXT = /火星科技|合肥火星科技有限公司|mars3d\.cn|marsgis/i

export function isMarsBrandingElement(el: Element): boolean {
  const text = (el.textContent || "").trim()
  const href = (el as HTMLAnchorElement).href || ""
  const src = (el as HTMLImageElement).src || ""

  return (
    Boolean(href && /(mars3d\.cn|marsgis)/i.test(href)) ||
    Boolean(src && /(mars3d\.cn|marsgis)/i.test(src)) ||
    Boolean(text && MARS3D_BRANDING_TEXT.test(text)) ||
    el.classList.contains("cesium-widget-credits") ||
    el.classList.contains("cesium-credit-logoContainer") ||
    el.classList.contains("cesium-credit-textContainer") ||
    el.classList.contains("cesium-credit-expand-link") ||
    el.classList.contains("cesium-credit-lightbox")
  )
}
