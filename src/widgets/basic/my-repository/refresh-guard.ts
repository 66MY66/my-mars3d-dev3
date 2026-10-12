export function createRefreshGuard(task: () => Promise<void>) {
  let inFlight: Promise<void> | null = null

  return {
    run(): Promise<void> {
      if (inFlight) {
        return inFlight
      }
      inFlight = task().finally(() => {
        inFlight = null
      })
      return inFlight
    },
    isRunning(): boolean {
      return inFlight !== null
    }
  }
}

export function shouldBlockRepositoryLoading(currentCount: number, localCount: number): boolean {
  return currentCount === 0 && localCount === 0
}
