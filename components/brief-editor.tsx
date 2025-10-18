"use client"

import { useEffect, useState } from "react"

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
  onChange?: (brief: CampaignBrief) => void
  onSave?: (brief: CampaignBrief) => void
  onLock?: (brief: CampaignBrief) => void
  onRegenerate?: () => void
  isLocked?: boolean
  isSaving?: boolean
  isLocking?: boolean
}

export function BriefEditor({
  initialBrief,
  onChange,
  onSave,
  onLock,
  onRegenerate,
  isLocked = false,
  isSaving = false,
  isLocking = false,
}: BriefEditorProps) {
  const [brief, setBrief] = useState<CampaignBrief>({
    productName: "",
    productCategory: "",
    businessProblem: "",
    targetAudience: "",
    objective: "",
  })

  useEffect(() => {
    if (initialBrief) {
      setBrief(initialBrief)
    }
  }, [initialBrief])

  const updateField = (field: keyof CampaignBrief, value: string) => {
    setBrief((previous) => {
      const updated = { ...previous, [field]: value }
      onChange?.(updated)
      return updated
    })
  }

  return (
    <div className="retro-border space-y-6 bg-card p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-3xl font-bold">Campaign Brief</h2>
        {!isLocked && (
          <Button type="button" variant="outline" onClick={onRegenerate}>
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
            onChange={(event) => updateField("productName", event.target.value)}
            disabled={isLocked}
            placeholder="e.g., SnoozeButton Pro"
          />
        </div>

        <div>
          <Label htmlFor="productCategory">Product Category</Label>
          <Input
            id="productCategory"
            value={brief.productCategory}
            onChange={(event) => updateField("productCategory", event.target.value)}
            disabled={isLocked}
            placeholder="e.g., Smart Home Device"
          />
        </div>

        <div>
          <Label htmlFor="businessProblem">Business Problem</Label>
          <Textarea
            id="businessProblem"
            value={brief.businessProblem}
            onChange={(event) => updateField("businessProblem", event.target.value)}
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
            onChange={(event) => updateField("targetAudience", event.target.value)}
            disabled={isLocked}
            placeholder="e.g., Busy professionals aged 25-40"
          />
        </div>

        <div>
          <Label htmlFor="objective">Campaign Objective</Label>
          <Textarea
            id="objective"
            value={brief.objective}
            onChange={(event) => updateField("objective", event.target.value)}
            disabled={isLocked}
            placeholder="What should this campaign achieve?"
            rows={3}
          />
        </div>
      </div>

      {!isLocked && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            className="w-full sm:w-auto"
            size="lg"
            onClick={() => onSave?.(brief)}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Brief"}
          </Button>
          {onLock && (
            <Button
              type="button"
              className="w-full sm:w-auto"
              size="lg"
              variant="secondary"
              onClick={() => onLock(brief)}
              disabled={isLocking}
            >
              {isLocking ? "Locking..." : "Lock Brief"}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
