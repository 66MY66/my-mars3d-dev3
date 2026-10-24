import { describe, expect, it, beforeEach } from "vitest"
import { clearThematicJobDraft, loadThematicJobDraft, saveThematicJobDraft } from "./thematic-job-draft"

const snapshot = { version: 1, settings: { scaleDenominator: 50000 } } as any

describe("thematic job draft storage", () => {
  beforeEach(() => localStorage.clear())

  it("round trips drafts by dataset and job", () => {
    saveThematicJobDraft("ds-1", "job-1", snapshot)
    expect(loadThematicJobDraft("ds-1", "job-1")).toEqual(snapshot)
    expect(loadThematicJobDraft("ds-2", "job-1")).toBeNull()
  })

  it("ignores malformed drafts and clears a saved draft", () => {
    localStorage.setItem("mars3d:thematic-job-draft:v1:ds-1:job-1", "bad")
    expect(loadThematicJobDraft("ds-1", "job-1")).toBeNull()
    saveThematicJobDraft("ds-1", "job-1", snapshot)
    clearThematicJobDraft("ds-1", "job-1")
    expect(loadThematicJobDraft("ds-1", "job-1")).toBeNull()
  })
})
