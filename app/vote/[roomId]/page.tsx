"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Canvas } from "@/components/canvas"
import { loadPlayer, type StoredPlayer } from "@/lib/player-storage"
import { routes } from "@/lib/routes"
import { canvasStateSchema, cloneCanvasState, type CanvasState } from "@/lib/canvas"
import { cn } from "@/lib/utils"

interface GamePlayer {
  id: string
  name: string
  emoji: string
  isReady: boolean
  isHost: boolean
}

interface AdLob {
  id: string
  bigIdea: {
    text: string
    createdBy: string
  }
  pitch: {
    text: string
    createdBy: string
  }
  visualNotes: string
  visualCanvas: CanvasState | null
  headlineCanvas: CanvasState | null
  assignedPresenterId: string | null
  voteCount: number
}

interface VoteGameState {
  id: string
  code: string
  status: string
  players: GamePlayer[]
  adlobs: AdLob[]
}

function extractCanvasNotes(data: unknown): string {
  if (!data || typeof data !== "object") return ""
  if ("notes" in data && typeof (data as { notes?: unknown }).notes === "string") {
    return (data as { notes?: string }).notes ?? ""
  }
  if ("text" in data && typeof (data as { text?: unknown }).text === "string") {
    return (data as { text?: string }).text ?? ""
  }
  return ""
}

function parseCanvasData(data: unknown): CanvasState | null {
  const parsed = canvasStateSchema.safeParse(data)
  if (!parsed.success) {
    return null
  }
  return cloneCanvasState(parsed.data)
}

export default function VotePage() {
  const router = useRouter()
  const params = useParams()
  const roomCode = params.roomId as string

  const [storedPlayer, setStoredPlayer] = useState<StoredPlayer | null>(null)
  const [game, setGame] = useState<VoteGameState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAdLob, setSelectedAdLob] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [isVoting, setIsVoting] = useState(false)

  useEffect(() => {
    setStoredPlayer(loadPlayer(roomCode))
  }, [roomCode])

  const fetchGame = useCallback(async () => {
    try {
      const response = await fetch(`/api/games/${roomCode}`, { cache: "no-store" })
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        setError(payload.error ?? "Unable to load voting data")
        setGame(null)
        return
      }

      const gameData = payload.game

      // Map the API response to our game state format
      const mappedAdlobs: AdLob[] = (gameData.adlobs ?? []).map((adlob: any) => ({
        id: adlob.id,
        bigIdea: {
          text: adlob.bigIdea ?? "",
          createdBy: adlob.bigIdeaAuthorId ?? "",
        },
        pitch: {
          text: adlob.pitch ?? "",
          createdBy: adlob.pitchAuthorId ?? "",
        },
        visualNotes: extractCanvasNotes(adlob.visualCanvasData),
        visualCanvas: parseCanvasData(adlob.visualCanvasData),
        headlineCanvas: parseCanvasData(adlob.headlineCanvasData),
        assignedPresenterId: adlob.assignedPresenterId ?? null,
        voteCount: adlob.voteCount ?? 0,
      }))

      const mappedPlayers: GamePlayer[] = (gameData.players ?? []).map((player: any) => ({
        id: player.id,
        name: player.name,
        emoji: player.emoji,
        isReady: player.isReady ?? false,
        isHost: player.isHost ?? false,
      }))

      setGame({
        id: gameData.id,
        code: gameData.code,
        status: gameData.status,
        players: mappedPlayers,
        adlobs: mappedAdlobs,
      })
    } catch (fetchError) {
      console.error("Failed to fetch voting data", fetchError)
      setError("Unable to load voting data")
      setGame(null)
    } finally {
      setLoading(false)
    }
  }, [roomCode])

  useEffect(() => {
    fetchGame()
  }, [fetchGame])

  // Redirect if game status changes
  useEffect(() => {
    if (!game) return

    if (game.status === "results") {
      router.push(routes.results(roomCode))
    } else if (game.status !== "voting") {
      router.push(routes.lobby(roomCode))
    }
  }, [game, router, roomCode])

  const handleVote = async () => {
    if (!selectedAdLob || !storedPlayer || !game) return

    setIsVoting(true)
    setError(null)

    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: roomCode,
          voterId: storedPlayer.id,
          adlobId: selectedAdLob,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error ?? "Failed to submit vote")
        setIsVoting(false)
        return
      }

      setHasVoted(true)

      // If all votes are in, the API will have transitioned to results
      // Poll to check if status has changed
      if (result.allVotesIn) {
        router.push(routes.results(roomCode))
      } else {
        // Poll for status changes
        const pollInterval = setInterval(async () => {
          const checkResponse = await fetch(`/api/games/${roomCode}`, { cache: "no-store" })
          const checkPayload = await checkResponse.json()
          if (checkPayload.success && checkPayload.game.status === "results") {
            clearInterval(pollInterval)
            router.push(routes.results(roomCode))
          }
        }, 2000)

        // Clean up polling after 2 minutes
        setTimeout(() => clearInterval(pollInterval), 120000)
      }
    } catch (voteError) {
      console.error("Failed to submit vote", voteError)
      setError("Failed to submit vote")
    } finally {
      setIsVoting(false)
    }
  }

  const getPresenterName = (presenterId: string | null) => {
    if (!game) return "Unknown"
    return game.players.find((p) => p.id === presenterId)?.name ?? "Unknown"
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-6xl">
          <div className="retro-border bg-card p-12 text-center">
            <p className="font-mono text-lg">Loading voting...</p>
          </div>
        </div>
      </main>
    )
  }

  if (!game || !storedPlayer) {
    return (
      <main className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-6xl">
          <div className="retro-border bg-destructive p-12 text-center text-destructive-foreground">
            <p className="font-mono text-lg">{error ?? "Unable to load voting"}</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="retro-border bg-card p-6 text-center">
          <h1 className="text-4xl font-bold uppercase">Vote for Best Campaign</h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            {hasVoted ? "Waiting for other players..." : "Click a campaign to select, then vote"}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {game.adlobs.map((adlob) => {
            const isOwnCampaign = adlob.assignedPresenterId === storedPlayer.id
            const isSelected = selectedAdLob === adlob.id
            const campaignCanvas = adlob.headlineCanvas ?? adlob.visualCanvas

            return (
              <button
                key={adlob.id}
                type="button"
                onClick={() => {
                  if (hasVoted) return
                  setError(null)
                  setSelectedAdLob(adlob.id)
                }}
                disabled={hasVoted}
                aria-pressed={isSelected}
                className={cn(
                  "retro-border flex h-full flex-col gap-4 text-left transition-all p-6",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : hasVoted
                      ? "bg-muted text-muted-foreground opacity-80"
                      : "bg-card hover:-translate-y-0.5 hover:bg-muted hover:shadow-md",
                  hasVoted ? "cursor-default" : "cursor-pointer",
                )}
              >
                <p className="font-mono text-xs uppercase tracking-wider">
                  Presented by {getPresenterName(adlob.assignedPresenterId)}
                </p>

                <div className="space-y-3">
                  <p className="text-xl font-bold leading-tight">{adlob.bigIdea.text}</p>

                  {adlob.visualNotes && (
                    <div
                      className={cn(
                        "rounded border border-border bg-muted/40 p-3",
                        isSelected ? "text-primary-foreground/80" : "text-foreground",
                      )}
                    >
                      <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                        Visual Notes
                      </p>
                      <p className="mt-1 text-sm leading-relaxed">{adlob.visualNotes}</p>
                    </div>
                  )}

                  <div>
                    {campaignCanvas ? (
                      <Canvas
                        initialData={campaignCanvas}
                        readOnly
                        className={cn("bg-white", "[&>div:first-child]:hidden")}
                      />
                    ) : (
                      <div className="retro-border flex aspect-video items-center justify-center bg-white text-muted-foreground">
                        <p className="font-mono text-xs uppercase tracking-widest">No visual submitted</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Campaign Pitch</p>
                    <p className="mt-2 text-sm leading-relaxed">{adlob.pitch.text || "No pitch submitted."}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {!hasVoted && (
          <div className="flex justify-center">
            <Button onClick={handleVote} disabled={!selectedAdLob || isVoting} size="lg" className="px-12">
              {isVoting ? "Submitting..." : "Cast Vote"}
            </Button>
          </div>
        )}

        {hasVoted && (
          <div className="retro-border bg-card p-6 text-center">
            <p className="font-mono text-lg">Vote submitted! Waiting for other players...</p>
          </div>
        )}

        {error && (
          <div className="retro-border bg-destructive p-4 text-center text-destructive-foreground">
            <p className="font-mono">{error}</p>
          </div>
        )}
      </div>
    </main>
  )
}
