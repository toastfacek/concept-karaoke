import { NextResponse } from "next/server"
import { metrics } from "@/lib/metrics"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const windowParam = url.searchParams.get("window")
    const windowMs = windowParam ? parseInt(windowParam, 10) : 60000 // default 1 minute

    if (isNaN(windowMs) || windowMs <= 0) {
      return NextResponse.json({ success: false, error: "Invalid window parameter" }, { status: 400 })
    }

    const stats = metrics.getStats(windowMs)

    return NextResponse.json({
      success: true,
      stats,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error("Failed to fetch metrics", error)
    return NextResponse.json({ success: false, error: "Failed to fetch metrics" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    metrics.clear()
    return NextResponse.json({
      success: true,
      message: "Metrics cleared",
    })
  } catch (error) {
    console.error("Failed to clear metrics", error)
    return NextResponse.json({ success: false, error: "Failed to clear metrics" }, { status: 500 })
  }
}
