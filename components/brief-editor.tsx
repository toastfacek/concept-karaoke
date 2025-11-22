"use client"

import { useEffect, useState } from "react"

import { Button } from "./ui/button"
import type { CampaignBrief } from "@/lib/types"

interface BriefEditorProps {
  initialBrief?: CampaignBrief
  onRegenerate?: () => void
  isRegenerating?: boolean
  showReveal?: boolean
}

export function BriefEditor({
  initialBrief,
  onRegenerate,
  isRegenerating = false,
  showReveal = false,
}: BriefEditorProps) {
  const [brief, setBrief] = useState<CampaignBrief>({
    productName: "",
    productCategory: "",
    briefContent: "",
  })

  useEffect(() => {
    if (initialBrief) {
      setBrief(initialBrief)
    }
  }, [initialBrief])

  // Helper function to render markdown bold text
  const renderMarkdownBold = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/)
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-bold text-foreground">
            {part.slice(2, -2)}
          </strong>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  // Parse brief content into paragraphs
  const renderBriefContent = (content: string) => {
    if (!content) return null

    const paragraphs = content.split("\n\n").filter(p => p.trim())

    return paragraphs.map((paragraph, i) => (
      <p key={i} className="text-sm leading-relaxed">
        {renderMarkdownBold(paragraph)}
      </p>
    ))
  }

  return (
    <div
      className={`retro-border space-y-6 bg-card p-8 transition-all duration-700 ${
        showReveal
          ? "animate-in fade-in slide-in-from-bottom-4 zoom-in-95"
          : ""
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-3xl font-bold text-purple-600 dark:text-purple-400">
          {brief.productName || "Campaign Brief"}
        </h2>
        <Button
          type="button"
          variant="outline"
          onClick={onRegenerate}
          disabled={isRegenerating}
        >
          {isRegenerating ? "Regenerating..." : "Regenerate Brief"}
        </Button>
      </div>

      {/* Two-column layout: Image on left, Content on right */}
      <div className="grid gap-6 md:grid-cols-[1fr,2fr]">
        {/* Left Column - Product Image */}
        <div>
          {brief.coverImageUrl ? (
            <div className="overflow-hidden rounded border-2 border-border">
              <img
                src={brief.coverImageUrl}
                alt={brief.productName || "Product"}
                className="h-auto w-full"
              />
            </div>
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded border-2 border-border bg-gradient-to-br from-muted/30 to-muted/10 bg-[length:10px_10px] [background-image:repeating-linear-gradient(45deg,transparent,transparent_5px,hsl(var(--muted))_5px,hsl(var(--muted))_6px)]">
              <span className="font-mono text-sm uppercase tracking-wider text-muted-foreground/50">
                &lt;Product Image&gt;
              </span>
            </div>
          )}

          {/* Product Category below image */}
          <div className="mt-4 space-y-1">
            <h3 className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Product Category
            </h3>
            <p className="text-sm leading-relaxed">
              {brief.productCategory || <span className="text-muted-foreground">Not set</span>}
            </p>
          </div>
        </div>

        {/* Right Column - Brief Content */}
        <div className="space-y-4">
          {brief.briefContent ? (
            renderBriefContent(brief.briefContent)
          ) : (
            <p className="text-sm text-muted-foreground">
              No brief content yet. Click "Regenerate Brief" to generate one.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
