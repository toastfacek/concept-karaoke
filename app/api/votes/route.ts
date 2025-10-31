import { NextResponse } from "next/server"
import { z } from "zod"

import { TABLES } from "@/lib/db"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const voteSchema = z.object({
  roomId: z.string().min(1, "Room ID is required"),
  voterId: z.string().uuid("Invalid voter ID"),
  adlobId: z.string().uuid("Invalid adlob ID"),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = voteSchema.safeParse(body)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const { roomId, voterId, adlobId } = parsed.data
    const supabase = getSupabaseAdminClient()

    const normalizedRoomId = (() => {
      const trimmed = roomId.trim()
      if (trimmed.length === 6) {
        return trimmed.toUpperCase()
      }
      return trimmed
    })()

    // Validate the game exists and is in voting phase
    const roomQuery = supabase.from(TABLES.gameRooms).select("id, status, code")

    const isCodeLookup = /^[A-Z0-9]{6}$/.test(normalizedRoomId)

    const { data: room, error: roomError } = isCodeLookup
      ? await roomQuery.eq("code", normalizedRoomId).maybeSingle()
      : await roomQuery.eq("id", normalizedRoomId).maybeSingle()

    if (roomError) {
      throw roomError
    }

    if (!room) {
      return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 })
    }

    if (room.status !== "voting") {
      return NextResponse.json({ success: false, error: "Game is not in voting phase" }, { status: 409 })
    }

    // Validate the voter is in this room
    const { data: voter, error: voterError } = await supabase
      .from(TABLES.players)
      .select("id, room_id")
      .eq("id", voterId)
      .maybeSingle()

    if (voterError) {
      throw voterError
    }

    if (!voter || voter.room_id !== room.id) {
      return NextResponse.json({ success: false, error: "Player not found in this room" }, { status: 403 })
    }

    // Check if voter has already voted
    const { data: existingVote, error: existingVoteError } = await supabase
      .from(TABLES.votes)
      .select("id")
      .eq("room_id", room.id)
      .eq("voter_id", voterId)
      .maybeSingle()

    if (existingVoteError) {
      throw existingVoteError
    }

    if (existingVote) {
      return NextResponse.json({ success: false, error: "You have already voted" }, { status: 409 })
    }

    // Validate the adlob exists and get the presenter
    const { data: adlob, error: adlobError } = await supabase
      .from(TABLES.adLobs)
      .select("id, room_id, assigned_presenter, vote_count")
      .eq("id", adlobId)
      .maybeSingle()

    if (adlobError) {
      throw adlobError
    }

    if (!adlob || adlob.room_id !== room.id) {
      return NextResponse.json({ success: false, error: "Campaign not found in this game" }, { status: 404 })
    }

    // Insert the vote
    const { error: insertError } = await supabase.from(TABLES.votes).insert({
      room_id: room.id,
      voter_id: voterId,
      adlob_id: adlobId,
    })

    if (insertError) {
      throw insertError
    }

    const currentVoteCount = Number(adlob?.vote_count ?? 0) || 0
    const nextVoteCount = currentVoteCount + 1

    const { error: updateError } = await supabase
      .from(TABLES.adLobs)
      .update({ vote_count: nextVoteCount })
      .eq("id", adlobId)

    if (updateError) {
      throw updateError
    }

    // Check if all players have voted
    const { count: playerCount, error: playerCountError } = await supabase
      .from(TABLES.players)
      .select("*", { count: "exact", head: true })
      .eq("room_id", room.id)

    if (playerCountError) {
      throw playerCountError
    }

    const { count: voteCount, error: voteCountError } = await supabase
      .from(TABLES.votes)
      .select("*", { count: "exact", head: true })
      .eq("room_id", room.id)

    if (voteCountError) {
      throw voteCountError
    }

    const allVotesIn = playerCount !== null && voteCount !== null && voteCount >= playerCount

    // If all votes are in, transition to results
    let phaseStartTime: string | null = null

    if (allVotesIn) {
      const resultsPhaseStartTime = new Date().toISOString()
      phaseStartTime = resultsPhaseStartTime
      const { error: statusError } = await supabase
        .from(TABLES.gameRooms)
        .update({
          status: "results",
          phase_start_time: resultsPhaseStartTime,
        })
        .eq("id", room.id)

      if (statusError) {
        throw statusError
      }
    }

    return NextResponse.json({
      success: true,
      message: "Vote recorded",
      allVotesIn,
      status: allVotesIn ? "results" : "voting",
      phaseStartTime,
    })
  } catch (error) {
    console.error("Failed to record vote", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to record vote"
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
