import { describe, expect, it } from "vitest"
import { attachSourceRegistryToManifest, buildSourceRegistryKey, collectSourceRegistryEntries, findSourceRegistryEntry, prepareSingleSourceLoad } from "./source-registry"

describe("source-registry", () => {
  it("builds stable source keys", () => {
    expect(buildSourceRegistryKey("revision", "ds-1", "rev-2")).toBe("revision::ds-1::rev-2")
  })

  it("attaches registry metadata to manifest layers", () => {
    const manifest = attachSourceRegistryToManifest({
      manifestVersion: "1.0",
      layers: [
        { id: "l1", sourceType: "xyz" as any, sourceRef: "demo" }
      ]
    } as any, {
      key: "revision::ds::r1",
      label: "成果版本/r1",
      kind: "revision",
      groupId: "group-1"
    })

    expect((manifest.layers?.[0] as any)?.options?.sourceRegistryKey).toBe("revision::ds::r1")
    expect((manifest.layers?.[0] as any)?.options?.sourceRegistryGroupId).toBe("group-1")
  })

  it("detects duplicate source instances from map layers", () => {
    const map = {
      getLayers: () => ([
        {
          id: "layer-1",
          name: "图层1",
          options: {
            sourceRegistryKey: "api::demo",
            sourceRegistryLabel: "API/demo",
            sourceRegistryKind: "api",
            sourceRegistryGroupId: "group-1"
          }
        }
      ])
    } as any

    const entry = findSourceRegistryEntry(map, "api::demo")
    expect(entry?.groupId).toBe("group-1")
    expect(entry?.layerIds).toEqual(["layer-1"])
    expect(collectSourceRegistryEntries(map)).toHaveLength(1)
  })

  it("returns replace hint when strategy is replace", () => {
    const map = {
      getLayers: () => ([
        {
          id: "layer-1",
          name: "图层1",
          options: {
            sourceRegistryKey: "local::file",
            sourceRegistryLabel: "本地成果/demo.geojson"
          }
        }
      ])
    } as any

    expect(prepareSingleSourceLoad(map, { key: "local::file" }, "block")).toEqual({
      ok: false,
      shouldReplace: false,
      existing: expect.objectContaining({
        key: "local::file"
      })
    })

    expect(prepareSingleSourceLoad(map, { key: "local::file" }, "replace")).toEqual({
      ok: true,
      shouldReplace: true,
      existing: expect.objectContaining({
        key: "local::file"
      })
    })
  })
})
