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

  // Parse brief content into sections with bullets
  const renderBriefContent = (content: string) => {
    if (!content) return null

    // Split into sections by double newlines
    const sections = content.split("\n\n").filter(s => s.trim())

    return sections.map((section, sectionIndex) => {
      const lines = section.split("\n").filter(l => l.trim())

      // First line is usually the bold header
      const header = lines[0]
      const contentLines = lines.slice(1)

      // Check if this section has bullets (lines starting with "- ")
      const hasBullets = contentLines.some(line => line.trim().startsWith("- "))

      if (hasBullets) {
        // Render as header + bullet list
        return (
          <div key={sectionIndex} className="space-y-2">
            <div className="text-sm font-semibold leading-relaxed">
              {renderMarkdownBold(header)}
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm leading-relaxed">
              {contentLines.map((line, lineIndex) => {
                const bulletText = line.trim().replace(/^- /, "")
                return bulletText ? (
                  <li key={lineIndex}>{bulletText}</li>
                ) : null
              })}
            </ul>
          </div>
        )
      } else if (contentLines.length > 0) {
        // Render as header + content text (for Main Message single phrase)
        return (
          <div key={sectionIndex} className="space-y-2">
            <div className="text-sm font-semibold leading-relaxed">
              {renderMarkdownBold(header)}
            </div>
            <div className="text-sm leading-relaxed">
              {contentLines.map((line, idx) => (
                <span key={idx}>{line}</span>
              ))}
            </div>
          </div>
        )
      } else {
        // Single line (header only) - render as paragraph
        return (
          <p key={sectionIndex} className="text-sm leading-relaxed">
            {renderMarkdownBold(section)}
          </p>
        )
      }
    })
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
        <div>
          <h2 className="text-3xl font-bold text-foreground">
            {brief.productName || "Campaign Brief"}
          </h2>
          {brief.productCategory && brief.productCategory !== "All" && (
            <p className="mt-1 text-sm text-muted-foreground">
              {brief.productCategory}
            </p>
          )}
        </div>
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
