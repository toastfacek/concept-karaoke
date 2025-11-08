/**
 * Gemini Image Generation Utility
 *
 * Reusable utility for generating images using Gemini 2.5 Flash Image model.
 * Extracted from /app/api/images/generate/route.ts for use in brief generation.
 */

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

/**
 * Generate a product image using Gemini 2.5 Flash Image
 *
 * @param prompt - The image generation prompt
 * @param geminiKey - Gemini API key
 * @returns Base64 data URL of the generated image, or null if generation fails
 */
export async function generateProductImage(prompt: string, geminiKey: string): Promise<string | null> {
  try {
    const requestPayload = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseModalities: ["Image"],
        imageConfig: {
          aspectRatio: "16:9", // Match canvas dimensions
        },
      },
    }

    console.log("[Gemini Image] Generating product image with prompt:", prompt)

    const response = await fetch(`${GEMINI_IMAGE_URL}?key=${geminiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Gemini Image] Failed with status", response.status, errorText)
      return null
    }

    const payload = await response.json()
    const image = extractImageFromPayload(payload)

    if (!image?.data) {
      console.error("[Gemini Image] Failed to extract image from payload")
      return null
    }

    const mimeType = image.mimeType ?? "image/png"
    const dataUrl = `data:${mimeType};base64,${image.data}`

    console.log("[Gemini Image] Successfully generated image, size:", image.data.length, "characters")

    return dataUrl
  } catch (error) {
    console.error("[Gemini Image] Error generating product image:", error)
    return null
  }
}
