import { expect, it } from "vitest"
import { compositionProofMark } from "./composition-proof-mark"
it("keeps reference-use marks outside map content without allowing an unmarked proof", () => {
  expect(compositionProofMark("reference")).toEqual({ text: "参考校样 · 非正式应急响应成果", diagonal: false })
  expect(compositionProofMark("test").diagonal).toBe(true)
  expect(compositionProofMark("operational").diagonal).toBe(true)
  expect(compositionProofMark().text).toContain("校样")
})
