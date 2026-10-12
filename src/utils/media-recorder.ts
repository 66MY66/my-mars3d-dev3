export type CanvasRecordingOptions = {
  fps?: number
  seconds?: number
  mimeType?: string
}

export function canUseMediaRecorder(): boolean {
  try {
    return typeof (globalThis as any).MediaRecorder === "function"
  } catch {
    return false
  }
}

export function pickMediaRecorderMimeType(preferred: string[] = []): string {
  const MediaRecorderAny: any = (globalThis as any).MediaRecorder
  if (!MediaRecorderAny || typeof MediaRecorderAny.isTypeSupported !== "function") {
    return ""
  }
  for (const mimeType of preferred) {
    try {
      if (mimeType && MediaRecorderAny.isTypeSupported(mimeType)) {
        return mimeType
      }
    } catch {
    }
  }
  return ""
}

export type CanvasRecorderSession = {
  start: (options?: CanvasRecordingOptions) => Promise<Blob>
  stop: () => Promise<Blob>
  isRecording: () => boolean
}

export function createCanvasRecorder(canvas: HTMLCanvasElement): CanvasRecorderSession {
  let recorder: any = null
  let chunks: BlobPart[] = []
  let stopResolve: ((blob: Blob) => void) | null = null
  let stopReject: ((err: any) => void) | null = null
  let stopTimer: number | null = null

  const cleanupTimer = () => {
    if (stopTimer != null) {
      window.clearTimeout(stopTimer)
      stopTimer = null
    }
  }

  const ensureStopPromise = () => {
    if (stopResolve || stopReject) {
      return
    }
    ;({ resolve: stopResolve, reject: stopReject } = (() => {
      let resolve: (blob: Blob) => void = () => {}
      let reject: (err: any) => void = () => {}
      const promise = new Promise<Blob>((_resolve, _reject) => {
        resolve = _resolve
        reject = _reject
      })
      ;(ensureStopPromise as any).promise = promise
      return { resolve, reject }
    })())
  }

  const getStopPromise = (): Promise<Blob> => {
    ensureStopPromise()
    return (ensureStopPromise as any).promise as Promise<Blob>
  }

  const start = async (options: CanvasRecordingOptions = {}): Promise<Blob> => {
    if (!canUseMediaRecorder()) {
      throw new Error("MediaRecorder unsupported")
    }
    if (!canvas || typeof (canvas as any).captureStream !== "function") {
      throw new Error("canvas.captureStream unsupported")
    }
    if (recorder && recorder.state === "recording") {
      return
    }
    cleanupTimer()
    chunks = []
    stopResolve = null
    stopReject = null
    ;(ensureStopPromise as any).promise = null

    const fps = Math.max(1, Number(options.fps) || 30)
    const seconds = Math.max(1, Number(options.seconds) || 8)
    const preferredMimeTypes = options.mimeType
      ? [options.mimeType]
      : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
    const mimeType = pickMediaRecorderMimeType(preferredMimeTypes) || ""
    const stream = (canvas as any).captureStream(fps)
    const MediaRecorderAny: any = (globalThis as any).MediaRecorder
    recorder = mimeType ? new MediaRecorderAny(stream, { mimeType }) : new MediaRecorderAny(stream)

    recorder.ondataavailable = (ev: any) => {
      if (ev?.data && ev.data.size > 0) {
        chunks.push(ev.data)
      }
    }
    recorder.onerror = (ev: any) => {
      cleanupTimer()
      const err = ev?.error || ev || new Error("recording error")
      if (stopReject) {
        stopReject(err)
      }
    }
    recorder.onstop = () => {
      cleanupTimer()
      const blob = new Blob(chunks, { type: mimeType || "video/webm" })
      if (stopResolve) {
        stopResolve(blob)
      }
    }

    ensureStopPromise()
    recorder.start()
    stopTimer = window.setTimeout(() => {
      try {
        recorder?.stop?.()
      } catch (e) {
        if (stopReject) {
          stopReject(e)
        }
      }
    }, seconds * 1000)
    return await getStopPromise()
  }

  const stop = async (): Promise<Blob> => {
    if (!recorder) {
      return new Blob([], { type: "video/webm" })
    }
    ensureStopPromise()
    try {
      recorder.stop()
    } catch (e) {
      cleanupTimer()
      if (stopReject) {
        stopReject(e)
      }
    }
    return await getStopPromise()
  }

  const isRecording = () => !!recorder && recorder.state === "recording"

  return {
    start,
    stop,
    isRecording
  }
}
