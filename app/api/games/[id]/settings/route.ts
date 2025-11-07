import { NextResponse } from "next/server"
import { z } from "zod"

import { TABLES } from "@/lib/db"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { BRIEF_STYLES, PRODUCT_CATEGORIES } from "@/lib/types"

const settingsSchema = z.object({
  productCategory: z.enum(PRODUCT_CATEGORIES).optional(),
  phaseDurationSeconds: z.number().refine((val) => [30, 60, 90, 120].includes(val), {
    message: "Phase duration must be 30, 60, 90, or 120 seconds",
  }).optional(),
  briefStyle: z.enum(BRIEF_STYLES).optional(),
  playerId: z.string().uuid("Invalid player identifier"),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const roomCode = resolvedParams.id.toUpperCase()
    const json = await request.json()
    const parsed = settingsSchema.safeParse(json)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const { productCategory, phaseDurationSeconds, briefStyle, playerId } = parsed.data

    // Validate at least one setting is being updated
    if (!productCategory && !phaseDurationSeconds && !briefStyle) {
      return NextResponse.json({ success: false, error: "No settings to update" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()

    // Get the room
    const { data: room, error: roomError } = await supabase
      .from(TABLES.gameRooms)
      .select("id, code, status, host_id")
      .eq("code", roomCode)
      .maybeSingle()

    if (roomError) {
      throw roomError
    }

    if (!room) {
      return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 })
    }

    // Only allow settings changes in lobby
    if (room.status !== "lobby") {
      return NextResponse.json(
        { success: false, error: "Settings can only be changed in the lobby" },
        { status: 409 },
      )
    }

    // Verify player is the host
    const { data: player, error: playerError } = await supabase
      .from(TABLES.players)
      .select("id, is_host")
      .eq("id", playerId)
      .eq("room_id", room.id)
      .maybeSingle()

    if (playerError) {
      throw playerError
    }

    if (!player || !player.is_host) {
      return NextResponse.json({ success: false, error: "Only the host can update settings" }, { status: 403 })
    }

    // Build update object
    const updates: Record<string, string | number> = {}
    if (productCategory) {
      updates.product_category = productCategory
    }
    if (phaseDurationSeconds) {
      updates.phase_duration_seconds = phaseDurationSeconds
    }
    if (briefStyle) {
      updates.brief_style = briefStyle
    }

    // Update settings
    const { data: updatedRoom, error: updateError } = await supabase
      .from(TABLES.gameRooms)
      .update(updates)
      .eq("id", room.id)
      .select("product_category, phase_duration_seconds, brief_style")
      .single()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      settings: {
        productCategory: updatedRoom.product_category,
        phaseDurationSeconds: updatedRoom.phase_duration_seconds,
        briefStyle: updatedRoom.brief_style,
      },
    })
  } catch (error) {
    console.error("Failed to update game settings", error)
    return NextResponse.json({ success: false, error: "Failed to update game settings" }, { status: 500 })
  }
}
