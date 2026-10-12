import { beforeEach, describe, expect, it, vi } from "vitest"

import { __resetDirectoryLockApiStateForTest, getDirectoryLocks, upsertDirectoryLock } from "./eoapi-directory-locks"
import { eoapiGet, eoapiPost } from "./eoapi-client"

vi.mock("./eoapi-client", () => ({
  eoapiGet: vi.fn(() => Promise.resolve({ success: true, data: [] })),
  eoapiPost: vi.fn(() => Promise.resolve({ success: true, data: {} }))
}))

vi.mock("./dataset-sync", () => ({
  emitDatasetSync: vi.fn()
}))

vi.mock("@/shell/permission", () => ({
  isSuperAdmin: vi.fn(() => false)
}))

describe("eoapi-directory-locks", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    localStorage.clear()
    __resetDirectoryLockApiStateForTest()
  })

  it("backs off repeated get requests after a 404", async () => {
    vi.mocked(eoapiGet).mockResolvedValueOnce({ success: false, code: 404, message: "not found" } as any)

    const first = await getDirectoryLocks("ds-1")
    const second = await getDirectoryLocks("ds-1")

    expect(first.success).toBe(false)
    expect(second).toEqual({ success: true, data: [] })
    expect(vi.mocked(eoapiGet)).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(60_001)
    vi.mocked(eoapiGet).mockResolvedValueOnce({ success: true, data: [] } as any)
    await getDirectoryLocks("ds-1")
    expect(vi.mocked(eoapiGet)).toHaveBeenCalledTimes(2)
  })

  it("skips upsert when lock api is in cooldown", async () => {
    vi.mocked(eoapiGet).mockResolvedValueOnce({ success: false, code: 500, message: "boom" } as any)

    await getDirectoryLocks("ds-1")
    const result = await upsertDirectoryLock("dir-1", {
      datasetId: "ds-1",
      locked: true
    })

    expect(result.success).toBe(false)
    expect(result.code).toBe(503)
    expect(vi.mocked(eoapiPost)).not.toHaveBeenCalled()
  })
})
