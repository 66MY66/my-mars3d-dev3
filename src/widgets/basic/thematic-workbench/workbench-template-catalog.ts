import type { ThematicTemplate } from "../dataset-repository/types/eoapi-types"
import { dbtTemplates, type DbtTemplateId } from "./dbt116-standard"
import { dbtRoleNames } from "./dbt-cartography-rules"

export type TemplatePurpose = "all" | "emergency" | "analysis"
type EmergencyCatalogEntry = ThematicTemplate & {
  emergencyId: DbtTemplateId
  dataTypes: Array<"vector" | "tabular" | "raster">
  components: string[]
  keywords: string[]
}

export const emergencyCatalog: EmergencyCatalogEntry[] = dbtTemplates.map(item => ({
  templateId: `emergency:${item.id}`,
  emergencyId: item.id,
  templateVersion: "1.0",
  name: item.name,
  description: item.summary,
  category: "应急响应专题",
  parameters: [],
  createdAt: 0,
  dataTypes: item.roles.some(role => role === "imagery") ? ["vector", "tabular", "raster"] : ["vector", "tabular"],
  components: item.roles.map(role => dbtRoleNames[role] || role),
  keywords: [item.id, "应急响应", "DB/T 101-2024", "制作要求报批稿", item.clause, ...item.roles.map(role => dbtRoleNames[role] || role)]
}))

export function getEmergencyCatalogEntry(template: Pick<ThematicTemplate, "templateId">) {
  return emergencyCatalog.find(item => item.templateId === template.templateId)
}

export function mergeWorkbenchTemplateCatalog(analysis: ThematicTemplate[]): ThematicTemplate[] {
  // Reserve emergency identities for the locally defined topic and validation contracts.
  return [...emergencyCatalog, ...analysis.filter(item => !item.templateId.startsWith("emergency:"))]
}

export function getTemplatePurpose(template: Pick<ThematicTemplate, "templateId">): Exclude<TemplatePurpose, "all"> {
  return getEmergencyCatalogEntry(template) ? "emergency" : "analysis"
}
