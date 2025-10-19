import type { RoomSnapshot } from "@concept-karaoke/realtime-shared"

import { supabase } from "./supabase-client.js"

export async function persistRoomSnapshot(snapshot: RoomSnapshot) {
  const { error } = await supabase.from("room_snapshots").insert({
    room_code: snapshot.code,
    version: snapshot.version,
    snapshot,
  })

  if (error) {
    throw new Error(`Failed to persist room snapshot: ${error.message}`)
  }
}

export async function recordRoomEvent(options: {
  roomCode: string
  eventType: string
  version?: number
  payload?: Record<string, unknown>
}) {
  const { roomCode, eventType, version, payload } = options
  const { error } = await supabase.from("room_events").insert({
    room_code: roomCode,
    event_type: eventType,
    version: version ?? null,
    payload: payload ?? null,
  })

  if (error) {
    throw new Error(`Failed to persist room event (${eventType}): ${error.message}`)
  }
}
