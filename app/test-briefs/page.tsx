"use client"

import { useState } from "react"
import { BriefEditor } from "@/components/brief-editor"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { PRODUCT_CATEGORIES, type ProductCategory } from "@/lib/types"

interface CampaignBrief {
  productName: string
  productCategory: string
  businessProblem: string
  targetAudience: string
  objective: string
}

type ModelProvider = "gemini-2.5-flash" | "gemini-2.0-flash-exp" | "gpt-4o" | "claude-3-5-sonnet"

const MODEL_OPTIONS: { value: ModelProvider; label: string }[] = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Current)" },
  { value: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash Exp" },
  { value: "gpt-4o", label: "GPT-4o (OpenAI)" },
  { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet (Anthropic)" },
]

export default function TestBriefsPage() {
  const [brief, setBrief] = useState<CampaignBrief | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>("All")
  const [selectedModel, setSelectedModel] = useState<ModelProvider>("gemini-2.5-flash")
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generationTime, setGenerationTime] = useState<number | null>(null)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)
    setGenerationTime(null)

    const startTime = performance.now()

    try {
      const response = await fetch("/api/test-briefs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory,
          model: selectedModel,
        }),
      })

      const endTime = performance.now()
      setGenerationTime(Math.round(endTime - startTime))

      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to generate brief")
      }

      setBrief(payload.brief)
    } catch (err) {
      console.error("Failed to generate brief", err)
      setError(err instanceof Error ? err.message : "Failed to generate brief")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="retro-border bg-card p-6">
          <h1 className="text-3xl font-bold uppercase">Brief Generation Testing Suite</h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            Test and compare different AI models for brief generation quality
          </p>
        </div>

        {/* Controls */}
        <div className="retro-border bg-card p-6 space-y-6">
          <h2 className="text-xl font-bold uppercase">Configuration</h2>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Product Category Selector */}
            <div className="space-y-2">
              <Label htmlFor="category" className="font-mono text-sm uppercase">
                Product Category
              </Label>
              <Select
                value={selectedCategory}
                onValueChange={(value) => setSelectedCategory(value as ProductCategory)}
              >
                <SelectTrigger id="category" className="retro-border">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model Selector */}
            <div className="space-y-2">
              <Label htmlFor="model" className="font-mono text-sm uppercase">
                AI Model
              </Label>
              <Select
                value={selectedModel}
                onValueChange={(value) => setSelectedModel(value as ModelProvider)}
              >
                <SelectTrigger id="model" className="retro-border">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex items-center gap-4">
            <Button
              type="button"
              size="lg"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-8"
            >
              {isGenerating ? "Generating..." : "Generate Brief"}
            </Button>

            {generationTime && (
              <p className="font-mono text-sm text-muted-foreground">
                Generated in {generationTime}ms
              </p>
            )}
          </div>

          {error && (
            <div className="retro-border bg-destructive p-4 text-destructive-foreground">
              <p className="font-mono text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Brief Display */}
        {brief && (
          <BriefEditor
            initialBrief={brief}
            onChange={setBrief}
            showReveal={true}
          />
        )}

        {/* Documentation */}
        <div className="retro-border bg-card p-6 space-y-4">
          <h2 className="text-xl font-bold uppercase">Evaluation Criteria</h2>
          <div className="space-y-3 font-mono text-sm">
            <div>
              <h3 className="font-bold text-foreground">Quality Factors:</h3>
              <ul className="ml-4 mt-1 list-disc space-y-1 text-muted-foreground">
                <li>Creativity and originality of product name</li>
                <li>Clarity of business problem</li>
                <li>Specificity of target audience</li>
                <li>Actionability of campaign objective</li>
                <li>Overall coherence and playfulness</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-foreground">Technical Metrics:</h3>
              <ul className="ml-4 mt-1 list-disc space-y-1 text-muted-foreground">
                <li>Generation time (ms)</li>
                <li>JSON parsing success rate</li>
                <li>Field completeness</li>
                <li>Category accuracy</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
