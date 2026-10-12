import { normalizeLayerIdToken } from "./layer-id"

export interface ThematicGroupConfig {
  rootGroupId: string
  rootGroupName: string
  thematicGroupId: string
  thematicGroupName: string
}

export function buildThematicResultGroup(datasetId: string): ThematicGroupConfig {
  const cleanDatasetId = String(datasetId || "").trim()
  const token = normalizeLayerIdToken(cleanDatasetId, "dataset")
  const rootGroupId = `myrepo_group_${token}_results`
  return {
    rootGroupId,
    rootGroupName: `数据集成果/${cleanDatasetId}`,
    thematicGroupId: `${rootGroupId}__thematics`,
    thematicGroupName: "专题图"
  }
}
