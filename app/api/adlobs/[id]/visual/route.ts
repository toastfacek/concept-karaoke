import { NextResponse } from "next/server"
import { z } from "zod"

import type { Json } from "@/lib/database.types"
import { TABLES } from "@/lib/db"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const requestSchema = z.object({
  canvasData: z.unknown().optional(),
  imageUrls: z.array(z.string().url()).optional(),
  createdBy: z.string().uuid("Invalid player identifier"),
})

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const json = await request.json()
    const parsed = requestSchema.safeParse(json)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()

    const canvasData = (parsed.data.canvasData ?? null) as Json | null

    const { data: adlob, error: updateError } = await supabase
      .from(TABLES.adLobs)
      .update({
        visual_canvas_data: canvasData,
        visual_image_urls: parsed.data.imageUrls ?? null,
        visual_created_by: parsed.data.createdBy,
      })
      .eq("id", id)
      .select("id, visual_canvas_data, visual_image_urls, visual_created_by, updated_at")
      .maybeSingle()

    if (updateError) {
      throw updateError
    }

    if (!adlob) {
      return NextResponse.json({ success: false, error: "AdLob not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      adlob,
    })
  } catch (error) {
    console.error("Failed to save visual", error)
    return NextResponse.json({ success: false, error: "Failed to save visual" }, { status: 500 })
  }
}
