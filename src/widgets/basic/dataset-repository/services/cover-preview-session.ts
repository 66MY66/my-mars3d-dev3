export interface CoverPreviewSessionDependencies<TState> {
  captureState: () => TState
  restoreState: (state: TState) => Promise<void>
  captureCover: () => Promise<string>
  releaseCover: (url: string) => void
  onCoverChange: (url: string) => void
  onBusyChange: (busy: boolean) => void
}

export interface CoverPreviewSession {
  open: (initialCover: string) => void
  runAction: (action: () => Promise<void>) => Promise<void>
  close: () => Promise<void>
}

export function createCoverPreviewSession<TState>(
  dependencies: CoverPreviewSessionDependencies<TState>
): CoverPreviewSession {
  let snapshot: TState | undefined
  let active = false
  let busy = false
  let generatedCover = ""
  let runningAction: Promise<void> | null = null
  let closing: Promise<void> | null = null

  const releaseGeneratedCover = () => {
    if (!generatedCover) {
      return
    }
    dependencies.releaseCover(generatedCover)
    generatedCover = ""
  }

  return {
    open(initialCover: string) {
      if (active) {
        return
      }
      snapshot = dependencies.captureState()
      active = true
      dependencies.onCoverChange(initialCover)
    },

    async runAction(action: () => Promise<void>) {
      if (!active || busy) {
        return
      }
      busy = true
      dependencies.onBusyChange(true)
      runningAction = (async () => {
        await action()
        if (!active) {
          return
        }
        const nextCover = await dependencies.captureCover()
        if (!active) {
          dependencies.releaseCover(nextCover)
          return
        }
        releaseGeneratedCover()
        generatedCover = nextCover
        dependencies.onCoverChange(nextCover)
      })()
      try {
        await runningAction
      } finally {
        runningAction = null
        busy = false
        dependencies.onBusyChange(false)
      }
    },

    async close() {
      if (closing) {
        return await closing
      }
      if (!active || snapshot === undefined) {
        return
      }
      active = false
      const stateToRestore = snapshot
      snapshot = undefined
      closing = (async () => {
        try {
          if (runningAction) {
            try {
              await runningAction
            } catch {
            }
          }
          await dependencies.restoreState(stateToRestore)
        } finally {
          releaseGeneratedCover()
          dependencies.onCoverChange("")
          closing = null
        }
      })()
      return await closing
    }
  }
}
