import * as mars3d from "mars3d"
import { layoutCartographyText } from "./cartography-text"
import { placeCartographyLabels, type GeographicLabel, type LabelCandidate, type LabelBox } from "./cartography-labels"
import { cartographyBasemapLabels } from "./cartography-basemap-labels"

export function createNativeLabelOverlay(map: mars3d.Map, read: () => Array<GeographicLabel & { opacity: number }>, readFrame?: () => LabelBox | null) {
  const layer = new mars3d.layer.GraphicLayer({ id: "thematic-workbench-automatic-labels", name: "专题自动注记" })
  map.addLayer(layer)
  const context = document.createElement("canvas").getContext("2d")!
  const basemapLabels = cartographyBasemapLabels(() => map.getLayers({ basemaps: true, layers: false }))
  let dirty = true; let signature = ""; let destroyed = false
  const update = () => {
    if (destroyed) { return }
    const canvas = map.scene.canvas
    const next = `${canvas.clientWidth}:${canvas.clientHeight}:${Array.from({ length: 16 }, (_, i) => map.camera.viewMatrix[i]).join(",")}`
    if (!dirty && next === signature) { return }
    signature = next; dirty = false; layer.clear()
    const source = read(); const entries = new Map<string, { label: GeographicLabel & { opacity: number }; lines: string[]; size: number; position: number[] }>()
    basemapLabels.apply(source.some(label => !!label.repeatKey))
    const labels: LabelCandidate[] = []
    for (const label of source) {
      const cartographic = mars3d.Cesium.Cartographic.fromDegrees(label.position[0], label.position[1])
      const height = map.scene.globe.getHeight(cartographic) || 0
      const position = [label.position[0], label.position[1], height]
      const cartesian = mars3d.LngLatPoint.toCartesian(position)
      if (map.scene.mode === mars3d.Cesium.SceneMode.SCENE3D) {
        const delta = mars3d.Cesium.Cartesian3.subtract(cartesian, map.camera.positionWC, new mars3d.Cesium.Cartesian3())
        const length = mars3d.Cesium.Cartesian3.magnitude(delta)
        if (!length) { continue }
        const ray = new mars3d.Cesium.Ray(map.camera.positionWC, mars3d.Cesium.Cartesian3.normalize(delta, delta))
        const hit = mars3d.Cesium.IntersectionTests.rayEllipsoid(ray, mars3d.Cesium.Ellipsoid.WGS84)
        if (hit && hit.start < length - Math.max(100, Math.abs(height) + 1)) { continue }
      }
      const p = mars3d.PointTrans.toWindowCoordinates(map.scene, cartesian)
      if (!p || p.x < 0 || p.x > canvas.clientWidth || p.y < 0 || p.y > canvas.clientHeight) { continue }
      const size = Math.max(13, Math.round(label.size * 0.8))
      const measure = (value: string) => { context.font = `${label.bold ? "bold " : ""}${size}px "Microsoft YaHei", sans-serif`; return context.measureText(value).width }
      const width = Math.min(220, measure(label.text) + 8)
      const layout = layoutCartographyText(label.text, width - 4, 300, size, measure)
      labels.push({ ...label, x: p.x, y: p.y, w: width, h: layout.height, radius: Math.min(20, label.radius) })
      entries.set(label.id, { label, lines: layout.lines, size, position })
    }
    const selected = readFrame?.()
    const x = Math.max(0, selected?.x || 0); const y = Math.max(0, selected?.y || 0)
    const right = Math.min(canvas.clientWidth, selected ? selected.x + selected.w : canvas.clientWidth)
    const bottom = Math.min(canvas.clientHeight, selected ? selected.y + selected.h : canvas.clientHeight)
    const result = placeCartographyLabels(labels, { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) }, [], 28)
    for (const entry of result.placed) {
      const data = entries.get(entry.id)!
      layer.addGraphic(new mars3d.graphic.LabelEntity({
 position: data.position,
attr: { label: data.label.text },
style: {
        text: data.lines.join("\n"),
font_size: data.size,
font_weight: data.label.bold ? "bold" : "normal",
color: data.label.color || "#17233d",
opacity: data.label.opacity,
        outline: true,
outlineColor: "#ffffff",
outlineWidth: 3,
pixelOffsetX: entry.box.x - entry.x + 2,
pixelOffsetY: entry.box.y - entry.y + 2,
        horizontalOrigin: mars3d.Cesium.HorizontalOrigin.LEFT,
verticalOrigin: mars3d.Cesium.VerticalOrigin.TOP
      } 
}))
    }
    map.fire("thematicLabelLayout", { placed: result.placed.length, unplaced: result.skipped.filter(entry => !["outside", "generalized", "duplicate"].includes(entry.reason)), generalized: result.skipped.filter(entry => ["generalized", "duplicate"].includes(entry.reason)), overflow: result.skipped.filter(entry => entry.reason === "limit").length })
  }
  const terrain = () => { dirty = true }
  const basemapChanged = () => { dirty = true; map.scene.requestRender() }
  map.on(mars3d.EventType.changeBasemap, basemapChanged)
  const remove = map.scene.postRender.addEventListener(update)
  const removeTerrain = map.scene.globe.tileLoadProgressEvent.addEventListener(terrain)
  return {
    refresh: () => { dirty = true; map.scene.requestRender() },
    destroy: () => { destroyed = true; remove(); removeTerrain(); map.off(mars3d.EventType.changeBasemap, basemapChanged); basemapLabels.restore(); map.removeLayer(layer, true) }
  }
}
