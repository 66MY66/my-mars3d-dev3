import { beforeEach, describe, expect, it, vi } from "vitest"

import eoapiClient, { __resetDegradedApiStateForTest, eoapiGet, eoapiPost, hasKnownHealthyManagementApi } from "./eoapi-client"

describe("eoapi-client degraded api cooldown", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.restoreAllMocks()
    localStorage.clear()
    __resetDegradedApiStateForTest()
  })

  it("backs off management api after a 500", async () => {
    const getSpy = vi.spyOn(eoapiClient, "get")
    getSpy.mockRejectedValueOnce({
      response: {
        status: 500,
        data: {
          message: "boom"
        }
      },
      message: "boom"
    } as any)

    const first = await eoapiGet("/favorites")
    const second = await eoapiGet("/favorites")

    expect(first.success).toBe(false)
    expect(first.code).toBe(500)
    expect(second).toEqual({
      success: false,
      message: "接口处于降级冷却中",
      code: 503
    })
    expect(getSpy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(60_001)
    getSpy.mockResolvedValueOnce({ status: 200, data: [] } as any)
    const third = await eoapiGet("/favorites")
    expect(third.success).toBe(true)
    expect(getSpy).toHaveBeenCalledTimes(2)
  })

  it("records a healthy management api signal after success", async () => {
    const getSpy = vi.spyOn(eoapiClient, "get")
    getSpy.mockResolvedValueOnce({ status: 200, data: [] } as any)

    await eoapiGet("/favorites")

    expect(hasKnownHealthyManagementApi()).toBe(true)
  })

  it("backs off directory lock api after a 404 across methods", async () => {
    const getSpy = vi.spyOn(eoapiClient, "get")
    const postSpy = vi.spyOn(eoapiClient, "post")
    getSpy.mockRejectedValueOnce({
      response: {
        status: 404,
        data: {
          message: "not found"
        }
      },
      message: "not found"
    } as any)

    await eoapiGet("/locks/directories")
    const skipped = await eoapiPost("/locks/directories/demo", {})

    expect(skipped).toEqual({
      success: false,
      message: "接口处于降级冷却中",
      code: 503
    })
    expect(postSpy).not.toHaveBeenCalled()
  })
})
