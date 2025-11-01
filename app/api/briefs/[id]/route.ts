import { NextResponse } from "next/server"
import { z } from "zod"

import { TABLES } from "@/lib/db"
import { broadcastToRoom } from "@/lib/realtime-broadcast"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const briefSchema = z.object({
  productName: z.string().min(1, "Product name is required").max(100),
  productCategory: z.string().min(1, "Product category is required").max(100),
  businessProblem: z.string().min(1, "Business problem is required"),
  targetAudience: z.string().min(1, "Target audience is required"),
  objective: z.string().min(1, "Objective is required"),
})

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const { id } = resolvedParams
    const body = await request.json()

    const parsed = briefSchema.safeParse(body)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid brief payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()

    const { data: brief, error: updateError } = await supabase
      .from(TABLES.campaignBriefs)
      .update({
        product_name: parsed.data.productName,
        product_category: parsed.data.productCategory,
        business_problem: parsed.data.businessProblem,
        target_audience: parsed.data.targetAudience,
        objective: parsed.data.objective,
      })
      .eq("id", id)
      .select("id, room_id, product_name, product_category, business_problem, target_audience, objective, updated_at")
      .maybeSingle()

    if (updateError) {
      throw updateError
    }

    if (!brief) {
      return NextResponse.json({ success: false, error: "Brief not found" }, { status: 404 })
    }

    // Increment game version to trigger realtime refresh
    const { data: gameRoom } = await supabase
      .from(TABLES.gameRooms)
      .select("version, code")
      .eq("id", brief.room_id)
      .single()

    if (gameRoom) {
      await supabase
        .from(TABLES.gameRooms)
        .update({ version: (gameRoom.version ?? 0) + 1 })
        .eq("id", brief.room_id)

      // Broadcast to WebSocket clients
      await broadcastToRoom(gameRoom.code, {
        type: "brief_updated",
        roomCode: gameRoom.code,
        briefId: brief.id,
        version: 0, // Version managed by WS server
      })
    }

    return NextResponse.json({
      success: true,
      brief: {
        id: brief.id,
        roomId: brief.room_id,
        productName: brief.product_name,
        productCategory: brief.product_category,
        businessProblem: brief.business_problem,
        targetAudience: brief.target_audience,
        objective: brief.objective,
        updatedAt: brief.updated_at,
      },
    })
  } catch (error) {
    console.error("Failed to update brief", error)
    return NextResponse.json({ success: false, error: "Failed to update brief" }, { status: 500 })
  }
}
