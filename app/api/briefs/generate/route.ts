import { NextResponse } from "next/server"
import { z } from "zod"

import { getBriefPrompt } from "@/lib/brief-prompts"
import { TABLES } from "@/lib/db"
import { env, requireServerEnv } from "@/lib/env"
import { generateProductImage } from "@/lib/gemini-image"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { SPECIFIC_PRODUCT_CATEGORIES, type BriefStyle } from "@/lib/types"

const requestSchema = z.object({
  roomId: z.string().uuid("Invalid room identifier"),
})

const briefSchema = z.object({
  productName: z.string().min(1),
  productCategory: z.string().min(1),
  mainPoint: z.string().min(1),
  audience: z.string().min(1),
  businessProblem: z.string().min(1),
  objective: z.string().min(1),
  strategy: z.string().min(1),
  productFeatures: z.string().min(1),
})

const GEMINI_GENERATE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

export async function POST(request: Request) {
  console.log("[Brief Generate] Request received")
  try {
    const json = await request.json()
    console.log("[Brief Generate] Parsed JSON, roomId:", json.roomId)
    const parsed = requestSchema.safeParse(json)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      console.error("[Brief Generate] Validation failed:", message)
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    console.log("[Brief Generate] Getting Gemini API key...")
    const geminiKey = env.server.GEMINI_API_KEY ?? requireServerEnv("GEMINI_API_KEY")
    console.log("[Brief Generate] Gemini key exists:", !!geminiKey, "length:", geminiKey?.length)

    console.log("[Brief Generate] Initializing Supabase client...")
    const supabase = getSupabaseAdminClient()

    console.log("[Brief Generate] Fetching room...")
    const { data: room, error: roomError } = await supabase
      .from(TABLES.gameRooms)
      .select("id, product_category, brief_style, status")
      .eq("id", parsed.data.roomId)
      .maybeSingle()

    if (roomError) {
      console.error("[Brief Generate] Room fetch error:", roomError)
      throw roomError
    }

    if (!room) {
      console.error("[Brief Generate] Room not found for ID:", parsed.data.roomId)
      return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 })
    }

    // Prevent brief regeneration once game has started (status guard)
    if (room.status !== "lobby" && room.status !== "briefing") {
      console.error("[Brief Generate] Cannot regenerate brief - game already in progress. Status:", room.status)
      return NextResponse.json(
        { success: false, error: "Cannot regenerate brief after game has started" },
        { status: 409 },
      )
    }

    const selectedCategory = room.product_category ?? "All"
    const briefStyle = (room.brief_style as BriefStyle) ?? "wacky"
    console.log("[Brief Generate] Room found. Category:", selectedCategory, "Style:", briefStyle)

    // If "All" is selected, randomly pick from specific categories
    const productCategory = selectedCategory === "All"
      ? SPECIFIC_PRODUCT_CATEGORIES[Math.floor(Math.random() * SPECIFIC_PRODUCT_CATEGORIES.length)]
      : selectedCategory

    console.log("[Brief Generate] Final category:", productCategory)
    const prompt = getBriefPrompt(productCategory, briefStyle)
    console.log("[Brief Generate] Generated prompt length:", prompt.length)

    console.log("[Brief Generate] Calling Gemini API for text generation...")
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
      console.error("[Brief Generate] Gemini API error. Status:", completionResponse.status, "Body:", errorText)
      throw new Error(`Gemini request failed: ${errorText}`)
    }

    console.log("[Brief Generate] Gemini text generation successful, parsing response...")
    const completionPayload = await completionResponse.json()
    const textContent = completionPayload?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof textContent !== "string") {
      console.error("[Brief Generate] Unexpected Gemini response format:", JSON.stringify(completionPayload))
      throw new Error("Unexpected Gemini response format")
    }

    console.log("[Brief Generate] Parsing brief JSON...")
    const parsedBrief = briefSchema.parse(JSON.parse(textContent))
    console.log("[Brief Generate] Brief parsed successfully:", parsedBrief.productName)

    // Generate product cover image
    console.log("[Brief Generate] Starting image generation...")
    let coverImageUrl: string | null = null
    try {
      const imagePrompt = `Professional product photograph for ${parsedBrief.productName}, a ${parsedBrief.productCategory} product. ${parsedBrief.mainPoint}. ${parsedBrief.productFeatures}. High-quality marketing image, clean composition, modern aesthetic.`
      coverImageUrl = await generateProductImage(imagePrompt, geminiKey)
      if (!coverImageUrl) {
        console.warn("[Brief Generate] Failed to generate cover image, continuing without image")
      } else {
        console.log("[Brief Generate] Cover image generated:", coverImageUrl)
      }
    } catch (imageError) {
      console.error("[Brief Generate] Error generating cover image:", imageError)
      // Continue without image - not critical
    }

    console.log("[Brief Generate] Checking for existing brief...")
    const { data: existing, error: briefFetchError } = await supabase
      .from(TABLES.campaignBriefs)
      .select("id")
      .eq("room_id", parsed.data.roomId)
      .maybeSingle()

    if (briefFetchError) {
      console.error("[Brief Generate] Error fetching existing brief:", briefFetchError)
      throw briefFetchError
    }

    if (existing) {
      console.log("[Brief Generate] Updating existing brief:", existing.id)
      const { error: updateError } = await supabase
        .from(TABLES.campaignBriefs)
        .update({
          product_name: parsedBrief.productName,
          product_category: parsedBrief.productCategory,
          main_point: parsedBrief.mainPoint,
          audience: parsedBrief.audience,
          business_problem: parsedBrief.businessProblem,
          objective: parsedBrief.objective,
          strategy: parsedBrief.strategy,
          product_features: parsedBrief.productFeatures,
          cover_image_url: coverImageUrl,
        })
        .eq("id", existing.id)

      if (updateError) {
        console.error("[Brief Generate] Error updating brief:", updateError)
        throw updateError
      }
      console.log("[Brief Generate] Brief updated successfully")
    } else {
      console.log("[Brief Generate] Inserting new brief...")
      const { error: insertError } = await supabase.from(TABLES.campaignBriefs).insert({
        room_id: parsed.data.roomId,
        product_name: parsedBrief.productName,
        product_category: parsedBrief.productCategory,
        main_point: parsedBrief.mainPoint,
        audience: parsedBrief.audience,
        business_problem: parsedBrief.businessProblem,
        objective: parsedBrief.objective,
        strategy: parsedBrief.strategy,
        product_features: parsedBrief.productFeatures,
        cover_image_url: coverImageUrl,
      })

      if (insertError) {
        console.error("[Brief Generate] Error inserting brief:", insertError)
        throw insertError
      }
      console.log("[Brief Generate] Brief inserted successfully")
    }

    console.log("[Brief Generate] Request completed successfully")
    return NextResponse.json({
      success: true,
      brief: {
        ...parsedBrief,
        coverImageUrl: coverImageUrl ?? undefined,
      },
    })
  } catch (error) {
    console.error("[Brief Generate] Fatal error:", error)
    return NextResponse.json({ success: false, error: "Failed to generate brief" }, { status: 500 })
  }
}
