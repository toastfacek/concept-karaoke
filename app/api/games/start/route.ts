import { NextResponse } from "next/server"
import { z } from "zod"

import { TABLES } from "@/lib/db"
import { transitionGameState } from "@/lib/game-state-machine"
import { broadcastToRoom } from "@/lib/realtime-broadcast"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import type { CreationPhase, GameStatus } from "@/lib/types"
import { env, requireServerEnv } from "@/lib/env"
import { SPECIFIC_PRODUCT_CATEGORIES } from "@/lib/types"

const requestSchema = z.object({
  code: z
    .string()
    .min(6, "Code must be 6 characters")
    .max(6, "Code must be 6 characters")
    .transform((value) => value.toUpperCase()),
  playerId: z.string().uuid("Invalid player identifier"),
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

async function generateBrief(productCategory: string) {
  const geminiKey = env.server.GEMINI_API_KEY ?? requireServerEnv("GEMINI_API_KEY")

  // If "All" is selected, randomly pick from specific categories
  const category = productCategory === "All"
    ? SPECIFIC_PRODUCT_CATEGORIES[Math.floor(Math.random() * SPECIFIC_PRODUCT_CATEGORIES.length)]
    : productCategory

  const prompt = [
    `Generate a creative advertising brief for a fictional product in the "${category}" category.`,
    "Respond with valid JSON that matches this TypeScript interface:",
    "{",
    '  "productName": string,',
    '  "productCategory": string,',
    '  "businessProblem": string,',
    '  "targetAudience": string,',
    '  "objective": string',
    "}",
    `The productCategory field MUST be exactly: "${category}"`,
    "Make the productName creative and fitting for this category.",
    "Keep it playful but useful for a collaborative online game.",
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

  return briefSchema.parse(JSON.parse(textContent))
}

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = requestSchema.safeParse(json)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const { code, playerId } = parsed.data
    const supabase = getSupabaseAdminClient()

    const { data: room, error: roomError } = await supabase
      .from(TABLES.gameRooms)
      .select("id, code, status, current_phase, product_category")
      .eq("code", code)
      .maybeSingle()

    if (roomError) {
      throw roomError
    }

    if (!room) {
      return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 })
    }

    if (room.status !== "lobby") {
      return NextResponse.json({ success: false, error: "Game already started" }, { status: 409 })
    }

    const { data: host, error: hostError } = await supabase
      .from(TABLES.players)
      .select("id, is_host")
      .eq("id", playerId)
      .eq("room_id", room.id)
      .maybeSingle()

    if (hostError) {
      throw hostError
    }

    if (!host || !host.is_host) {
      return NextResponse.json({ success: false, error: "Only the host can start the game" }, { status: 403 })
    }

    const { data: players, error: playersError } = await supabase
      .from(TABLES.players)
      .select("id, is_ready")
      .eq("room_id", room.id)

    if (playersError) {
      throw playersError
    }

    // Temporarily allow hosts to start with a single player while testing.

    const allReady = players?.every((player) => player.is_ready) ?? false
    if (!allReady) {
      return NextResponse.json({ success: false, error: "All players must be ready before starting" }, { status: 409 })
    }

    const nextState = transitionGameState(
      {
        status: room.status as GameStatus,
        currentPhase: (room.current_phase ?? null) as CreationPhase | null,
      },
      "briefing",
    )

    const phaseStartTime = new Date().toISOString()

    const { error: updateError } = await supabase
      .from(TABLES.gameRooms)
      .update({
        status: nextState.status,
        current_phase: nextState.currentPhase,
        phase_start_time: phaseStartTime,
      })
      .eq("id", room.id)

    if (updateError) {
      throw updateError
    }

    const { error: resetReadyError } = await supabase
      .from(TABLES.players)
      .update({ is_ready: false })
      .eq("room_id", room.id)

    if (resetReadyError) {
      throw resetReadyError
    }

    // Increment version to trigger realtime refresh
    const { data: currentRoom } = await supabase
      .from(TABLES.gameRooms)
      .select("version")
      .eq("id", room.id)
      .single()

    await supabase
      .from(TABLES.gameRooms)
      .update({ version: (currentRoom?.version ?? 0) + 1 })
      .eq("id", room.id)

    // Broadcast status change to WebSocket clients
    await broadcastToRoom(room.code, {
      type: "status_changed",
      roomCode: room.code,
      status: nextState.status,
      currentPhase: nextState.currentPhase ?? null,
      phaseStartTime,
      version: 0, // Version will be managed by WS server
    })

    // Generate AI brief based on product category
    let generatedBrief
    try {
      generatedBrief = await generateBrief(room.product_category ?? "All")
    } catch (briefError) {
      console.error("Failed to generate brief, using empty brief as fallback", briefError)
      // Fallback to empty brief if generation fails
      generatedBrief = {
        productName: "",
        productCategory: room.product_category ?? "All",
        businessProblem: "",
        targetAudience: "",
        objective: "",
      }
    }

    const { data: existingBrief, error: briefSelectError } = await supabase
      .from(TABLES.campaignBriefs)
      .select("id")
      .eq("room_id", room.id)
      .maybeSingle()

    if (briefSelectError) {
      throw briefSelectError
    }

    let briefId: string
    if (existingBrief) {
      // Update existing brief with generated content
      const { error: updateBriefError } = await supabase
        .from(TABLES.campaignBriefs)
        .update({
          product_name: generatedBrief.productName,
          product_category: generatedBrief.productCategory,
          business_problem: generatedBrief.businessProblem,
          target_audience: generatedBrief.targetAudience,
          objective: generatedBrief.objective,
        })
        .eq("id", existingBrief.id)

      if (updateBriefError) {
        throw updateBriefError
      }
      briefId = existingBrief.id
    } else {
      // Create new brief with generated content
      const { data: newBrief, error: insertBriefError } = await supabase
        .from(TABLES.campaignBriefs)
        .insert({
          room_id: room.id,
          product_name: generatedBrief.productName,
          product_category: generatedBrief.productCategory,
          business_problem: generatedBrief.businessProblem,
          target_audience: generatedBrief.targetAudience,
          objective: generatedBrief.objective,
        })
        .select("id")
        .single()

      if (insertBriefError || !newBrief) {
        throw insertBriefError || new Error("Failed to create brief")
      }
      briefId = newBrief.id
    }

    // Broadcast brief update to all players
    await broadcastToRoom(room.code, {
      type: "brief_updated",
      roomCode: room.code,
      briefId,
      version: 0, // Version will be managed by WS server
    })

    return NextResponse.json({
      success: true,
      status: nextState.status,
      currentPhase: nextState.currentPhase ?? null,
      phaseStartTime,
      brief: generatedBrief,
    })
  } catch (error) {
    console.error("Failed to start game", error)
    return NextResponse.json({ success: false, error: "Failed to start game" }, { status: 500 })
  }
}
