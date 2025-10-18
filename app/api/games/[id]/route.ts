import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    // TODO: Fetch game room from Supabase by ID
    // TODO: Include players, brief, current phase, etc.

    return NextResponse.json({
      success: true,
      game: {
        id,
        code: "ABC123",
        status: "lobby",
        players: [],
        brief: null,
      },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch game" }, { status: 500 })
  }
}
