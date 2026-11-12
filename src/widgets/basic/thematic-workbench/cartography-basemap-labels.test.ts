import { expect, it } from "vitest"
import { cartographyBasemapLabels } from "./cartography-basemap-labels"
it("temporarily hides only separate annotation tiles and restores them when cartography ends", () => {
  const imagery = { show: true, type: "xyz", options: { url: "https://webst01.is.autonavi.com/appmaptile?style=6&x={x}" } }
  const labels = { show: true, type: "xyz", options: { url: "https://webst01.is.autonavi.com/appmaptile?style=8&x={x}" } }
  const business = { show: true, type: "xyz", options: { url: "/api/thematic/tiles/real-population" } }
  const mask = cartographyBasemapLabels(() => [imagery, labels, business])
  mask.apply(true)
  expect(labels.show).toBe(false); expect(imagery.show).toBe(true); expect(business.show).toBe(true)
  mask.apply(true); mask.restore(); expect(labels.show).toBe(true)
})
it("does not enable a layer which was already hidden by the user", () => {
  const labels = { show: false, type: "tdt", options: { layer: "img_z" } }
  const mask = cartographyBasemapLabels(() => [labels])
  mask.apply(true); mask.apply(false); expect(labels.show).toBe(false)
})
