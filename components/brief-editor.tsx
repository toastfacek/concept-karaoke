"use client"

import { useEffect, useState } from "react"
import { Pencil } from "lucide-react"

import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"

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

interface BriefEditorProps {
  initialBrief?: CampaignBrief
  onChange?: (brief: CampaignBrief) => void
  onLock?: (brief: CampaignBrief) => void
  onRegenerate?: () => void
  isLocked?: boolean
  isLocking?: boolean
  showReveal?: boolean
}

type EditableField = "productName" | "mainPoint" | "audience" | "businessProblem" | "objective" | "strategy" | "productFeatures"

export function BriefEditor({
  initialBrief,
  onChange,
  onLock,
  onRegenerate,
  isLocked = false,
  isLocking = false,
  showReveal = false,
}: BriefEditorProps) {
  const [brief, setBrief] = useState<CampaignBrief>({
    productName: "",
    productCategory: "",
    mainPoint: "",
    audience: "",
    businessProblem: "",
    objective: "",
    strategy: "",
    productFeatures: "",
  })
  const [editingField, setEditingField] = useState<EditableField | null>(null)
  const [editValue, setEditValue] = useState("")

  useEffect(() => {
    if (initialBrief) {
      setBrief(initialBrief)
    }
  }, [initialBrief])

  const startEditing = (field: EditableField) => {
    if (isLocked) return
    setEditingField(field)
    setEditValue(brief[field] ?? "")
  }

  const cancelEditing = () => {
    setEditingField(null)
    setEditValue("")
  }

  const saveField = () => {
    if (editingField) {
      const updated = { ...brief, [editingField]: editValue }
      setBrief(updated)
      onChange?.(updated)
      setEditingField(null)
      setEditValue("")
    }
  }

  const renderField = (
    field: EditableField,
    label: string,
    value: string,
    multiline: boolean = false,
  ) => {
    const isEditing = editingField === field

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-xs font-bold uppercase text-muted-foreground">{label}</h3>
          {!isLocked && !isEditing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => startEditing(field)}
              className="gap-2"
            >
              <Pencil className="size-4" />
              Edit
            </Button>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-2">
            {multiline ? (
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={3}
                className="font-mono"
                autoFocus
              />
            ) : (
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="font-mono"
                autoFocus
              />
            )}
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={saveField}>
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={cancelEditing}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
            {value || <span className="text-muted-foreground">Not set</span>}
          </p>
        )}
      </div>
    )
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
        <h2 className="text-lg font-bold">Campaign Brief</h2>
        {!isLocked && (
          <Button type="button" variant="outline" onClick={onRegenerate}>
            Regenerate Brief
          </Button>
        )}
      </div>

      <div className="space-y-6">
        {/* Cover Image */}
        {brief.coverImageUrl && (
          <div className="space-y-2">
            <h3 className="font-mono text-xs font-bold uppercase text-muted-foreground">
              Product Image
            </h3>
            <div className="overflow-hidden rounded border-2 border-border">
              <img
                src={brief.coverImageUrl}
                alt={brief.productName || "Product"}
                className="w-full h-auto"
              />
            </div>
          </div>
        )}

        {renderField("productName", "Product Name", brief.productName)}

        {/* Product Category is read-only and comes from game settings */}
        <div className="space-y-2">
          <h3 className="font-mono text-xs font-bold uppercase text-muted-foreground">Product Category</h3>
          <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
            {brief.productCategory || <span className="text-muted-foreground">Not set</span>}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            (Set from game settings)
          </p>
        </div>

        {renderField("mainPoint", "The Main Point", brief.mainPoint)}

        {renderField("audience", "Audience", brief.audience, true)}

        {renderField("businessProblem", "Business Problem", brief.businessProblem, true)}

        {renderField("objective", "Objective", brief.objective, true)}

        {renderField("strategy", "Strategy", brief.strategy, true)}

        {renderField("productFeatures", "Product Features", brief.productFeatures, true)}
      </div>

      {!isLocked && onLock && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            className="w-full sm:w-auto"
            size="lg"
            onClick={() => onLock(brief)}
            disabled={isLocking}
          >
            {isLocking ? "Locking..." : "Lock Brief"}
          </Button>
        </div>
      )}
    </div>
  )
}
