import type { ServerToClientEvent } from "@concept-karaoke/realtime-shared"

import { env } from "./env"

/**
 * Broadcasts an event to all connected clients in a room via the realtime server
 */
export async function broadcastToRoom(roomCode: string, event: ServerToClientEvent): Promise<void> {
  const realtimeUrl = env.client.NEXT_PUBLIC_REALTIME_URL
  const broadcastSecret = env.server.REALTIME_BROADCAST_SECRET

  if (!realtimeUrl) {
    console.warn("NEXT_PUBLIC_REALTIME_URL not configured, skipping WS broadcast")
    return
  }

  if (!broadcastSecret) {
    console.warn("REALTIME_BROADCAST_SECRET not configured, skipping WS broadcast")
    return
  }

  try {
    const response = await fetch(`${realtimeUrl}/api/broadcast`, {
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
