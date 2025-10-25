"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { PRODUCT_CATEGORIES, PHASE_DURATIONS, type ProductCategory, type PhaseDuration } from "@/lib/types"

interface GameSettingsProps {
  productCategory: string
  phaseDurationSeconds: number
  isHost: boolean
  roomCode: string
  playerId: string
  onSettingsChange?: (settings: { productCategory: string; phaseDurationSeconds: number }) => void
}

const DURATION_LABELS: Record<PhaseDuration, string> = {
  30: "30 seconds",
  60: "60 seconds",
  90: "90 seconds",
  120: "2 minutes",
}

export function GameSettings({
  productCategory,
  phaseDurationSeconds,
  isHost,
  roomCode,
  playerId,
  onSettingsChange,
}: GameSettingsProps) {
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>(productCategory as ProductCategory)
  const [selectedDuration, setSelectedDuration] = useState<PhaseDuration>(phaseDurationSeconds as PhaseDuration)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasChanges = selectedCategory !== productCategory || selectedDuration !== phaseDurationSeconds

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
      })
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Failed to update settings")
      // Revert to original values on error
      setSelectedCategory(productCategory)
      setSelectedDuration(phaseDurationSeconds)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleReset = () => {
    setSelectedCategory(productCategory)
    setSelectedDuration(phaseDurationSeconds)
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
          <Label htmlFor="product-category" className="font-mono text-sm uppercase">
            Product Category
          </Label>
          <Select
            value={selectedCategory}
            onValueChange={setSelectedCategory}
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
