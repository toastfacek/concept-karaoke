import { NextResponse } from "next/server"
import { z } from "zod"

import { TABLES } from "@/lib/db"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const requestSchema = z.object({
  text: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, "Pitch cannot be empty").max(1200, "Pitch is too long")),
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
      .select("id, room_id, assigned_presenter, pitch_created_by")
      .eq("id", adlobId)
      .maybeSingle()

    if (adlobError) {
      throw adlobError
    }

    if (!adlob) {
      return NextResponse.json({ success: false, error: "AdLob not found" }, { status: 404 })
    }

    // Prevent overwriting existing pitch from a different creator (safety guard)
    if (adlob.pitch_created_by && adlob.pitch_created_by !== parsed.data.createdBy) {
      return NextResponse.json(
        { success: false, error: "This pitch was already created by another player" },
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
        pitch_text: parsed.data.text,
        pitch_created_by: parsed.data.createdBy,
        assigned_presenter: adlob.assigned_presenter ?? parsed.data.createdBy,
      })
      .eq("id", adlobId)

    if (updateError) {
      throw updateError
    }

    // Increment game version to trigger realtime refresh
    const { data: room } = await supabase
      .from(TABLES.gameRooms)
      .select("version")
      .eq("id", adlob.room_id)
      .single()

    await supabase
      .from(TABLES.gameRooms)
      .update({ version: (room?.version ?? 0) + 1 })
      .eq("id", adlob.room_id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update pitch", error)
    return NextResponse.json({ success: false, error: "Failed to update pitch" }, { status: 500 })
  }
}
