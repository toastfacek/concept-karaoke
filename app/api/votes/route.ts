import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { roomId: _roomId, voterId: _voterId, adlobId: _adlobId } = body

    // TODO: Validate voter hasn't already voted
    // TODO: Validate voter isn't voting for their own pitch
    // TODO: Save vote to Supabase
    // TODO: Check if all votes are in
    // TODO: Calculate results and transition to results phase

    return NextResponse.json({
      success: true,
      message: "Vote recorded",
    })
  } catch {
    return NextResponse.json({ success: false, error: "Failed to record vote" }, { status: 500 })
  }
}
