export const MARS3D_BRANDING_SELECTOR = [
  ".cesium-credit-logoContainer",
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
    el.classList.contains("cesium-credit-logoContainer")
  )
}

/**
 * Mars3D 3.10.12 draws the free-edition badge as a ViewportQuad and tags it
 * with this flag before PrimitiveCollection.add. The flag appears only on that
 * quad, so other imagery, terrain, and vector primitives are left untouched.
 */
const MARS_LOGO_FLAG = "_mhan"
const MARS_LOGO_LOCK = Symbol.for("mars.logo.hidden")
const MARS_LOGO_GUARD = Symbol.for("mars.logo.guard")

type PrimitiveCollectionLike = {
  length: number
  add: (...args: any[]) => any
  get: (index: number) => any
  [MARS_LOGO_GUARD]?: { stop: () => void }
}

export function isMarsLogoPrimitive(primitive: unknown): boolean {
  return Boolean(primitive && (primitive as Record<string, unknown>)[MARS_LOGO_FLAG] === true)
}

export function concealMarsLogoPrimitive(primitive: any): boolean {
  if (!isMarsLogoPrimitive(primitive)) {
    return false
  }
  if (!primitive[MARS_LOGO_LOCK]) {
    try {
      Object.defineProperty(primitive, "show", {
        configurable: true,
        enumerable: true,
        get: () => false,
        set: () => {}
      })
      primitive[MARS_LOGO_LOCK] = true
    } catch {
      try {
        primitive.show = false
      } catch {
      }
    }
  }
  try {
    const rect = primitive.rectangle
    if (rect) {
      rect.width = 0
      rect.height = 0
    }
  } catch {
  }
  return true
}

export function sweepMarsLogoPrimitives(primitives: { length: number; get: (index: number) => any } | null | undefined): number {
  if (!primitives || typeof primitives.length !== "number" || typeof primitives.get !== "function") {
    return 0
  }
  let hidden = 0
  for (let i = 0; i < primitives.length; i++) {
    if (concealMarsLogoPrimitive(primitives.get(i))) {
      hidden += 1
    }
  }
  return hidden
}

export function installMarsLogoPrimitiveGuard(primitives: PrimitiveCollectionLike | null | undefined): () => void {
  if (!primitives || typeof primitives.add !== "function") {
    return () => {}
  }
  const existing = primitives[MARS_LOGO_GUARD]
  if (existing) {
    sweepMarsLogoPrimitives(primitives)
    return existing.stop
  }

  const rawAdd = primitives.add.bind(primitives)
  const guarded = function (this: unknown, ...args: any[]) {
    concealMarsLogoPrimitive(args[0])
    return rawAdd.apply(primitives, args)
  }
  primitives.add = guarded
  sweepMarsLogoPrimitives(primitives)

  const stop = () => {
    if (primitives.add === guarded) {
      primitives.add = rawAdd
    }
    delete primitives[MARS_LOGO_GUARD]
  }
  primitives[MARS_LOGO_GUARD] = { stop }
  return stop
}
