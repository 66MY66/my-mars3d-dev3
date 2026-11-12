import { describe, expect, it } from "vitest"
import { packageProductCatalog, packageProduct } from "./package-product-catalog"

describe("package product catalog", () => {
  it("exposes the real products declared by the 2026-11 integration package", () => {
    expect(packageProductCatalog.map(product => product.itemId)).toEqual([
      "SP-china-pop2020",
      "SP-china-gdp2020",
      "SP-landsat-lst-20260216",
      "DEF-20261009151058-2ccbd7"
    ])
  })

  it("returns undefined for a product that is not supplied by the package", () => {
    expect(packageProduct("SP-luding-intensity")).toBeUndefined()
  })
})
