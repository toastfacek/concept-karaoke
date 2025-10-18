import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")

    // TODO: Validate file type and size
    // TODO: Upload to Supabase Storage
    // TODO: Return public URL

    return NextResponse.json({
      success: true,
      url: "https://storage.supabase.co/...",
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to upload file" }, { status: 500 })
  }
}
