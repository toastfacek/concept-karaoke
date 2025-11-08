"use client"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { CampaignBrief } from "@/lib/types"

interface BriefViewDialogProps {
  brief: CampaignBrief | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function BriefViewDialog({ brief, isOpen, onOpenChange }: BriefViewDialogProps) {
  const parseBullets = (text: string): string[] => {
    if (!text) return []
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  }

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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogTitle className="text-lg font-bold">Campaign Brief</DialogTitle>

        <div className="space-y-6">
          {/* Two-column layout: Image on left, Product info on right */}
          <div className="grid gap-6 md:grid-cols-[1fr,1fr]">
            {/* Left Column - Product Image */}
            <div className="space-y-2">
              <h4 className="font-mono text-xs font-bold uppercase text-muted-foreground">
                Product Image
              </h4>
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
            </div>

            {/* Right Column - Product Name, Category, Main Point, Audience */}
            <div className="space-y-4">
              {/* Product Name */}
              <div>
                <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {brief.productName}
                </h3>
              </div>

              {/* Product Category */}
              <div className="space-y-1">
                <h4 className="font-mono text-xs font-bold uppercase text-muted-foreground">
                  Product Category
                </h4>
                <p className="text-sm leading-relaxed">{brief.productCategory}</p>
              </div>

              {/* The Main Point */}
              <div className="space-y-2">
                <h4 className="font-mono text-xs font-bold uppercase text-muted-foreground">
                  The Main Point
                </h4>
                <p className="text-sm font-medium leading-relaxed">{brief.mainPoint}</p>
              </div>

              {/* Audience */}
              <div className="space-y-2">
                <h4 className="font-mono text-xs font-bold uppercase text-muted-foreground">
                  Audience
                </h4>
                {parseBullets(brief.audience).length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                    {parseBullets(brief.audience).map((bullet, idx) => (
                      <li key={idx}>{bullet}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm leading-relaxed">{brief.audience}</p>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Grid - Business Problem, Objective, Strategy, Product Features */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Business Problem */}
            <div className="space-y-2">
              <h4 className="font-mono text-xs font-bold uppercase text-muted-foreground">
                Business Problem
              </h4>
              {parseBullets(brief.businessProblem).length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                  {parseBullets(brief.businessProblem).map((bullet, idx) => (
                    <li key={idx}>{bullet}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-relaxed">{brief.businessProblem}</p>
              )}
            </div>

            {/* Campaign Objective */}
            <div className="space-y-2">
              <h4 className="font-mono text-xs font-bold uppercase text-muted-foreground">
                Objective
              </h4>
              <p className="text-sm leading-relaxed">{brief.objective}</p>
            </div>

            {/* Strategy */}
            <div className="space-y-2">
              <h4 className="font-mono text-xs font-bold uppercase text-muted-foreground">
                Strategy
              </h4>
              <p className="text-sm leading-relaxed">{brief.strategy}</p>
            </div>

            {/* Product Features */}
            <div className="space-y-2">
              <h4 className="font-mono text-xs font-bold uppercase text-muted-foreground">
                Product Features
              </h4>
              {parseBullets(brief.productFeatures).length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                  {parseBullets(brief.productFeatures).map((bullet, idx) => (
                    <li key={idx}>{bullet}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-relaxed">{brief.productFeatures}</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
