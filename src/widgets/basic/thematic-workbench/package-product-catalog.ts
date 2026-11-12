export type PackageProduct = {
  itemId: string
  collection: string
  asset: "visual" | "data"
  kind: "population" | "gdp" | "thermal-infrared" | "insar-deformation"
  status: "available" | "reference-only"
}

/**
 * Products explicitly delivered by the 2026-11 integration package.
 * Keep this list limited to package-backed items; missing business layers
 * must not be presented as if they were connected.
 */
export const packageProductCatalog: readonly PackageProduct[] = [
  { itemId: "SP-china-pop2020", collection: "spatial-thematic", asset: "visual", kind: "population", status: "available" },
  { itemId: "SP-china-gdp2020", collection: "spatial-thematic", asset: "visual", kind: "gdp", status: "available" },
  { itemId: "SP-landsat-lst-20260216", collection: "spatial-thematic", asset: "data", kind: "thermal-infrared", status: "available" },
  { itemId: "DEF-20261009151058-2ccbd7", collection: "insar-deformation", asset: "visual", kind: "insar-deformation", status: "available" }
]

export function packageProduct(itemId: string): PackageProduct | undefined {
  return packageProductCatalog.find(product => product.itemId === itemId)
}
