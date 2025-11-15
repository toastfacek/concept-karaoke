/**
 * Performance Metrics Tracking
 *
 * Provides utilities for tracking database queries, API performance,
 * and realtime events. Metrics are stored in-memory and can be
 * accessed via the /api/metrics endpoint.
 */

export type MetricType =
  | "db_query"
  | "api_request"
  | "realtime_event"
  | "cache_hit"
  | "cache_miss"
  | "error"

export interface Metric {
  type: MetricType
  name: string
  duration?: number
  timestamp: number
  metadata?: Record<string, unknown>
}

class MetricsCollector {
  private metrics: Metric[] = []
  private readonly maxMetrics = 10000 // Keep last 10k metrics
  private startTime = Date.now()

  record(metric: Omit<Metric, "timestamp">): void {
    this.metrics.push({
      ...metric,
      timestamp: Date.now(),
    })

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  getMetrics(since?: number): Metric[] {
    if (since) {
      return this.metrics.filter((m) => m.timestamp >= since)
    }
    return [...this.metrics]
  }

  getStats(windowMs = 60000): MetricsStats {
    const now = Date.now()
    const windowStart = now - windowMs
    const recentMetrics = this.metrics.filter((m) => m.timestamp >= windowStart)

    const dbQueries = recentMetrics.filter((m) => m.type === "db_query")
    const apiRequests = recentMetrics.filter((m) => m.type === "api_request")
    const realtimeEvents = recentMetrics.filter((m) => m.type === "realtime_event")
    const cacheHits = recentMetrics.filter((m) => m.type === "cache_hit")
    const cacheMisses = recentMetrics.filter((m) => m.type === "cache_miss")
    const errors = recentMetrics.filter((m) => m.type === "error")

    const calculatePercentiles = (durations: number[]): { p50: number; p95: number; p99: number } => {
      if (durations.length === 0) return { p50: 0, p95: 0, p99: 0 }
      const sorted = [...durations].sort((a, b) => a - b)
      return {
        p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
        p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
        p99: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
      }
    }

    const dbQueryDurations = dbQueries.filter((m) => m.duration).map((m) => m.duration!)
    const apiDurations = apiRequests.filter((m) => m.duration).map((m) => m.duration!)

    return {
      windowMs,
      uptime: now - this.startTime,
      database: {
        queryCount: dbQueries.length,
        queryRate: (dbQueries.length / windowMs) * 60000, // queries/min
        avgDuration: dbQueryDurations.length > 0 ? dbQueryDurations.reduce((a, b) => a + b, 0) / dbQueryDurations.length : 0,
        ...calculatePercentiles(dbQueryDurations),
      },
      api: {
        requestCount: apiRequests.length,
        requestRate: (apiRequests.length / windowMs) * 60000, // requests/min
        errorRate: apiRequests.length > 0 ? errors.length / apiRequests.length : 0,
        avgDuration: apiDurations.length > 0 ? apiDurations.reduce((a, b) => a + b, 0) / apiDurations.length : 0,
        ...calculatePercentiles(apiDurations),
      },
      cache: {
        hitCount: cacheHits.length,
        missCount: cacheMisses.length,
        hitRate: cacheHits.length + cacheMisses.length > 0 ? cacheHits.length / (cacheHits.length + cacheMisses.length) : 0,
      },
      realtime: {
        eventCount: realtimeEvents.length,
        eventRate: (realtimeEvents.length / windowMs) * 1000, // events/sec
      },
      errors: {
        count: errors.length,
        rate: (errors.length / windowMs) * 60000, // errors/min
      },
    }
  }

  clear(): void {
    this.metrics = []
    this.startTime = Date.now()
  }
}

export interface MetricsStats {
  windowMs: number
  uptime: number
  database: {
    queryCount: number
    queryRate: number
    avgDuration: number
    p50: number
    p95: number
    p99: number
  }
  api: {
    requestCount: number
    requestRate: number
    errorRate: number
    avgDuration: number
    p50: number
    p95: number
    p99: number
  }
  cache: {
    hitCount: number
    missCount: number
    hitRate: number
  }
  realtime: {
    eventCount: number
    eventRate: number
  }
  errors: {
    count: number
    rate: number
  }
}

// Global singleton
export const metrics = new MetricsCollector()

/**
 * Utility to measure and record async function execution time
 */
export async function measure<T>(
  type: MetricType,
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>,
): Promise<T> {
  const start = performance.now()
  try {
    const result = await fn()
    const duration = performance.now() - start
    metrics.record({ type, name, duration, metadata })
    return result
  } catch (error) {
    const duration = performance.now() - start
    metrics.record({
      type: "error",
      name: `${name}_error`,
      duration,
      metadata: { ...metadata, error: String(error) },
    })
    throw error
  }
}
