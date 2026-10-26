import { describe, expect, it, vi } from "vitest"
import { createCoverPreviewSession } from "./cover-preview-session"

function deferred<T = void>() {
  let resolveDeferred!: (value: T | PromiseLike<T>) => void
  let rejectDeferred!: (reason?: unknown) => void
  const promise = new Promise<T>((resolve, reject) => {
    resolveDeferred = resolve
    rejectDeferred = reject
  })
  return { promise, resolve: resolveDeferred, reject: rejectDeferred }
}

describe("cover preview session", () => {
  it("captures the map once, refreshes the cover after an action, and restores on close", async () => {
    const covers: string[] = []
    const busy: boolean[] = []
    const restore = vi.fn(async () => {})
    const release = vi.fn()
    const session = createCoverPreviewSession({
      captureState: () => ({ camera: "before" }),
      restoreState: restore,
      captureCover: async () => "blob:current-cover",
      releaseCover: release,
      onCoverChange: (url) => covers.push(url),
      onBusyChange: (value) => busy.push(value)
    })

    session.open("https://example.test/original.png")
    await session.runAction(async () => {})
    await session.close()

    expect(covers).toEqual([
      "https://example.test/original.png",
      "blob:current-cover",
      ""
    ])
    expect(busy).toEqual([true, false])
    expect(restore).toHaveBeenCalledOnce()
    expect(restore).toHaveBeenCalledWith({ camera: "before" })
    expect(release).toHaveBeenCalledOnce()
    expect(release).toHaveBeenCalledWith("blob:current-cover")
  })

  it("does not start a second map action while the first action is busy", async () => {
    const first = deferred()
    const secondAction = vi.fn(async () => {})
    const session = createCoverPreviewSession({
      captureState: () => "before",
      restoreState: async () => {},
      captureCover: async () => "blob:cover",
      releaseCover: () => {},
      onCoverChange: () => {},
      onBusyChange: () => {}
    })

    session.open("original")
    const firstRun = session.runAction(() => first.promise)
    const secondRun = session.runAction(secondAction)
    first.resolve()

    await Promise.all([firstRun, secondRun])
    expect(secondAction).not.toHaveBeenCalled()
  })

  it("waits for an in-flight action before restoring and skips the late cover capture", async () => {
    const action = deferred()
    const events: string[] = []
    const captureCover = vi.fn(async () => "blob:late")
    const session = createCoverPreviewSession({
      captureState: () => "before",
      restoreState: async () => { events.push("restore") },
      captureCover,
      releaseCover: () => {},
      onCoverChange: () => {},
      onBusyChange: () => {}
    })

    session.open("original")
    const running = session.runAction(async () => {
      await action.promise
      events.push("action")
    })
    const closing = session.close()
    action.resolve()

    await Promise.all([running, closing])
    expect(events).toEqual(["action", "restore"])
    expect(captureCover).not.toHaveBeenCalled()
  })

  it("keeps the current cover when an action fails and still restores the map", async () => {
    const covers: string[] = []
    const restore = vi.fn(async () => {})
    const session = createCoverPreviewSession({
      captureState: () => "before",
      restoreState: restore,
      captureCover: async () => "blob:unused",
      releaseCover: () => {},
      onCoverChange: (url) => covers.push(url),
      onBusyChange: () => {}
    })

    session.open("original")
    await expect(session.runAction(async () => {
      throw new Error("map failed")
    })).rejects.toThrow("map failed")
    await session.close()

    expect(covers).toEqual(["original", ""])
    expect(restore).toHaveBeenCalledOnce()
  })
})
