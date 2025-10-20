import { NextResponse } from "next/server"
import { z } from "zod"

import { TABLES, generateRoomCode } from "@/lib/db"
import { INITIAL_GAME_STATE } from "@/lib/game-state-machine"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const requestSchema = z.object({
  playerName: z
    .string()
    .min(1, "Player name is required")
    .max(50, "Player name must be 50 characters or fewer")
    .transform((value) => value.trim()),
  emoji: z.string().min(1, "Emoji is required").max(10, "Emoji must be 10 characters or fewer"),
})

const MAX_CODE_ATTEMPTS = 5

async function findUniqueCode() {
  const supabase = getSupabaseAdminClient()

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const candidate = generateRoomCode()

    const { data, error } = await supabase
      .from(TABLES.gameRooms)
      .select("id")
      .eq("code", candidate)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return candidate
    }
  }

  throw new Error("Unable to generate unique room code. Please try again.")
}

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = requestSchema.safeParse(json)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const body = parsed.data
    const supabase = getSupabaseAdminClient()

    const roomCode = await findUniqueCode()
    const roomId = crypto.randomUUID()
    const playerId = crypto.randomUUID()

    const { error: roomError } = await supabase.from(TABLES.gameRooms).insert({
      id: roomId,
      code: roomCode,
      status: INITIAL_GAME_STATE.status,
      current_phase: INITIAL_GAME_STATE.currentPhase,
      phase_start_time: null,
      host_id: playerId,
      product_category: "All",
      phase_duration_seconds: 60,
    })

    if (roomError) {
      throw roomError
    }

    const { data: player, error: playerError } = await supabase
      .from(TABLES.players)
      .insert({
        id: playerId,
        room_id: roomId,
        name: body.playerName,
        emoji: body.emoji,
        is_ready: false,
        is_host: true,
      })
      .select("id, name, emoji, is_ready, is_host")
      .single()

    if (playerError) {
      throw playerError
    }

    return NextResponse.json({
      success: true,
      room: {
        id: roomId,
        code: roomCode,
      },
      player: {
        id: player.id,
        name: player.name,
        emoji: player.emoji,
        isReady: player.is_ready,
        isHost: player.is_host,
      },
    })
  } catch (error) {
    console.error("Failed to create game", error)
    return NextResponse.json({ success: false, error: "Failed to create game" }, { status: 500 })
  }
}
