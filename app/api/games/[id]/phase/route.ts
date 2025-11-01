import { NextResponse } from "next/server"
import { z } from "zod"

import { TABLES } from "@/lib/db"
import { advanceCreationPhase } from "@/lib/game-state-machine"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import type { CreationPhase, GameStatus } from "@/lib/types"

const requestSchema = z.object({
  playerId: z.string().uuid("Invalid player identifier"),
})

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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const json = await request.json()
    const parsed = requestSchema.safeParse(json)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const resolvedParams = await params
    const identifier = normalizeId(resolvedParams.id)
    const supabase = getSupabaseAdminClient()

    const room = await resolveRoom(identifier)

    if (!room) {
      return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 })
    }

    if (room.status !== "creating") {
      return NextResponse.json({ success: false, error: "Game is not in creation phase" }, { status: 409 })
    }

    if (!room.current_phase) {
      return NextResponse.json({ success: false, error: "Current phase is not set" }, { status: 409 })
    }

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
      return NextResponse.json({ success: false, error: "Only the host can advance the phase" }, { status: 403 })
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
      return NextResponse.json({ success: false, error: "All players must be ready before advancing" }, { status: 409 })
    }

    const currentSnapshot = {
      status: room.status as GameStatus,
      currentPhase: (room.current_phase ?? null) as CreationPhase | null,
    }

    const nextSnapshot = advanceCreationPhase(currentSnapshot)
    let presentSequence: string[] = []

    if (nextSnapshot.status === "presenting") {
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

    // Increment version to trigger realtime refresh for all clients
    const { data: currentRoom } = await supabase
      .from(TABLES.gameRooms)
      .select("version")
      .eq("id", room.id)
      .single()

    const gameUpdate: Record<string, unknown> = {
      status: nextSnapshot.status,
      current_phase: nextSnapshot.status === "creating" ? nextSnapshot.currentPhase : null,
      phase_start_time: phaseStartTime,
      current_present_index: nextSnapshot.status === "presenting" ? (hasPresentSequence ? 0 : null) : null,
      present_sequence: nextSnapshot.status === "presenting" ? (hasPresentSequence ? presentSequence : null) : null,
      version: (currentRoom?.version ?? 0) + 1,
    }

    const { error: updateError } = await supabase.from(TABLES.gameRooms).update(gameUpdate).eq("id", room.id)

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
      status: nextSnapshot.status,
      currentPhase: nextSnapshot.currentPhase ?? null,
      phaseStartTime,
    })
  } catch (error) {
    console.error("Failed to advance phase", error)
    return NextResponse.json({ success: false, error: "Failed to advance phase" }, { status: 500 })
  }
}
