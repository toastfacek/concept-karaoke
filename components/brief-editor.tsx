"use client"

import { useState } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"

interface CampaignBrief {
  productName: string
  productCategory: string
  businessProblem: string
  targetAudience: string
  objective: string
}

interface BriefEditorProps {
  initialBrief?: CampaignBrief
  onRegenerate?: () => void
  onLock?: (brief: CampaignBrief) => void
  isLocked?: boolean
}

export function BriefEditor({ initialBrief, onRegenerate, onLock, isLocked = false }: BriefEditorProps) {
  const [brief, setBrief] = useState<CampaignBrief>(
    initialBrief || {
      productName: "",
      productCategory: "",
      businessProblem: "",
      targetAudience: "",
      objective: "",
    },
  )

  const updateField = (field: keyof CampaignBrief, value: string) => {
    setBrief((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="retro-border space-y-6 bg-card p-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Campaign Brief</h2>
        {!isLocked && (
          <Button variant="outline" onClick={onRegenerate}>
            Regenerate Brief
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="productName">Product Name</Label>
          <Input
            id="productName"
            value={brief.productName}
            onChange={(e) => updateField("productName", e.target.value)}
            disabled={isLocked}
            placeholder="e.g., SnoozeButton Pro"
          />
        </div>

        <div>
          <Label htmlFor="productCategory">Product Category</Label>
          <Input
            id="productCategory"
            value={brief.productCategory}
            onChange={(e) => updateField("productCategory", e.target.value)}
            disabled={isLocked}
            placeholder="e.g., Smart Home Device"
          />
        </div>

        <div>
          <Label htmlFor="businessProblem">Business Problem</Label>
          <Textarea
            id="businessProblem"
            value={brief.businessProblem}
            onChange={(e) => updateField("businessProblem", e.target.value)}
            disabled={isLocked}
            placeholder="What challenge does this product solve?"
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="targetAudience">Target Audience</Label>
          <Input
            id="targetAudience"
            value={brief.targetAudience}
            onChange={(e) => updateField("targetAudience", e.target.value)}
            disabled={isLocked}
            placeholder="e.g., Busy professionals aged 25-40"
          />
        </div>

        <div>
          <Label htmlFor="objective">Campaign Objective</Label>
          <Textarea
            id="objective"
            value={brief.objective}
            onChange={(e) => updateField("objective", e.target.value)}
            disabled={isLocked}
            placeholder="What should this campaign achieve?"
            rows={3}
          />
        </div>
      </div>

      {!isLocked && (
        <Button className="w-full" size="lg" onClick={() => onLock?.(brief)}>
          Lock Brief & Start
        </Button>
      )}
    </div>
  )
}
