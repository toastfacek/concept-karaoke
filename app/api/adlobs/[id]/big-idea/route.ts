import { NextResponse } from "next/server"
import { z } from "zod"

import { TABLES } from "@/lib/db"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const requestSchema = z.object({
  text: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, "Give your other players something to work with!").max(800, "Big idea is too long")),
  createdBy: z.string().uuid("Invalid player identifier"),
})

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const adlobId = params.id
    const supabase = getSupabaseAdminClient()

    const { data: adlob, error: adlobError } = await supabase
      .from(TABLES.adLobs)
      .select("id, room_id")
      .eq("id", adlobId)
      .maybeSingle()

    if (adlobError) {
      throw adlobError
    }

    if (!adlob) {
      return NextResponse.json({ success: false, error: "AdLob not found" }, { status: 404 })
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update big idea", error)
    return NextResponse.json({ success: false, error: "Failed to update big idea" }, { status: 500 })
  }
}
