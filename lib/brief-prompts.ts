import type { BriefStyle, WackyBriefStyle } from "./types"

export function getBriefPrompt(
  category: string,
  style: BriefStyle,
  wackyStyle?: WackyBriefStyle
): string {
  if (style === "wacky") {
    return getWackyPrompt(category, wackyStyle || "absurd_constraints")
  }
  return getRealisticPrompt(category)
}

function getWackyPrompt(category: string, wackyStyle: WackyBriefStyle): string {
  const styleInstructions = getWackyStyleInstructions(wackyStyle)

  return [
    `Generate a quick, funny advertising brief for a fictional product in the "${category}" category.`,
    "",
    "STYLE: " + styleInstructions.name,
    styleInstructions.description,
    "",
    "CRITICAL: Keep everything SHORT and PUNCHY. The brief should take 30 seconds to read.",
    "",
    "Respond with valid JSON matching this structure:",
    "{",
    '  "productName": string,',
    '  "productCategory": string,',
    '  "productDescription": string,',
    '  "audience": string,',
    '  "uniqueBenefit": string,',
    '  "mainMessage": string',
    "}",
    "",
    `The productCategory field MUST be exactly: "${category}"`,
    "",
    "Field requirements (BE BRIEF!):",
    "- productName: Realistic-sounding brand name (2-4 words) like 'Hearthco Mug' or 'Nimbus Chair'",
    "- productDescription: ONE sentence, ~10 words max. What is it? Example: 'A self-warming travel mug'",
    "- audience: ONE phrase, ~8 words max. Who's it for? Example: 'Young busy commuters and working professionals'",
    "- uniqueBenefit: ONE sentence, ~12 words max. What makes it different? " + styleInstructions.benefitExample,
    "- mainMessage: ONE phrase, ~6 words max. What should the ad say? " + styleInstructions.messageExample,
    "",
    styleInstructions.examples,
    "",
    "Make it weird and memorable, but keep it SHORT. Do not wrap the JSON in markdown fences.",
  ].join("\n")
}

function getWackyStyleInstructions(style: WackyBriefStyle): {
  name: string
  description: string
  benefitExample: string
  messageExample: string
  examples: string
} {
  switch (style) {
    case "absurd_constraints":
      return {
        name: "Absurd Constraints",
        description: "Normal product with a bizarre limitation or overly-specific use case.",
        benefitExample: "Example: 'Only works when you're slightly annoyed'",
        messageExample: "Example: 'Frustration has its rewards'",
        examples: [
          "Examples of this style:",
          "- A vacuum that only works during full moons",
          "- Headphones that pause when you make eye contact",
          "- A toaster that only toasts bread cut at exactly 45-degree angles",
        ].join("\n"),
      }
    case "genre_mashups":
      return {
        name: "Genre Mashups",
        description: "Apply an unexpected genre tone (film noir, romance novel, conspiracy theory) to a mundane product.",
        benefitExample: "Example: 'Finally, a stapler that understands betrayal'",
        messageExample: "Example: 'Trust no one. Staple everything.'",
        examples: [
          "Examples of this style:",
          "- Film noir office supplies: 'The pen that's seen too much'",
          "- Romance novel kitchen tools: 'The Spatula of Longing'",
          "- Conspiracy theory toiletries: 'They don't want you to know about this soap'",
        ].join("\n"),
      }
    case "unnecessary_solutions":
      return {
        name: "Unnecessary Solutions",
        description: "Products that solve non-problems with excessive seriousness.",
        benefitExample: "Example: 'Never waste the first 30 seconds of gum-chewing again'",
        messageExample: "Example: 'Reclaim your jaw's potential'",
        examples: [
          "Examples of this style:",
          "- Pre-moistened ice cubes for faster melting",
          "- Doorbell that texts you when you're home",
          "- Pants with built-in sitting detection",
        ].join("\n"),
      }
    case "conflicting_elements":
      return {
        name: "Conflicting Elements",
        description: "Create comedy through mismatch - serious product with absurd audience, or mundane product with dramatic message.",
        benefitExample: "Example: 'The only welding mask endorsed by lifestyle influencers'",
        messageExample: "Example: 'Paperclips: Because chaos is the alternative'",
        examples: [
          "Examples of this style:",
          "- Industrial equipment for teenagers",
          "- Luxury products for mundane tasks",
          "- Epic dramatic messaging for boring items",
        ].join("\n"),
      }
  }
}

function getRealisticPrompt(category: string): string {
  return [
    `Generate a quick advertising brief for a realistic product in the "${category}" category.`,
    "",
    "CRITICAL: Keep everything SHORT and PUNCHY. The brief should take 30 seconds to read.",
    "",
    "Make it SPECIFIC and DIFFERENTIATED:",
    "- A concrete market gap or underserved need",
    "- A distinctive positioning angle",
    "- A realistic product name (like 'Hearthco Mug' not 'MegaSuper InnovatePro 3000')",
    "",
    "Respond with valid JSON matching this structure:",
    "{",
    '  "productName": string,',
    '  "productCategory": string,',
    '  "productDescription": string,',
    '  "audience": string,',
    '  "uniqueBenefit": string,',
    '  "mainMessage": string',
    "}",
    "",
    `The productCategory field MUST be exactly: "${category}"`,
    "",
    "Field requirements (BE BRIEF!):",
    "- productName: Realistic brand name (2-4 words). Examples: 'Hearthco Mug', 'Nimbus Chair', 'Verde Kitchen'",
    "- productDescription: ONE sentence, ~10 words max. Example: 'A self-warming travel mug'",
    "- audience: ONE phrase, ~8 words max. Example: 'Young busy commuters and working professionals'",
    "- uniqueBenefit: ONE sentence, ~12 words max. Example: 'Bluetooth connects to phone for appointment reminders'",
    "- mainMessage: ONE phrase, ~6 words max. Example: 'Never drink cold coffee again'",
    "",
    "Examples of good briefs:",
    "- Hearthco Mug: Self-warming travel mug for busy commuters. Benefit: keeps drinks hot for 8 hours. Message: 'Your coffee, always ready'",
    "- Nimbus Chair: Ergonomic desk chair for remote workers. Benefit: adapts to your posture automatically. Message: 'Sit better, work longer'",
    "- Sprout Box: Weekly meal kit for busy parents. Benefit: kid-approved recipes ready in 15 minutes. Message: 'Dinner solved'",
    "",
    "Make it believable and specific. Do not wrap the JSON in markdown fences.",
  ].join("\n")
}
