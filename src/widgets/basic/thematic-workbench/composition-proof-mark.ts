export function compositionProofMark(usage?: string) {
  if (usage === "test") { return { text: "合成测试 · 禁止业务使用", diagonal: true } }
  if (usage === "reference") { return { text: "参考校样 · 非正式应急响应成果", diagonal: false } }
  return { text: "校样 · 未完成质量审核", diagonal: true }
}
