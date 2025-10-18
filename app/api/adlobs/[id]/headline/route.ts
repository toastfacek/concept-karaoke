import { NextResponse } from "next/server"
import { z } from "zod"

import type { Json } from "@/lib/database.types"
import { TABLES } from "@/lib/db"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const requestSchema = z.object({
  canvasData: z.unknown().optional(),
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
        headline_canvas_data: canvasData,
        headline_created_by: parsed.data.createdBy,
      })
      .eq("id", id)
      .select("id, headline_canvas_data, headline_created_by, updated_at")
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
    console.error("Failed to save headline", error)
    return NextResponse.json({ success: false, error: "Failed to save headline" }, { status: 500 })
  }
}
