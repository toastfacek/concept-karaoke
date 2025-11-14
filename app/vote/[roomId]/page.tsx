"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Canvas } from "@/components/canvas"
import { loadPlayer, type StoredPlayer } from "@/lib/player-storage"
import { routes } from "@/lib/routes"
import { fetchWithRetry } from "@/lib/fetch-with-retry"
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
  seatIndex: number
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
  const { send: sendRealtime, status: realtimeStatus } = realtime

  const [storedPlayer, setStoredPlayer] = useState<StoredPlayer | null>(null)
  const [game, setGame] = useState<VoteGameState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAdLob, setSelectedAdLob] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [isVoting, setIsVoting] = useState(false)
  const lastRealtimeStatusRef = useRef<RealtimeStatus>("idle")
  const latestGameRef = useRef<VoteGameState | null>(null)
  const pendingFetchRef = useRef<Promise<void> | null>(null)
  const lastFetchVersionRef = useRef<number>(0)

  useEffect(() => {
    setStoredPlayer(loadPlayer(roomCode))
  }, [roomCode])

  const fetchGame = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    // Deduplicate concurrent requests
    if (pendingFetchRef.current) {
      console.log("[vote] Deduplicating concurrent fetchGame call")
      return pendingFetchRef.current
    }

    if (!silent) {
      setLoading(true)
      setError(null)
    }

    const fetchPromise = (async () => {
      try {
        const response = await fetchWithRetry(`/api/games/${roomCode}`, { cache: "no-store" })
        const payload = await response.json()

        if (!response.ok || !payload.success) {
          setError(payload.error ?? "Unable to load voting data")
          setGame(null)
          return
        }

        const gameData = payload.game
        const newVersion = typeof gameData.version === "number" ? gameData.version : 0

        // Ignore stale responses (version guard)
        if (newVersion < lastFetchVersionRef.current) {
          console.warn("[vote] Ignoring stale response", {
            received: newVersion,
            current: lastFetchVersionRef.current,
          })
          return
        }

        lastFetchVersionRef.current = newVersion

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

      const mappedPlayers: GamePlayer[] = (gameData.players ?? []).map(
        (player: Partial<GamePlayer> & { joined_at?: string; seat_index?: number }) => ({
          id: player.id ?? "",
          name: player.name ?? "",
          emoji: player.emoji ?? "",
          isReady: Boolean(player.isReady),
          isHost: Boolean(player.isHost),
          joinedAt: player.joinedAt ?? player.joined_at ?? new Date().toISOString(),
          seatIndex:
            typeof player.seatIndex === "number"
              ? player.seatIndex
              : typeof player.seat_index === "number"
                ? player.seat_index
                : 0,
        }),
      )

      setGame({
        id: gameData.id,
        code: gameData.code,
        status: gameData.status,
        hostId: gameData.hostId,
        version: typeof gameData.version === "number" ? gameData.version : 0,
        players: mappedPlayers,
        adlobs: mappedAdlobs,
      })

      setStoredPlayer((previous) => {
        if (!previous) return previous
        const latestPlayer = mappedPlayers.find((player) => player.id === previous.id)
        if (latestPlayer) {
          return { ...previous, isHost: latestPlayer.isHost, emoji: latestPlayer.emoji, name: latestPlayer.name }
        }
        return previous
        })
      } catch (fetchError) {
        console.error("Failed to fetch voting data", fetchError)
        setError("Unable to load voting data")
        setGame(null)
      } finally {
        if (!silent) {
          setLoading(false)
        }
        pendingFetchRef.current = null
      }
    })()

    pendingFetchRef.current = fetchPromise
    return fetchPromise
  }, [roomCode])

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
      const response = await fetchWithRetry("/api/votes", {
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

      const nextStatus = result.allVotesIn && typeof result.status === "string" ? result.status : null
      const phaseStartTime = result.allVotesIn && typeof result.phaseStartTime === "string"
        ? result.phaseStartTime
        : new Date().toISOString()
      const previousStatus = latestGameRef.current?.status ?? game.status

      if (nextStatus) {
        setGame((previous) =>
          previous
            ? {
                ...previous,
                status: nextStatus,
                phaseStartTime,
              }
            : previous,
        )

        if (nextStatus !== previousStatus) {
          sendRealtime({
            type: "set_status",
            roomCode,
            playerId: storedPlayer.id,
            status: nextStatus,
            currentPhase: null,
            phaseStartTime,
          })
        }
      }

      if (result.allVotesIn) {
        if (realtimeStatus !== "connected") {
          await fetchGame({ silent: true })
        }
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
    if (game) {
      return stateToSnapshot(game)
    }
    const snapshotSource = latestGameRef.current
    return snapshotSource ? stateToSnapshot(snapshotSource) : null
  }, [game])

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
                      seatIndex: player.seatIndex,
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
                  seatIndex: player.seatIndex,
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

      const unsubscribeStatusChanged = addListener("status_changed", ({ status, phaseStartTime, version }) => {
        setGame((previous) =>
          previous
            ? {
                ...previous,
                status,
                phaseStartTime,
                version,
              }
            : previous,
        )
      })

      const unsubscribePhaseChanged = addListener("phase_changed", ({ currentPhase, phaseStartTime, version }) => {
        setGame((previous) =>
          previous
            ? {
                ...previous,
                phaseStartTime,
                version,
                currentPhase,
              }
            : previous,
        )
      })

      return [
        unsubscribeHello,
        unsubscribeRoomState,
        unsubscribeReady,
        unsubscribePlayerJoined,
        unsubscribePlayerLeft,
        unsubscribeStatusChanged,
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
                  hasVoted ? "cursor-not-allowed" : "cursor-pointer",
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
