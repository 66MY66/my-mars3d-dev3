import { inspectJsonContent } from "./content-routing"
import type { TemplateDocument } from "./template-renderer"

const supported = new Set(["admin-area", "border-line", "settlement-name", "settlement-area", "water-line", "water-area", "road-line", "rail-line", "active-faults", "fault-reference", "assessment-intensity", "hazard", "hazard-reference", "target-0", "target-1", "target-2", "target-3", "target-4"])

export function selectContentRole(document: TemplateDocument, role: string) {
  if (!supported.has(role)) { return document }
  const features = document.features.filter(feature => inspectJsonContent({ ...document, features: [feature] }).groups.some(group => group.roles.includes(role)))
  if (!features.length) { throw new Error("文件中没有符合当前专题用途的实际要素，请重新匹配资料") }
  return { ...document, features, metadata: { ...document.metadata, contentSelection: { role, sourceFeatureCount: document.features.length, selectedFeatureCount: features.length } } }
}
