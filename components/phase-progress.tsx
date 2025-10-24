import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

type Phase = "big_idea" | "visual" | "headline" | "pitch"

interface PhaseConfig {
  id: Phase
  label: string
  shortLabel: string
}

interface PhaseProgressProps {
  currentPhase: Phase
  completedPhases: Phase[]
  className?: string
}

const PHASES: PhaseConfig[] = [
  { id: "big_idea", label: "Big Idea", shortLabel: "Idea" },
  { id: "visual", label: "Visual", shortLabel: "Visual" },
  { id: "headline", label: "Headline", shortLabel: "Head" },
  { id: "pitch", label: "Pitch", shortLabel: "Pitch" },
]

export function PhaseProgress({ currentPhase, completedPhases, className }: PhaseProgressProps) {
  const getCurrentIndex = () => PHASES.findIndex((p) => p.id === currentPhase)
  const isCompleted = (phase: Phase) => completedPhases.includes(phase)
  const isCurrent = (phase: Phase) => phase === currentPhase
  const currentIndex = getCurrentIndex()

  return (
    <div className={cn("space-y-2", className)}>
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Progress</h3>
      <div className="space-y-1">
        {PHASES.map((phase, index) => {
          const completed = isCompleted(phase.id)
          const current = isCurrent(phase.id)
          const upcoming = index > currentIndex

          return (
            <div key={phase.id} className="flex items-center gap-2">
              {/* Step indicator */}
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                  completed && "border-green-600 bg-green-600 text-white",
                  current && !completed && "border-foreground bg-foreground text-background",
                  upcoming && "border-border bg-muted text-muted-foreground",
                )}
              >
                {completed ? <Check className="h-3 w-3" /> : index + 1}
              </div>

              {/* Label */}
              <span
                className={cn(
                  "text-sm font-medium transition-colors",
                  current && "font-bold text-foreground",
                  completed && "text-muted-foreground",
                  upcoming && "text-muted-foreground/60",
                )}
              >
                {phase.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="pt-2 text-xs text-muted-foreground">
        Round {currentIndex + 1} of {PHASES.length}
      </div>
    </div>
  )
}
