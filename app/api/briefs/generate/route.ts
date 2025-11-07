import { NextResponse } from "next/server"
import { z } from "zod"

import { getBriefPrompt } from "@/lib/brief-prompts"
import { TABLES } from "@/lib/db"
import { env, requireServerEnv } from "@/lib/env"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { SPECIFIC_PRODUCT_CATEGORIES, type BriefStyle } from "@/lib/types"

const requestSchema = z.object({
  roomId: z.string().uuid("Invalid room identifier"),
})

const briefSchema = z.object({
  productName: z.string().min(1),
  productCategory: z.string().min(1),
  tagline: z.string().optional(),
  productFeatures: z.string().optional(),
  businessProblem: z.string().min(1),
  targetAudience: z.string().min(1),
  objective: z.string().min(1),
  weirdConstraint: z.string().optional(),
})

const GEMINI_GENERATE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = requestSchema.safeParse(json)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const geminiKey = env.server.GEMINI_API_KEY ?? requireServerEnv("GEMINI_API_KEY")

    const supabase = getSupabaseAdminClient()

    const { data: room, error: roomError } = await supabase
      .from(TABLES.gameRooms)
      .select("id, product_category, brief_style")
      .eq("id", parsed.data.roomId)
      .maybeSingle()

    if (roomError) {
      throw roomError
    }

    if (!room) {
      return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 })
    }

    const selectedCategory = room.product_category ?? "All"
    const briefStyle = (room.brief_style as BriefStyle) ?? "wacky"

    // If "All" is selected, randomly pick from specific categories
    const productCategory = selectedCategory === "All"
      ? SPECIFIC_PRODUCT_CATEGORIES[Math.floor(Math.random() * SPECIFIC_PRODUCT_CATEGORIES.length)]
      : selectedCategory

    const prompt = getBriefPrompt(productCategory, briefStyle)

    const completionResponse = await fetch(`${GEMINI_GENERATE_URL}?key=${geminiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
        },
      }),
    })

    if (!completionResponse.ok) {
      const errorText = await completionResponse.text()
      throw new Error(`Gemini request failed: ${errorText}`)
    }

    const completionPayload = await completionResponse.json()
    const textContent = completionPayload?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof textContent !== "string") {
      throw new Error("Unexpected Gemini response format")
    }

    const parsedBrief = briefSchema.parse(JSON.parse(textContent))

    const { data: existing, error: briefFetchError } = await supabase
      .from(TABLES.campaignBriefs)
      .select("id")
      .eq("room_id", parsed.data.roomId)
      .maybeSingle()

    if (briefFetchError) {
      throw briefFetchError
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from(TABLES.campaignBriefs)
        .update({
          product_name: parsedBrief.productName,
          product_category: parsedBrief.productCategory,
          tagline: parsedBrief.tagline ?? null,
          product_features: parsedBrief.productFeatures ?? null,
          business_problem: parsedBrief.businessProblem,
          target_audience: parsedBrief.targetAudience,
          objective: parsedBrief.objective,
          weird_constraint: parsedBrief.weirdConstraint ?? null,
        })
        .eq("id", existing.id)

      if (updateError) {
        throw updateError
      }
    } else {
      const { error: insertError } = await supabase.from(TABLES.campaignBriefs).insert({
        room_id: parsed.data.roomId,
        product_name: parsedBrief.productName,
        product_category: parsedBrief.productCategory,
        tagline: parsedBrief.tagline ?? null,
        product_features: parsedBrief.productFeatures ?? null,
        business_problem: parsedBrief.businessProblem,
        target_audience: parsedBrief.targetAudience,
        objective: parsedBrief.objective,
        weird_constraint: parsedBrief.weirdConstraint ?? null,
      })

      if (insertError) {
        throw insertError
      }
    }

    return NextResponse.json({
      success: true,
      brief: parsedBrief,
    })
  } catch (error) {
    console.error("Failed to generate brief", error)
    return NextResponse.json({ success: false, error: "Failed to generate brief" }, { status: 500 })
  }
}
