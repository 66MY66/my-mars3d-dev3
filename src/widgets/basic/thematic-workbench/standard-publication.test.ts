import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { dbtTemplates, inspectDbtDocument, readDbtDocument } from "./dbt116-standard"
import { standardPublicationBlockers } from "./standard-publication"

const approved = () => ({
  hasDocument: true,
  usage: "operational",
  mapDraft: false,
  renderReady: true,
  issues: [],
  reviewCount: 5,
  reviewTotal: 5,
  reviewer: "测试复核人",
  evidence: "单元测试复核记录"
})

describe("standard publication gates", () => {
  it("allows checked business documents without treating online service status as a file export condition", () => {
    expect(standardPublicationBlockers(approved())).toEqual([])
  })

  it.each([
    [{ hasDocument: false }, "尚未创建"],
    [{ usage: "test" }, "仅可导出校样"],
    [{ usage: "unknown" }, "仅可导出校样"],
    [{ mapDraft: true }, "底图草稿"],
    [{ renderReady: false }, "尚未完成渲染"],
    [{ reviewCount: 4 }, "1 项未确认"],
    [{ reviewer: "  " }, "未填写复核人"],
    [{ evidence: "" }, "未填写复核依据"],
    [{ issues: [{ severity: "error" as const, clause: "9", message: "版式不符合要求" }] }, "版式不符合要求"]
  ])("blocks incomplete or changed document state: %j", (change, message) => {
    expect(standardPublicationBlockers({ ...approved(), ...change }).join("；")).toContain(message)
  })

  it("keeps advisory warnings without silently turning them into hard errors", () => {
    expect(standardPublicationBlockers({
      ...approved(), issues: [{ severity: "warning", clause: "10", message: "复核提示" }]
    })).toEqual([])
  })

  it.each(dbtTemplates)("never allows test data for $id to be a formal publication", template => {
    const document = readDbtDocument(JSON.parse(readFileSync(resolve(`public/data/dbt116-test/${template.id}.json`), "utf8")))
    expect(standardPublicationBlockers({
      ...approved(), usage: document.usage, issues: inspectDbtDocument(document, template.id)
    }).length).toBeGreaterThan(0)
  })
})
