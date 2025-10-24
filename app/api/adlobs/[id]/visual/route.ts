import { NextResponse } from "next/server"
import { z } from "zod"

import { canvasStateSchema } from "@/lib/canvas"
import { TABLES } from "@/lib/db"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const canvasPayloadSchema = canvasStateSchema.superRefine((value, ctx) => {
  const strokeCount = value.strokes.length
  const textCount = value.textBlocks?.length ?? 0
  const imageCount = value.images?.length ?? 0

  if (strokeCount === 0 && textCount === 0 && imageCount === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Canvas is empty — add at least one sketch, text block, or generated image",
    })
  }
})

const requestSchema = z.object({
  canvasData: canvasPayloadSchema,
  imageUrls: z.array(z.string().min(1)).max(6).default([]),
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
        visual_canvas_data: parsed.data.canvasData,
        visual_image_urls: parsed.data.imageUrls,
        visual_created_by: parsed.data.createdBy,
      })
      .eq("id", adlobId)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update visual", error)
    return NextResponse.json({ success: false, error: "Failed to update visual" }, { status: 500 })
  }
}
