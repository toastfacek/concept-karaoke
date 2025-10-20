import { NextResponse } from "next/server"
import { z } from "zod"

import { TABLES } from "@/lib/db"
import { env, requireServerEnv } from "@/lib/env"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { SPECIFIC_PRODUCT_CATEGORIES } from "@/lib/types"

const requestSchema = z.object({
  roomId: z.string().uuid("Invalid room identifier"),
})

const briefSchema = z.object({
  productName: z.string().min(1),
  productCategory: z.string().min(1),
  businessProblem: z.string().min(1),
  targetAudience: z.string().min(1),
  objective: z.string().min(1),
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
      .select("id, product_category")
      .eq("id", parsed.data.roomId)
      .maybeSingle()

    if (roomError) {
      throw roomError
    }

    if (!room) {
      return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 })
    }

    const selectedCategory = room.product_category ?? "All"

    // If "All" is selected, randomly pick from specific categories
    const productCategory = selectedCategory === "All"
      ? SPECIFIC_PRODUCT_CATEGORIES[Math.floor(Math.random() * SPECIFIC_PRODUCT_CATEGORIES.length)]
      : selectedCategory

    const prompt = [
      `Generate a creative advertising brief for a fictional product in the "${productCategory}" category.`,
      "Respond with valid JSON that matches this TypeScript interface:",
      "{",
      '  "productName": string,',
      '  "productCategory": string,',
      '  "businessProblem": string,',
      '  "targetAudience": string,',
      '  "objective": string',
      "}",
      `The productCategory field MUST be exactly: "${productCategory}"`,
      "Make the productName creative and fitting for this category.",
      "Keep it playful but useful for a collaborative improv game.",
      "Do not wrap the JSON in markdown fences or add extra text.",
    ].join("\n")

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
          business_problem: parsedBrief.businessProblem,
          target_audience: parsedBrief.targetAudience,
          objective: parsedBrief.objective,
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
        business_problem: parsedBrief.businessProblem,
        target_audience: parsedBrief.targetAudience,
        objective: parsedBrief.objective,
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
