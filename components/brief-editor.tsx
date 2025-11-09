"use client"

import { useEffect, useState } from "react"
import { Pencil } from "lucide-react"

import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import type { CampaignBrief } from "@/lib/types"

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

  const parseBullets = (text: string): string[] => {
    if (!text) return []
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  }

  const renderField = (
    field: EditableField,
    label: string,
    value: string,
    multiline: boolean = false,
    showBullets: boolean = false,
  ) => {
    const isEditing = editingField === field

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</h3>
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
        ) : showBullets && value ? (
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
            {parseBullets(value).map((bullet, idx) => (
              <li key={idx}>{bullet}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-relaxed">
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
        <h2 className="text-3xl font-bold text-purple-600 dark:text-purple-400">
          {brief.productName || "Campaign Brief"}
        </h2>
        {!isLocked && (
          <Button type="button" variant="outline" onClick={onRegenerate}>
            Regenerate Brief
          </Button>
        )}
      </div>

      {/* Two-column layout: Image on left, Product info on right */}
      <div className="grid gap-6 md:grid-cols-[1fr,1fr]">
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

        {/* Right Column - Product Name, Category, Main Point, Audience */}
        <div className="space-y-4">
          {/* Product Name - Large heading */}
          <div className="space-y-2">
            {editingField === "productName" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-mono text-xs font-bold uppercase text-muted-foreground">
                    Product Name
                  </h3>
                </div>
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="text-2xl font-bold"
                  autoFocus
                />
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
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {brief.productName || (
                      <span className="text-muted-foreground">&lt;Product Name&gt;</span>
                    )}
                  </h3>
                  {!isLocked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing("productName")}
                      className="gap-2"
                    >
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Product Category - Read-only */}
          <div className="space-y-1">
            <h3 className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Product Category
            </h3>
            <p className="text-sm leading-relaxed">
              {brief.productCategory || <span className="text-muted-foreground">Not set</span>}
            </p>
          </div>

          {/* The Main Point */}
          {renderField("mainPoint", "The Main Point", brief.mainPoint, false, false)}

          {/* Audience */}
          {renderField("audience", "Audience", brief.audience, true, true)}
        </div>
      </div>

      {/* Bottom Grid - Business Problem, Objective, Strategy, Product Features */}
      <div className="grid gap-6 md:grid-cols-2">
        {renderField("businessProblem", "Business Problem", brief.businessProblem, true, true)}
        {renderField("objective", "Objective", brief.objective, true, false)}
        {renderField("strategy", "Strategy", brief.strategy, true, false)}
        {renderField("productFeatures", "Product Features", brief.productFeatures, true, true)}
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
