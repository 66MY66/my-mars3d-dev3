import { describe, expect, it, vi } from "vitest"
import { createCanvasRecorder, pickMediaRecorderMimeType } from "./media-recorder"

describe("media-recorder", () => {
  it("picks the first supported mime type", () => {
    const MediaRecorderMock: any = {
      isTypeSupported: (mime: string) => mime.includes("webm") && !mime.includes("vp9")
    }
    vi.stubGlobal("MediaRecorder", MediaRecorderMock)
    expect(pickMediaRecorderMimeType(["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"])).toBe("video/webm;codecs=vp8")
    vi.unstubAllGlobals()
  })

  it("records canvas stream and resolves blob after stop", async () => {
    class FakeMediaRecorder {
      static isTypeSupported() {
        return true
      }

      state = "inactive"
      ondataavailable: any = null
      onstop: any = null
      onerror: any = null
      mimeType: string

      constructor(_: any, options?: any) {
        this.mimeType = options?.mimeType || "video/webm"
      }

      start() {
        this.state = "recording"
      }

      stop() {
        this.state = "inactive"
        try {
          this.ondataavailable?.({ data: new Blob(["x"], { type: this.mimeType }) })
        } catch (e) {
          this.onerror?.({ error: e })
          return
        }
        this.onstop?.()
      }
    }

    vi.stubGlobal("MediaRecorder", FakeMediaRecorder as any)
    const canvas = document.createElement("canvas") as any
    canvas.captureStream = vi.fn(() => ({}))

    const recorder = createCanvasRecorder(canvas)
    const promise = recorder.start({ seconds: 20, fps: 10 })

    expect(recorder.isRecording()).toBe(true)

    const blob = await recorder.stop()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)

    await expect(promise).resolves.toBeInstanceOf(Blob)

    vi.unstubAllGlobals()
  })
})

