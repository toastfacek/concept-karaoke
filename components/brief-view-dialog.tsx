"use client"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { CampaignBrief } from "@/lib/types"

interface BriefViewDialogProps {
  brief: CampaignBrief | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function BriefViewDialog({ brief, isOpen, onOpenChange }: BriefViewDialogProps) {
  if (!brief) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>Campaign Brief</DialogTitle>
          <div className="py-8 text-center">
            <p className="font-mono text-muted-foreground">No brief available for this game.</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogTitle className="text-lg font-bold">{brief.productName}</DialogTitle>

        <div className="space-y-6">
          {/* Two-column layout: Image on left, Content on right */}
          <div className="grid gap-6 md:grid-cols-[1fr,2fr]">
            {/* Left Column - Product Image */}
            <div>
              {brief.coverImageUrl ? (
                <div className="overflow-hidden rounded border-2 border-border">
                  <img
                    src={brief.coverImageUrl}
                    alt={brief.productName}
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
                <h4 className="font-mono text-xs font-bold uppercase text-muted-foreground">
                  Product Category
                </h4>
                <p className="text-sm leading-relaxed">{brief.productCategory}</p>
              </div>
            </div>

            {/* Right Column - Brief Content */}
            <div className="space-y-4">
              {brief.briefContent ? (
                renderBriefContent(brief.briefContent)
              ) : (
                <p className="text-sm text-muted-foreground">
                  No brief content available.
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
