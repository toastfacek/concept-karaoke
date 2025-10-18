interface Player {
  id: string
  name: string
  emoji: string
  isReady?: boolean
  isHost?: boolean
}

interface PlayerListProps {
  players: Player[]
  showReady?: boolean
  className?: string
}

export function PlayerList({ players, showReady = false, className = "" }: PlayerListProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {players.map((player) => (
        <div key={player.id} className="retro-border flex items-center justify-between bg-card p-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{player.emoji}</span>
            <div>
              <p className="font-bold">
                {player.name}
                {player.isHost && (
                  <span className="ml-2 rounded bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
                    HOST
                  </span>
                )}
              </p>
            </div>
          </div>
          {showReady && (
            <div
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                player.isReady ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {player.isReady ? "READY" : "NOT READY"}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
