import type { ServerToClientEvent } from "@concept-karaoke/realtime-shared"

import { env } from "./env"

function buildBroadcastUrl() {
  const realtimeUrl = env.client.NEXT_PUBLIC_REALTIME_URL
  if (!realtimeUrl) {
    return null
  }

  try {
    const url = new URL(realtimeUrl)
    if (url.protocol === "ws:") {
      url.protocol = "http:"
    } else if (url.protocol === "wss:") {
      url.protocol = "https:"
    }
    url.pathname = url.pathname.replace(/\/?$/, "")
    url.hash = ""
    url.search = ""
    const normalizedBase = url.toString().replace(/\/$/, "")
    return `${normalizedBase}/api/broadcast`
  } catch {
    return null
  }
}

function getBroadcastSecret() {
  return env.server.REALTIME_BROADCAST_SECRET
}

/**
 * Broadcasts an event to all connected clients in a room via the realtime server
 */
export async function broadcastToRoom(roomCode: string, event: ServerToClientEvent): Promise<void> {
  const broadcastUrl = buildBroadcastUrl()
  const broadcastSecret = getBroadcastSecret()

  if (!broadcastUrl) {
    console.warn("Realtime server URL missing or invalid, skipping WS broadcast")
    return
  }

  if (!broadcastSecret) {
    console.warn("REALTIME_BROADCAST_SECRET not configured, skipping WS broadcast")
    return
  }

  try {
    const response = await fetch(broadcastUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roomCode,
        event,
        secret: broadcastSecret,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }))
      console.error("Failed to broadcast to WS server:", error)
    }
  } catch (error) {
    console.error("Failed to broadcast to WS server:", error instanceof Error ? error.message : "Unknown error")
  }
}
