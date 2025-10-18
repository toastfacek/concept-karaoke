import { NextResponse } from "next/server"

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    const { text, createdBy } = body

    // TODO: Update AdLob big idea in Supabase
    // TODO: Broadcast update via Realtime
    // TODO: Check if all players completed, trigger phase transition

    return NextResponse.json({
      success: true,
      message: "Big idea saved",
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to save big idea" }, { status: 500 })
  }
}
