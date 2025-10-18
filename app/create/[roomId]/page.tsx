"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Timer } from "@/components/timer"
import { Canvas } from "@/components/canvas"
import type { CreationPhase } from "@/lib/types"

const PHASE_LABELS = {
  big_idea: "Round 1: The Big Idea",
  visual: "Round 2: The Visual",
  headline: "Round 3: The Headline",
  mantra: "Round 4: The Mantra",
}

const PHASE_INSTRUCTIONS = {
  big_idea: "What's the big idea for this campaign? Write 1-2 sentences.",
  visual: "Create a visual representation of the campaign using the canvas tools.",
  headline: "Add a headline to the visual. Make it bold and memorable.",
  mantra: "Write a sexy 1-3 sentence description that sells this campaign (50-100 words).",
}

export default function CreatePage() {
  const router = useRouter()
  const params = useParams()
  const roomId = params.roomId as string

  const [currentPhase, setCurrentPhase] = useState<CreationPhase>("big_idea")
  const [bigIdea, setBigIdea] = useState("")
  const [mantra, setMantra] = useState("")
  const [previousWork, setPreviousWork] = useState({
    bigIdea: "Wake up to your best self - not your worst alarm",
    visual: null,
  })

  // Timer ends 60 seconds from now
  const phaseEndTime = new Date(Date.now() + 60000)

  const handlePhaseComplete = () => {
    // TODO: Save current work to database
    console.log("[v0] Phase complete, saving work...")

    // Move to next phase
    const phases: CreationPhase[] = ["big_idea", "visual", "headline", "mantra"]
    const currentIndex = phases.indexOf(currentPhase)

    if (currentIndex < phases.length - 1) {
      setCurrentPhase(phases[currentIndex + 1])
    } else {
      // All phases complete, go to pitch
      router.push(`/pitch/${roomId}`)
    }
  }

  const renderPhaseContent = () => {
    switch (currentPhase) {
      case "big_idea":
        return (
          <div className="space-y-4">
            <Textarea
              value={bigIdea}
              onChange={(e) => setBigIdea(e.target.value)}
              placeholder="Enter your big idea..."
              rows={4}
              className="text-lg"
            />
            <p className="font-mono text-sm text-muted-foreground">{bigIdea.length} characters</p>
          </div>
        )

      case "visual":
        return (
          <div className="space-y-4">
            <div className="retro-border bg-muted p-4">
              <p className="mb-2 font-mono text-xs uppercase text-muted-foreground">Previous: Big Idea</p>
              <p className="font-bold">{previousWork.bigIdea}</p>
            </div>
            <Canvas onSave={(data) => console.log("[v0] Canvas saved:", data)} />
          </div>
        )

      case "headline":
        return (
          <div className="space-y-4">
            <div className="retro-border bg-muted p-4">
              <p className="mb-2 font-mono text-xs uppercase text-muted-foreground">Previous Work</p>
              <p className="mb-2 font-bold">{previousWork.bigIdea}</p>
              <p className="font-mono text-xs text-muted-foreground">[Visual canvas displayed above]</p>
            </div>
            <Canvas onSave={(data) => console.log("[v0] Headline canvas saved:", data)} />
            <p className="font-mono text-sm text-muted-foreground">
              Use the text tool to add your headline to the canvas
            </p>
          </div>
        )

      case "mantra":
        return (
          <div className="space-y-4">
            <div className="retro-border bg-muted p-6">
              <p className="mb-3 font-mono text-xs uppercase text-muted-foreground">Complete AdLob (View Only)</p>
              <div className="space-y-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">Big Idea:</p>
                  <p className="font-bold">{previousWork.bigIdea}</p>
                </div>
                <div className="retro-border aspect-video bg-white p-4">
                  <p className="font-mono text-sm text-muted-foreground">[Visual + Headline Canvas]</p>
                </div>
              </div>
            </div>
            <Textarea
              value={mantra}
              onChange={(e) => setMantra(e.target.value)}
              placeholder="Write your campaign mantra..."
              rows={4}
              className="text-lg"
            />
            <p className="font-mono text-sm text-muted-foreground">
              {mantra.split(" ").filter((w) => w).length} words (aim for 50-100)
            </p>
          </div>
        )
    }
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="retro-border bg-card px-6 py-3">
            <h1 className="text-2xl font-bold uppercase">{PHASE_LABELS[currentPhase]}</h1>
          </div>
          <Timer endTime={phaseEndTime} onComplete={handlePhaseComplete} />
        </div>

        <div className="retro-border bg-card p-6">
          <p className="mb-6 text-center font-mono text-lg">{PHASE_INSTRUCTIONS[currentPhase]}</p>
          {renderPhaseContent()}
        </div>

        <div className="flex justify-end">
          <Button onClick={handlePhaseComplete} size="lg">
            Submit & Continue
          </Button>
        </div>
      </div>
    </main>
  )
}
