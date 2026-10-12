export type ProfilePoint = {
  lng: number
  lat: number
  height?: number
}

export type ProfileSample = {
  index: number
  ratio: number
  distanceM: number
  lng: number
  lat: number
  elevationM: number
}

function toRad(value: number) {
  return (value * Math.PI) / 180
}

export function haversineDistanceMeters(a: ProfilePoint, b: ProfilePoint): number {
  const earthRadius = 6371000
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const dLat = lat2 - lat1
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  return 2 * earthRadius * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))))
}

export function computeLineLengthMeters(points: ProfilePoint[]): number {
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    total += haversineDistanceMeters(points[i - 1], points[i])
  }
  return total
}

export function interpolateProfilePoints(points: ProfilePoint[], sampleCount: number): ProfileSample[] {
  if (!Array.isArray(points) || points.length < 2) {
    return []
  }
  const safeCount = Math.max(2, Math.floor(Number(sampleCount) || 0))
  const cumulative = [0]
  for (let i = 1; i < points.length; i += 1) {
    cumulative.push(cumulative[i - 1] + haversineDistanceMeters(points[i - 1], points[i]))
  }
  const total = cumulative[cumulative.length - 1]
  if (!Number.isFinite(total) || total <= 0) {
    return []
  }

  const samples: ProfileSample[] = []
  let segmentIndex = 1
  for (let i = 0; i < safeCount; i += 1) {
    const ratio = safeCount === 1 ? 0 : i / (safeCount - 1)
    const targetDistance = total * ratio
    while (segmentIndex < cumulative.length - 1 && cumulative[segmentIndex] < targetDistance) {
      segmentIndex += 1
    }
    const startIndex = Math.max(0, segmentIndex - 1)
    const endIndex = Math.min(points.length - 1, segmentIndex)
    const start = points[startIndex]
    const end = points[endIndex]
    const startDistance = cumulative[startIndex]
    const endDistance = cumulative[endIndex]
    const segmentDistance = Math.max(0.000001, endDistance - startDistance)
    const localRatio = Math.max(0, Math.min(1, (targetDistance - startDistance) / segmentDistance))
    const lng = start.lng + (end.lng - start.lng) * localRatio
    const lat = start.lat + (end.lat - start.lat) * localRatio
    const startHeight = Number(start.height || 0)
    const endHeight = Number(end.height || 0)
    const elevationM = startHeight + (endHeight - startHeight) * localRatio
    samples.push({
      index: i + 1,
      ratio,
      distanceM: targetDistance,
      lng,
      lat,
      elevationM
    })
  }
  return samples
}

export function smoothElevations(samples: ProfileSample[], windowSize: number): ProfileSample[] {
  const safeWindow = Math.max(1, Math.floor(Number(windowSize) || 1))
  if (safeWindow <= 1 || samples.length === 0) {
    return samples.map((sample) => ({ ...sample }))
  }
  const radius = Math.floor(safeWindow / 2)
  return samples.map((sample, index) => {
    let total = 0
    let count = 0
    for (let i = Math.max(0, index - radius); i <= Math.min(samples.length - 1, index + radius); i += 1) {
      total += Number(samples[i].elevationM || 0)
      count += 1
    }
    return {
      ...sample,
      elevationM: count > 0 ? total / count : sample.elevationM
    }
  })
}

export function buildProfileSummary(samples: ProfileSample[]) {
  if (!samples.length) {
    return null
  }
  const elevations = samples.map((item) => Number(item.elevationM || 0))
  const totalLengthM = Number(samples[samples.length - 1].distanceM || 0)
  const minElevationM = Math.min(...elevations)
  const maxElevationM = Math.max(...elevations)
  const avgElevationM = elevations.reduce((sum, item) => sum + item, 0) / elevations.length
  const startElevationM = Number(samples[0].elevationM || 0)
  const endElevationM = Number(samples[samples.length - 1].elevationM || 0)
  return {
    sampleCount: samples.length,
    totalLengthM,
    minElevationM,
    maxElevationM,
    avgElevationM,
    reliefM: maxElevationM - minElevationM,
    startElevationM,
    endElevationM,
    elevationDeltaM: endElevationM - startElevationM
  }
}

export function profileSamplesToCsv(samples: ProfileSample[]): string {
  const header = ["index", "distanceM", "lng", "lat", "elevationM"].join(",")
  const rows = samples.map((item) =>
    [
      item.index,
      item.distanceM.toFixed(2),
      item.lng.toFixed(6),
      item.lat.toFixed(6),
      item.elevationM.toFixed(2)
    ].join(",")
  )
  return [header, ...rows].join("\n")
}
