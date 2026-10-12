import type { Manifest } from "../types/eoapi-types"

export type ManifestLayer = NonNullable<Manifest["layers"]>[number]

export interface ManifestLayerChange {
  key: string
  before: any
  after: any
}

export interface ManifestLayerDiffEntry {
  id: string
  name?: string
  changes: ManifestLayerChange[]
}

export interface ManifestLayerMoveEntry {
  id: string
  name?: string
  fromPid?: string | number
  toPid?: string | number
  fromOrder?: number
  toOrder?: number
}

export interface ManifestDiffResult {
  added: ManifestLayer[]
  removed: ManifestLayer[]
  changed: ManifestLayerDiffEntry[]
  moved: ManifestLayerMoveEntry[]
  summary: {
    added: number
    removed: number
    changed: number
    moved: number
  }
}

function stableStringify(v: any): string {
  const seen = new WeakSet<object>()
  const walk = (x: any): any => {
    if (!x || typeof x !== "object") {
      return x
    }
    if (seen.has(x as any)) {
      return "[Circular]"
    }
    seen.add(x as any)
    if (Array.isArray(x)) {
      return x.map(walk)
    }
    const keys = Object.keys(x).sort()
    const out: Record<string, any> = {}
    for (const k of keys) {
      out[k] = walk(x[k])
    }
    return out
  }
  return JSON.stringify(walk(v))
}

function pickComparableLayerFields(layer: ManifestLayer): Record<string, any> {
  return {
    id: layer.id,
    name: layer.name,
    sourceType: layer.sourceType,
    sourceRef: layer.sourceRef,
    pid: layer.pid,
    visible: layer.visible,
    opacity: layer.opacity,
    order: layer.order,
    zIndex: layer.zIndex,
    temporal: layer.temporal,
    data: layer.data,
    options: layer.options
  }
}

export function diffManifests(a: Manifest | null | undefined, b: Manifest | null | undefined): ManifestDiffResult {
  const layersA = (a?.layers || []) as ManifestLayer[]
  const layersB = (b?.layers || []) as ManifestLayer[]
  const mapA = new Map<string, ManifestLayer>()
  const mapB = new Map<string, ManifestLayer>()
  for (const l of layersA) {
    if (l?.id) {
      mapA.set(String(l.id), l)
    }
  }
  for (const l of layersB) {
    if (l?.id) {
      mapB.set(String(l.id), l)
    }
  }

  const added: ManifestLayer[] = []
  const removed: ManifestLayer[] = []
  const changed: ManifestLayerDiffEntry[] = []
  const moved: ManifestLayerMoveEntry[] = []

  for (const [id, after] of mapB.entries()) {
    if (!mapA.has(id)) {
      added.push(after)
    }
  }
  for (const [id, before] of mapA.entries()) {
    if (!mapB.has(id)) {
      removed.push(before)
    }
  }

  const sharedIds = [...mapA.keys()].filter((id) => mapB.has(id))
  for (const id of sharedIds) {
    const before = mapA.get(id)!
    const after = mapB.get(id)!
    const beforePicked = pickComparableLayerFields(before)
    const afterPicked = pickComparableLayerFields(after)

    const changes: ManifestLayerChange[] = []
    for (const k of Object.keys(afterPicked)) {
      const bv = (beforePicked as any)[k]
      const av = (afterPicked as any)[k]
      const same = stableStringify(bv) === stableStringify(av)
      if (!same) {
        changes.push({ key: k, before: bv, after: av })
      }
    }
    if (changes.length) {
      changed.push({ id, name: after.name || before.name, changes })
    }

    const fromPid = before.pid
    const toPid = after.pid
    const fromOrder = Number.isFinite(Number(before.order)) ? Number(before.order) : undefined
    const toOrder = Number.isFinite(Number(after.order)) ? Number(after.order) : undefined
    const movedByPid = stableStringify(fromPid) !== stableStringify(toPid)
    const movedByOrder = stableStringify(fromOrder) !== stableStringify(toOrder)
    if (movedByPid || movedByOrder) {
      moved.push({ id, name: after.name || before.name, fromPid, toPid, fromOrder, toOrder })
    }
  }

  return {
    added,
    removed,
    changed,
    moved,
    summary: {
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      moved: moved.length
    }
  }
}

