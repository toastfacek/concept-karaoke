import { NextResponse } from "next/server"
import { z } from "zod"

import { TABLES } from "@/lib/db"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const requestSchema = z.object({
  playerId: z.string().uuid("Invalid player identifier"),
  action: z.enum(["start", "advance"]).default("advance"),
})

function normalizeId(id: string) {
  const trimmed = id.trim()
  return trimmed.length === 6 ? trimmed.toUpperCase() : trimmed
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const resolvedParams = await params
    const identifier = normalizeId(resolvedParams.id)

    const matchByCode = /^[A-Z0-9]{6}$/.test(identifier)

    const roomQuery = supabase
      .from(TABLES.gameRooms)
      .select("id, code, status, host_id, current_present_index, present_sequence")

    const { data: room, error: roomError } = matchByCode
      ? await roomQuery.eq("code", identifier).maybeSingle()
      : await roomQuery.eq("id", identifier).maybeSingle()

    if (roomError) {
      throw roomError
    }

    if (!room) {
      return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 })
    }

    if (room.status !== "presenting") {
      return NextResponse.json({ success: false, error: "Game is not in the presenting phase" }, { status: 409 })
    }

    const presentSequence = room.present_sequence ?? []
    const currentIndex = room.current_present_index ?? 0

    if (!Array.isArray(presentSequence) || presentSequence.length === 0) {
      return NextResponse.json({ success: false, error: "No campaigns are ready to present yet" }, { status: 409 })
    }

    const currentAdlobId = presentSequence[currentIndex]
    if (!currentAdlobId) {
      return NextResponse.json({ success: false, error: "Unable to determine current presentation" }, { status: 409 })
    }

    const { data: player, error: playerError } = await supabase
      .from(TABLES.players)
      .select("id, is_host")
      .eq("id", parsed.data.playerId)
      .eq("room_id", room.id)
      .maybeSingle()

    if (playerError) {
      throw playerError
    }

    if (!player) {
      return NextResponse.json({ success: false, error: "Player not found in this room" }, { status: 404 })
    }

    const { data: adlob, error: adlobError } = await supabase
      .from(TABLES.adLobs)
      .select("id, assigned_presenter, present_started_at, present_completed_at")
      .eq("id", currentAdlobId)
      .maybeSingle()

    if (adlobError) {
      throw adlobError
    }

    if (!adlob) {
      return NextResponse.json({ success: false, error: "Current AdLob not found" }, { status: 404 })
    }

    const isHost = player.is_host
    const isPresenter = adlob.assigned_presenter === player.id

    if (!isHost && !isPresenter) {
      return NextResponse.json(
        { success: false, error: "Only the host or the assigned presenter can control the presentation flow" },
        { status: 403 },
      )
    }

    const now = new Date().toISOString()

    if (parsed.data.action === "start") {
      if (adlob.present_started_at) {
        return NextResponse.json({ success: true, startedAt: adlob.present_started_at })
      }

      const { error: startError } = await supabase
        .from(TABLES.adLobs)
        .update({ present_started_at: now, present_completed_at: null })
        .eq("id", adlob.id)

      if (startError) {
        throw startError
      }

      return NextResponse.json({ success: true, startedAt: now })
    }

    const adlobUpdate: Record<string, string> = {
      present_completed_at: now,
    }

    if (!adlob.present_started_at) {
      adlobUpdate.present_started_at = now
    }

    const { error: completeError } = await supabase.from(TABLES.adLobs).update(adlobUpdate).eq("id", adlob.id)

    if (completeError) {
      throw completeError
    }

    const nextIndex = currentIndex + 1
    const hasNext = nextIndex < presentSequence.length

    if (hasNext) {
      const { error: advanceError } = await supabase
        .from(TABLES.gameRooms)
        .update({
          current_present_index: nextIndex,
          phase_start_time: now,
        })
        .eq("id", room.id)

      if (advanceError) {
        throw advanceError
      }

      return NextResponse.json({
        success: true,
        nextPresentIndex: nextIndex,
        phaseStartTime: now,
      })
    }

    const { error: finalizeError } = await supabase
      .from(TABLES.gameRooms)
      .update({
        status: "voting",
        current_phase: null,
        phase_start_time: now,
        current_present_index: null,
      })
      .eq("id", room.id)

    if (finalizeError) {
      throw finalizeError
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
      status: "voting",
      phaseStartTime: now,
    })
  } catch (error) {
    console.error("Failed to update presentation flow", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to update presentation flow"
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
