"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Trophy } from "lucide-react"
import { routes } from "@/lib/routes"
import { Canvas } from "@/components/canvas"
import { canvasStateSchema, cloneCanvasState, type CanvasState } from "@/lib/canvas"

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

interface ResultsGameState {
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

export default function ResultsPage() {
  const router = useRouter()
  const params = useParams()
  const roomCode = params.roomId as string

  const [game, setGame] = useState<ResultsGameState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGame = useCallback(async () => {
    try {
      const response = await fetch(`/api/games/${roomCode}`, { cache: "no-store" })
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        setError(payload.error ?? "Unable to load results")
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
      console.error("Failed to fetch results", fetchError)
      setError("Unable to load results")
      setGame(null)
    } finally {
      setLoading(false)
    }
  }, [roomCode])

  useEffect(() => {
    fetchGame()
  }, [fetchGame])

  const getPresenterName = (presenterId: string | null) => {
    if (!game) return "Unknown"
    return game.players.find((p) => p.id === presenterId)?.name ?? "Unknown"
  }

  const getPresenter = (presenterId: string | null) => {
    if (!game) return null
    return game.players.find((p) => p.id === presenterId) ?? null
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-6xl">
          <div className="retro-border bg-card p-12 text-center">
            <p className="font-mono text-lg">Loading results...</p>
          </div>
        </div>
      </main>
    )
  }

  if (error || !game) {
    return (
      <main className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-6xl">
          <div className="retro-border bg-destructive p-12 text-center text-destructive-foreground">
            <p className="font-mono text-lg">{error ?? "Unable to load results"}</p>
          </div>
        </div>
      </main>
    )
  }

  // Sort adlobs by vote count descending
  const sortedAdLobs = [...game.adlobs].sort((a, b) => b.voteCount - a.voteCount)
  const winner = sortedAdLobs[0]
  const winnerPresenter = winner ? getPresenter(winner.assignedPresenterId) : null
  const winnerCanvas = winner ? winner.headlineCanvas ?? winner.visualCanvas : null

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {winner && (
          <>
            <div className="retro-border bg-primary p-12 text-center text-primary-foreground">
              <Trophy className="mx-auto mb-4 size-16" />
              <h1 className="mb-2 text-5xl font-bold uppercase">Winner!</h1>
              <p className="text-3xl font-bold">
                <span className="text-4xl">{winnerPresenter?.emoji}</span> {winnerPresenter?.name}
              </p>
              <p className="mt-4 font-mono text-lg">
                {winner.voteCount} vote{winner.voteCount !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="retro-border bg-card p-8">
              <h2 className="mb-6 text-center text-2xl font-bold uppercase">Winning Campaign</h2>
              <div className="space-y-6">
                <div>
                  <p className="mb-2 font-mono text-xs uppercase text-muted-foreground">Big Idea</p>
                  <p className="text-2xl font-bold">{winner.bigIdea.text}</p>
                </div>

                {winner.visualNotes && (
                  <div className="rounded border border-border bg-muted/40 p-4">
                    <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Visual Notes</p>
                    <p className="mt-1 text-sm leading-relaxed">{winner.visualNotes}</p>
                  </div>
                )}

                <div>
                  {winnerCanvas ? (
                    <Canvas
                      initialData={winnerCanvas}
                      readOnly
                      className="bg-white [&>div:first-child]:hidden"
                    />
                  ) : (
                    <div className="retro-border flex aspect-video items-center justify-center bg-white">
                      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                        No visual submitted
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-2 font-mono text-xs uppercase text-muted-foreground">Campaign Pitch</p>
                  <p className="text-lg">{winner.pitch.text}</p>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="retro-border bg-card p-8">
          <h2 className="mb-6 text-center text-2xl font-bold uppercase">All Results</h2>
          <div className="space-y-4">
            {sortedAdLobs.map((adlob, index) => (
              <div key={adlob.id} className="retro-border flex items-center justify-between bg-muted p-4">
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-muted-foreground">#{index + 1}</span>
                  <div>
                    <p className="font-bold">{adlob.bigIdea.text}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      Presented by {getPresenterName(adlob.assignedPresenterId)}
                    </p>
                    {adlob.visualNotes && (
                      <p className="mt-1 text-xs italic text-muted-foreground/70">"{adlob.visualNotes}"</p>
                    )}
                  </div>
                </div>
                <div className="retro-border bg-primary px-4 py-2 text-primary-foreground">
                  <p className="text-xl font-bold">{adlob.voteCount}</p>
                  <p className="font-mono text-xs">vote{adlob.voteCount !== 1 ? "s" : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center">
          <Button onClick={() => router.push(routes.home())} size="lg" className="px-12">
            Play Again
          </Button>
        </div>
      </div>
    </main>
  )
}
