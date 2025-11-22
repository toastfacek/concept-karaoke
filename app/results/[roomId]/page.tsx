"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { Trophy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Canvas } from "@/components/canvas"
import { useRealtime } from "@/components/realtime-provider"
import { useRoomRealtime, type RoomRealtimeListenerHelpers } from "@/hooks/use-room-realtime"
import { canvasStateSchema, cloneCanvasState, type CanvasState } from "@/lib/canvas"
import { loadPlayer, type StoredPlayer } from "@/lib/player-storage"
import { mergeSnapshotIntoState, stateToSnapshot, type SnapshotDrivenState } from "@/lib/realtime/snapshot"
import type { RealtimeStatus } from "@/lib/realtime-client"
import { routes } from "@/lib/routes"
import { fetchWithRetry } from "@/lib/fetch-with-retry"

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

interface ResultsGameState extends SnapshotDrivenState<GamePlayer> {
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
  const realtime = useRealtime()
  const { status: realtimeStatus } = realtime

  const [storedPlayer, setStoredPlayer] = useState<StoredPlayer | null>(null)
  const [game, setGame] = useState<ResultsGameState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const lastRealtimeStatusRef = useRef<RealtimeStatus>("idle")
  const latestGameRef = useRef<ResultsGameState | null>(null)
  const pendingFetchRef = useRef<Promise<void> | null>(null)
  const lastFetchVersionRef = useRef<number>(0)

  useEffect(() => {
    setStoredPlayer(loadPlayer(roomCode))
  }, [roomCode])

  const fetchGame = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    // Deduplicate concurrent requests
    if (pendingFetchRef.current) {
      console.log("[results] Deduplicating concurrent fetchGame call")
      return pendingFetchRef.current
    }

    if (!silent) {
      setLoading(true)
      setError(null)
    }

    const fetchPromise = (async () => {
      try {
        // Results page needs players and adlobs to display final results
        const response = await fetchWithRetry(`/api/games/${roomCode}?include=players,adlobs`, { cache: "no-store" })
        const payload = await response.json()

        if (!response.ok || !payload.success) {
          setError(payload.error ?? "Unable to load results")
          setGame(null)
          return
        }

        const gameData = payload.game
        const newVersion = typeof gameData.version === "number" ? gameData.version : 0

        // Ignore stale responses (version guard)
        if (newVersion < lastFetchVersionRef.current) {
          console.warn("[results] Ignoring stale response", {
            received: newVersion,
            current: lastFetchVersionRef.current,
          })
          return
        }

        lastFetchVersionRef.current = newVersion

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
      } catch (fetchError) {
        console.error("Failed to fetch results", fetchError)
        setError("Unable to load results")
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
        console.error("Failed to refresh results after disconnect", statusError)
      })
    } else if (realtimeStatus === "connected" && lastRealtimeStatusRef.current === "disconnected") {
      fetchGame({ silent: true }).catch((statusError) => {
        console.error("Failed to refresh results after reconnect", statusError)
      })
    }
    lastRealtimeStatusRef.current = realtimeStatus
  }, [fetchGame, realtimeStatus])

  useEffect(() => {
    if (!game) return

    switch (game.status) {
      case "lobby":
        router.push(routes.lobby(roomCode))
        break
      case "creating":
        router.push(routes.create(roomCode))
        break
      case "presenting":
        router.push(routes.present(roomCode))
        break
      case "voting":
        router.push(routes.vote(roomCode))
        break
      default:
        break
    }
  }, [game, router, roomCode])

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
        setGame((previous) => (previous ? (mergeSnapshotIntoState(previous, incoming) as ResultsGameState) : previous))
      })

      const unsubscribeRoomState = addListener("room_state", ({ snapshot: incoming }) => {
        setGame((previous) => (previous ? (mergeSnapshotIntoState(previous, incoming) as ResultsGameState) : previous))
        fetchGame({ silent: true }).catch((error) => {
          console.error("Failed to refresh results after room_state", error)
        })
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

      const unsubscribeReady = addListener("ready_update", ({ playerId: readyPlayerId, isReady, version }) => {
        setGame((previous) =>
          previous
            ? {
                ...previous,
                version,
                players: previous.players.map((player) =>
                  player.id === readyPlayerId ? { ...player, isReady } : player,
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
                currentPhase,
                phaseStartTime,
                version,
              }
            : previous,
        )
      })

      return [
        unsubscribeHello,
        unsubscribeRoomState,
        unsubscribePlayerJoined,
        unsubscribePlayerLeft,
        unsubscribeReady,
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

  const sortedAdLobs = [...game.adlobs].sort((a, b) => b.voteCount - a.voteCount)
  const winner = sortedAdLobs[0]
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
                {winner.bigIdea.text}
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

                {winnerCanvas ? (
                  <Canvas initialData={winnerCanvas} readOnly className="pointer-events-none bg-muted" />
                ) : (
                  <div className="retro-border bg-muted p-6 text-center font-mono text-sm text-muted-foreground">
                    No visual or headline canvas available
                  </div>
                )}

                <div>
                  <p className="mb-2 font-mono text-xs uppercase text-muted-foreground">Pitch</p>
                  <p className="text-lg leading-relaxed">{winner.pitch.text}</p>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="retro-border bg-card p-8">
          <h2 className="mb-6 text-center text-2xl font-bold uppercase">Full Standings</h2>
          <div className="space-y-6">
            {sortedAdLobs.map((adlob, index) => {
              const presenter = getPresenter(adlob.assignedPresenterId)
              const canvas = adlob.headlineCanvas ?? adlob.visualCanvas
              return (
                <div key={adlob.id} className="rounded border border-border bg-muted/30 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xs uppercase text-muted-foreground">Rank #{index + 1}</p>
                      <p className="text-xl font-bold">
                        <span className="text-2xl">{presenter?.emoji}</span> {presenter?.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs uppercase text-muted-foreground">Votes</p>
                      <p className="text-3xl font-bold">{adlob.voteCount}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Big Idea</p>
                        <p className="text-base leading-relaxed">{adlob.bigIdea.text}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Pitch</p>
                        <p className="text-base leading-relaxed">{adlob.pitch.text}</p>
                      </div>
                      {adlob.visualNotes && (
                        <div>
                          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Visual Notes</p>
                          <p className="text-sm leading-relaxed">{adlob.visualNotes}</p>
                        </div>
                      )}
                    </div>

                    <div>
                      {canvas ? (
                        <Canvas initialData={canvas} readOnly className="pointer-events-none bg-muted" />
                      ) : (
                        <div className="retro-border bg-muted p-6 text-center font-mono text-xs text-muted-foreground">
                          No canvas provided
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const response = await fetch("/api/games/create", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ playerId: player?.playerId, playerName: player?.name, playerEmoji: player?.emoji }),
                })
                const data = await response.json()
                if (data.success && data.room?.code) {
                  router.push(routes.lobby(data.room.code))
                }
              } catch (error) {
                console.error("Failed to create new game:", error)
              }
            }}
            size="lg"
          >
            New Game
          </Button>
          <Button onClick={() => router.push(routes.home)} size="lg">
            Home
          </Button>
        </div>
      </div>
    </main>
  )
}
