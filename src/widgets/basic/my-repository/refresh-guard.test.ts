import { describe, expect, it, vi } from "vitest"
import { createRefreshGuard, shouldBlockRepositoryLoading } from "./refresh-guard"

describe("my-repository refresh guard", () => {
  it("reuses the in-flight refresh instead of starting another request", async () => {
    let resolveRequest!: () => void
    const request = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRequest = resolve
        })
    )
    const guard = createRefreshGuard(request)

    const first = guard.run()
    const second = guard.run()

    expect(first).toBe(second)
    expect(request).toHaveBeenCalledTimes(1)

    resolveRequest()
    await first
    expect(guard.isRunning()).toBe(false)
  })

  it("allows a new refresh after the previous one completes", async () => {
    const request = vi.fn().mockResolvedValue(undefined)
    const guard = createRefreshGuard(request)

    await guard.run()
    await guard.run()

    expect(request).toHaveBeenCalledTimes(2)
  })

  it("only blocks the panel when no current or local data is available", () => {
    expect(shouldBlockRepositoryLoading(0, 0)).toBe(true)
    expect(shouldBlockRepositoryLoading(0, 2)).toBe(false)
    expect(shouldBlockRepositoryLoading(3, 0)).toBe(false)
  })
})
