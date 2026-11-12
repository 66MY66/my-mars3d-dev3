/**
 * Arrow IPC 快速通道：/api/arrow/search（stac-arrow sidecar, 5962）
 *
 * 服务端绕开 pgstac hydrate 列式直出，Arrow IPC 二进制返回，
 * 前端 tableFromIPC 零解析直接拿 TypedArray（比 JSON.parse 快 10 倍+）。
 *
 * 返回值适配回 searchItems/getItems 的 StacItem[] 形状，业务组件零感知。
 * 失败自动回退 JSON 路径（由调用方处理或本模块内 fallback）。
 */
import { tableFromIPC } from "apache-arrow"
import { eoApiConfig } from "./eoapi-config"
import type { StacItem } from "../types/eoapi-types"

const ARROW_PREFIX = "/api/arrow"

/** Arrow 查询参数 */
export interface ArrowSearchParams {
  collections?: string[]
  bbox?: [number, number, number, number]
  datetime?: string
  limit?: number
}

function isoFromEpoch(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) {
    return ""
  }
  return new Date(sec * 1000).toISOString()
}

function parseAssetsJson(raw: string): Record<string, { href: string }> {
  try {
    if (raw) {
      return JSON.parse(raw)
    }
    return {}
  } catch {
    return {}
  }
}

/**
 * 调用 Arrow sidecar 搜索。成功返回 StacItem[]，失败返回 null（调用方回退 JSON 路径）。
 */
export async function arrowSearchItems(params: ArrowSearchParams): Promise<StacItem[] | null> {
  try {
    const res = await fetch(`${ARROW_PREFIX}/arrow/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collections: params.collections || [],
        bbox: params.bbox || [],
        datetime: params.datetime || null,
        limit: params.limit || 200
      })
    })
    if (!res.ok) {
      return null
    }
    const buf = await res.arrayBuffer()
    const table = tableFromIPC(buf)

    const ids = table.getChild("id")
    const colls = table.getChild("collection")
    const xmins = table.getChild("xmin")
    const ymins = table.getChild("ymin")
    const xmaxs = table.getChild("xmax")
    const ymaxs = table.getChild("ymax")
    const dts = table.getChild("datetime")
    const dte = table.getChild("end_datetime")
    const platforms = table.getChild("platform")
    const epsgs = table.getChild("epsg")
    const assetsJson = table.getChild("assets_json")

    const items: StacItem[] = new Array(table.numRows)
    for (let i = 0; i < table.numRows; i++) {
      const xmin = xmins?.get(i)
      const ymin = ymins?.get(i)
      const xmax = xmaxs?.get(i)
      const ymax = ymaxs?.get(i)
      const dtSec = dts?.get(i)
      const platform = platforms?.get(i)
      const epsg = epsgs?.get(i)
      const id = ids?.get(i) || ""
      const collection = colls?.get(i) || ""

      const props: Record<string, any> = {
        datetime: isoFromEpoch(dtSec as number)
      }
      if (platform != null) {
        props.platform = platform
      }
      if (epsg != null) {
        props["proj:epsg"] = epsg
      }
      if (dtSec != null) {
        const end = dte?.get(i)
        if (end != null) {
          props.end_datetime = isoFromEpoch(end as number)
        }
      }

      items[i] = {
        id,
        type: "Feature",
        collection,
        geometry: null,
        bbox: [xmin, ymin, xmax, ymax] as number[],
        properties: props,
        assets: parseAssetsJson((assetsJson?.get(i) as string) || ""),
        links: []
      } as StacItem
    }
    return items
  } catch {
    // sidecar 不可用/网络失败 → 回退 JSON 路径
    return null
  }
}

/** sidecar 是否可用（懒探测，失败后本会话内不再尝试） */
let arrowAvailable: boolean | null = null
export function markArrowUnavailable() {
  arrowAvailable = false
}
export function isArrowCandidate(): boolean {
  return arrowAvailable !== false
}
export function markArrowAvailable() {
  arrowAvailable = true
}
