export interface RetryOptions {
  maxRetries?: number
  delays?: number[]
  onRetry?: (detail: { attempt: number; delay: number; error: Error }) => void | Promise<void>
}

const DEFAULT_DELAYS = [3000, 6000, 12000]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export async function retryLoad<T>(loadFn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxRetries = Math.max(1, Number(options.maxRetries ?? 3))
  const delays = Array.isArray(options.delays) && options.delays.length ? options.delays : DEFAULT_DELAYS

  let lastError: Error | null = null
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await loadFn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error || "load failed"))
      if (attempt >= maxRetries) {
        break
      }
      const delay = Number(delays[Math.min(attempt - 1, delays.length - 1)] ?? 0)
      await options.onRetry?.({ attempt, delay, error: lastError })
      if (delay > 0) {
        await sleep(delay)
      }
    }
  }

  throw lastError || new Error("load failed")
}
