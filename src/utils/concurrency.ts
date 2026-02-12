export type TaskFn<T> = () => Promise<T>

export async function runWithConcurrency<T>(
  tasks: TaskFn<T>[],
  concurrency: number,
  minDelayMs = 0,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  const total = tasks.length
  if (total === 0) {
    return results
  }

  const limit = Math.max(1, Math.floor(concurrency || 1))
  let nextIndex = 0

  async function delay(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  async function runNext(): Promise<void> {
    if (nextIndex >= total) {
      return
    }
    const current = nextIndex
    nextIndex += 1

    if (minDelayMs > 0 && current > 0) {
      await delay(minDelayMs)
    }

    const task = tasks[current]
    const value = await task()
    results[current] = value

    if (nextIndex < total) {
      await runNext()
    }
  }

  const starters = []
  for (let i = 0; i < limit && i < total; i += 1) {
    starters.push(runNext())
  }
  await Promise.all(starters)

  return results
}
