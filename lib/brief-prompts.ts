import type { BriefStyle } from "./types"

export function getBriefPrompt(category: string, style: BriefStyle): string {
  if (style === "wacky") {
    return getWackyPrompt(category)
  }
  return getRealisticPrompt(category)
}

function getWackyPrompt(category: string): string {
  return [
    `Generate a creative advertising brief for a ridiculous fictional product in the "${category}" category.`,
    "",
    "Make it SPECIFIC and ABSURD. The product should have:",
    "- A distinctive quirk, flaw, or overly-specific use case",
    "- An unexpected combination of features or a bizarre selling point",
    "- A business problem that's hilariously mismatched with the solution",
    "- Enough weird detail to spark creative riffing",
    "",
    "Respond with valid JSON matching this TypeScript interface:",
    "{",
    '  "productName": string,',
    '  "productCategory": string,',
    '  "tagline": string,',
    '  "productFeatures": string,',
    '  "businessProblem": string,',
    '  "targetAudience": string,',
    '  "objective": string,',
    '  "weirdConstraint": string',
    "}",
    "",
    `The productCategory field MUST be exactly: "${category}"`,
    "",
    "The productFeatures should be a short paragraph (2-3 sentences) describing what the product actually does and its key absurd features.",
    "",
    "Examples of the absurdity level to aim for:",
    "- A luxury sleeping bag for business meetings",
    "- Edible post-it notes that taste like the priority level",
    "- A meditation app that only works while you're screaming",
    "",
    "Make it weird, specific, and memorable. Do not wrap the JSON in markdown fences or add extra text.",
  ].join("\n")
}

function getRealisticPrompt(category: string): string {
  return [
    `Generate a creative advertising brief for a realistic fictional product in the "${category}" category.`,
    "",
    "Make it SPECIFIC and DIFFERENTIATED. The product should have:",
    "- A concrete market gap or underserved customer need (not just 'better' or 'innovative')",
    "- A distinctive positioning angle or unique value proposition",
    "- Specific product features with measurable benefits or outcomes",
    "- A well-defined target audience with specific demographics, behaviors, and pain points",
    "- Clear business objectives tied to metrics (awareness, consideration, conversion, retention)",
    "- Enough concrete detail to inspire distinctive creative campaigns",
    "",
    "VARY these elements to create diverse briefs:",
    "- Price positioning (luxury, premium, mid-market, budget, value)",
    "- Business model (subscription, one-time purchase, freemium, B2B, D2C)",
    "- Innovation type (category disruption, incremental improvement, category creation)",
    "- Primary customer pain point (time, money, convenience, status, safety, sustainability)",
    "- Distribution channel (retail, direct-to-consumer, B2B, marketplace)",
    "",
    "Respond with valid JSON matching this TypeScript interface:",
    "{",
    '  "productName": string,',
    '  "productCategory": string,',
    '  "tagline": string,',
    '  "productFeatures": string,',
    '  "businessProblem": string,',
    '  "targetAudience": string,',
    '  "objective": string',
    "}",
    "",
    `The productCategory field MUST be exactly: "${category}"`,
    "",
    "The tagline should be a memorable, punchy positioning statement (6-10 words).",
    "",
    "The productFeatures should be a specific paragraph (2-3 sentences) describing concrete features, benefits, and what makes this product different from competitors.",
    "",
    "The targetAudience should include specific demographics, psychographics, behaviors, and the exact pain point this product addresses for them.",
    "",
    "Examples of the specificity level to aim for:",
    "- FlexDesk Pro: A modular standing desk system with built-in cable management and wireless charging, targeting remote workers in small apartments (under 600 sq ft) who struggle with dedicated workspace and need furniture that adapts throughout the day",
    "- SnackLab: A personalized snack subscription using AI taste profiling, targeting health-conscious Gen Z consumers (18-24) with dietary restrictions who want discovery without the guilt of traditional snack boxes",
    "- CareCircle: A family coordination app with medication reminders and appointment scheduling, targeting adult children (35-50) managing care for aging parents across different cities",
    "",
    "Make it believable, strategically grounded, and specific enough to inspire creative advertising concepts.",
    "Avoid generic products - each brief should feel distinct and memorable.",
    "Do not wrap the JSON in markdown fences or add extra text.",
  ].join("\n")
}
