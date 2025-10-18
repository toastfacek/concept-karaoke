import { NextResponse } from "next/server"
import { z } from "zod"

import { TABLES } from "@/lib/db"
import { env, requireServerEnv } from "@/lib/env"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

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

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"
const OPENAI_MODEL = "gpt-4o-mini"

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = requestSchema.safeParse(json)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const openAiKey = env.server.OPENAI_API_KEY ?? requireServerEnv("OPENAI_API_KEY")

    const supabase = getSupabaseAdminClient()

    const { data: room, error: roomError } = await supabase
      .from(TABLES.gameRooms)
      .select("id")
      .eq("id", parsed.data.roomId)
      .maybeSingle()

    if (roomError) {
      throw roomError
    }

    if (!room) {
      return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 })
    }

    const prompt = `Generate a creative advertising brief for a fictional product as JSON with keys productName, productCategory, businessProblem, targetAudience, objective. Keep it punchy, witty, and grounded enough to be playable in an improv party game. Avoid quotes or Markdown.`

    const completionResponse = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a mischievous ad creative generating campaign briefs that are weird, delightful, and playable in a party improv game.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    })

    if (!completionResponse.ok) {
      const errorText = await completionResponse.text()
      throw new Error(`OpenAI request failed: ${errorText}`)
    }

    const completionPayload = await completionResponse.json()
    const content = completionPayload?.choices?.[0]?.message?.content
    if (typeof content !== "string") {
      throw new Error("Unexpected OpenAI response format")
    }

    const parsedBrief = briefSchema.parse(JSON.parse(content))

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
