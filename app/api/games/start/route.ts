import { NextResponse } from "next/server"
import { z } from "zod"

import { TABLES } from "@/lib/db"
import { transitionGameState } from "@/lib/game-state-machine"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import type { CreationPhase, GameStatus } from "@/lib/types"

const requestSchema = z.object({
  code: z
    .string()
    .min(6, "Code must be 6 characters")
    .max(6, "Code must be 6 characters")
    .transform((value) => value.toUpperCase()),
  playerId: z.string().uuid("Invalid player identifier"),
})

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = requestSchema.safeParse(json)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const { code, playerId } = parsed.data
    const supabase = getSupabaseAdminClient()

    const { data: room, error: roomError } = await supabase
      .from(TABLES.gameRooms)
      .select("id, code, status, current_phase, product_category")
      .eq("code", code)
      .maybeSingle()

    if (roomError) {
      throw roomError
    }

    if (!room) {
      return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 })
    }

    if (room.status !== "lobby") {
      return NextResponse.json({ success: false, error: "Game already started" }, { status: 409 })
    }

    const { data: host, error: hostError } = await supabase
      .from(TABLES.players)
      .select("id, is_host")
      .eq("id", playerId)
      .eq("room_id", room.id)
      .maybeSingle()

    if (hostError) {
      throw hostError
    }

    if (!host || !host.is_host) {
      return NextResponse.json({ success: false, error: "Only the host can start the game" }, { status: 403 })
    }

    const { data: players, error: playersError } = await supabase
      .from(TABLES.players)
      .select("id, is_ready")
      .eq("room_id", room.id)

    if (playersError) {
      throw playersError
    }

    // Temporarily allow hosts to start with a single player while testing.

    const allReady = players?.every((player) => player.is_ready) ?? false
    if (!allReady) {
      return NextResponse.json({ success: false, error: "All players must be ready before starting" }, { status: 409 })
    }

    const nextState = transitionGameState(
      {
        status: room.status as GameStatus,
        currentPhase: (room.current_phase ?? null) as CreationPhase | null,
      },
      "briefing",
    )

    const { error: updateError } = await supabase
      .from(TABLES.gameRooms)
      .update({
        status: nextState.status,
        current_phase: nextState.currentPhase,
        phase_start_time: new Date().toISOString(),
      })
      .eq("id", room.id)

    if (updateError) {
      throw updateError
    }

    const { error: resetReadyError } = await supabase
      .from(TABLES.players)
      .update({ is_ready: false })
      .eq("room_id", room.id)

    if (resetReadyError) {
      throw resetReadyError
    }

    const { data: existingBrief, error: briefSelectError } = await supabase
      .from(TABLES.campaignBriefs)
      .select("id")
      .eq("room_id", room.id)
      .maybeSingle()

    if (briefSelectError) {
      throw briefSelectError
    }

    if (!existingBrief) {
      const { error: insertBriefError } = await supabase.from(TABLES.campaignBriefs).insert({
        room_id: room.id,
        product_name: "",
        product_category: room.product_category ?? "All",
        business_problem: "",
        target_audience: "",
        objective: "",
      })

      if (insertBriefError) {
        throw insertBriefError
      }
    }

    return NextResponse.json({
      success: true,
      status: nextState.status,
    })
  } catch (error) {
    console.error("Failed to start game", error)
    return NextResponse.json({ success: false, error: "Failed to start game" }, { status: 500 })
  }
}
