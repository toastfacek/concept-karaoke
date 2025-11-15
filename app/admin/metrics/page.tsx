"use client"

import { useEffect, useState } from "react"
import type { MetricsStats } from "@/lib/metrics"

export default function MetricsPage() {
  const [stats, setStats] = useState<MetricsStats | null>(null)
  const [realtimeStats, setRealtimeStats] = useState<{
    uptime: number
    current: Record<string, number>
    lifetime: Record<string, number>
    activeRooms: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // Fetch Next.js API metrics
        const apiResponse = await fetch("/api/metrics?window=60000")
        const apiData = await apiResponse.json()

        if (apiData.success) {
          setStats(apiData.stats)
        }

        // Fetch realtime server metrics if configured
        const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL
        if (realtimeUrl) {
          try {
            const realtimeResponse = await fetch(`${realtimeUrl}/api/metrics`)
            const realtimeData = await realtimeResponse.json()

            if (realtimeData.success) {
              setRealtimeStats({
                uptime: realtimeData.stats.uptime,
                current: realtimeData.stats.current,
                lifetime: realtimeData.stats.lifetime,
                activeRooms: realtimeData.activeRooms,
              })
            }
          } catch (realtimeError) {
            console.error("Failed to fetch realtime metrics:", realtimeError)
          }
        }

        setError(null)
      } catch (fetchError) {
        console.error("Failed to fetch metrics:", fetchError)
        setError("Failed to load metrics")
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
    const interval = setInterval(fetchMetrics, 5000) // Refresh every 5 seconds

    return () => clearInterval(interval)
  }, [])

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`
    return num.toFixed(2)
  }

  if (loading) {
    return (
      <main className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">Performance Metrics</h1>
        <p>Loading metrics...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">Performance Metrics</h1>
        <p className="text-red-600">{error}</p>
      </main>
    )
  }

  return (
    <main className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Performance Metrics</h1>

      {/* API Server Metrics */}
      {stats && (
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">API Server (Next.js)</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard
              title="Uptime"
              value={formatUptime(stats.uptime)}
              subtitle="Server uptime"
            />
            <MetricCard
              title="API Request Rate"
              value={formatNumber(stats.api.requestRate)}
              subtitle="requests/min (1m window)"
            />
            <MetricCard
              title="DB Query Rate"
              value={formatNumber(stats.database.queryRate)}
              subtitle="queries/min (1m window)"
            />
            <MetricCard
              title="Cache Hit Rate"
              value={`${(stats.cache.hitRate * 100).toFixed(1)}%`}
              subtitle={`${stats.cache.hitCount} hits / ${stats.cache.missCount} misses`}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <MetricCard
              title="API Latency (P50)"
              value={`${stats.api.p50.toFixed(0)}ms`}
              subtitle="Median response time"
            />
            <MetricCard
              title="API Latency (P95)"
              value={`${stats.api.p95.toFixed(0)}ms`}
              subtitle="95th percentile"
            />
            <MetricCard
              title="API Latency (P99)"
              value={`${stats.api.p99.toFixed(0)}ms`}
              subtitle="99th percentile"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="DB Query Latency (P50)"
              value={`${stats.database.p50.toFixed(0)}ms`}
              subtitle="Median query time"
            />
            <MetricCard
              title="DB Query Latency (P95)"
              value={`${stats.database.p95.toFixed(0)}ms`}
              subtitle="95th percentile"
            />
            <MetricCard
              title="Error Rate"
              value={formatNumber(stats.errors.rate)}
              subtitle={`errors/min (${stats.errors.count} in window)`}
            />
          </div>
        </section>
      )}

      {/* Realtime Server Metrics */}
      {realtimeStats && (
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Realtime Server (WebSocket)</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard
              title="Uptime"
              value={formatUptime(realtimeStats.uptime)}
              subtitle="Server uptime"
            />
            <MetricCard
              title="Active Rooms"
              value={String(realtimeStats.activeRooms)}
              subtitle="Live game sessions"
            />
            <MetricCard
              title="Total Connections"
              value={String(realtimeStats.lifetime.ws_connections_total ?? 0)}
              subtitle="Lifetime WebSocket connections"
            />
            <MetricCard
              title="Total Messages"
              value={formatNumber(realtimeStats.lifetime.ws_messages_total ?? 0)}
              subtitle="Lifetime messages processed"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Current Window Counters</h3>
              <div className="space-y-1 text-sm font-mono">
                {Object.entries(realtimeStats.current).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span>{key}:</span>
                    <span className="font-bold">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Lifetime Counters</h3>
              <div className="space-y-1 text-sm font-mono">
                {Object.entries(realtimeStats.lifetime).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span>{key}:</span>
                    <span className="font-bold">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

function MetricCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 rounded-lg">
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{title}</h3>
      <p className="text-3xl font-bold mb-1">{value}</p>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  )
}
