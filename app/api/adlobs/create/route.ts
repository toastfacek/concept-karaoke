import { NextResponse } from "next/server"
import { z } from "zod"

import { TABLES } from "@/lib/db"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const requestSchema = z.object({
  roomId: z.string().uuid("Invalid room identifier"),
  briefId: z.string().uuid("Invalid brief identifier").optional(),
})

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = requestSchema.safeParse(json)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const { roomId, briefId } = parsed.data
    const supabase = getSupabaseAdminClient()

    const { data: players, error: playersError } = await supabase
      .from(TABLES.players)
      .select("id")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true })

    if (playersError) {
      throw playersError
    }

    if (!players || players.length === 0) {
      return NextResponse.json({ success: false, error: "No players found for room" }, { status: 404 })
    }

    const { count: existingCount, error: existingError } = await supabase
      .from(TABLES.adLobs)
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId)

    if (existingError) {
      throw existingError
    }

    if ((existingCount ?? 0) > 0) {
      return NextResponse.json({
        success: true,
        message: "AdLobs already exist for this room",
        created: 0,
      })
    }

    const inserts = players.map(() => ({
      room_id: roomId,
      brief_id: briefId ?? null,
      vote_count: 0,
    }))

    const { data: inserted, error: insertError } = await supabase
      .from(TABLES.adLobs)
      .insert(inserts)
      .select("id")

    if (insertError) {
      throw insertError
    }

    return NextResponse.json({
      success: true,
      message: "AdLobs created",
      created: inserted?.length ?? 0,
    })
  } catch (error) {
    console.error("Failed to create AdLobs", error)
    return NextResponse.json({ success: false, error: "Failed to create AdLobs" }, { status: 500 })
  }
}
