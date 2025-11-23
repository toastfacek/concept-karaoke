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
    `Generate a funny advertising brief for a fictional product in the "${category}" category.`,
    "",
    "HUMOR STYLE: " + styleInstructions.name,
    styleInstructions.description,
    "",
    "UNIVERSAL HUMOR PRINCIPLES:",
    "1. Satire targets the PRODUCT DESIGN and SOLUTION, never people or their problems",
    "2. For sensitive categories (healthcare, finance), mock over-engineered solutions, not human struggles",
    "3. The absurdity comes from HOW the product works, not WHO uses it",
    "4. Think: 'This solution is ridiculous' not 'These people are ridiculous'",
    "",
    "PRODUCT THINKING:",
    "- What physical or digital products exist in this category?",
    "- What mundane micro-problems could be absurdly over-solved?",
    "- What two incompatible purposes could collide?",
    "- What feature would hilariously undermine the main purpose?",
    "",
    "FORMAT REQUIREMENTS:",
    "- Write a bulleted brief with 80-120 words total across all sections",
    "- Use markdown bullets (- ) for each point",
    "- Structure with these markdown bold subheadings in this exact order:",
    "  **Main Message** - Single concise phrase (4-8 words). " + styleInstructions.messageGuidance,
    "  **What Is It** - 2-3 bullets. MUST capture the absurd constraint/feature that makes this funny. " + styleInstructions.productGuidance,
    "  **Who It's For** - Exactly 1 bullet about the target audience",
    "  **Unique Product Benefits** - 2-3 bullets. " + styleInstructions.benefitGuidance,
    "",
    "CROSS-CATEGORY EXAMPLES:",
    "These patterns work across electronics, food, fashion, wellness, finance, etc:",
    styleInstructions.examples,
    "",
    "WHY IT'S FUNNY:",
    styleInstructions.whyFunny,
    "",
    "TONE: Deadpan corporate strategy consultant. Never wink at the joke. The absurdity speaks for itself.",
    "",
    "Respond with valid JSON:",
    "{",
    '  "productName": string (realistic 2-4 word brand, NO puns),',
    '  "productCategory": "' + category + '",',
    '  "briefContent": string (bulleted with **bold** subheadings)',
    "}",
    "",
    "Generate a memorable, specific product. Do not wrap JSON in markdown fences.",
  ].join("\n")
}

function getWackyStyleInstructions(style: WackyBriefStyle): {
  name: string
  description: string
  benefitGuidance: string
  productGuidance: string
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
        productGuidance: "Lead with the constraint. Example: 'Premium umbrella that only opens above 10,000 feet altitude'",
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
        productGuidance: "Emphasize the clash. Example: 'Meditation app with competitive racing game mechanics'",
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
        description: "An impressively over-engineered solution to a TRIVIAL 2-3 SECOND micro-annoyance that nobody actually needs solved. The problem must be a tiny daily inconvenience - NOT a constraint on how the product works. The product form is familiar (app, device, service) but the 'problem' it solves is hilariously specific and pointless.",
        benefitGuidance: "Treat the trivial micro-problem as if it's a serious pain point. Example: 'Eliminates the 3 seconds of uncertainty about which pocket your phone is in'",
        productGuidance: "State the trivial problem being solved FIRST. Example: 'Subscription service that reminds you which pocket your phone is in' or 'App that tracks which hand you're holding your coffee in'. The problem should be a micro-inconvenience, NOT an operational constraint.",
        messageGuidance: "Deadpan serious about solving the trivial problem. Example: 'Never wonder again' or 'Total pocket certainty'",
        whyFunny: "The mismatch between the elaborate, serious solution and the trivial non-problem that takes 2 seconds to resolve naturally. The brief's corporate urgency about something nobody cares about.",
        examples: [
          "Examples of this style (notice the TRIVIAL problems):",
          "- PocketPing: A subscription service that reminds you which pocket your phone is in",
          "- KeyScale: A precision weight tracker specifically for your keys to know if you're carrying them",
          "- BailPredict AI: An AI that predicts which of your friends will cancel plans this week",
          "- LockCheck Pro: A smart device that confirms you locked your door (but only sends notification after you've left)",
          "- CupSide: An app that tracks which hand you're holding your coffee cup in",
          "",
          "ANTI-EXAMPLES (these are absurd_constraints, NOT unnecessary_solutions):",
          "- A Wi-Fi hotspot that requires no Wi-Fi signals nearby (this is a CONSTRAINT, not a trivial problem)",
          "- A coffee maker that only works during full moons (this is a CONSTRAINT, not a trivial problem)",
          "- Headphones that require silence to activate (this is a CONSTRAINT, not a trivial problem)",
        ].join("\n"),
      }
    case "conflicting_elements":
      return {
        name: "Conflicting Elements",
        description: "A product with a feature that directly contradicts or undermines its primary purpose. The brief must NOT acknowledge the contradiction - present the undermining feature as a BENEFIT.",
        benefitGuidance: "Spin the contradiction as a feature. Example: 'Built-in flashlight ensures you can always find it'",
        productGuidance: "State the contradiction upfront. Example: 'Sleep mask with built-in flashlight for midnight convenience'",
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
    `Generate an advertising brief for a realistic product in the "${category}" category.`,
    "",
    "PRODUCT THINKING:",
    "- What physical or digital products exist in this category?",
    "- What concrete market gap or underserved need exists?",
    "- What distinctive positioning angle would stand out?",
    "- Who is the specific target customer?",
    "",
    "Make it SPECIFIC and DIFFERENTIATED:",
    "- Not generic ('a better app') but specific ('meditation app for shift workers')",
    "- Not obvious features but unexpected combinations",
    "- Not 'MegaSuper InnovatePro 3000' but realistic brand names like 'Hearthco Mug'",
    "",
    "FORMAT REQUIREMENTS:",
    "- Write a bulleted brief with 80-120 words total across all sections",
    "- Use markdown bullets (- ) for each point",
    "- Structure with these markdown bold subheadings in this exact order:",
    "  **Main Message** - Single concise phrase (4-8 words) capturing the core campaign message",
    "  **What Is It** - 2-3 bullets describing the product and its key feature",
    "  **Who It's For** - Exactly 1 bullet about the target audience",
    "  **Unique Product Benefits** - 2-3 bullets about what makes it unique",
    "",
    "EXAMPLE FORMAT:",
    "**Main Message**",
    "Never drink cold coffee again",
    "",
    "**What Is It**",
    "- Self-warming travel mug for busy professionals",
    "- Keeps beverages at perfect temperature for 8 hours",
    "- No power source needed",
    "",
    "**Who It's For**",
    "- Working professionals who hate cold coffee",
    "",
    "**Unique Product Benefits**",
    "- Connects to phone via Bluetooth",
    "- Sends appointment reminders when you pick it up",
    "- Smart technology meets morning routine",
    "",
    "Respond with valid JSON:",
    "{",
    '  "productName": string (realistic 2-4 word brand),',
    '  "productCategory": "' + category + '",',
    '  "briefContent": string (bulleted with **bold** subheadings)',
    "}",
    "",
    "Make it believable and specific. Do not wrap JSON in markdown fences.",
  ].join("\n")
}
