import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

type Phase = "big_idea" | "visual" | "headline" | "pitch"

interface PhaseConfig {
  id: Phase
  label: string
  shortLabel: string
}

interface PhaseProgressHorizontalProps {
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

export function PhaseProgressHorizontal({ currentPhase, completedPhases, className }: PhaseProgressHorizontalProps) {
  const getCurrentIndex = () => PHASES.findIndex((p) => p.id === currentPhase)
  const isCompleted = (phase: Phase) => completedPhases.includes(phase)
  const isCurrent = (phase: Phase) => phase === currentPhase
  const currentIndex = getCurrentIndex()

  return (
    <div className={cn("space-y-3", className)}>
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        {PHASES.map((phase, index) => {
          const completed = isCompleted(phase.id)
          const current = isCurrent(phase.id)
          const upcoming = index > currentIndex

          return (
            <div key={phase.id} className="flex items-center flex-1">
              {/* Step indicator */}
              <div className="flex flex-col items-center flex-1 gap-1">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                    completed && "border-green-600 bg-green-600 text-white",
                    current && !completed && "border-foreground bg-foreground text-background",
                    upcoming && "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {completed ? <Check className="h-4 w-4" /> : index + 1}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    "text-xs font-medium transition-colors text-center",
                    current && "font-bold text-foreground",
                    completed && "text-muted-foreground",
                    upcoming && "text-muted-foreground/60",
                  )}
                >
                  {phase.shortLabel}
                </span>
              </div>

              {/* Connector line */}
              {index < PHASES.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 transition-colors",
                    index < currentIndex ? "bg-green-600" : "bg-border",
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="text-center text-xs text-muted-foreground">
        Round {currentIndex + 1} of {PHASES.length}
      </div>
    </div>
  )
}
