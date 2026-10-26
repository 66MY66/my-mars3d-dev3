import * as mars3d from "mars3d"
import {
  buildProfileSummary,
  applyTerrainHeights,
  computeLineLengthMeters,
  interpolateProfilePoints,
  profileSamplesToCsv,
  smoothElevations,
  type ProfilePoint,
  type ProfileSample
} from "./utils"

type ProfileTarget = {
  type: "line"
  points: ProfilePoint[]
  source?: string
}

let map: mars3d.Map | null = null
let drawLayer: any = null
let resultLayer: any = null
let lastTargetGraphic: any = null
let lastSamples: ProfileSample[] = []
let lastSummary: Record<string, any> | null = null
let hoverGraphic: any = null

export function onMounted(mapInstance: mars3d.Map): void {
  map = mapInstance
}

export function onUnmounted(): void {
  try {
    if (drawLayer) {
      map?.removeLayer(drawLayer, true)
    }
    if (resultLayer) {
      map?.removeLayer(resultLayer, true)
    }
  } catch {
  }
  drawLayer = null
  resultLayer = null
  lastTargetGraphic = null
  lastSamples = []
  lastSummary = null
  hoverGraphic = null
  map = null
}

function ensureDrawLayer() {
  if (!map) {
    return null
  }
  if (!drawLayer) {
    drawLayer = new mars3d.layer.GraphicLayer({ name: "剖面对象" })
    map.addLayer(drawLayer)
  }
  return drawLayer
}

function ensureResultLayer() {
  if (!map) {
    return null
  }
  if (!resultLayer) {
    resultLayer = new mars3d.layer.GraphicLayer({ name: "剖面结果" })
    map.addLayer(resultLayer)
  }
  return resultLayer
}

export function clearAnalysisResult() {
  lastSamples = []
  lastSummary = null
  try {
    ensureResultLayer()?.clear?.()
  } catch {
  }
  hoverGraphic = null
}

export function clearTargetGraphic() {
  const layer = ensureDrawLayer()
  if (!layer) {
    return
  }
  try {
    if (lastTargetGraphic) {
      layer.removeGraphic?.(lastTargetGraphic)
    }
  } catch {
  }
  try {
    layer.clear?.()
  } catch {
  }
  lastTargetGraphic = null
}

function cartesianToPoint(position: any): ProfilePoint | null {
  try {
    const pt = mars3d.LngLatPoint.fromCartesian(position)
    if (!pt) {
      return null
    }
    return {
      lng: Number(pt.lng),
      lat: Number(pt.lat),
      height: Number.isFinite(Number(pt.alt)) ? Number(pt.alt) : 0
    }
  } catch {
    return null
  }
}

export function getTargetFromGraphic(graphic: any): ProfileTarget | null {
  if (!graphic) {
    return null
  }
  try {
    const positions = graphic.positions || graphic._positions
    if (Array.isArray(positions) && positions.length >= 2) {
      const points = positions.map(cartesianToPoint).filter(Boolean) as ProfilePoint[]
      if (points.length >= 2) {
        return { type: "line", points, source: "marker" }
      }
    }
  } catch {
  }
  try {
    const gj = graphic.toGeoJSON?.()
    const coords = gj?.geometry?.coordinates
    if (Array.isArray(coords) && coords.length >= 2) {
      const points = coords
        .filter((item: any) => Array.isArray(item) && item.length >= 2)
        .map((item: any) => ({
          lng: Number(item[0]),
          lat: Number(item[1]),
          height: Number.isFinite(Number(item[2])) ? Number(item[2]) : 0
        }))
      if (points.length >= 2) {
        return { type: "line", points, source: "marker" }
      }
    }
  } catch {
  }
  return null
}

function renderTargetLine(target: ProfileTarget | null) {
  const layer = ensureDrawLayer()
  if (!layer || !target?.points?.length) {
    return
  }
  try {
    layer.clear?.()
  } catch {
  }
  lastTargetGraphic = new mars3d.graphic.PolylineEntity({
    positions: target.points.map((item) => [item.lng, item.lat, item.height || 0]),
    style: {
      color: "#ffd666",
      width: 4,
      clampToGround: false
    }
  })
  layer.addGraphic(lastTargetGraphic)
}

export async function startSelectLine(): Promise<ProfileTarget | null> {
  const layer = ensureDrawLayer()
  if (!layer) {
    return null
  }
  clearTargetGraphic()
  return new Promise((resolve) => {
    try {
      layer.startDraw({
        type: "polyline",
        style: {
          color: "#ffd666",
          width: 4,
          clampToGround: false
        },
        success: (graphic: any) => {
          lastTargetGraphic = graphic
          resolve(getTargetFromGraphic(graphic))
        }
      })
    } catch {
      resolve(null)
    }
  })
}

export function flyToTarget(target: ProfileTarget | null, duration?: number) {
  if (!map || !target?.points?.length) {
    return
  }
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  target.points.forEach((item) => {
    west = Math.min(west, item.lng)
    south = Math.min(south, item.lat)
    east = Math.max(east, item.lng)
    north = Math.max(north, item.lat)
  })
  const Cesium = mars3d.Cesium
  map.camera.flyTo({
    destination: Cesium.Rectangle.fromDegrees(west, south, east, north),
    duration: duration ?? 1.2
  })
}

async function sampleHeights(points: ProfilePoint[]): Promise<{ points: ProfilePoint[]; terrainSampled: boolean }> {
  if (!map || !points.length) {
    return { points, terrainSampled: false }
  }
  const Cesium = mars3d.Cesium
  const cartographics = points.map((item) => Cesium.Cartographic.fromDegrees(item.lng, item.lat))
  try {
    const viewer = (map as any).viewer
    const terrainProvider = viewer?.terrainProvider
    const sampled = await Cesium.sampleTerrainMostDetailed(terrainProvider, cartographics)
    return {
      points: points.map((item, index) => ({
        ...item,
        height: Number.isFinite(Number(sampled[index]?.height)) ? Number(sampled[index].height) : Number(item.height || 0)
      })),
      terrainSampled: true
    }
  } catch {
    return {
      points: points.map((item) => ({ ...item, height: Number(item.height || 0) })),
      terrainSampled: false
    }
  }
}

function renderResult(target: ProfileTarget, samples: ProfileSample[]) {
  const layer = ensureResultLayer()
  if (!layer) {
    return
  }
  try {
    layer.clear?.()
  } catch {
  }
  const start = samples[0]
  const end = samples[samples.length - 1]
  const line = new mars3d.graphic.PolylineEntity({
    positions: target.points.map((item) => [item.lng, item.lat]),
    style: {
      color: "#40a9ff",
      width: 5,
      clampToGround: true
    }
  })
  layer.addGraphic(line)
  if (start) {
    layer.addGraphic(new mars3d.graphic.PointEntity({
      position: [start.lng, start.lat, start.elevationM],
      style: {
        color: "#52c41a",
        pixelSize: 10,
        outline: true,
        outlineColor: "#ffffff",
        outlineWidth: 2
      },
      attr: { label: "起点" }
    }))
  }
  if (end) {
    layer.addGraphic(new mars3d.graphic.PointEntity({
      position: [end.lng, end.lat, end.elevationM],
      style: {
        color: "#ff4d4f",
        pixelSize: 10,
        outline: true,
        outlineColor: "#ffffff",
        outlineWidth: 2
      },
      attr: { label: "终点" }
    }))
  }
}

export async function runProfileAnalysis(target: ProfileTarget, params: Record<string, any>) {
  if (!target?.points || target.points.length < 2) {
    throw new Error("请先选择剖面线")
  }
  renderTargetLine(target)
  const sampleCount = Math.max(16, Math.min(512, Math.floor(Number(params.sampleCount) || 128)))
  const smoothWindow = Math.max(1, Math.min(21, Math.floor(Number(params.smoothWindow) || 1)))
  const coordinateSamples = interpolateProfilePoints(target.points, sampleCount)
  const terrainResult = await sampleHeights(coordinateSamples.map((sample) => ({
    lng: sample.lng,
    lat: sample.lat,
    height: sample.elevationM
  })))
  const terrainSamples = applyTerrainHeights(coordinateSamples, terrainResult.points.map((point) => Number(point.height)))
  const sampled = smoothElevations(terrainSamples, smoothWindow)
  const summary = buildProfileSummary(sampled)
  if (!summary) {
    throw new Error("剖面采样失败")
  }
  lastSamples = sampled
  lastSummary = {
    ...summary,
    sourcePointCount: target.points.length,
    smoothWindow,
    sampleCount,
    totalLengthM: computeLineLengthMeters(target.points),
    terrainSampled: terrainResult.terrainSampled
  }
  renderResult(target, sampled)
  return lastSummary
}

export function getProfileSamples() {
  return lastSamples.map((item) => ({ ...item }))
}

export function getProfileSummary() {
  return lastSummary ? { ...lastSummary } : null
}

export function showProfilePosition(index: number) {
  const layer = ensureResultLayer()
  const sample = lastSamples[index]
  if (!layer || !sample) {
    return
  }
  try {
    if (hoverGraphic) {
      layer.removeGraphic?.(hoverGraphic)
    }
  } catch {
  }
  hoverGraphic = new mars3d.graphic.PointEntity({
    position: [sample.lng, sample.lat, sample.elevationM],
    style: {
      color: "#00e5ff",
      pixelSize: 12,
      outline: true,
      outlineColor: "#ffffff",
      outlineWidth: 3,
      visibleDepth: false
    },
    attr: {
      label: "剖面位置",
      distanceM: sample.distanceM,
      elevationM: sample.elevationM
    }
  })
  layer.addGraphic(hoverGraphic)
}

export function clearProfilePosition() {
  const layer = ensureResultLayer()
  if (!layer || !hoverGraphic) {
    return
  }
  try {
    layer.removeGraphic?.(hoverGraphic)
  } catch {
  }
  hoverGraphic = null
}

export function exportProfileCsv() {
  if (!lastSamples.length) {
    return
  }
  mars3d.Util.downloadFile(`剖面分析_${Date.now()}.csv`, profileSamplesToCsv(lastSamples))
}
