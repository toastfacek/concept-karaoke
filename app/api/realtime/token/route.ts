import { NextResponse } from "next/server"
import { z } from "zod"

import { signRealtimeToken } from "@concept-karaoke/realtime-shared"

import { requireServerEnv } from "@/lib/env"
import { TABLES } from "@/lib/db"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const requestSchema = z.object({
  roomCode: z.string().min(6).max(6),
  playerId: z.string().uuid(),
})

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const { roomCode, playerId } = requestSchema.parse(json)

    const supabase = getSupabaseAdminClient()

    const { data: room, error: roomError } = await supabase
      .from(TABLES.gameRooms)
      .select("id")
      .eq("code", roomCode)
      .maybeSingle()

    if (roomError) {
      throw roomError
    }

    if (!room) {
      return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 })
    }

    const { data: player, error: playerError } = await supabase
      .from(TABLES.players)
      .select("id")
      .eq("id", playerId)
      .eq("room_id", room.id)
      .maybeSingle()

    if (playerError) {
      throw playerError
    }

    if (!player) {
      return NextResponse.json({ success: false, error: "Player not found in room" }, { status: 404 })
    }

    const secret = requireServerEnv("REALTIME_SHARED_SECRET")
    const exp = Math.floor(Date.now() / 1000) + 60
    const token = signRealtimeToken({ roomCode, playerId, exp }, secret)

    return NextResponse.json({ success: true, token, expiresAt: exp * 1000 })
  } catch (error) {
    console.error("Failed to issue realtime token", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid request payload" }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: "Failed to issue realtime token" }, { status: 500 })
  }
}
