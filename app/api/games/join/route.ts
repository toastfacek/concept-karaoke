import { NextResponse } from "next/server"
import { z } from "zod"

import { TABLES } from "@/lib/db"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const MAX_PLAYERS = 8

const requestSchema = z.object({
  code: z
    .string()
    .min(6, "Code must be 6 characters")
    .max(6, "Code must be 6 characters")
    .transform((value) => value.toUpperCase()),
  name: z
    .string()
    .min(1, "Name is required")
    .max(50, "Name must be 50 characters or fewer")
    .transform((value) => value.trim()),
  emoji: z.string().min(1, "Emoji is required").max(10, "Emoji must be 10 characters or fewer"),
})

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = requestSchema.safeParse(json)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const { code, name, emoji } = parsed.data
    const supabase = getSupabaseAdminClient()

    const { data: room, error: roomError } = await supabase
      .from(TABLES.gameRooms)
      .select("id, code, status")
      .eq("code", code)
      .maybeSingle()

    if (roomError) {
      throw roomError
    }

    if (!room) {
      return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 })
    }

    if (room.status !== "lobby") {
      return NextResponse.json({ success: false, error: "Game already in progress" }, { status: 409 })
    }

    const { count, error: playerCountError } = await supabase
      .from(TABLES.players)
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id)

    if (playerCountError) {
      throw playerCountError
    }

    if ((count ?? 0) >= MAX_PLAYERS) {
      return NextResponse.json({ success: false, error: "Lobby is full" }, { status: 409 })
    }

    const { data: duplicateName, error: duplicateError } = await supabase
      .from(TABLES.players)
      .select("id")
      .eq("room_id", room.id)
      .eq("name", name)
      .maybeSingle()

    if (duplicateError) {
      throw duplicateError
    }

    if (duplicateName) {
      return NextResponse.json({ success: false, error: "A player with that name already joined" }, { status: 409 })
    }

    const playerId = crypto.randomUUID()

    const { data: player, error: playerError } = await supabase
      .from(TABLES.players)
      .insert({
        id: playerId,
        room_id: room.id,
        name,
        emoji,
        is_ready: false,
        is_host: false,
      })
      .select("id, name, emoji, is_ready, is_host")
      .single()

    if (playerError) {
      throw playerError
    }

    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        code: room.code,
      },
      player: {
        id: player.id,
        name: player.name,
        emoji: player.emoji,
        isReady: player.is_ready,
        isHost: player.is_host,
      },
    })
  } catch (error) {
    console.error("Failed to join game", error)
    return NextResponse.json({ success: false, error: "Failed to join game" }, { status: 500 })
  }
}
