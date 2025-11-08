import { NextResponse } from "next/server"
import { z } from "zod"

import { TABLES } from "@/lib/db"
import { broadcastToRoom } from "@/lib/realtime-broadcast"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const requestSchema = z.object({
  text: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, "Give your other players something to work with!").max(800, "Big idea is too long")),
  createdBy: z.string().uuid("Invalid player identifier"),
})

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const resolvedParams = await params
    const adlobId = resolvedParams.id
    const supabase = getSupabaseAdminClient()

    const { data: adlob, error: adlobError } = await supabase
      .from(TABLES.adLobs)
      .select("id, room_id, big_idea_created_by")
      .eq("id", adlobId)
      .maybeSingle()

    if (adlobError) {
      throw adlobError
    }

    if (!adlob) {
      return NextResponse.json({ success: false, error: "AdLob not found" }, { status: 404 })
    }

    // Prevent overwriting existing big idea from a different creator (safety guard)
    if (adlob.big_idea_created_by && adlob.big_idea_created_by !== parsed.data.createdBy) {
      return NextResponse.json(
        { success: false, error: "This big idea was already created by another player" },
        { status: 409 },
      )
    }

    const { data: player, error: playerError } = await supabase
      .from(TABLES.players)
      .select("id, room_id")
      .eq("id", parsed.data.createdBy)
      .maybeSingle()

    if (playerError) {
      throw playerError
    }

    if (!player || player.room_id !== adlob.room_id) {
      return NextResponse.json({ success: false, error: "Player is not part of this room" }, { status: 403 })
    }

    const { error: updateError } = await supabase
      .from(TABLES.adLobs)
      .update({
        big_idea_text: parsed.data.text,
        big_idea_created_by: parsed.data.createdBy,
      })
      .eq("id", adlobId)

    if (updateError) {
      throw updateError
    }

    // Get room code for broadcast
    const { data: room } = await supabase
      .from(TABLES.gameRooms)
      .select("version, code")
      .eq("id", adlob.room_id)
      .single()

    await supabase
      .from(TABLES.gameRooms)
      .update({ version: (room?.version ?? 0) + 1 })
      .eq("id", adlob.room_id)

    // Broadcast to WebSocket clients
    if (room) {
      await broadcastToRoom(room.code, {
        type: "content_submitted",
        roomCode: room.code,
        adlobId: adlobId,
        phase: "big_idea",
        playerId: parsed.data.createdBy,
        version: 0, // Version managed by WS server
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update big idea", error)
    return NextResponse.json({ success: false, error: "Failed to update big idea" }, { status: 500 })
  }
}
