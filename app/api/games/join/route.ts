import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { code, name, emoji } = body

    // TODO: Validate code exists in database
    // TODO: Check if room is full (max 8 players)
    // TODO: Check if game has already started
    // TODO: Add player to room in Supabase
    // TODO: Broadcast player joined event via Supabase Realtime

    return NextResponse.json({
      success: true,
      roomId: code,
      playerId: "player-123",
      message: "Joined game successfully",
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to join game" }, { status: 500 })
  }
}
