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
    .select("id, code, status, current_phase, phase_start_time, host_id, current_pitch_index, pitch_sequence")

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

    const { data: adlobs, error: adlobsError } = await supabase
      .from(TABLES.adLobs)
      .select(
        "id, big_idea_text, big_idea_created_by, visual_canvas_data, visual_image_urls, visual_created_by, headline_canvas_data, headline_created_by, mantra_text, mantra_created_by, created_at, assigned_pitcher, pitch_order, pitch_started_at, pitch_completed_at",
      )
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })

    if (adlobsError) {
      throw adlobsError
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
        currentPitchIndex: room.current_pitch_index,
        pitchSequence: room.pitch_sequence ?? [],
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
        adlobs:
          adlobs?.map((adlob) => ({
            id: adlob.id,
            bigIdea: adlob.big_idea_text,
            bigIdeaAuthorId: adlob.big_idea_created_by,
            visualCanvasData: adlob.visual_canvas_data,
            visualImageUrls: adlob.visual_image_urls,
            visualAuthorId: adlob.visual_created_by,
            headlineCanvasData: adlob.headline_canvas_data,
            headlineAuthorId: adlob.headline_created_by,
            mantra: adlob.mantra_text,
            mantraAuthorId: adlob.mantra_created_by,
            createdAt: adlob.created_at,
            assignedPitcherId: adlob.assigned_pitcher,
            pitchOrder: adlob.pitch_order,
            pitchStartedAt: adlob.pitch_started_at,
            pitchCompletedAt: adlob.pitch_completed_at,
          })) ?? [],
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

    let pitchSequence: string[] = []

    if (nextState.status === "pitching") {
      const { data: adlobsForPitch, error: adlobsSelectError } = await supabase
        .from(TABLES.adLobs)
        .select("id, assigned_pitcher, mantra_created_by")
        .eq("room_id", room.id)
        .order("created_at", { ascending: true })

      if (adlobsSelectError) {
        throw adlobsSelectError
      }

      const orderedAdlobs = adlobsForPitch ?? []
      pitchSequence = orderedAdlobs.map((item) => item.id)

      for (let index = 0; index < orderedAdlobs.length; index += 1) {
        const adlob = orderedAdlobs[index]
        const assignedPitcher = adlob.assigned_pitcher ?? adlob.mantra_created_by ?? null

        const { error: adlobUpdateError } = await supabase
          .from(TABLES.adLobs)
          .update({
            assigned_pitcher: assignedPitcher,
            pitch_order: index,
            pitch_started_at: null,
            pitch_completed_at: null,
          })
          .eq("id", adlob.id)

        if (adlobUpdateError) {
          throw adlobUpdateError
        }
      }
    }

    const hasPitchSequence = pitchSequence.length > 0

    const { error: updateError } = await supabase
      .from(TABLES.gameRooms)
      .update({
        status: nextState.status,
        current_phase: nextState.status === "creating" ? nextState.currentPhase : null,
        phase_start_time: new Date().toISOString(),
        current_pitch_index: nextState.status === "pitching" ? (hasPitchSequence ? 0 : null) : null,
        pitch_sequence: nextState.status === "pitching" ? (hasPitchSequence ? pitchSequence : null) : null,
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
