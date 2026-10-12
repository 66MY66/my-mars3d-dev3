import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { retryLoad } from "./layer-retry"

describe("layer-retry", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("succeeds on the first try", async () => {
    const loadFn = vi.fn().mockResolvedValue("success")
    await expect(retryLoad(loadFn)).resolves.toBe("success")
    expect(loadFn).toHaveBeenCalledTimes(1)
  })

  it("retries with exponential backoff and succeeds", async () => {
    const loadFn = vi.fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("success")
    const onRetry = vi.fn()

    const promise = retryLoad(loadFn, { maxRetries: 3, delays: [100, 200, 400], onRetry })
    await vi.advanceTimersByTimeAsync(300)
    await expect(promise).resolves.toBe("success")

    expect(loadFn).toHaveBeenCalledTimes(3)
    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenNthCalledWith(1, expect.objectContaining({ attempt: 1, delay: 100 }))
    expect(onRetry).toHaveBeenNthCalledWith(2, expect.objectContaining({ attempt: 2, delay: 200 }))
  })

  it("fails after max retries", async () => {
    const loadFn = vi.fn().mockRejectedValue(new Error("always fail"))
    const promise = expect(retryLoad(loadFn, { maxRetries: 3, delays: [100, 200, 400] })).rejects.toThrow("always fail")
    await vi.advanceTimersByTimeAsync(300)
    await promise
    expect(loadFn).toHaveBeenCalledTimes(3)
  })
})
