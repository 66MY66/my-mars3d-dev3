import dayjs from "dayjs"
import type { CatalogNode, MetadataQuery, SatelliteRecord } from "./types"

function splitList(value: unknown): string[] {
  if (Array.isArray(value)) { return value.map(String) }
  if (typeof value !== "string" || !value.trim()) { return [] }
  return value.split(",").map((item) => item.trim()).filter(Boolean)
}

function joinList(value: unknown): unknown {
  return Array.isArray(value) ? value.join(",") : value
}

export function fromPool(record: SatelliteRecord): SatelliteRecord {
  const total = Number(record.totalCapacity) || 0
  const used = Number(record.usedCapacity) || 0
  return {
    ...record,
    poolId: record.id,
    satellites: splitList(record.satellites),
    usageRate: total > 0 ? Math.round((used / total) * 100) : 0
  }
}

export function toPoolPayload(record: SatelliteRecord): SatelliteRecord {
  const { poolId, ...payload } = record
  return { ...payload, id: poolId, satellites: joinList(record.satellites) }
}

export function fromMetadata(record: SatelliteRecord): SatelliteRecord {
  return {
    ...record,
    metadataId: record.id,
    acquisitionTime: record.observationTime,
    region: record.imageExtent
  }
}

export function toMetadataPayload(record: SatelliteRecord): SatelliteRecord {
  const { metadataId, acquisitionTime, region, ...payload } = record
  return {
    ...payload,
    id: metadataId,
    observationTime: acquisitionTime,
    imageExtent: region
  }
}

export function fromCatalog(record: SatelliteRecord): CatalogNode {
  const id = String(record.id ?? record.key ?? "")
  return {
    ...record,
    id,
    key: id,
    title: record.name ?? record.title,
    count: record.dataCount ?? record.count ?? 0,
    parentId: String(record.parentId ?? "")
  }
}

export function toCatalogPayload(record: SatelliteRecord): SatelliteRecord {
  const { key, children, ...payload } = record
  return { ...payload, id: record.id ?? key }
}

export function buildCatalogTree(records: CatalogNode[]): CatalogNode[] {
  const nodes = records.map((record) => ({ ...record, children: [] as CatalogNode[] }))
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const roots: CatalogNode[] = []
  nodes.forEach((node) => {
    const parent = node.parentId ? byId.get(node.parentId) : undefined
    if (parent && parent !== node) { parent.children?.push(node) } else { roots.push(node) }
  })
  return roots
}

function dateValue(value: unknown): number | null {
  if (!value) { return null }
  const parsed = dayjs(value as string)
  return parsed.isValid() ? parsed.valueOf() : null
}

export function filterMetadata(records: SatelliteRecord[], query: MetadataQuery): SatelliteRecord[] {
  const [start, end] = query.dateRange ?? []
  const startAt = dateValue(start)
  const endAt = dateValue(end)
  return records.filter((record) => {
    const acquisition = dateValue(record.acquisitionTime)
    const resolution = Number(record.resolution)
    const cloudCover = Number(record.cloudCover)
    if (query.satellite?.length && !query.satellite.includes(String(record.satellite ?? ""))) { return false }
    if (query.sensor?.length && !query.sensor.includes(String(record.sensor ?? ""))) { return false }
    if (query.dataTypes?.length && !query.dataTypes.includes(String(record.dataType ?? ""))) { return false }
    if (query.cloudCover?.length === 2 && (cloudCover < query.cloudCover[0] || cloudCover > query.cloudCover[1])) { return false }
    if (query.resolutionMin != null && resolution < query.resolutionMin) { return false }
    if (query.resolutionMax != null && resolution > query.resolutionMax) { return false }
    if (startAt != null && (acquisition == null || acquisition < startAt)) { return false }
    if (endAt != null && (acquisition == null || acquisition > endAt)) { return false }
    return true
  })
}

export function fromShare(record: SatelliteRecord): SatelliteRecord {
  const dataIds = splitList(record.dataIds)
  const authTarget = splitList(record.authTarget)
  return {
    ...record,
    authId: record.id,
    ruleId: record.id,
    dataIds,
    dataId: dataIds[0] ?? "",
    permissions: splitList(record.permissions),
    authTarget,
    validPeriod: [record.validStart, record.validEnd].filter(Boolean).join(" ~ ")
  }
}

export function toSharePayload(record: SatelliteRecord): SatelliteRecord {
  const { authId, ruleId, ...payload } = record
  return {
    ...payload,
    id: authId ?? ruleId,
    dataIds: joinList(record.dataIds),
    permissions: joinList(record.permissions),
    authTarget: joinList(record.authTarget)
  }
}
