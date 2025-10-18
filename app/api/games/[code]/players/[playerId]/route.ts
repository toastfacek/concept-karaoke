import { NextResponse } from "next/server"
import { z } from "zod"

import { TABLES } from "@/lib/db"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const updateSchema = z.object({
  isReady: z.boolean(),
})

export async function PATCH(request: Request, { params }: { params: { code: string; playerId: string } }) {
  try {
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const code = params.code.toUpperCase()
    const playerId = params.playerId
    const supabase = getSupabaseAdminClient()

    const { data: room, error: roomError } = await supabase
      .from(TABLES.gameRooms)
      .select("id")
      .eq("code", code)
      .maybeSingle()

    if (roomError) {
      throw roomError
    }

    if (!room) {
      return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 })
    }

    const { data: player, error: playerError } = await supabase
      .from(TABLES.players)
      .update({ is_ready: parsed.data.isReady })
      .eq("id", playerId)
      .eq("room_id", room.id)
      .select("id, name, emoji, is_ready, is_host")
      .single()

    if (playerError) {
      if (playerError.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Player not found" }, { status: 404 })
      }
      throw playerError
    }

    return NextResponse.json({
      success: true,
      player: {
        id: player.id,
        name: player.name,
        emoji: player.emoji,
        isReady: player.is_ready,
        isHost: player.is_host,
      },
    })
  } catch (error) {
    console.error("Failed to update player", error)
    return NextResponse.json({ success: false, error: "Failed to update player" }, { status: 500 })
  }
}
