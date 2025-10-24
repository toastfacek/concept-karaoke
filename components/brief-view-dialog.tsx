"use client"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

interface CampaignBrief {
  productName: string
  productCategory: string
  businessProblem: string
  targetAudience: string
  objective: string
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

          {/* Business Problem */}
          <div className="space-y-2">
            <h4 className="font-mono text-sm font-bold uppercase text-muted-foreground">
              Business Problem
            </h4>
            <p className="text-sm leading-relaxed">{brief.businessProblem}</p>
          </div>

          {/* Target Audience */}
          <div className="space-y-2">
            <h4 className="font-mono text-sm font-bold uppercase text-muted-foreground">
              Target Audience
            </h4>
            <p className="text-sm leading-relaxed">{brief.targetAudience}</p>
          </div>

          {/* Campaign Objective */}
          <div className="space-y-2">
            <h4 className="font-mono text-sm font-bold uppercase text-muted-foreground">
              Campaign Objective
            </h4>
            <p className="text-sm leading-relaxed">{brief.objective}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
