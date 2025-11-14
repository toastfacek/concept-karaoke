import { NextResponse } from "next/server"
import { z } from "zod"

import { TABLES } from "@/lib/db"
import { broadcastToRoom } from "@/lib/realtime-broadcast"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const MAX_PLAYERS = 12
const MAX_SEAT_ASSIGN_ATTEMPTS = 3

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

    let playerSeatIndex = 0
    let createdPlayer: {
      id: string
      name: string
      emoji: string
      is_ready: boolean | null
      is_host: boolean | null
      seat_index: number
    } | null = null

    for (let attempt = 0; attempt < MAX_SEAT_ASSIGN_ATTEMPTS; attempt += 1) {
      const { data: highestSeat, error: highestSeatError } = await supabase
        .from(TABLES.players)
        .select("seat_index")
        .eq("room_id", room.id)
        .order("seat_index", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (highestSeatError) {
        throw highestSeatError
      }

      playerSeatIndex = typeof highestSeat?.seat_index === "number" ? highestSeat.seat_index + 1 : 0

      const { data: player, error: playerError } = await supabase
        .from(TABLES.players)
        .insert({
          id: playerId,
          room_id: room.id,
          name,
          emoji,
          is_ready: false,
          is_host: false,
          seat_index: playerSeatIndex,
        })
        .select("id, name, emoji, is_ready, is_host, seat_index")
        .single()

      if (!playerError) {
        createdPlayer = player
        break
      }

      const isSeatCollision = playerError.code === "23505"

      if (!isSeatCollision || attempt === MAX_SEAT_ASSIGN_ATTEMPTS - 1) {
        throw playerError
      }
    }

    if (!createdPlayer) {
      return NextResponse.json({ success: false, error: "Failed to assign player seat" }, { status: 500 })
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

    // Broadcast to WebSocket clients
    await broadcastToRoom(room.code, {
      type: "player_joined",
      roomCode: room.code,
      player: {
        id: createdPlayer.id,
        name: createdPlayer.name,
        emoji: createdPlayer.emoji,
        isReady: createdPlayer.is_ready ?? false,
        isHost: createdPlayer.is_host ?? false,
        seatIndex: createdPlayer.seat_index,
      },
      version: 0, // Version will be managed by WS server
    })

    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        code: room.code,
      },
      player: {
        id: createdPlayer.id,
        name: createdPlayer.name,
        emoji: createdPlayer.emoji,
        isReady: createdPlayer.is_ready,
        isHost: createdPlayer.is_host,
        seatIndex: createdPlayer.seat_index,
      },
    })
  } catch (error) {
    console.error("Failed to join game", error)
    return NextResponse.json({ success: false, error: "Failed to join game" }, { status: 500 })
  }
}
