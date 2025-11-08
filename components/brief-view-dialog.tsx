"use client"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

interface CampaignBrief {
  productName: string
  productCategory: string
  coverImageUrl?: string
  mainPoint: string
  audience: string
  businessProblem: string
  objective: string
  strategy: string
  productFeatures: string
}

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
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogTitle className="text-3xl font-bold uppercase">Campaign Brief</DialogTitle>

        <div className="space-y-6">
          {/* Product Name */}
          <div>
            <h3 className="mb-2 text-2xl font-bold">{brief.productName}</h3>
            <Badge variant="secondary" className="text-sm">
              {brief.productCategory}
            </Badge>
          </div>

          {/* Cover Image */}
          {brief.coverImageUrl && (
            <div className="overflow-hidden rounded border-2 border-border">
              <img
                src={brief.coverImageUrl}
                alt={brief.productName}
                className="w-full h-auto"
              />
            </div>
          )}

          {/* The Main Point */}
          <div className="space-y-2">
            <h4 className="font-mono text-sm font-bold uppercase text-muted-foreground">
              The Main Point
            </h4>
            <p className="text-sm leading-relaxed font-medium">{brief.mainPoint}</p>
          </div>

          {/* Audience */}
          <div className="space-y-2">
            <h4 className="font-mono text-sm font-bold uppercase text-muted-foreground">
              Audience
            </h4>
            <p className="whitespace-pre-line text-sm leading-relaxed">{brief.audience}</p>
          </div>

          {/* Business Problem */}
          <div className="space-y-2">
            <h4 className="font-mono text-sm font-bold uppercase text-muted-foreground">
              Business Problem
            </h4>
            <p className="whitespace-pre-line text-sm leading-relaxed">{brief.businessProblem}</p>
          </div>

          {/* Campaign Objective */}
          <div className="space-y-2">
            <h4 className="font-mono text-sm font-bold uppercase text-muted-foreground">
              Objective
            </h4>
            <p className="text-sm leading-relaxed">{brief.objective}</p>
          </div>

          {/* Strategy */}
          <div className="space-y-2">
            <h4 className="font-mono text-sm font-bold uppercase text-muted-foreground">
              Strategy
            </h4>
            <p className="text-sm leading-relaxed">{brief.strategy}</p>
          </div>

          {/* Product Features */}
          <div className="space-y-2">
            <h4 className="font-mono text-sm font-bold uppercase text-muted-foreground">
              Product Features
            </h4>
            <p className="whitespace-pre-line text-sm leading-relaxed">{brief.productFeatures}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
