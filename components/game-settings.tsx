"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { PRODUCT_CATEGORIES, PHASE_DURATIONS, BRIEF_STYLES, WACKY_BRIEF_STYLES, type ProductCategory, type PhaseDuration, type BriefStyle, type WackyBriefStyle } from "@/lib/types"

interface GameSettingsProps {
  productCategory: ProductCategory
  phaseDurationSeconds: PhaseDuration
  briefStyle: BriefStyle
  wackyBriefStyle: WackyBriefStyle
  isHost: boolean
  roomCode: string
  playerId: string
  onSettingsChange?: (settings: { productCategory: ProductCategory; phaseDurationSeconds: PhaseDuration; briefStyle: BriefStyle; wackyBriefStyle: WackyBriefStyle }) => void
}

const DURATION_LABELS: Record<PhaseDuration, string> = {
  30: "30 seconds",
  60: "60 seconds",
  90: "90 seconds",
  120: "2 minutes",
}

const BRIEF_STYLE_LABELS: Record<BriefStyle, string> = {
  wacky: "Wacky",
  realistic: "Realistic",
}

const BRIEF_STYLE_DESCRIPTIONS: Record<BriefStyle, string> = {
  wacky: "Absurd, specific, and hilarious products",
  realistic: "Professional, strategic campaigns",
}

const WACKY_STYLE_LABELS: Record<WackyBriefStyle, string> = {
  absurd_constraints: "Absurd Constraints",
  genre_mashups: "Genre Mashups",
  unnecessary_solutions: "Unnecessary Solutions",
  conflicting_elements: "Conflicting Elements",
}

const WACKY_STYLE_DESCRIPTIONS: Record<WackyBriefStyle, string> = {
  absurd_constraints: "Wild limitations that make no sense",
  genre_mashups: "Mix unexpected genres together",
  unnecessary_solutions: "Solve problems that don't exist",
  conflicting_elements: "Combine contradictory features",
}

export function GameSettings({
  productCategory,
  phaseDurationSeconds,
  briefStyle,
  wackyBriefStyle,
  isHost,
  roomCode,
  playerId,
  onSettingsChange,
}: GameSettingsProps) {
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>(productCategory)
  const [selectedDuration, setSelectedDuration] = useState<PhaseDuration>(phaseDurationSeconds)
  const [selectedBriefStyle, setSelectedBriefStyle] = useState<BriefStyle>(briefStyle)
  const [selectedWackyStyle, setSelectedWackyStyle] = useState<WackyBriefStyle>(wackyBriefStyle)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasChanges = selectedCategory !== productCategory || selectedDuration !== phaseDurationSeconds || selectedBriefStyle !== briefStyle || selectedWackyStyle !== wackyBriefStyle

  const handleSave = async () => {
    if (!hasChanges) return

    setIsUpdating(true)
    setError(null)

    try {
      const response = await fetch(`/api/games/${roomCode}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productCategory: selectedCategory,
          phaseDurationSeconds: selectedDuration,
          briefStyle: selectedBriefStyle,
          wackyBriefStyle: selectedWackyStyle,
          playerId,
        }),
      })

      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to update settings")
      }

      onSettingsChange?.({
        productCategory: payload.settings.productCategory,
        phaseDurationSeconds: payload.settings.phaseDurationSeconds,
        briefStyle: payload.settings.briefStyle,
        wackyBriefStyle: payload.settings.wackyBriefStyle,
      })
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Failed to update settings")
      // Revert to original values on error
      setSelectedCategory(productCategory)
      setSelectedDuration(phaseDurationSeconds)
      setSelectedBriefStyle(briefStyle)
      setSelectedWackyStyle(wackyBriefStyle)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleReset = () => {
    setSelectedCategory(productCategory)
    setSelectedDuration(phaseDurationSeconds)
    setSelectedBriefStyle(briefStyle)
    setSelectedWackyStyle(wackyBriefStyle)
    setError(null)
  }

  return (
    <div className="retro-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold uppercase">Game Settings</h2>
        {!isHost && <p className="font-mono text-xs uppercase text-muted-foreground">Host Only</p>}
      </div>

      {error && <p className="font-mono text-sm font-medium text-destructive">{error}</p>}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="brief-style" className="font-mono text-sm uppercase">
            Brief Style
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {BRIEF_STYLES.map((style) => (
              <Button
                key={style}
                type="button"
                variant={selectedBriefStyle === style ? "default" : "outline"}
                className="retro-border flex flex-col items-start h-auto py-3"
                onClick={() => setSelectedBriefStyle(style)}
                disabled={!isHost || isUpdating}
              >
                <span className="font-bold">{BRIEF_STYLE_LABELS[style]}</span>
                <span className="text-xs font-normal opacity-80">{BRIEF_STYLE_DESCRIPTIONS[style]}</span>
              </Button>
            ))}
          </div>

          {/* Wacky Sub-Style Selector */}
          {selectedBriefStyle === "wacky" && (
            <div className="mt-3 space-y-2">
              <Label className="font-mono text-xs uppercase text-muted-foreground">
                Wacky Style
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {WACKY_BRIEF_STYLES.map((style) => (
                  <Button
                    key={style}
                    type="button"
                    variant={selectedWackyStyle === style ? "secondary" : "ghost"}
                    className="retro-border flex flex-col items-start h-auto py-2 text-left"
                    onClick={() => setSelectedWackyStyle(style)}
                    disabled={!isHost || isUpdating}
                  >
                    <span className="text-sm font-semibold">{WACKY_STYLE_LABELS[style]}</span>
                    <span className="text-xs font-normal opacity-70">{WACKY_STYLE_DESCRIPTIONS[style]}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-category" className="font-mono text-sm uppercase">
            Product Category
          </Label>
          <Select
            value={selectedCategory}
            onValueChange={(value) => setSelectedCategory(value as ProductCategory)}
            disabled={!isHost || isUpdating}
          >
            <SelectTrigger id="product-category" className="retro-border">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phase-duration" className="font-mono text-sm uppercase">
            Round Length
          </Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PHASE_DURATIONS.map((duration) => (
              <Button
                key={duration}
                type="button"
                variant={selectedDuration === duration ? "default" : "outline"}
                className="retro-border"
                onClick={() => setSelectedDuration(duration)}
                disabled={!isHost || isUpdating}
              >
                {DURATION_LABELS[duration]}
              </Button>
            ))}
          </div>
        </div>

        {isHost && hasChanges && (
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={isUpdating}
              className="flex-1"
            >
              {isUpdating ? "Saving..." : "Save Settings"}
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              disabled={isUpdating}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      {!isHost && (
        <p className="font-mono text-xs text-muted-foreground">
          The host can change these settings before starting the game.
        </p>
      )}
    </div>
  )
}
