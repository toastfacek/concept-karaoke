"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"

import { Canvas } from "@/components/canvas"
import { Button } from "@/components/ui/button"
import { PlayerList } from "@/components/player-list"
import { canvasStateSchema, cloneCanvasState, type CanvasState } from "@/lib/canvas"
import { loadPlayer, savePlayer, type StoredPlayer } from "@/lib/player-storage"
import { routes } from "@/lib/routes"
import { useRealtime } from "@/components/realtime-provider"
import { mergeSnapshotIntoState, stateToSnapshot, type SnapshotDrivenState } from "@/lib/realtime/snapshot"
import type { RealtimeStatus } from "@/lib/realtime-client"
import { fetchRealtimeToken, type RealtimeToken } from "@/lib/realtime/token"

type GamePlayer = {
  id: string
  name: string
  emoji: string
  isReady: boolean
  isHost: boolean
  joinedAt: string
}

type PresentAdlob = {
  id: string
  bigIdea: string | null
  bigIdeaAuthorId: string | null
  visualCanvasData: unknown
  visualImageUrls: string[] | null
  visualAuthorId: string | null
  headlineCanvasData: unknown
  headlineAuthorId: string | null
  pitch: string | null
  pitchAuthorId: string | null
  createdAt: string
  assignedPresenterId: string | null
  presentOrder: number | null
  presentStartedAt: string | null
  presentCompletedAt: string | null
}

type PresentGameState = SnapshotDrivenState<GamePlayer> & {
  currentPresentIndex: number | null
  presentSequence: string[]
  adlobs: PresentAdlob[]
}

function extractNotes(data: unknown): string {
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

export default function PresentPage() {
  const router = useRouter()
  const params = useParams()
  const roomCode = (params.roomId as string).toUpperCase()
  const {
    connect: connectRealtime,
    disconnect: disconnectRealtime,
    addListener: addRealtimeListener,
    status: realtimeStatus,
  } = useRealtime()

  const [storedPlayer, setStoredPlayer] = useState<StoredPlayer | null>(null)
  const [game, setGame] = useState<PresentGameState | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRevealing, setIsRevealing] = useState(false)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [showPitch, setShowPitch] = useState(true)
  const [showCampaign, setShowCampaign] = useState(false)

  const lastPresentIdRef = useRef<string | null>(null)
  const realtimeConnectionKeyRef = useRef<string | null>(null)
  const lastRealtimeStatusRef = useRef<RealtimeStatus>("idle")
  const tokenRef = useRef<RealtimeToken | null>(null)
  const latestGameRef = useRef<PresentGameState | null>(null)

  useEffect(() => {
    setStoredPlayer(loadPlayer(roomCode))
  }, [roomCode])

  const fetchGame = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) {
        setLoading(true)
        setError(null)
      }

      try {
        const response = await fetch(`/api/games/${roomCode}`, { cache: "no-store" })
        const payload = await response.json()

        if (!response.ok || !payload.success) {
          setError(payload.error ?? "Unable to load presentation flow.")
          setGame(null)
          return
        }

        const gameData = payload.game

        const players: GamePlayer[] = (gameData.players ?? []).map((player: GamePlayer & { joined_at?: string }) => ({
          id: player.id,
          name: player.name,
          emoji: player.emoji,
          isReady: player.isReady,
          isHost: player.isHost,
          joinedAt: player.joinedAt ?? player.joined_at ?? new Date().toISOString(),
        }))

        setGame({
          id: gameData.id,
          code: gameData.code,
          status: gameData.status,
          hostId: gameData.hostId,
          currentPresentIndex: gameData.currentPresentIndex ?? 0,
          presentSequence: gameData.presentSequence ?? [],
          players,
          adlobs: gameData.adlobs,
          version: typeof gameData.version === "number" ? gameData.version : 0,
        })

        const localPlayer = loadPlayer(roomCode)
        if (localPlayer) {
          const latest = gameData.players.find((player: GamePlayer) => player.id === localPlayer.id)
          if (latest) {
            const synced: StoredPlayer = {
              id: latest.id,
              name: latest.name,
              emoji: latest.emoji,
              isHost: latest.isHost,
            }
            savePlayer(roomCode, synced)
            setStoredPlayer(synced)
          }
        }
      } catch (fetchError) {
        console.error(fetchError)
        setError("Unable to load presentation flow.")
        setGame(null)
      } finally {
        if (!silent) {
          setLoading(false)
        }
      }
    },
    [roomCode],
  )

  useEffect(() => {
    fetchGame()
  }, [fetchGame])

  useEffect(() => {
    if (realtimeStatus === "disconnected") {
      fetchGame({ silent: true }).catch((error) => {
        console.error("Failed to refresh presentation flow after disconnect", error)
      })
    } else if (realtimeStatus === "connected" && lastRealtimeStatusRef.current === "disconnected") {
      fetchGame({ silent: true }).catch((error) => {
        console.error("Failed to refresh presentation flow after reconnect", error)
      })
    }
    lastRealtimeStatusRef.current = realtimeStatus
  }, [fetchGame, realtimeStatus])

  const currentPlayer = useMemo(() => {
    if (!storedPlayer || !game) return null
    return game.players.find((player) => player.id === storedPlayer.id) ?? null
  }, [storedPlayer, game])

  const orderedAdlobs = useMemo(() => {
    if (!game) return []
    const map = new Map(game.adlobs.map((adlob) => [adlob.id, adlob]))

    if (game.presentSequence.length > 0) {
      return game.presentSequence
        .map((id) => map.get(id))
        .filter((value): value is PresentAdlob => Boolean(value))
    }

    return [...game.adlobs].sort((a, b) => (a.presentOrder ?? 0) - (b.presentOrder ?? 0))
  }, [game])

  const presentCount = orderedAdlobs.length
  const currentPresentIndex = Math.min(game?.currentPresentIndex ?? 0, Math.max(orderedAdlobs.length - 1, 0))
  const currentAdlob = orderedAdlobs[currentPresentIndex] ?? null

  useEffect(() => {
    const activePresentId = currentAdlob?.id ?? null
    if (lastPresentIdRef.current !== activePresentId) {
      setShowPitch(true)
      setShowCampaign(false)
      setIsRevealing(false)
      setIsAdvancing(false)
      lastPresentIdRef.current = activePresentId
    }
  }, [currentAdlob?.id])

  const currentPresenter = useMemo(() => {
    if (!game || !currentAdlob) return null
    return game.players.find((player) => player.id === currentAdlob.assignedPresenterId) ?? null
  }, [game, currentAdlob])

  const visualCanvas = useMemo(() => parseCanvasData(currentAdlob?.visualCanvasData), [currentAdlob])
  const headlineCanvas = useMemo(() => parseCanvasData(currentAdlob?.headlineCanvasData), [currentAdlob])

  const canControlPresent = !!currentPlayer && (currentPlayer.isHost || currentPlayer.id === currentAdlob?.assignedPresenterId)

  const handleRevealCampaign = async () => {
    if (!game || !currentPlayer || !currentAdlob) return
    if (showCampaign) return

    setIsRevealing(true)
    setError(null)

    try {
      await fetch(`/api/games/${roomCode}/present`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: currentPlayer.id,
          action: "start",
        }),
      })

      setShowPitch(false)
      setShowCampaign(true)
    } catch (revealError) {
      console.error(revealError)
      setError(revealError instanceof Error ? revealError.message : "Failed to reveal campaign.")
    } finally {
      setIsRevealing(false)
    }
  }

  const handleAdvancePresent = async () => {
    if (!game || !currentPlayer || !currentAdlob) return

    setIsAdvancing(true)
    setError(null)

    try {
      console.log("[PRESENT DEBUG] Calling advance API...")
      const response = await fetch(`/api/games/${roomCode}/present`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: currentPlayer.id,
          action: "advance",
        }),
      })

      const result = await response.json()
      console.log("[PRESENT DEBUG] API response:", result)

      // If we moved to voting, redirect immediately
      if (result.success && result.status === "voting") {
        console.log("[PRESENT DEBUG] Moving to voting, redirecting...")
        router.push(routes.vote(roomCode))
        return
      }

      console.log("[PRESENT DEBUG] Not moving to voting, refreshing game state...")
      await fetchGame({ silent: true })
    } catch (advanceError) {
      console.error("[PRESENT DEBUG] Error:", advanceError)
      setError(advanceError instanceof Error ? advanceError.message : "Failed to advance presentation.")
    } finally {
      setIsAdvancing(false)
    }
  }

  useEffect(() => {
    latestGameRef.current = game
  }, [game])

  useEffect(() => {
    const snapshotSource = latestGameRef.current
    const playerId = storedPlayer?.id
    if (!playerId || !snapshotSource) return

    const connectionKey = `${roomCode}:${playerId}`
    if (realtimeConnectionKeyRef.current === connectionKey) {
      return
    }

    let cancelled = false
    let cleanupFns: Array<() => void> = []

    const initialize = async () => {
      try {
        let tokenInfo = tokenRef.current
        if (!tokenInfo || tokenInfo.expiresAt <= Date.now() + 5_000) {
          tokenInfo = await fetchRealtimeToken(roomCode, playerId)
          if (cancelled) return
          tokenRef.current = tokenInfo
        }

        connectRealtime({
          roomCode,
          playerId,
          playerToken: tokenInfo.token,
          initialSnapshot: stateToSnapshot(snapshotSource),
        })
        realtimeConnectionKeyRef.current = connectionKey

        const unsubscribeHello = addRealtimeListener("hello_ack", ({ snapshot: incoming }) => {
          setGame((previous) => (previous ? (mergeSnapshotIntoState(previous, incoming) as PresentGameState) : previous))
        })

        const unsubscribeRoomState = addRealtimeListener("room_state", ({ snapshot: incoming }) => {
          setGame((previous) => (previous ? (mergeSnapshotIntoState(previous, incoming) as PresentGameState) : previous))
        })

        const unsubscribePlayerJoined = addRealtimeListener("player_joined", ({ player, version }) => {
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

        const unsubscribePlayerLeft = addRealtimeListener("player_left", ({ playerId: leftPlayerId, version }) => {
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

        const unsubscribeReady = addRealtimeListener("ready_update", ({ playerId: readyPlayerId, isReady, version }) => {
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

        const unsubscribePhaseChanged = addRealtimeListener("phase_changed", ({ version }) => {
          setGame((previous) =>
            previous
              ? {
                  ...previous,
                  version,
                  status: previous.status === "presenting" ? previous.status : "presenting",
                }
              : previous,
          )
          fetchGame({ silent: true }).catch((error) => {
            console.error("Failed to refresh presentation flow after phase change", error)
          })
        })

        cleanupFns = [
          unsubscribeHello,
          unsubscribeRoomState,
          unsubscribePlayerJoined,
          unsubscribePlayerLeft,
          unsubscribeReady,
          unsubscribePhaseChanged,
        ]
      } catch (error) {
        console.error("Failed to initialize presentation realtime connection", error)
      }
    }

    void initialize()

    return () => {
      cancelled = true
      cleanupFns.forEach((fn) => fn())
      disconnectRealtime()
      realtimeConnectionKeyRef.current = null
    }
  }, [addRealtimeListener, connectRealtime, disconnectRealtime, fetchGame, roomCode, storedPlayer?.id])
  useEffect(() => {
    if (!game) return

    if (game.status === "voting") {
      router.push(routes.vote(roomCode))
    } else if (game.status === "results") {
      router.push(routes.results(roomCode))
    } else if (game.status === "creating") {
      router.push(routes.create(roomCode))
    }
  }, [game, router, roomCode])

  const renderCampaignSlide = () => {
    if (!currentAdlob) {
      return (
        <div className="retro-border bg-muted p-8 text-center font-mono text-sm text-muted-foreground">
          Waiting for the host to queue up the next presentation...
        </div>
      )
    }

    return (
      <div className="retro-border bg-card p-8 space-y-8">
        {headlineCanvas ? (
          <Canvas initialData={headlineCanvas} readOnly className="pointer-events-none bg-muted" />
        ) : (
          <div className="retro-border bg-muted p-6 text-center font-mono text-sm text-muted-foreground">
            Headline layout pending...
          </div>
        )}

        {canControlPresent && (
          <Button onClick={handleAdvancePresent} size="lg" className="w-full" disabled={isAdvancing}>
            {isAdvancing
              ? "Advancing..."
              : currentPresentIndex + 1 >= presentCount
                ? "Send to Voting"
                : "End Presentation"}
          </Button>
        )}
      </div>
    )
  }

  const renderPitchIntro = () => {
    if (!currentAdlob) {
      return (
        <div className="retro-border bg-primary p-8 text-center text-primary-foreground">
          <p className="text-2xl font-bold">Waiting for the next presentation...</p>
        </div>
      )
    }

    return (
      <div className="retro-border bg-primary p-12 text-center text-primary-foreground">
        <p className="text-3xl font-bold leading-relaxed">
          {currentAdlob.pitch ?? "This pitch is still being polished."}
        </p>
        {canControlPresent && (
          <Button
            onClick={handleRevealCampaign}
            size="lg"
            variant="secondary"
            className="mt-8"
            disabled={isRevealing}
          >
            {isRevealing ? "Revealing..." : "Reveal Campaign"}
          </Button>
        )}
      </div>
    )
  }

  const currentPresentLabel = useMemo(() => {
    if (!currentAdlob) {
      return "Presentation loading..."
    }
    return `Presentation ${currentPresentIndex + 1} of ${presentCount}`
  }, [currentAdlob, currentPresentIndex, presentCount])

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="retro-border bg-card px-6 py-4 text-center">
          <p className="mb-2 font-mono text-sm uppercase tracking-wider text-muted-foreground">Up Next</p>
          <h1 className="text-4xl font-bold">
            {currentPresenter ? (
              <>
                <span className="text-5xl">{currentPresenter.emoji}</span> {currentPresenter.name}
              </>
            ) : (
              "Assigning presenter..."
            )}
          </h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">{currentPresentLabel}</p>
        </header>

        {error && <p className="font-mono text-sm font-medium text-destructive">{error}</p>}

        {loading || !game ? (
          <div className="retro-border bg-muted p-8 text-center font-mono text-sm text-muted-foreground">
            Loading presentation flow...
          </div>
        ) : (
          <>
            {showPitch && renderPitchIntro()}
            {showCampaign && renderCampaignSlide()}

            {!canControlPresent && (
              <div className="retro-border bg-muted p-6 text-center">
                <p className="font-mono text-sm text-muted-foreground">
                  {currentPresenter
                    ? `Watching ${currentPresenter.name}'s presentation...`
                    : "Waiting for the host to assign the next presenter..."}
                </p>
              </div>
            )}

            <section className="retro-border bg-card p-6">
              <h2 className="mb-4 text-2xl font-bold uppercase">Players</h2>
              <PlayerList players={game.players} />
            </section>
          </>
        )}
      </div>
    </main>
  )
}
