import { describe, expect, it, vi } from "vitest"
import { cancelQuickIdentifyJob, createQuickIdentifyJob, getQuickIdentifyJob } from "@/api/quickIdentify"

describe("quickIdentify mock", () => {
  it("creates job and progresses to done", async () => {
    ;(process.env as any).API_LOCAL = "1"
    vi.useFakeTimers()

    const { jobId } = await createQuickIdentifyJob({
      regionType: "disaster",
      ring: [
        [0, 0],
        [0.01, 0],
        [0.01, 0.01],
        [0, 0.01]
      ],
      products: ["thermal"]
    })
    expect(jobId).toMatch(/^qi_/)

    const s1 = await getQuickIdentifyJob(jobId)
    expect(["queued", "running"]).toContain(s1.status)

    vi.advanceTimersByTime(7000)
    const s2 = await getQuickIdentifyJob(jobId)
    expect(s2.status).toBe("done")
    expect(s2.resultGeojson).toBeTruthy()

    vi.useRealTimers()
  })

  it("cancels job", async () => {
    ;(process.env as any).API_LOCAL = "1"
    const { jobId } = await createQuickIdentifyJob({
      regionType: "disaster",
      ring: [
        [0, 0],
        [0.01, 0],
        [0.01, 0.01],
        [0, 0.01]
      ]
    })
    await cancelQuickIdentifyJob(jobId)
    const s = await getQuickIdentifyJob(jobId)
    expect(s.status).toBe("canceled")
  })
})

