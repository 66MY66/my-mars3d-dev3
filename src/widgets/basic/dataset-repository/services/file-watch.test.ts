import { describe, expect, it } from "vitest"
import { emitFileWatchChange, onFileWatchChange } from "./file-watch"

describe("file-watch", () => {
  it("emits change events to listeners", () => {
    let received = ""
    const dispose = onFileWatchChange((detail) => {
      received = `${detail.key}:${detail.type}`
    })

    emitFileWatchChange({
      key: "remote:test",
      type: "updated",
      name: "demo",
      source: "remote",
      at: Date.now()
    })

    expect(received).toBe("remote:test:updated")
    dispose()
  })
})
