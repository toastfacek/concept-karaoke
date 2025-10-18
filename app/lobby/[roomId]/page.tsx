"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PlayerList } from "@/components/player-list"
import { samplePlayers } from "@/lib/sample-data"
import { Copy, Check } from "lucide-react"

export default function LobbyPage() {
  const router = useRouter()
  const params = useParams()
  const roomId = params.roomId as string

  const [players, setPlayers] = useState(samplePlayers)
  const [isReady, setIsReady] = useState(false)
  const [copied, setCopied] = useState(false)

  const currentPlayer = players[0] // Assume first player is current user for demo
  const isHost = currentPlayer.isHost
  const allReady = players.every((p) => p.isReady)
  const minPlayers = players.length >= 3

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToggleReady = () => {
    setIsReady(!isReady)
    // TODO: Update player ready status in database
  }

  const handleStartGame = () => {
    // TODO: Call API to start game
    router.push(`/brief/${roomId}`)
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="retro-border bg-card p-8 text-center">
          <h1 className="mb-4 text-5xl font-bold uppercase">Game Lobby</h1>

          <div className="retro-border inline-flex items-center gap-4 bg-primary px-8 py-4 text-primary-foreground">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider">Game Code</p>
              <p className="text-3xl font-bold tracking-widest">{roomId}</p>
            </div>
            <Button size="icon" variant="secondary" onClick={handleCopyCode} className="shrink-0">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>

          <p className="mt-4 font-mono text-sm text-muted-foreground">Share this code with your friends to join</p>
        </div>

        <div className="retro-border bg-card p-8">
          <h2 className="mb-4 text-2xl font-bold uppercase">Players ({players.length}/8)</h2>
          <PlayerList players={players} showReady />
        </div>

        <div className="retro-border bg-card p-8">
          <div className="space-y-4">
            {!isHost && (
              <Button
                onClick={handleToggleReady}
                size="lg"
                variant={isReady ? "secondary" : "default"}
                className="w-full"
              >
                {isReady ? "Not Ready" : "Ready Up"}
              </Button>
            )}

            {isHost && (
              <>
                <Button onClick={handleStartGame} disabled={!allReady || !minPlayers} size="lg" className="w-full">
                  Start Game
                </Button>
                {!minPlayers && (
                  <p className="text-center font-mono text-sm text-muted-foreground">
                    Need at least 3 players to start
                  </p>
                )}
                {minPlayers && !allReady && (
                  <p className="text-center font-mono text-sm text-muted-foreground">
                    Waiting for all players to ready up...
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
