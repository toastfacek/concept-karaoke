import { NextResponse } from "next/server"
import { z } from "zod"

import { TABLES } from "@/lib/db"
import { getInitialCreationPhase, transitionGameState } from "@/lib/game-state-machine"
import { broadcastToRoom } from "@/lib/realtime-broadcast"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import type { CreationPhase, GameStatus } from "@/lib/types"
import { serializeGameRow } from "@/lib/serializers/game"

function normalizeId(id: string) {
  const trimmed = id.trim()
  return trimmed.length === 6 ? trimmed.toUpperCase() : trimmed
}

async function resolveRoom(identifier: string) {
  const supabase = getSupabaseAdminClient()

  const matchByCode = /^[A-Z0-9]{6}$/.test(identifier)

  const roomQuery = supabase
    .from(TABLES.gameRooms)
    .select("id, code, status, current_phase, phase_start_time, host_id, current_present_index, present_sequence, product_category, phase_duration_seconds")

  const { data: room, error: roomError } = matchByCode
    ? await roomQuery.eq("code", identifier).maybeSingle()
    : await roomQuery.eq("id", identifier).maybeSingle()

  if (roomError) {
    throw roomError
  }

  return room ?? null
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params
    const identifier = normalizeId(rawId)
    const supabase = getSupabaseAdminClient()

    const matchByCode = /^[A-Z0-9]{6}$/.test(identifier)
    let query = supabase
      .from(TABLES.gameRooms)
      .select(
        `
          id,
          code,
          status,
          current_phase,
          phase_start_time,
          host_id,
          current_present_index,
          present_sequence,
          product_category,
          phase_duration_seconds,
          brief_style,
          version,
          players:players(id, name, emoji, is_ready, is_host, joined_at),
          brief:campaign_briefs(id, product_name, product_category, tagline, product_features, business_problem, target_audience, objective, weird_constraint, updated_at),
          adlobs:adlobs(id, big_idea_text, big_idea_created_by, visual_canvas_data, visual_image_urls, visual_created_by, headline_canvas_data, headline_created_by, pitch_text, pitch_created_by, created_at, assigned_presenter, present_order, present_started_at, present_completed_at, vote_count)
        `,
      )
      .limit(1)

    query = matchByCode ? query.eq("code", identifier) : query.eq("id", identifier)

    const { data: room, error: roomError } = await query.maybeSingle()

    // Sort players and adlobs arrays client-side to ensure consistent ordering
    if (room) {
      if (room.players) {
        room.players.sort((a, b) => {
          const timeA = a.joined_at ? new Date(a.joined_at).getTime() : 0
          const timeB = b.joined_at ? new Date(b.joined_at).getTime() : 0
          return timeA - timeB
        })
      }
      if (room.adlobs) {
        room.adlobs.sort((a, b) => {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
          return timeA - timeB
        })
      }
    }

    if (roomError) {
      throw roomError
    }

    if (!room) {
      return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      game: serializeGameRow(room),
    })
  } catch (error) {
    console.error("Failed to fetch game", error)
    return NextResponse.json({ success: false, error: "Failed to fetch game" }, { status: 500 })
  }
}

const updateSchema = z.object({
  status: z.enum(["briefing", "creating", "presenting", "voting", "results"]),
  playerId: z.string().uuid("Invalid player identifier"),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const { id: rawId } = await params
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

    let presentSequence: string[] = []

    if (nextState.status === "presenting") {
      // Fetch all players ordered by join time for deterministic round-robin assignment
      const { data: allPlayers, error: playersForPresentError } = await supabase
        .from(TABLES.players)
        .select("id")
        .eq("room_id", room.id)
        .order("joined_at", { ascending: true })

      if (playersForPresentError) {
        throw playersForPresentError
      }

      const { data: adlobsForPresent, error: adlobsSelectError } = await supabase
        .from(TABLES.adLobs)
        .select("id")
        .eq("room_id", room.id)
        .order("created_at", { ascending: true })

      if (adlobsSelectError) {
        throw adlobsSelectError
      }

      const orderedPlayers = allPlayers ?? []
      const orderedAdlobs = adlobsForPresent ?? []

      // Validate that we have the same number of players and adlobs
      if (orderedPlayers.length !== orderedAdlobs.length) {
        console.error(
          `[PRESENT ASSIGNMENT] Mismatch: ${orderedPlayers.length} players vs ${orderedAdlobs.length} adlobs`,
        )
        return NextResponse.json(
          {
            success: false,
            error: `Cannot assign presenters: ${orderedPlayers.length} players but ${orderedAdlobs.length} campaigns`,
          },
          { status: 409 },
        )
      }

      if (orderedAdlobs.length === 0) {
        return NextResponse.json(
          { success: false, error: "Cannot transition to presenting: no campaigns exist" },
          { status: 409 },
        )
      }

      presentSequence = orderedAdlobs.map((item) => item.id)

      // Assign presenters using round-robin: player[i] presents adlob[i]
      // This guarantees every player presents exactly once
      for (let index = 0; index < orderedAdlobs.length; index += 1) {
        const adlob = orderedAdlobs[index]
        const assignedPresenter = orderedPlayers[index].id

        console.log(`[PRESENT ASSIGNMENT] AdLob ${index} (${adlob.id}) → Player ${assignedPresenter}`)

        const { error: adlobUpdateError } = await supabase
          .from(TABLES.adLobs)
          .update({
            assigned_presenter: assignedPresenter,
            present_order: index,
            present_started_at: null,
            present_completed_at: null,
          })
          .eq("id", adlob.id)

        if (adlobUpdateError) {
          throw adlobUpdateError
        }
      }

      console.log(
        `[PRESENT ASSIGNMENT] Successfully assigned ${orderedAdlobs.length} presenters for room ${room.id}`,
      )
    }

    const hasPresentSequence = presentSequence.length > 0

    const phaseStartTime = new Date().toISOString()

    const { error: updateError } = await supabase
      .from(TABLES.gameRooms)
      .update({
        status: nextState.status,
        current_phase: nextState.status === "creating" ? nextState.currentPhase : null,
        phase_start_time: phaseStartTime,
        current_present_index: nextState.status === "presenting" ? (hasPresentSequence ? 0 : null) : null,
        present_sequence: nextState.status === "presenting" ? (hasPresentSequence ? presentSequence : null) : null,
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

    // Increment version to trigger realtime refresh
    const { data: currentRoom } = await supabase
      .from(TABLES.gameRooms)
      .select("version")
      .eq("id", room.id)
      .single()

    await supabase
      .from(TABLES.gameRooms)
      .update({ version: (currentRoom?.version ?? 0) + 1 })
      .eq("id", room.id)

    // Broadcast status change to WebSocket clients
    await broadcastToRoom(room.code, {
      type: "status_changed",
      roomCode: room.code,
      status: nextState.status,
      currentPhase: nextState.currentPhase ?? null,
      phaseStartTime,
      version: 0, // Version will be managed by WS server
    })

    return NextResponse.json({
      success: true,
      status: nextState.status,
      currentPhase: nextState.currentPhase ?? null,
      phaseStartTime,
    })
  } catch (error) {
    console.error("Failed to update game", error)
    return NextResponse.json({ success: false, error: "Failed to update game" }, { status: 500 })
  }
}
