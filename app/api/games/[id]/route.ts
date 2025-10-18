import { NextResponse } from "next/server"

import { TABLES } from "@/lib/db"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

function normalizeId(id: string) {
  const trimmed = id.trim()
  return trimmed.length === 6 ? trimmed.toUpperCase() : trimmed
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const rawId = params.id
    const identifier = normalizeId(rawId)
    const supabase = getSupabaseAdminClient()

    const matchByCode = /^[A-Z0-9]{6}$/.test(identifier)

    const roomQuery = supabase.from(TABLES.gameRooms).select("id, code, status, current_phase, phase_start_time, host_id")

    const { data: room, error: roomError } = matchByCode
      ? await roomQuery.eq("code", identifier).maybeSingle()
      : await roomQuery.eq("id", identifier).maybeSingle()

    if (roomError) {
      throw roomError
    }

    if (!room) {
      return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 })
    }

    const { data: players, error: playersError } = await supabase
      .from(TABLES.players)
      .select("id, name, emoji, is_ready, is_host, joined_at")
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true })

    if (playersError) {
      throw playersError
    }

    return NextResponse.json({
      success: true,
      game: {
        id: room.id,
        code: room.code,
        status: room.status,
        currentPhase: room.current_phase,
        phaseStartTime: room.phase_start_time,
        hostId: room.host_id,
        players: players?.map((player) => ({
          id: player.id,
          name: player.name,
          emoji: player.emoji,
          isReady: player.is_ready,
          isHost: player.is_host,
          joinedAt: player.joined_at,
        })) ?? [],
      },
    })
  } catch (error) {
    console.error("Failed to fetch game", error)
    return NextResponse.json({ success: false, error: "Failed to fetch game" }, { status: 500 })
  }
}
