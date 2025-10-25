import { NextResponse } from "next/server"
import { z } from "zod"

import { env, requireServerEnv } from "@/lib/env"
import { SPECIFIC_PRODUCT_CATEGORIES } from "@/lib/types"

const requestSchema = z.object({
  category: z.string().min(1),
  model: z.enum(["gemini-2.5-flash", "gemini-2.0-flash-exp", "gpt-4o", "claude-3-5-sonnet"]),
})

const briefSchema = z.object({
  productName: z.string().min(1),
  productCategory: z.string().min(1),
  businessProblem: z.string().min(1),
  targetAudience: z.string().min(1),
  objective: z.string().min(1),
})

// Base prompt template used across all models
function createPrompt(productCategory: string): string {
  return [
    `Generate a creative advertising brief for a fictional product in the "${productCategory}" category.`,
    "Respond with valid JSON that matches this TypeScript interface:",
    "{",
    '  "productName": string,',
    '  "productCategory": string,',
    '  "businessProblem": string,',
    '  "targetAudience": string,',
    '  "objective": string',
    "}",
    `The productCategory field MUST be exactly: "${productCategory}"`,
    "Make the productName creative and fitting for this category.",
    "Keep it playful but useful for a collaborative improv game.",
    "Do not wrap the JSON in markdown fences or add extra text.",
  ].join("\n")
}

// Gemini API call (current implementation)
async function generateWithGemini(
  prompt: string,
  model: "gemini-2.5-flash" | "gemini-2.0-flash-exp",
): Promise<string> {
  const geminiKey = env.server.GEMINI_API_KEY ?? requireServerEnv("GEMINI_API_KEY")
  const modelName = model === "gemini-2.5-flash" ? "gemini-2.5-flash" : "gemini-2.0-flash-exp"
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`

  const response = await fetch(`${url}?key=${geminiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini request failed: ${errorText}`)
  }

  const payload = await response.json()
  const textContent = payload?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof textContent !== "string") {
    throw new Error("Unexpected Gemini response format")
  }

  return textContent
}

// OpenAI GPT-4o API call
async function generateWithOpenAI(prompt: string): Promise<string> {
  const openaiKey = env.server.OPENAI_API_KEY ?? requireServerEnv("OPENAI_API_KEY")

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a creative advertising brief generator. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI request failed: ${errorText}`)
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== "string") {
    throw new Error("Unexpected OpenAI response format")
  }

  return content
}

// Anthropic Claude API call
async function generateWithClaude(prompt: string): Promise<string> {
  const claudeKey = env.server.ANTHROPIC_API_KEY ?? requireServerEnv("ANTHROPIC_API_KEY")

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Claude request failed: ${errorText}`)
  }

  const payload = await response.json()
  const content = payload?.content?.[0]?.text
  if (typeof content !== "string") {
    throw new Error("Unexpected Claude response format")
  }

  return content
}

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = requestSchema.safeParse(json)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request payload"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const { category, model } = parsed.data

    // If "All" is selected, randomly pick from specific categories
    const productCategory =
      category === "All"
        ? SPECIFIC_PRODUCT_CATEGORIES[Math.floor(Math.random() * SPECIFIC_PRODUCT_CATEGORIES.length)]
        : category

    const prompt = createPrompt(productCategory)

    // Generate based on selected model
    let textContent: string

    if (model === "gemini-2.5-flash" || model === "gemini-2.0-flash-exp") {
      textContent = await generateWithGemini(prompt, model)
    } else if (model === "gpt-4o") {
      textContent = await generateWithOpenAI(prompt)
    } else if (model === "claude-3-5-sonnet") {
      textContent = await generateWithClaude(prompt)
    } else {
      throw new Error("Unsupported model")
    }

    // Parse and validate the response
    const parsedBrief = briefSchema.parse(JSON.parse(textContent))

    return NextResponse.json({
      success: true,
      brief: parsedBrief,
    })
  } catch (error) {
    console.error("Failed to generate test brief", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate brief",
      },
      { status: 500 },
    )
  }
}
