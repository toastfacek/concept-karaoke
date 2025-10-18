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

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const identifier = normalizeId(params.id)

    const { data: room, error: roomError } = await supabase
      .from(TABLES.gameRooms)
      .select("id, code, status, host_id, current_pitch_index, pitch_sequence")
      .or(`code.eq.${identifier},id.eq.${identifier}`)
      .maybeSingle()

    if (roomError) {
      throw roomError
    }

    if (!room) {
      return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 })
    }

    if (room.status !== "pitching") {
      return NextResponse.json({ success: false, error: "Game is not in the pitching phase" }, { status: 409 })
    }

    const pitchSequence = room.pitch_sequence ?? []
    const currentIndex = room.current_pitch_index ?? 0

    if (!Array.isArray(pitchSequence) || pitchSequence.length === 0) {
      return NextResponse.json({ success: false, error: "No campaigns are ready to pitch yet" }, { status: 409 })
    }

    const currentAdlobId = pitchSequence[currentIndex]
    if (!currentAdlobId) {
      return NextResponse.json({ success: false, error: "Unable to determine current pitch" }, { status: 409 })
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
      .select("id, assigned_pitcher, pitch_started_at, pitch_completed_at")
      .eq("id", currentAdlobId)
      .maybeSingle()

    if (adlobError) {
      throw adlobError
    }

    if (!adlob) {
      return NextResponse.json({ success: false, error: "Current AdLob not found" }, { status: 404 })
    }

    const isHost = player.is_host
    const isPitcher = adlob.assigned_pitcher === player.id

    if (!isHost && !isPitcher) {
      return NextResponse.json(
        { success: false, error: "Only the host or the assigned pitcher can control the pitch flow" },
        { status: 403 },
      )
    }

    const now = new Date().toISOString()

    if (parsed.data.action === "start") {
      if (adlob.pitch_started_at) {
        return NextResponse.json({ success: true, startedAt: adlob.pitch_started_at })
      }

      const { error: startError } = await supabase
        .from(TABLES.adLobs)
        .update({ pitch_started_at: now, pitch_completed_at: null })
        .eq("id", adlob.id)

      if (startError) {
        throw startError
      }

      return NextResponse.json({ success: true, startedAt: now })
    }

    const adlobUpdate: Record<string, string> = {
      pitch_completed_at: now,
    }

    if (!adlob.pitch_started_at) {
      adlobUpdate.pitch_started_at = now
    }

    const { error: completeError } = await supabase.from(TABLES.adLobs).update(adlobUpdate).eq("id", adlob.id)

    if (completeError) {
      throw completeError
    }

    const nextIndex = currentIndex + 1
    const hasNext = nextIndex < pitchSequence.length

    if (hasNext) {
      const { error: advanceError } = await supabase
        .from(TABLES.gameRooms)
        .update({
          current_pitch_index: nextIndex,
          phase_start_time: now,
        })
        .eq("id", room.id)

      if (advanceError) {
        throw advanceError
      }

      return NextResponse.json({
        success: true,
        nextPitchIndex: nextIndex,
      })
    }

    const { error: finalizeError } = await supabase
      .from(TABLES.gameRooms)
      .update({
        status: "voting",
        current_phase: null,
        phase_start_time: now,
        current_pitch_index: null,
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
    })
  } catch (error) {
    console.error("Failed to update pitch flow", error)
    return NextResponse.json({ success: false, error: "Failed to update pitch flow" }, { status: 500 })
  }
}
