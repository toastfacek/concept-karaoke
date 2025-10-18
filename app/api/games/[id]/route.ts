import { NextResponse } from "next/server"
import { z } from "zod"

import { TABLES } from "@/lib/db"
import { getInitialCreationPhase, transitionGameState } from "@/lib/game-state-machine"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import type { CreationPhase, GameStatus } from "@/lib/types"

function normalizeId(id: string) {
  const trimmed = id.trim()
  return trimmed.length === 6 ? trimmed.toUpperCase() : trimmed
}

async function resolveRoom(identifier: string) {
  const supabase = getSupabaseAdminClient()

  const matchByCode = /^[A-Z0-9]{6}$/.test(identifier)

  const roomQuery = supabase
    .from(TABLES.gameRooms)
    .select("id, code, status, current_phase, phase_start_time, host_id")

  const { data: room, error: roomError } = matchByCode
    ? await roomQuery.eq("code", identifier).maybeSingle()
    : await roomQuery.eq("id", identifier).maybeSingle()

  if (roomError) {
    throw roomError
  }

  return room ?? null
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const rawId = params.id
    const identifier = normalizeId(rawId)
    const supabase = getSupabaseAdminClient()

    const room = await resolveRoom(identifier)

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

    const { data: brief, error: briefError } = await supabase
      .from(TABLES.campaignBriefs)
      .select("id, product_name, product_category, business_problem, target_audience, objective, updated_at")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .maybeSingle()

    if (briefError) {
      throw briefError
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
        brief: brief
          ? {
              id: brief.id,
              productName: brief.product_name,
              productCategory: brief.product_category,
              businessProblem: brief.business_problem,
              targetAudience: brief.target_audience,
              objective: brief.objective,
              updatedAt: brief.updated_at,
            }
          : null,
      },
    })
  } catch (error) {
    console.error("Failed to fetch game", error)
    return NextResponse.json({ success: false, error: "Failed to fetch game" }, { status: 500 })
  }
}

const updateSchema = z.object({
  status: z.enum(["briefing", "creating", "pitching", "voting", "results"]),
  playerId: z.string().uuid("Invalid player identifier"),
})

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const rawId = params.id
    const identifier = normalizeId(rawId)
    const supabase = getSupabaseAdminClient()

    const room = await resolveRoom(identifier)

    if (!room) {
      return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 })
    }

    const nextState = transitionGameState(
      {
        status: room.status as GameStatus,
        currentPhase: (room.current_phase ?? null) as CreationPhase | null,
      },
      parsed.data.status,
      {
        nextPhase: parsed.data.status === "creating" ? getInitialCreationPhase() : null,
      },
    )

    const { data: host, error: hostError } = await supabase
      .from(TABLES.players)
      .select("id, is_host")
      .eq("id", parsed.data.playerId)
      .eq("room_id", room.id)
      .maybeSingle()

    if (hostError) {
      throw hostError
    }

    if (!host || !host.is_host) {
      return NextResponse.json({ success: false, error: "Only the host can change game status" }, { status: 403 })
    }

    const { data: players, error: playersError } = await supabase
      .from(TABLES.players)
      .select("id, is_ready")
      .eq("room_id", room.id)

    if (playersError) {
      throw playersError
    }

    const allReady = players?.every((player) => player.is_ready) ?? false
    if (!allReady) {
      return NextResponse.json(
        { success: false, error: "All players must be ready before advancing" },
        { status: 409 },
      )
    }

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

    return NextResponse.json({
      success: true,
      status: nextState.status,
    })
  } catch (error) {
    console.error("Failed to update game", error)
    return NextResponse.json({ success: false, error: "Failed to update game" }, { status: 500 })
  }
}
