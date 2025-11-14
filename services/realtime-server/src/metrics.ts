type CounterMap = Map<string, number>

export class MetricsRecorder {
  private readonly counters: CounterMap = new Map()
  private readonly lifetimeCounters: CounterMap = new Map()
  private flushTimer: NodeJS.Timeout | null = null
  private readonly startTime = Date.now()

  constructor(private readonly flushIntervalMs = 60_000, private readonly onFlush?: (snapshot: Record<string, number>) => void) {
    if (flushIntervalMs > 0) {
      this.flushTimer = setInterval(() => {
        this.flush()
      }, flushIntervalMs)
    }
  }

  increment(name: string, amount = 1) {
    const next = (this.counters.get(name) ?? 0) + amount
    this.counters.set(name, next)

    // Also track lifetime totals
    const lifetimeNext = (this.lifetimeCounters.get(name) ?? 0) + amount
    this.lifetimeCounters.set(name, lifetimeNext)
  }

  getStats() {
    const uptime = Date.now() - this.startTime
    const currentCounters: Record<string, number> = {}
    const lifetimeCounters: Record<string, number> = {}

    for (const [key, value] of this.counters.entries()) {
      currentCounters[key] = value
    }

    for (const [key, value] of this.lifetimeCounters.entries()) {
      lifetimeCounters[key] = value
    }

    return {
      uptime,
      current: currentCounters,
      lifetime: lifetimeCounters,
    }
  }

  flush() {
    if (this.counters.size === 0) {
      return
    }

    const snapshot: Record<string, number> = {}
    for (const [key, value] of this.counters.entries()) {
      snapshot[key] = value
    }
    this.counters.clear()
    this.onFlush?.(snapshot)
  }

  shutdown() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    this.flush()
  }
}

