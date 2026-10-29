import { describe, expect, it } from "vitest"
import {
  buildCatalogTree,
  filterMetadata,
  fromCatalog,
  fromMetadata,
  fromPool,
  fromShare,
  toPoolPayload,
  toSharePayload
} from "./adapters"

describe("satellite data adapters", () => {
  it("maps JEECG pool fields to the existing page model", () => {
    expect(fromPool({ id: "1", poolName: "光学池", totalCapacity: 100, usedCapacity: 25, satellites: "GF-1,GF-6", status: "正常" })).toMatchObject({
      poolId: "1", poolName: "光学池", usageRate: 25, satellites: ["GF-1", "GF-6"]
    })
    expect(toPoolPayload({ poolId: "1", satellites: ["GF-1", "GF-6"] })).toMatchObject({ id: "1", satellites: "GF-1,GF-6" })
  })

  it("maps metadata identity and observation time", () => {
    expect(fromMetadata({ id: "m1", observationTime: "2024-11-18 10:30:25", imageExtent: "北京市" })).toMatchObject({
      metadataId: "m1", acquisitionTime: "2024-11-18 10:30:25", region: "北京市"
    })
  })

  it("builds a stable catalog tree and keeps orphan nodes at root", () => {
    const tree = buildCatalogTree([
      fromCatalog({ id: "root", name: "根目录", parentId: "" }),
      fromCatalog({ id: "child", name: "子目录", parentId: "root" }),
      fromCatalog({ id: "orphan", name: "孤立目录", parentId: "missing" })
    ])
    expect(tree.map((node) => node.key)).toEqual(["root", "orphan"])
    expect(tree[0].children?.[0].key).toBe("child")
  })

  it("filters metadata using the existing query form", () => {
    const records = [
      fromMetadata({ id: "1", satellite: "GF-1", sensor: "PMS", resolution: 2, cloudCover: 5, dataType: "光学", observationTime: "2024-11-18 10:00:00" }),
      fromMetadata({ id: "2", satellite: "GF-6", sensor: "WFV", resolution: 16, cloudCover: 40, dataType: "光学", observationTime: "2024-10-01 10:00:00" })
    ]
    expect(filterMetadata(records, {
      satellite: ["GF-1"], sensor: ["PMS"], dataTypes: ["光学"], cloudCover: [0, 30], resolutionMin: 1, resolutionMax: 10, dateRange: []
    }).map((item) => item.metadataId)).toEqual(["1"])
  })

  it("round-trips share array fields", () => {
    expect(fromShare({ id: "s1", dataIds: "m1,m2", permissions: "查看,下载" })).toMatchObject({ authId: "s1", dataIds: ["m1", "m2"], permissions: ["查看", "下载"] })
    expect(toSharePayload({ authId: "s1", dataIds: ["m1"], permissions: ["查看", "下载"] })).toMatchObject({ id: "s1", dataIds: "m1", permissions: "查看,下载" })
  })
})
