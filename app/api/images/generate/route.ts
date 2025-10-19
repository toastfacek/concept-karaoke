import { NextResponse } from "next/server"
import { z } from "zod"

import { env, requireServerEnv } from "@/lib/env"

const requestSchema = z.object({
  prompt: z.string().trim().min(5, "Prompt must be at least 5 characters"),
})

const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image"
const GEMINI_IMAGE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`

type ImagePayload = { data: string; mimeType: string }

function resolveBase64Image(value: unknown): ImagePayload | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const record = value as Record<string, unknown>

  if (record.inlineData && typeof record.inlineData === "object") {
    const inlineData = record.inlineData as Record<string, unknown>
    const data = inlineData.data
    if (typeof data === "string" && data.length > 0) {
      return {
        data,
        mimeType: typeof inlineData.mimeType === "string" ? inlineData.mimeType : "image/png",
      }
    }
  }

  const image = record.image
  if (image && typeof image === "object") {
    const nested = resolveBase64Image(image)
    if (nested) {
      const mimeType =
        typeof (image as Record<string, unknown>).mimeType === "string"
          ? ((image as Record<string, unknown>).mimeType as string)
          : nested.mimeType
      return {
        data: nested.data,
        mimeType,
      }
    }
  }

  const base64 =
    (typeof record.b64Data === "string" && record.b64Data.length > 0 && record.b64Data) ||
    (typeof record.base64Data === "string" && record.base64Data.length > 0 && record.base64Data) ||
    (typeof record.data === "string" && record.data.length > 0 && record.data) ||
    (typeof record.imageBytes === "string" && record.imageBytes.length > 0 && record.imageBytes)

  if (typeof base64 === "string" && base64.length > 0) {
    const mimeType =
      (typeof record.mimeType === "string" && record.mimeType) ||
      (typeof record.mime_type === "string" && (record.mime_type as string)) ||
      "image/png"

    return { data: base64, mimeType }
  }

  return undefined
}

function extractImageFromPayload(payload: unknown): ImagePayload | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined
  }

  const payloadRecord = payload as Record<string, unknown>

  const generatedImages = Array.isArray(payloadRecord.generatedImages)
    ? (payloadRecord.generatedImages as unknown[])
    : undefined
  if (generatedImages?.length) {
    for (const image of generatedImages) {
      const resolved = resolveBase64Image(image)
      if (resolved) return resolved
    }
  }

  const images = Array.isArray(payloadRecord.images) ? (payloadRecord.images as unknown[]) : undefined
  if (images?.length) {
    for (const image of images) {
      const resolved = resolveBase64Image(image)
      if (resolved) return resolved
    }
  }

  const candidates = Array.isArray(payloadRecord.candidates) ? (payloadRecord.candidates as unknown[]) : undefined
  if (candidates?.length) {
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object") continue
      const candidateRecord = candidate as Record<string, unknown>
      const content = candidateRecord.content
      if (!content || typeof content !== "object") continue
      const parts = Array.isArray((content as Record<string, unknown>).parts)
        ? ((content as Record<string, unknown>).parts as unknown[])
        : []
      for (const part of parts) {
        const resolved = resolveBase64Image(part)
        if (resolved) return resolved
      }
    }
  }

  return undefined
}

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = requestSchema.safeParse(json)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const geminiKey = env.server.GEMINI_API_KEY ?? requireServerEnv("GEMINI_API_KEY")

    const promptText = [
      "You are creating an advertising campaign image for a collaborative improv design game.",
      "Keep the style bold, playful, and high-contrast so it reads well when sketched over.",
      "Avoid adding logos or text in the artwork.",
      `Prompt: ${parsed.data.prompt}`,
    ].join("\n")

    const requestPayload = {
      contents: [
        {
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        responseModalities: ["Image"],
        temperature: 0.7,
      },
    }

    console.log("[Gemini Image] Request URL:", GEMINI_IMAGE_URL)
    console.log("[Gemini Image] Request payload:", JSON.stringify(requestPayload, null, 2))
    console.log("[Gemini Image] Timestamp:", new Date().toISOString())

    const response = await fetch(`${GEMINI_IMAGE_URL}?key=${geminiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    })

    console.log("[Gemini Image] Response status:", response.status)
    console.log("[Gemini Image] Response headers:", Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Gemini Image] Error response body:", errorText)
      console.error("[Gemini Image] Failed with status", response.status)
      throw new Error(`Gemini image request failed (${response.status}): ${errorText}`)
    }

    const payload = await response.json()
    console.log("[Gemini Image] Response payload structure:", JSON.stringify(payload, null, 2))

    const image = extractImageFromPayload(payload)

    if (!image?.data) {
      console.error("[Gemini Image] Failed to extract image from payload")
      console.error("[Gemini Image] Full payload:", JSON.stringify(payload, null, 2))
      throw new Error("Gemini image response missing image data")
    }

    console.log("[Gemini Image] Successfully extracted image, mime type:", image.mimeType)
    console.log("[Gemini Image] Image data length:", image.data.length, "characters")

    const mimeType = image.mimeType ?? "image/png"
    const dataUrl = `data:${mimeType};base64,${image.data}`

    return NextResponse.json({
      success: true,
      image: {
        mimeType,
        base64: image.data,
        dataUrl,
      },
    })
  } catch (error) {
    console.error("Failed to generate image", error)
    return NextResponse.json({ success: false, error: "Failed to generate image" }, { status: 500 })
  }
}
