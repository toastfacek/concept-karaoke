"use client"

import { useCallback, useEffect, useState } from "react"
import { Canvas } from "@/components/canvas"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PhaseProgress } from "@/components/phase-progress"
import { PlayerStatus } from "@/components/player-status"
import { canvasHasContent, type CanvasState } from "@/lib/canvas"
import { cn } from "@/lib/utils"

type Phase = "big_idea" | "visual" | "headline" | "mantra"

interface TestAdLob {
  bigIdea: string
  visual: {
    canvasData: CanvasState | null
    notes: string
  }
  headline: {
    canvasData: CanvasState | null
    notes: string
  }
  mantra: string
  brief: string
}

const STORAGE_KEY = "create-test-data"
const DEBOUNCE_MS = 500

const DEFAULT_BRIEF = `# Campaign Brief

## Brand
TestCo - A modern technology company

## Product
Smart Home Assistant Device

## Target Audience
Tech-savvy millennials and Gen Z professionals who value convenience and aesthetics

## Campaign Objective
Launch the new Smart Home Assistant and establish it as the must-have device for modern living

## Key Message
"Your home, smarter. Your life, simpler."

## Tone & Style
Modern, approachable, aspirational yet accessible. Emphasize seamless integration into daily life.

## Deliverables
Create compelling advertising concepts that showcase how the device transforms everyday routines.`

function createEmptyAdLob(): TestAdLob {
  return {
    bigIdea: "",
    visual: {
      canvasData: null,
      notes: "",
    },
    headline: {
      canvasData: null,
      notes: "",
    },
    mantra: "",
    brief: DEFAULT_BRIEF,
  }
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((word) => word.length > 0).length
}

// Mock player data for testing multiplayer UI
const MOCK_PLAYERS = [
  { id: "1", name: "You", emoji: "🎨", isReady: false, isYou: true },
  { id: "2", name: "Alex", emoji: "🚀", isReady: true, isYou: false },
  { id: "3", name: "Jordan", emoji: "✨", isReady: false, isYou: false },
]

export default function CreateTestPage() {
  const [currentPhase, setCurrentPhase] = useState<Phase>("big_idea")
  const [adlob, setAdlob] = useState<TestAdLob>(createEmptyAdLob)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [saveTimer, setSaveTimer] = useState<NodeJS.Timeout | null>(null)
  const [showBrief, setShowBrief] = useState(false)
  const [mockPlayers, setMockPlayers] = useState(MOCK_PLAYERS)

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        // Ensure brief exists for old data
        if (!parsed.brief) {
          parsed.brief = DEFAULT_BRIEF
        }
        setAdlob(parsed)
        setLastSaved(new Date())
      } catch (error) {
        console.error("Failed to load saved data:", error)
      }
    }
  }, [])

  // Auto-save to localStorage (debounced)
  const scheduleAutoSave = useCallback((data: TestAdLob) => {
    if (saveTimer) {
      clearTimeout(saveTimer)
    }

    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      setLastSaved(new Date())
    }, DEBOUNCE_MS)

    setSaveTimer(timer)
  }, [saveTimer])

  const updateAdlob = useCallback((updater: (prev: TestAdLob) => TestAdLob) => {
    setAdlob((prev) => {
      const next = updater(prev)
      scheduleAutoSave(next)
      return next
    })
  }, [scheduleAutoSave])

  const handleReset = useCallback(() => {
    if (confirm("Clear all data and start fresh? This cannot be undone.")) {
      const empty = createEmptyAdLob()
      setAdlob(empty)
      localStorage.removeItem(STORAGE_KEY)
      setLastSaved(null)
      setCurrentPhase("big_idea")
    }
  }, [])

  const handleExport = useCallback(() => {
    const dataStr = JSON.stringify(adlob, null, 2)
    const blob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `create-test-export-${new Date().toISOString()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [adlob])

  const toggleMockPlayerReady = useCallback((playerId: string) => {
    setMockPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, isReady: !p.isReady } : p))
    )
  }, [])

  const phaseConfig: Array<{ id: Phase; label: string; completed: boolean }> = [
    { id: "big_idea", label: "Big Idea", completed: adlob.bigIdea.trim().length >= 20 },
    {
      id: "visual",
      label: "Visual",
      completed: canvasHasContent(adlob.visual.canvasData) && adlob.visual.notes.trim().length >= 10
    },
    {
      id: "headline",
      label: "Headline",
      completed: canvasHasContent(adlob.headline.canvasData) && adlob.headline.notes.trim().length >= 3
    },
    { id: "mantra", label: "Mantra", completed: countWords(adlob.mantra) >= 3 },
  ]

  const mantraWordCount = countWords(adlob.mantra)
  const completedPhases = phaseConfig.filter((p) => p.completed).map((p) => p.id)

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Brief Modal */}
      {showBrief && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowBrief(false)}
        >
          <div
            className="retro-border relative max-h-[80vh] w-full max-w-2xl overflow-y-auto bg-background p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowBrief(false)}
              className="absolute right-4 top-4 text-2xl font-bold hover:text-muted-foreground"
              aria-label="Close brief"
            >
              ×
            </button>
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap font-mono text-sm">
                {adlob.brief}
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <Label htmlFor="brief-edit">Edit Brief</Label>
              <Textarea
                id="brief-edit"
                value={adlob.brief}
                onChange={(e) => updateAdlob((prev) => ({ ...prev, brief: e.target.value }))}
                rows={12}
                className="font-mono text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="retro-border border-b-4 bg-muted p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold">Create Phase Test</h1>
              <p className="text-sm text-muted-foreground">
                UI experiment - testing 2-column layout with player status
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBrief(true)}
              className="flex items-center gap-2"
              title="View Campaign Brief"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              Brief
            </Button>
          </div>
          <div className="flex items-center gap-3">
            {lastSaved && (
              <p className="text-xs text-muted-foreground">
                Last saved: {Math.floor((Date.now() - lastSaved.getTime()) / 1000)}s ago
              </p>
            )}
            <Button variant="secondary" size="sm" onClick={handleExport}>
              Export JSON
            </Button>
            <Button variant="destructive" size="sm" onClick={handleReset}>
              Reset All
            </Button>
          </div>
        </div>

        {/* Phase Navigation */}
        <div className="mt-4 flex gap-2">
          {phaseConfig.map((phase) => (
            <button
              key={phase.id}
              onClick={() => setCurrentPhase(phase.id)}
              className={cn(
                "flex items-center gap-2 rounded border-2 px-4 py-2 text-sm font-semibold uppercase transition",
                currentPhase === phase.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              {phase.label}
              {phase.completed && <span className="text-xs">✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content - 2 Column Layout */}
      <div className="flex flex-1 overflow-hidden gap-6 p-6">
        {/* Main Workspace - Left Side */}
        <div className="flex-1 overflow-y-auto">
          {currentPhase === "big_idea" && (
            <div className="mx-auto max-w-3xl space-y-4">
              <div>
                <h2 className="mb-2 text-2xl font-bold">Big Idea</h2>
                <p className="text-sm text-muted-foreground">
                  Describe the core concept for this advertisement. What's the big idea?
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="big-idea-input">Your Big Idea</Label>
                <Textarea
                  id="big-idea-input"
                  value={adlob.bigIdea}
                  onChange={(e) => updateAdlob((prev) => ({ ...prev, bigIdea: e.target.value }))}
                  placeholder="Start typing your big idea here..."
                  rows={8}
                  className="text-base"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{adlob.bigIdea.length}/800 characters</span>
                  {adlob.bigIdea.length < 20 && (
                    <span className="text-amber-600">Need at least 20 characters</span>
                  )}
                  {adlob.bigIdea.length >= 20 && (
                    <span className="text-green-600">Looking good! ✓</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentPhase === "visual" && (
            <div className="space-y-4">
              <div>
                <h2 className="mb-2 text-2xl font-bold">Visual</h2>
                <p className="text-sm text-muted-foreground">
                  Sketch out the visual concept. Use drawing tools, text, and AI-generated images.
                </p>
                {adlob.bigIdea && (
                  <div className="mt-3 rounded border-2 border-border bg-muted/50 p-3">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Big Idea Context:</p>
                    <p className="text-sm">{adlob.bigIdea}</p>
                  </div>
                )}
              </div>

              <Canvas
                initialData={adlob.visual.canvasData}
                onChange={(data) => {
                  updateAdlob((prev) => ({
                    ...prev,
                    visual: { ...prev.visual, canvasData: data },
                  }))
                }}
              />

              <div className="space-y-2">
                <Label htmlFor="visual-notes">Visual Notes</Label>
                <Textarea
                  id="visual-notes"
                  value={adlob.visual.notes}
                  onChange={(e) => updateAdlob((prev) => ({
                    ...prev,
                    visual: { ...prev.visual, notes: e.target.value },
                  }))}
                  placeholder="Describe your visual concept, provide guidance for the next phase..."
                  rows={4}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{adlob.visual.notes.length} characters</span>
                  {adlob.visual.notes.length < 10 && (
                    <span className="text-amber-600">Add at least 10 characters for context</span>
                  )}
                  {adlob.visual.notes.length >= 10 && canvasHasContent(adlob.visual.canvasData) && (
                    <span className="text-green-600">Complete! ✓</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentPhase === "headline" && (
            <div className="space-y-4">
              <div>
                <h2 className="mb-2 text-2xl font-bold">Headline</h2>
                <p className="text-sm text-muted-foreground">
                  Create the headline layout. Build on the visual sketch or start fresh.
                </p>

                <div className="mt-3 space-y-2">
                  {adlob.bigIdea && (
                    <div className="rounded border-2 border-border bg-muted/50 p-3">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Big Idea:</p>
                      <p className="text-sm">{adlob.bigIdea}</p>
                    </div>
                  )}

                  {adlob.visual.notes && (
                    <div className="rounded border-2 border-border bg-muted/50 p-3">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Visual Notes:</p>
                      <p className="text-sm">{adlob.visual.notes}</p>
                    </div>
                  )}

                  {canvasHasContent(adlob.visual.canvasData) && !canvasHasContent(adlob.headline.canvasData) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        updateAdlob((prev) => ({
                          ...prev,
                          headline: { ...prev.headline, canvasData: prev.visual.canvasData },
                        }))
                      }}
                    >
                      Copy Visual Canvas as Starting Point
                    </Button>
                  )}
                </div>
              </div>

              <Canvas
                key={adlob.headline.canvasData ? "has-data" : "empty"}
                initialData={adlob.headline.canvasData}
                onChange={(data) => {
                  updateAdlob((prev) => ({
                    ...prev,
                    headline: { ...prev.headline, canvasData: data },
                  }))
                }}
              />

              <div className="space-y-2">
                <Label htmlFor="headline-notes">Headline Copy Notes</Label>
                <Textarea
                  id="headline-notes"
                  value={adlob.headline.notes}
                  onChange={(e) => updateAdlob((prev) => ({
                    ...prev,
                    headline: { ...prev.headline, notes: e.target.value },
                  }))}
                  placeholder="Add any copy, messaging notes, or guidance..."
                  rows={4}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{adlob.headline.notes.length} characters</span>
                  {adlob.headline.notes.length < 3 && (
                    <span className="text-amber-600">Add at least 3 characters</span>
                  )}
                  {adlob.headline.notes.length >= 3 && canvasHasContent(adlob.headline.canvasData) && (
                    <span className="text-green-600">Complete! ✓</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentPhase === "mantra" && (
            <div className="mx-auto max-w-3xl space-y-4">
              <div>
                <h2 className="mb-2 text-2xl font-bold">Mantra</h2>
                <p className="text-sm text-muted-foreground">
                  Write the pitch. Synthesize everything into a compelling mantra (50-100 words target).
                </p>

                <div className="mt-3 space-y-2">
                  {adlob.bigIdea && (
                    <div className="rounded border-2 border-border bg-muted/50 p-3">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Big Idea:</p>
                      <p className="text-sm">{adlob.bigIdea}</p>
                    </div>
                  )}

                  {adlob.visual.notes && (
                    <div className="rounded border-2 border-border bg-muted/50 p-3">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Visual Notes:</p>
                      <p className="text-sm">{adlob.visual.notes}</p>
                    </div>
                  )}

                  {adlob.headline.notes && (
                    <div className="rounded border-2 border-border bg-muted/50 p-3">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Headline Notes:</p>
                      <p className="text-sm">{adlob.headline.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mantra-input">Your Mantra</Label>
                <Textarea
                  id="mantra-input"
                  value={adlob.mantra}
                  onChange={(e) => updateAdlob((prev) => ({ ...prev, mantra: e.target.value }))}
                  placeholder="Craft your pitch mantra here..."
                  rows={10}
                  className="text-base"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="space-x-4">
                    <span>{mantraWordCount} words</span>
                    <span>{adlob.mantra.length}/1200 characters</span>
                  </div>
                  {mantraWordCount < 3 && (
                    <span className="text-amber-600">Need at least 3 words</span>
                  )}
                  {mantraWordCount >= 3 && mantraWordCount < 50 && (
                    <span className="text-blue-600">Target: 50-100 words</span>
                  )}
                  {mantraWordCount >= 50 && mantraWordCount <= 100 && (
                    <span className="text-green-600">Perfect length! ✓</span>
                  )}
                  {mantraWordCount > 100 && (
                    <span className="text-amber-600">Over target (but okay!)</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Player Status & Progress */}
        <div className="w-80 shrink-0 space-y-6">
          {/* Phase Progress */}
          <div className="retro-border bg-card p-4">
            <PhaseProgress currentPhase={currentPhase} completedPhases={completedPhases} />
          </div>

          {/* Mock Timer Display */}
          <div className="retro-border bg-card p-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Time</h3>
            <div className="text-center">
              <div className="text-3xl font-bold font-mono">--:--</div>
              <div className="text-xs text-muted-foreground mt-1">Test mode (no timer)</div>
            </div>
          </div>

          {/* Player Status */}
          <div className="retro-border bg-card p-4">
            <PlayerStatus players={mockPlayers} />

            {/* Quick toggle for testing */}
            <div className="mt-4 pt-4 border-t-2 border-border">
              <button
                onClick={() => toggleMockPlayerReady("1")}
                className="w-full rounded border-2 border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Toggle Your Ready Status
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
