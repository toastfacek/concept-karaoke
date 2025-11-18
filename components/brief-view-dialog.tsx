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

            {/* Right Column - Product Name, Category, Description, Audience */}
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

              {/* What Is It */}
              <div className="space-y-2">
                <h4 className="font-mono text-xs font-bold uppercase text-muted-foreground">
                  What Is It
                </h4>
                <p className="text-sm leading-relaxed">{brief.productDescription}</p>
              </div>

              {/* Who Is It For */}
              <div className="space-y-2">
                <h4 className="font-mono text-xs font-bold uppercase text-muted-foreground">
                  Who Is It For
                </h4>
                <p className="text-sm leading-relaxed">{brief.audience}</p>
              </div>
            </div>
          </div>

          {/* Bottom Row - Unique Benefit and Main Message */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Unique Benefit */}
            <div className="space-y-2">
              <h4 className="font-mono text-xs font-bold uppercase text-muted-foreground">
                Unique Benefit
              </h4>
              <p className="text-sm leading-relaxed">{brief.uniqueBenefit}</p>
            </div>

            {/* Main Message */}
            <div className="space-y-2">
              <h4 className="font-mono text-xs font-bold uppercase text-muted-foreground">
                Main Message
              </h4>
              <p className="text-sm font-medium leading-relaxed">{brief.mainMessage}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
