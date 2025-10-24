import { cn } from "@/lib/utils"
import { Check, Clock } from "lucide-react"

interface MockPlayer {
  id: string
  name: string
  emoji: string
  isReady: boolean
  isYou?: boolean
}

interface PlayerStatusProps {
  players: MockPlayer[]
  className?: string
}

export function PlayerStatus({ players, className }: PlayerStatusProps) {
  const readyCount = players.filter((p) => p.isReady).length
  const totalCount = players.length

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Players</h3>
        <span className="text-xs font-mono text-muted-foreground">
          {readyCount}/{totalCount} Ready
        </span>
      </div>

      {/* Player list */}
      <div className="space-y-2">
        {players.map((player) => (
          <div
            key={player.id}
            className={cn(
              "flex items-center gap-2 rounded border-2 p-2 transition-colors",
              player.isReady ? "border-border bg-background" : "border-border bg-muted/30",
            )}
          >
            {/* Emoji avatar */}
            <span className="text-lg">{player.emoji}</span>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate block">
                {player.name}
                {player.isYou && <span className="ml-1 text-xs text-muted-foreground">(You)</span>}
              </span>
            </div>

            {/* Ready status */}
            <div className="shrink-0">
              {player.isReady ? (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600">
                  <Check className="h-3 w-3 text-white" />
                </div>
              ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Ready summary */}
      {readyCount < totalCount && (
        <div className="text-xs text-muted-foreground italic text-center pt-1">
          Waiting for {totalCount - readyCount} player{totalCount - readyCount !== 1 ? "s" : ""}
        </div>
      )}
      {readyCount === totalCount && totalCount > 0 && (
        <div className="text-xs text-green-600 font-medium text-center pt-1">Everyone is ready!</div>
      )}
    </div>
  )
}
