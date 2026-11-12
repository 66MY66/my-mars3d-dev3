export function remoteReferenceStyle(source?: { collection: string; itemId: string }) {
  if (source?.collection === "spatial-thematic" && source.itemId === "SP-fault_zones_shp") {
    return { color: "#e9e2cc", outlineColor: "#786b45", label: "断裂带范围（面，仅参考）" }
  }
  if (source?.collection === "geohazard-spot") {
    return { color: "#eadce9", outlineColor: "#81567b", label: "待核查隐患图斑（未分级）" }
  }
}
