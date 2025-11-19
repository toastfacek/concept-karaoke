"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PRODUCT_CATEGORIES, WACKY_BRIEF_STYLES, type WackyBriefStyle } from "@/lib/types"

// Inline prompt generation (no DB schema)
function getWackyStyleInstructions(style: WackyBriefStyle) {
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

function generatePrompt(category: string, wackyStyle: WackyBriefStyle): string {
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
    "- productName: Realistic-sounding brand name (2-4 words) like 'Hearthco Mug' or 'Nimbus Chair' - NO PUNS",
    "- productDescription: ONE sentence, ~10 words max. What is it? Must be a FAMILIAR product form.",
    "- audience: ONE phrase, ~8 words max. Who's it for?",
    "- uniqueBenefit: ONE sentence, ~12 words max. " + styleInstructions.benefitGuidance,
    "- mainMessage: ONE phrase, ~6 words max. " + styleInstructions.messageGuidance,
    "",
    styleInstructions.examples,
    "",
    "WHY IT'S FUNNY:",
    styleInstructions.whyFunny,
    "",
    "TONE: Deadpan corporate. Never wink at the joke. Treat the absurdity as completely normal.",
    "Make it weird and memorable, but keep it SHORT. Do not wrap the JSON in markdown fences.",
  ].join("\n")
}

export default function TestPromptsPage() {
  const [category, setCategory] = useState("Consumer Electronics")
  const [expandedStyle, setExpandedStyle] = useState<WackyBriefStyle | null>(null)

  const styleLabels: Record<WackyBriefStyle, string> = {
    absurd_constraints: "Absurd Constraints",
    genre_mashups: "Genre Mashups",
    unnecessary_solutions: "Unnecessary Solutions",
    conflicting_elements: "Conflicting Elements",
  }

  const styleDescriptions: Record<WackyBriefStyle, string> = {
    absurd_constraints: "Normal product with one impossible requirement",
    genre_mashups: "Two incompatible categories fused together",
    unnecessary_solutions: "Over-engineered fix for a non-problem",
    conflicting_elements: "Product with self-defeating feature",
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Prompt Test Page</h1>
          <p className="text-muted-foreground">
            View all 4 wacky brief prompts side-by-side
          </p>
        </div>

        <div className="flex items-center gap-4">
          <label className="font-mono text-sm uppercase">Category:</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_CATEGORIES.filter(c => c !== "All").map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {WACKY_BRIEF_STYLES.map((style) => {
            const prompt = generatePrompt(category, style)
            const isExpanded = expandedStyle === style

            return (
              <div
                key={style}
                className="border rounded-lg p-4 space-y-3 bg-card"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold">{styleLabels[style]}</h2>
                    <p className="text-sm text-muted-foreground">
                      {styleDescriptions[style]}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedStyle(isExpanded ? null : style)}
                  >
                    {isExpanded ? "Collapse" : "Expand"}
                  </Button>
                </div>

                <div
                  className={`font-mono text-xs bg-muted p-3 rounded overflow-auto ${
                    isExpanded ? "max-h-none" : "max-h-64"
                  }`}
                >
                  <pre className="whitespace-pre-wrap">{prompt}</pre>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{prompt.length} characters</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(prompt)}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
