import { NextResponse } from "next/server"
import { z } from "zod"

import { TABLES } from "@/lib/db"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const updateSchema = z.object({
  isReady: z.boolean(),
})

function normalizeId(id: string) {
  const trimmed = id.trim()
  return trimmed.length === 6 ? trimmed.toUpperCase() : trimmed
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; playerId: string }> }) {
  try {
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const resolvedParams = await params
    const identifier = normalizeId(resolvedParams.id)
    const playerId = resolvedParams.playerId
    const supabase = getSupabaseAdminClient()

    const roomQuery = supabase.from(TABLES.gameRooms).select("id, code").limit(1)

    const { data: room, error: roomError } = /^[A-Z0-9]{6}$/.test(identifier)
      ? await roomQuery.eq("code", identifier).maybeSingle()
      : await roomQuery.eq("id", identifier).maybeSingle()

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
      .maybeSingle()

    if (playerError) {
      if (playerError.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Player not found" }, { status: 404 })
      }
      throw playerError
    }

    if (!player) {
      return NextResponse.json({ success: false, error: "Player not found" }, { status: 404 })
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
