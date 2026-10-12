import { classifyLayer, DEFAULT_GROUP } from "./layer-classifier"

type ImportLayer = Record<string, any>

type CategoryTemplate = {
  key: string
  name: string
}

const CATEGORY_TEMPLATES: CategoryTemplate[] = [
  { key: "raster", name: "栅格" },
  { key: "vector", name: "矢量" },
  { key: "3d", name: "三维" },
  { key: "result", name: "成果" },
  { key: "basemap", name: "底图" },
  { key: "temp", name: DEFAULT_GROUP }
]

function resolveTopLevelGroupName(layer: ImportLayer): string {
  const type = String(layer?.sourceType || layer?.type || "").toLowerCase()
  const format = String(layer?.format || "").toLowerCase()

  if (["3dtiles", "model", "tileset"].includes(type) || ["gltf", "glb", "3dtiles"].includes(format)) {
    return "三维"
  }

  const classified = classifyLayer({
    type,
    sourceType: type,
    format,
    source: String(layer?.name || layer?.sourceRef || "")
  })
  if (classified === DEFAULT_GROUP) {
    return DEFAULT_GROUP
  }
  return String(classified).split("/")[0] || DEFAULT_GROUP
}

function buildCategoryId(template: CategoryTemplate, prefixHint?: string): string {
  return prefixHint ? `__type_${template.key}_${prefixHint}` : `__type_${template.key}`
}

export function categorizeLayersForImport(layers: ImportLayer[], prefixHint?: string): ImportLayer[] {
  const list = Array.isArray(layers) ? layers : []
  if (list.length === 0) {
    return []
  }

  const ids = new Set<string>(list.map((layer) => String(layer?.id || "")).filter(Boolean))
  const hasExistingGroups = list.some((layer) => String(layer?.sourceType || "") === "group")
  const hasValidPids = list.some((layer) => {
    const pid = layer?.pid
    return pid !== null && pid !== undefined && String(pid) !== "" && String(pid) !== String(layer?.id) && ids.has(String(pid))
  })

  if (hasExistingGroups && hasValidPids) {
    return list.map((layer, idx) => ({
      ...layer,
      order: Number.isFinite(layer?.order) ? layer.order : idx
    }))
  }

  const leafLayers = list.filter((layer) => String(layer?.sourceType || "") !== "group")
  if (leafLayers.length === 0) {
    return list
  }

  const usedCategoryIds = new Set<string>()
  const orderedLayers = [...leafLayers].sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0))
  const remappedLayers = orderedLayers.map((layer, idx) => {
    const groupName = resolveTopLevelGroupName(layer)
    const template = CATEGORY_TEMPLATES.find((item) => item.name === groupName) || CATEGORY_TEMPLATES[CATEGORY_TEMPLATES.length - 1]
    const pid = buildCategoryId(template, prefixHint)
    usedCategoryIds.add(pid)
    return {
      ...layer,
      pid,
      order: Number.isFinite(layer?.order) ? layer.order : idx
    }
  })

  const groups = CATEGORY_TEMPLATES
    .map((template) => {
      const id = buildCategoryId(template, prefixHint)
      if (!usedCategoryIds.has(id)) {
        return null
      }
      return {
        id,
        name: template.name,
        sourceType: "group",
        sourceRef: "",
        visible: true,
        opacity: 1
      }
    })
    .filter(Boolean)
    .map((group: any, idx: number) => ({
      ...group,
      order: idx
    }))

  return [...groups, ...remappedLayers]
}
