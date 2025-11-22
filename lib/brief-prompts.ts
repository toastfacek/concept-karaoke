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
    "FORMAT REQUIREMENTS:",
    "- Write a bulleted brief with 80-120 words total across all sections",
    "- Use markdown bullets (- ) for each point",
    "- Each section should have 2-4 concise bullet points",
    "- Structure with these markdown bold subheadings in this exact order:",
    "  **Main Message** - 2-3 bullets. " + styleInstructions.messageGuidance,
    "  **What Is It** - 2-3 bullets describing the product form",
    "  **Who It's For** - 2-3 bullets about the target audience",
    "  **The Difference** - 2-3 bullets. " + styleInstructions.benefitGuidance,
    "",
    "Respond with valid JSON matching this structure:",
    "{",
    '  "productName": string,',
    '  "productCategory": string,',
    '  "briefContent": string',
    "}",
    "",
    `The productCategory field MUST be exactly: "${category}"`,
    "",
    "Field requirements:",
    "- productName: Realistic-sounding brand name (2-4 words) like 'Hearthco Mug' or 'Nimbus Chair' - NO PUNS",
    "- briefContent: Prose brief with markdown bold subheadings (80-120 words total)",
    "",
    styleInstructions.examples,
    "",
    "WHY IT'S FUNNY:",
    styleInstructions.whyFunny,
    "",
    "TONE: Deadpan corporate. Never wink at the joke. Treat the absurdity as completely normal.",
    "Make it weird and memorable. Do not wrap the JSON in markdown fences.",
  ].join("\n")
}

function getWackyStyleInstructions(style: WackyBriefStyle): {
  name: string
  description: string
  benefitGuidance: string
  messageGuidance: string
  whyFunny: string
  examples: string
} {
  switch (style) {
    case "absurd_constraints":
      return {
        name: "Absurd Constraints",
        description: "A completely normal, familiar product with ONE absurd operational requirement that makes it nearly useless. The product itself is instantly understood - the constraint is the only weird part.",
        benefitGuidance: "State the constraint matter-of-factly as if it's a feature. Example: 'Only activates above 10,000 feet altitude'",
        messageGuidance: "Earnest value prop that ignores the constraint. Example: 'Stay dry in any weather'",
        whyFunny: "The corporate seriousness applied to an obviously impractical limitation. The brief never acknowledges that the constraint is a problem.",
        examples: [
          "Examples of this style:",
          "- AeroShield Umbrella: Premium umbrella that only opens above 10,000 feet altitude",
          "- SilentWave Headphones: Noise-canceling headphones that require complete silence to activate",
          "- LunarBrew Coffee Maker: Single-serve coffee maker that only works during a full moon",
          "- StillStep Running Shoes: Performance running shoes that must remain stationary for 24 hours before each use",
        ].join("\n"),
      }
    case "genre_mashups":
      return {
        name: "Genre Mashups",
        description: "A product that genuinely tries to serve TWO incompatible purposes at once. Pick a second category that has NO logical connection to the primary one. The brief earnestly tries to unify both.",
        benefitGuidance: "Try to serve both purposes. Example: 'Track your heart rate while filing your taxes'",
        messageGuidance: "Unify both purposes. Example: 'Relax your way to financial clarity'",
        whyFunny: "The collision of two legitimate but incompatible purposes creates absurdity. The brief's earnest attempt to unify them makes it funnier.",
        examples: [
          "Examples of this style:",
          "- ZenTurbo: A meditation app that's also a competitive racing game",
          "- BabyBeat Monitor: A baby monitor that doubles as a DJ mixing board",
          "- LoveNest Retirement: A retirement planning service that's also a dating app",
          "- FlexForm Yoga Mat: A yoga mat with built-in tax preparation software",
        ].join("\n"),
      }
    case "unnecessary_solutions":
      return {
        name: "Unnecessary Solutions",
        description: "An impressively over-engineered solution to a trivial micro-annoyance that nobody actually needs solved. The product form is familiar (app, device, service) - the 'problem' it solves is hilariously specific.",
        benefitGuidance: "Treat the micro-problem as urgent. Example: 'Eliminates the 3 seconds of uncertainty about which pocket'",
        messageGuidance: "Deadly serious about the trivial problem. Example: 'Never wonder again'",
        whyFunny: "The mismatch between the elaborate, serious solution and the trivial non-problem. The brief's urgency about something nobody cares about.",
        examples: [
          "Examples of this style:",
          "- PocketPing: A subscription service that reminds you which pocket your phone is in",
          "- KeyScale: A precision weight tracker specifically for your keys",
          "- BailPredict AI: An AI that predicts which of your friends will cancel plans",
          "- LockCheck Pro: A smart device that confirms you locked your door (only after you've left)",
          "",
          "Financial Services examples:",
          "- CentTracker Pro: Real-time push notifications every time your savings account earns a single penny of interest",
          "- RoundUpAlert: Premium service that sends you a monthly report of which purchases got rounded up to the nearest dollar",
          "- ReceiptRemember: Cloud-based storage solution exclusively for receipts under $5",
          "- CoinCount Premier: Enterprise-grade accounting software that tracks the exact number of pennies in your couch",
        ].join("\n"),
      }
    case "conflicting_elements":
      return {
        name: "Conflicting Elements",
        description: "A product with a feature that directly contradicts or undermines its primary purpose. The brief must NOT acknowledge the contradiction - present the undermining feature as a BENEFIT.",
        benefitGuidance: "Spin the contradiction as a feature. Example: 'Built-in flashlight ensures you can always find it'",
        messageGuidance: "Confident about the main purpose. Example: 'Sleep deeper than ever'",
        whyFunny: "The internal contradiction that everyone notices but the brief ignores. The marketing spin on why the undermining feature is actually good.",
        examples: [
          "Examples of this style:",
          "- PrivacyShare App: A privacy app that shares your location with everyone for 'accountability'",
          "- NightVision Sleep Mask: A sleep mask with a built-in flashlight for 'midnight convenience'",
          "- ConfirmTone Headphones: Noise-canceling headphones that beep every 30 seconds to confirm they're working",
          "- AquaCase Phone Case: A waterproof phone case that must be opened to answer calls",
        ].join("\n"),
      }
  }
}

function getRealisticPrompt(category: string): string {
  return [
    `Generate a quick advertising brief for a realistic product in the "${category}" category.`,
    "",
    "Make it SPECIFIC and DIFFERENTIATED:",
    "- A concrete market gap or underserved need",
    "- A distinctive positioning angle",
    "- A realistic product name (like 'Hearthco Mug' not 'MegaSuper InnovatePro 3000')",
    "",
    "FORMAT REQUIREMENTS:",
    "- Write a bulleted brief with 80-120 words total across all sections",
    "- Use markdown bullets (- ) for each point",
    "- Each section should have 2-4 concise bullet points",
    "- Structure with these markdown bold subheadings in this exact order:",
    "  **Main Message** - 2-3 bullets with the core campaign message",
    "  **What Is It** - 2-3 bullets describing the product",
    "  **Who It's For** - 2-3 bullets about the target audience",
    "  **The Difference** - 2-3 bullets about what makes it unique",
    "",
    "Respond with valid JSON matching this structure:",
    "{",
    '  "productName": string,',
    '  "productCategory": string,',
    '  "briefContent": string',
    "}",
    "",
    `The productCategory field MUST be exactly: "${category}"`,
    "",
    "Field requirements:",
    "- productName: Realistic brand name (2-4 words). Examples: 'Hearthco Mug', 'Nimbus Chair', 'Verde Kitchen'",
    "- briefContent: Prose brief with markdown bold subheadings (80-120 words total)",
    "",
    "Example brief format:",
    "**Main Message**",
    "- Never drink cold coffee again",
    "- Your morning routine, perfected",
    "",
    "**What Is It**",
    "- Self-warming travel mug for busy professionals",
    "- Keeps beverages at perfect temperature for 8 hours",
    "- No power source needed",
    "",
    "**Who It's For**",
    "- Young commuters always on the go",
    "- Working professionals who hate cold coffee",
    "",
    "**The Difference**",
    "- Connects to phone via Bluetooth",
    "- Sends appointment reminders when you pick it up",
    "- Smart technology meets morning routine",
    "",
    "Make it believable and specific. Do not wrap the JSON in markdown fences.",
  ].join("\n")
}
