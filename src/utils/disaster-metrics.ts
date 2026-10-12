export type RingLonLat = Array<[number, number]>

export type DisasterModel = {
  populationDensityPerKm2: number
  lossPerPersonYuan: number
}

export type UnitPrefs = {
  area: "m2" | "km2"
  distance: "m" | "km"
  population: "person" | "wan"
  money: "yuan" | "wan" | "yi"
}

export type DisasterMetrics = {
  areaM2: number
  perimeterM: number
  population: number
  lossYuan: number
}

const R = 6378137
function mercatorX(lngDeg: number) {
  return (R * lngDeg * Math.PI) / 180
}
function mercatorY(latDeg: number) {
  const lat = (latDeg * Math.PI) / 180
  return R * Math.log(Math.tan(Math.PI / 4 + lat / 2))
}

function mercatorXY(ring: RingLonLat) {
  return ring
    .map(([lng, lat]) => {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return null
      }
      const x = mercatorX(lng)
      const y = mercatorY(lat)
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null
      }
      return [x, y] as const
    })
    .filter(Boolean) as Array<[number, number]>
}

export function computeAreaM2(ring: RingLonLat) {
  const pts = mercatorXY(ring)
  if (pts.length < 3) {
    return 0
  }
  let sum = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % pts.length]
    sum += x1 * y2 - x2 * y1
  }
  return Math.abs(sum) / 2
}

export function computePerimeterM(ring: RingLonLat) {
  const pts = mercatorXY(ring)
  if (pts.length < 2) {
    return 0
  }
  let sum = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % pts.length]
    const dx = x2 - x1
    const dy = y2 - y1
    sum += Math.hypot(dx, dy)
  }
  return sum
}

export function estimateMetrics(ring: RingLonLat, model: DisasterModel): DisasterMetrics {
  const areaM2 = computeAreaM2(ring)
  const perimeterM = computePerimeterM(ring)
  const areaKm2 = areaM2 / 1_000_000
  const population = Math.max(0, areaKm2 * (Number(model.populationDensityPerKm2) || 0))
  const lossYuan = Math.max(0, population * (Number(model.lossPerPersonYuan) || 0))
  return { areaM2, perimeterM, population, lossYuan }
}

export function formatArea(areaM2: number, unit: UnitPrefs["area"]) {
  if (unit === "km2") {
    return `${(areaM2 / 1_000_000).toFixed(3)} km²`
  }
  return `${Math.round(areaM2).toLocaleString()} m²`
}

export function formatDistance(distanceM: number, unit: UnitPrefs["distance"]) {
  if (unit === "km") {
    return `${(distanceM / 1000).toFixed(3)} km`
  }
  return `${Math.round(distanceM).toLocaleString()} m`
}

export function formatPopulation(population: number, unit: UnitPrefs["population"]) {
  if (unit === "wan") {
    return `${(population / 10_000).toFixed(3)} 万人`
  }
  return `${Math.round(population).toLocaleString()} 人`
}

export function formatMoney(lossYuan: number, unit: UnitPrefs["money"]) {
  if (unit === "yi") {
    return `${(lossYuan / 100_000_000).toFixed(3)} 亿元`
  }
  if (unit === "wan") {
    return `${(lossYuan / 10_000).toFixed(3)} 万元`
  }
  return `${Math.round(lossYuan).toLocaleString()} 元`
}

export function metricsToJSONPayload(ring: RingLonLat, model: DisasterModel, metrics: DisasterMetrics) {
  return {
    ring,
    model,
    metrics,
    generatedAt: new Date().toISOString()
  }
}

export function metricsToCSV(model: DisasterModel, metrics: DisasterMetrics) {
  const rows = [
    ["area_m2", String(metrics.areaM2)],
    ["perimeter_m", String(metrics.perimeterM)],
    ["population_person", String(metrics.population)],
    ["loss_yuan", String(metrics.lossYuan)],
    ["populationDensityPerKm2", String(model.populationDensityPerKm2)],
    ["lossPerPersonYuan", String(model.lossPerPersonYuan)]
  ]
  return ["key,value", ...rows.map((r) => `${r[0]},${r[1]}`)].join("\n")
}
