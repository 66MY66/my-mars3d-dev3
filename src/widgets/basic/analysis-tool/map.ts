import * as mars3d from "mars3d"
import { runBufferAnalysis, runNeighborAnalysis, runOverlayAnalysis, type AnalysisTarget } from "@/api/spatialAnalysis"

let map: mars3d.Map // mars3d.Map三维地图对象
let polygonLayer: any = null
let pointLayer: any = null
let heatLayer: any = null
let lastFeatureCollection: any = null
let lastPointItems: Array<{
  idx: number
  lng: number
  lat: number
  level: number
  name: string
  properties: any
  graphic: any
}> = []
let lastSelectedGraphic: any = null
let drawLayer: any = null
let lastTargetGraphic: any = null

// 初始化当前业务
export function onMounted(mapInstance: mars3d.Map): void {
  map = mapInstance // 记录map
}

// 释放当前业务
export function onUnmounted(): void {
  try {
    if (polygonLayer) {
      map?.removeLayer(polygonLayer, true)
      polygonLayer = null
    }
    if (pointLayer) {
      map?.removeLayer(pointLayer, true)
      pointLayer = null
    }
    if (heatLayer) {
      map?.removeLayer(heatLayer, true)
      heatLayer = null
    }
    if (drawLayer) {
      map?.removeLayer(drawLayer, true)
      drawLayer = null
      lastTargetGraphic = null
    }
  } catch {}
  map = null
}

function ensureLayers() {
  if (!map) {
    return
  }
  if (!polygonLayer) {
    polygonLayer = new mars3d.layer.GraphicLayer({ name: "分析结果-面" })
    map.addLayer(polygonLayer)
  }
  if (!pointLayer) {
    pointLayer = new mars3d.layer.GraphicLayer({ name: "分析结果-点" })
    map.addLayer(pointLayer)
  }
}

function ensureDrawLayer() {
  if (!map) {
    return null
  }
  if (!drawLayer) {
    drawLayer = new mars3d.layer.GraphicLayer({ name: "分析对象-圈选" })
    map.addLayer(drawLayer)
  }
  return drawLayer
}

export function clearAnalysisResult() {
  ensureLayers()
  polygonLayer?.clear?.()
  pointLayer?.clear?.()
  if (heatLayer) {
    map.removeLayer(heatLayer, true)
    heatLayer = null
  }
  lastFeatureCollection = null
  lastPointItems = []
  lastSelectedGraphic = null
}

export function clearTargetGraphic() {
  const layer = ensureDrawLayer()
  if (!layer) {
    return
  }
  const g = lastTargetGraphic
  lastTargetGraphic = null
  try {
    if (g) {
      layer.removeGraphic?.(g)
    }
  } catch {}
  try {
    if (g) {
      layer.remove?.(g)
    }
  } catch {}
}

function tryGetRingFromGraphic(graphic: any): Array<[number, number]> | null {
  try {
    const gj = graphic?.toGeoJSON?.()
    const coords = gj?.geometry?.coordinates
    if (Array.isArray(coords) && Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
      const ring = coords[0]
        .filter((c: any) => Array.isArray(c) && c.length >= 2)
        .map((c: any) => [Number(c[0]), Number(c[1])] as [number, number])
      if (ring.length >= 3) {
        return ring
      }
    }
  } catch {}
  try {
    const positions = graphic?.positions || graphic?._positions
    if (Array.isArray(positions) && positions.length >= 3) {
      const ring = positions
        .map((p: any) => {
          const pt = mars3d.LngLatPoint.fromCartesian(p)
          return pt ? ([pt.lng, pt.lat] as [number, number]) : null
        })
        .filter(Boolean) as Array<[number, number]>
      if (ring.length >= 3) {
        return ring
      }
    }
  } catch {}
  return null
}

export async function startSelectTarget(type: "rectangle" | "polygon"): Promise<{ ring: Array<[number, number]> } | null> {
  const layer = ensureDrawLayer()
  if (!layer) {
    return null
  }
  try {
    layer.clear?.()
  } catch {}
  lastTargetGraphic = null
  return new Promise((resolve) => {
    try {
      layer.startDraw({
        type,
        style: {
          fill: true,
          color: "rgba(255,255,0,0.2)",
          outline: true,
          outlineWidth: 2,
          outlineColor: "rgba(255,255,0,1)"
        },
        success: function (graphic: any) {
          lastTargetGraphic = graphic
          const ring = tryGetRingFromGraphic(graphic)
          if (!ring || ring.length < 3) {
            resolve(null)
            return
          }
          resolve({ ring })
        }
      })
    } catch {
      resolve(null)
    }
  })
}

function getRingBbox(ring: Array<[number, number]>): [number, number, number, number] | null {
  if (!ring || ring.length < 3) {
    return null
  }
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  ring.forEach(([lng, lat]) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return
    }
    west = Math.min(west, lng)
    south = Math.min(south, lat)
    east = Math.max(east, lng)
    north = Math.max(north, lat)
  })
  if (!Number.isFinite(west) || !Number.isFinite(south) || !Number.isFinite(east) || !Number.isFinite(north)) {
    return null
  }
  return [west, south, east, north]
}

export function flyToRing(ring: Array<[number, number]>, duration?: number) {
  if (!map) {
    return
  }
  const bbox = getRingBbox(ring)
  if (!bbox) {
    return
  }
  const Cesium = mars3d.Cesium
  map.camera.flyTo({
    destination: Cesium.Rectangle.fromDegrees(bbox[0], bbox[1], bbox[2], bbox[3]),
    duration: duration ?? 1.2
  })
}

function addPolygon(positions: any, style: any, attr: any) {
  const g = new mars3d.graphic.PolygonEntity({
    positions,
    style,
    attr
  })
  polygonLayer.addGraphic(g)
  return g
}

function addPoint(lng: number, lat: number, style: any, attr: any) {
  const g = new mars3d.graphic.PointEntity({
    position: [lng, lat],
    style,
    attr
  })
  pointLayer.addGraphic(g)
  return g
}

function renderFeatureCollection(fc: any, toolType: string) {
  clearAnalysisResult()
  if (!fc || fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
    return
  }
  lastFeatureCollection = fc

  const neighborMeta = fc.features.find((f: any) => f?.geometry?.type === "Polygon" && f?.properties?.analysis === "neighbor")?.properties || null
  const neighborRender = String(neighborMeta?.render ?? "heat+point")
  const neighborHeatRadius = Number(neighborMeta?.heatRadius ?? 28)
  const showPoints = toolType !== "neighbor" ? true : neighborRender === "heat+point" || neighborRender === "point"
  const showHeat = toolType === "neighbor" && (neighborRender === "heat+point" || neighborRender === "heat")

  let pointIdx = 0
  const heatPositions: Array<{ lng: number; lat: number; value: number }> = []
  fc.features.forEach((f: any) => {
    const geom = f?.geometry
    const props = f?.properties || {}

    if (geom?.type === "Polygon" && Array.isArray(geom.coordinates?.[0])) {
      const positions = geom.coordinates as any
      const role = props.role
      const isResult = role === "Result" || props.operation
      const isA = role === "A"
      const isB = role === "B"

      let style: any = { color: "#1677ff", opacity: 0.2, outline: true, outlineColor: "#1677ff", outlineWidth: 2 }
      if (toolType === "buffer") {
        const opacity = Number(props.opacity ?? 0.7)
        if (props.level === "core") {
          style = { color: "#d50000", opacity: Math.min(0.6, opacity), outline: true, outlineColor: "#d50000", outlineWidth: 2 }
        } else if (props.level === "transition") {
          style = { color: "#ff6d00", opacity: Math.min(0.4, opacity), outline: true, outlineColor: "#ff6d00", outlineWidth: 2 }
        } else if (props.level === "edge") {
          style = { color: "#ffea00", opacity: Math.min(0.28, opacity), outline: true, outlineColor: "#ffea00", outlineWidth: 2 }
        } else {
          style = { color: "#d50000", opacity: Math.min(0.35, opacity), outline: true, outlineColor: "#d50000", outlineWidth: 2 }
        }
      }
      if (toolType === "neighbor") {
        style = { color: "#ff9800", opacity: 0.2, outline: true, outlineColor: "#ff9800", outlineWidth: 2 }
      }
      if (toolType === "overlay") {
        if (isResult) {
          style = { color: "#8e24aa", opacity: 0.35, outline: true, outlineColor: "#8e24aa", outlineWidth: 2 }
        } else if (isA) {
          style = { color: "#d50000", opacity: 0.15, outline: true, outlineColor: "#d50000", outlineWidth: 2 }
        } else if (isB) {
          style = { color: "#1677ff", opacity: 0.15, outline: true, outlineColor: "#1677ff", outlineWidth: 2 }
        } else {
          style = { color: "#8e24aa", opacity: 0.2, outline: true, outlineColor: "#8e24aa", outlineWidth: 2 }
        }
      }

      addPolygon(positions, style, { toolType, ...props })
      return
    }

    if (geom?.type === "Point" && Array.isArray(geom.coordinates)) {
      const [lng, lat] = geom.coordinates
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return
      }
      const level = Number(props.level || 1)
      const value = Number(props.value ?? level)
      let color = "#ffea00"
      if (level >= 3) {
        color = "#d50000"
      } else if (level === 2) {
        color = "#ff6d00"
      }
      let graphic: any = null
      if (showPoints) {
        graphic = addPoint(
          lng,
          lat,
          {
            color,
            pixelSize: 9,
            outline: true,
            outlineColor: "#ffffff",
            outlineWidth: 2,
            clampToGround: true
          },
          { toolType, ...props }
        )
      }
      pointIdx += 1
      lastPointItems.push({
        idx: pointIdx,
        lng,
        lat,
        level,
        name: String(props.name ?? `隐患点${pointIdx}`),
        properties: props,
        graphic
      })
      if (showHeat && Number.isFinite(value)) {
        heatPositions.push({ lng, lat, value })
      }
    }
  })

  if (showHeat && heatPositions.length > 0 && map) {
    heatLayer = new mars3d.layer.HeatLayer({
      name: "邻域热力图",
      positions: heatPositions,
      valueColumn: "value",
      heatStyle: {
        maxOpacity: 0.85,
        minOpacity: 0.15,
        blur: 0.85,
        radius: Math.max(5, Math.min(80, Math.round(neighborHeatRadius || 28))),
        gradient: { 0.3: "#1b5e20", 0.55: "#66bb6a", 0.75: "#ffea00", 0.9: "#ff6d00", 1.0: "#d50000" }
      },
      style: { type: "image", opacity: 0.85, clampToGround: true }
    })
    map.addLayer(heatLayer)
  }
}

export function getAnalysisFeatureCollection() {
  return lastFeatureCollection
}

export function getAnalysisPoints() {
  return lastPointItems.map((p) => ({
    idx: p.idx,
    lng: p.lng,
    lat: p.lat,
    level: p.level,
    name: p.name,
    properties: p.properties
  }))
}

export function flyToAnalysisPoint(idx: number) {
  const item = lastPointItems.find((p) => p.idx === idx)
  if (!item) {
    return
  }
  try {
    if (lastSelectedGraphic && typeof lastSelectedGraphic.closeHighlight === "function") {
      lastSelectedGraphic.closeHighlight()
    }
  } catch {}
  if (item.graphic) {
    lastSelectedGraphic = item.graphic
    item.graphic.flyTo?.({ radius: 1800 })
    item.graphic.openHighlight?.()
    pointLayer?.openPopup?.(item.graphic)
    return
  }
  const graphic = addPoint(
    item.lng,
    item.lat,
    { color: "#ffffff", pixelSize: 10, outline: true, outlineColor: "#ff4d4f", outlineWidth: 3, clampToGround: true },
    { toolType: "neighbor", ...item.properties, __temp: true }
  )
  lastSelectedGraphic = graphic
  graphic.flyTo?.({ radius: 1800 })
  graphic.openHighlight?.()
  pointLayer?.openPopup?.(graphic)
}

function toCsvValue(v: any) {
  const s = String(v ?? "")
  if (/[",\n]/.test(s)) {
    return `"${s.replaceAll('"', '""')}"`
  }
  return s
}

export function exportAnalysisGeoJSON(toolType: string) {
  if (!lastFeatureCollection) {
    return
  }
  const name = `空间分析_${toolType}_${Date.now()}.geojson`
  mars3d.Util.downloadFile(name, JSON.stringify(lastFeatureCollection, null, 2))
}

export function exportAnalysisCSV(toolType: string, summary?: Record<string, any> | null) {
  const now = Date.now()
  if (lastPointItems.length > 0) {
    const header = ["idx", "name", "level", "lng", "lat"].join(",")
    const rows = lastPointItems.map((p) =>
      [p.idx, p.name, p.level, p.lng.toFixed(6), p.lat.toFixed(6)].map(toCsvValue).join(",")
    )
    mars3d.Util.downloadFile(`空间分析_${toolType}_${now}.csv`, [header, ...rows].join("\n"))
    return
  }

  const s = summary || {}
  const rows = Object.keys(s).map((k) => `${toCsvValue(k)},${toCsvValue(s[k])}`)
  mars3d.Util.downloadFile(`空间分析_${toolType}_${now}.csv`, ["key,value", ...rows].join("\n"))
}

export async function runToolAnalysis(toolType: string, params: Record<string, any>, target: AnalysisTarget) {
  ensureLayers()

  if (toolType === "buffer") {
    const du = String(params.distanceUnit ?? "km")
    const toKm = (v: any) => {
      const n = Number(v)
      if (!Number.isFinite(n)) {
        return 0
      }
      return du === "m" ? n / 1000 : n
    }
    const res = await runBufferAnalysis({
      target,
      mode: params.mode,
      radiusKm: toKm(params.radiusKm ?? 50),
      coreKm: toKm(params.coreKm ?? 50),
      transitionKm: toKm(params.transitionKm ?? 100),
      edgeKm: toKm(params.edgeKm ?? 150),
      opacity: Number(params.opacity ?? 70),
      smooth: Number(params.smooth ?? 64)
    })
    renderFeatureCollection(res.geojson, "buffer")
    return res.summary
  }

  if (toolType === "overlay") {
    const res = await runOverlayAnalysis({
      target,
      targetLayer: params.targetLayer,
      operation: params.operation
    })
    renderFeatureCollection(res.geojson, "overlay")
    return res.summary
  }

  if (toolType === "neighbor") {
    const du = String(params.distanceUnit ?? "m")
    const toM = (v: any) => {
      const n = Number(v)
      if (!Number.isFinite(n)) {
        return 0
      }
      return du === "km" ? n * 1000 : n
    }
    const res = await runNeighborAnalysis({
      target,
      dataset: params.dataset,
      radiusM: toM(params.radius ?? 0),
      limit: Number(params.limit ?? 200),
      render: params.render,
      heatRadius: Number(params.heatRadius ?? 28)
    })
    renderFeatureCollection(res.geojson, "neighbor")
    return res.summary
  }

  return null
}
