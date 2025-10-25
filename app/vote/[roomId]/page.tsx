"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Canvas } from "@/components/canvas"
import { loadPlayer, type StoredPlayer } from "@/lib/player-storage"
import { routes } from "@/lib/routes"
import { canvasStateSchema, cloneCanvasState, type CanvasState } from "@/lib/canvas"
import { cn } from "@/lib/utils"
import { useRealtime } from "@/components/realtime-provider"
import { useRoomRealtime, type RoomRealtimeListenerHelpers } from "@/hooks/use-room-realtime"
import { mergeSnapshotIntoState, stateToSnapshot, type SnapshotDrivenState } from "@/lib/realtime/snapshot"
import type { RealtimeStatus } from "@/lib/realtime-client"

interface GamePlayer {
  id: string
  name: string
  emoji: string
  isReady: boolean
  isHost: boolean
  joinedAt: string
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

interface VoteGameState extends SnapshotDrivenState<GamePlayer> {
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
  const realtime = useRealtime()
  const { status: realtimeStatus } = realtime

  const [storedPlayer, setStoredPlayer] = useState<StoredPlayer | null>(null)
  const [game, setGame] = useState<VoteGameState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAdLob, setSelectedAdLob] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [isVoting, setIsVoting] = useState(false)
  const lastRealtimeStatusRef = useRef<RealtimeStatus>("idle")
  const latestGameRef = useRef<VoteGameState | null>(null)

  useEffect(() => {
    setStoredPlayer(loadPlayer(roomCode))
  }, [roomCode])

  const fetchGame = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setLoading(true)
      setError(null)
    }

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
        joinedAt: player.joinedAt ?? player.joined_at ?? new Date().toISOString(),
      }))

      setGame({
        id: gameData.id,
        code: gameData.code,
        status: gameData.status,
        hostId: gameData.hostId,
        version: typeof gameData.version === "number" ? gameData.version : 0,
        players: mappedPlayers,
        adlobs: mappedAdlobs,
      })

      if (storedPlayer) {
        const latestPlayer = mappedPlayers.find((player) => player.id === storedPlayer.id)
        if (latestPlayer) {
          setStoredPlayer((previous) =>
            previous
              ? { ...previous, isHost: latestPlayer.isHost, emoji: latestPlayer.emoji, name: latestPlayer.name }
              : previous,
          )
        }
      }
    } catch (fetchError) {
      console.error("Failed to fetch voting data", fetchError)
      setError("Unable to load voting data")
      setGame(null)
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [roomCode, storedPlayer])

  useEffect(() => {
    fetchGame()
  }, [fetchGame])

  useEffect(() => {
    latestGameRef.current = game
  }, [game])

  useEffect(() => {
    if (realtimeStatus === "disconnected") {
      fetchGame({ silent: true }).catch((statusError) => {
        console.error("Failed to refresh voting data after disconnect", statusError)
      })
    } else if (realtimeStatus === "connected" && lastRealtimeStatusRef.current === "disconnected") {
      fetchGame({ silent: true }).catch((statusError) => {
        console.error("Failed to refresh voting data after reconnect", statusError)
      })
    }
    lastRealtimeStatusRef.current = realtimeStatus
  }, [fetchGame, realtimeStatus])

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

      if (result.allVotesIn) {
        router.push(routes.results(roomCode))
      } else {
        await fetchGame({ silent: true })
      }
    } catch (voteError) {
      console.error("Failed to submit vote", voteError)
      setError("Failed to submit vote")
    } finally {
      setIsVoting(false)
    }
  }

  const getInitialSnapshot = useCallback(() => {
    const snapshotSource = latestGameRef.current
    return snapshotSource ? stateToSnapshot(snapshotSource) : null
  }, [])

  const registerRealtimeListeners = useCallback(
    ({ addListener }: RoomRealtimeListenerHelpers) => {
      const unsubscribeHello = addListener("hello_ack", ({ snapshot: incoming }) => {
        setGame((previous) => (previous ? (mergeSnapshotIntoState(previous, incoming) as VoteGameState) : previous))
      })

      const unsubscribeRoomState = addListener("room_state", ({ snapshot: incoming }) => {
        setGame((previous) => (previous ? (mergeSnapshotIntoState(previous, incoming) as VoteGameState) : previous))
        fetchGame({ silent: true }).catch((error) => {
          console.error("Failed to refresh voting data after room_state", error)
        })
      })

      const unsubscribeReady = addListener("ready_update", ({ playerId, isReady, version }) => {
        setGame((previous) =>
          previous
            ? {
                ...previous,
                version,
                players: previous.players.map((player) =>
                  player.id === playerId ? { ...player, isReady } : player,
                ),
              }
            : previous,
        )
      })

      const unsubscribePlayerJoined = addListener("player_joined", ({ player, version }) => {
        setGame((previous) => {
          if (!previous) return previous
          const existing = previous.players.find((candidate) => candidate.id === player.id)
          const players = existing
            ? previous.players.map((candidate) =>
                candidate.id === player.id
                  ? {
                      ...candidate,
                      name: player.name,
                      emoji: player.emoji,
                      isReady: player.isReady,
                      isHost: player.isHost,
                    }
                  : candidate,
              )
            : [
                ...previous.players,
                {
                  id: player.id,
                  name: player.name,
                  emoji: player.emoji,
                  isReady: player.isReady,
                  isHost: player.isHost,
                  joinedAt: new Date().toISOString(),
                },
              ]
          const hostId = players.find((candidate) => candidate.isHost)?.id ?? previous.hostId
          return {
            ...previous,
            version,
            players,
            hostId,
          }
        })
      })

      const unsubscribePlayerLeft = addListener("player_left", ({ playerId: leftPlayerId, version }) => {
        setGame((previous) =>
          previous
            ? {
                ...previous,
                version,
                players: previous.players.map((player) =>
                  player.id === leftPlayerId ? { ...player, isReady: false } : player,
                ),
              }
            : previous,
        )
      })

      const unsubscribePhaseChanged = addListener("phase_changed", () => {
        fetchGame({ silent: true }).catch((error) => {
          console.error("Failed to refresh voting data after phase change", error)
        })
      })

      return [
        unsubscribeHello,
        unsubscribeRoomState,
        unsubscribeReady,
        unsubscribePlayerJoined,
        unsubscribePlayerLeft,
        unsubscribePhaseChanged,
      ]
    },
    [fetchGame],
  )

  useRoomRealtime({
    roomCode,
    playerId: storedPlayer?.id ?? null,
    enabled: Boolean(storedPlayer?.id && game),
    getInitialSnapshot,
    registerListeners: registerRealtimeListeners,
    realtime,
  })

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
                  if (hasVoted || isOwnCampaign) return
                  setError(null)
                  setSelectedAdLob(adlob.id)
                }}
                disabled={hasVoted || isOwnCampaign}
                aria-pressed={isSelected}
                className={cn(
                  "retro-border flex h-full flex-col gap-4 text-left transition-all p-6",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : hasVoted || isOwnCampaign
                      ? "bg-muted text-muted-foreground opacity-80"
                      : "bg-card hover:-translate-y-0.5 hover:bg-muted hover:shadow-md",
                  hasVoted || isOwnCampaign ? "cursor-not-allowed" : "cursor-pointer",
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
