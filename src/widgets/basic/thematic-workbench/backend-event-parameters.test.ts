import { describe, expect, it } from "vitest"
import { readBackendEventParameters, readBackendEventVector, layerEventParameters } from "./backend-event-parameters"
import { matchesWorkflowItem, workflowAssets } from "./cartography-workflow"
import type { RemoteItem } from "./remote-cartography-source"

const scope = { west: 103, south: 32.5, east: 104.6, north: 34.1 }
const item: RemoteItem = { type: "Feature", id: "SP-jiuzhaigou2017-intensity", collection: "spatial-thematic", bbox: [103, 32.5, 104.6, 34.1], properties: { "proj:epsg": 4326, datetime: "2017-08-08T13:19:00Z", "event:place": "后台地名", "event:name": "后台事件名称", "event:epicenter": [103.82, 33.2], "eq:magnitude": 7, "eq:magnitude_mw": 6.5, "eq:depth_km": 20, "event:source": "随包参数表图片，不是地震目录接口记录" }, assets: {} }
describe("backend structured event parameters", () => {
  it("uses actual structured properties without deriving the epicenter from a bounding box", () => {
    const event = readBackendEventParameters(item)
    expect(event.event).toMatchObject({ time: "2017-08-08T13:19:00Z", longitude: 103.82, latitude: 33.2, magnitude: 7, magnitudeType: "", authority: "" })
    expect(event).toMatchObject({ depthKm: 20, mw: 6.5 })
    expect(matchesWorkflowItem(item, "event-parameters")).toBe(true)
    expect(workflowAssets(item, "event-parameters")[0].key).toBe("properties")
    const vector = readBackendEventVector(item, scope)
    expect(vector.features[0].geometry).toEqual({ type: "Point", coordinates: [103.82, 33.2] })
    expect(vector.metadata.referenceOnly).toBe(true)
    expect(vector.metadata.eventParameters.event.magnitudeType).toBe("")
  })
  it.each(["event:epicenter", "datetime", "event:source", "eq:magnitude"])("rejects missing %s rather than supplying frontend example values", key => {
    const changed = structuredClone(item); delete changed.properties[key]
    expect(() => readBackendEventParameters(changed)).toThrow()
  })
  it("rejects unqualified time zones, string-valued coordinates and relabelled CRS", () => {
    for (const patch of [{ datetime: "2017-08-08T21:19:00" }, { "event:epicenter": ["103.82", 33.2] }, { "proj:epsg": 4490 }]) { expect(() => readBackendEventParameters({ ...item, properties: { ...item.properties, ...patch } })).toThrow() }
    expect(() => readBackendEventVector(item, { west: 105, south: 32, east: 106, north: 34 })).toThrow("真实震中位于选区外")
  })
  it("does not carry a hidden source into a visible paper epicenter", () => {
    const layer = { role: "event", data: readBackendEventVector(item, scope) }
    expect(layerEventParameters([layer])?.event.longitude).toBe(103.82)
    expect(layerEventParameters([{ ...layer, enabled: false }])).toBeUndefined()
    expect(layerEventParameters([{ ...layer, opacity: 0 }])).toBeUndefined()
  })
})
