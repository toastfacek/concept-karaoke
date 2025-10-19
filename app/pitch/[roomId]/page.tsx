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

type PitchAdlob = {
  id: string
  bigIdea: string | null
  bigIdeaAuthorId: string | null
  visualCanvasData: unknown
  visualImageUrls: string[] | null
  visualAuthorId: string | null
  headlineCanvasData: unknown
  headlineAuthorId: string | null
  mantra: string | null
  mantraAuthorId: string | null
  createdAt: string
  assignedPitcherId: string | null
  pitchOrder: number | null
  pitchStartedAt: string | null
  pitchCompletedAt: string | null
}

type PitchGameState = SnapshotDrivenState<GamePlayer> & {
  currentPitchIndex: number | null
  pitchSequence: string[]
  adlobs: PitchAdlob[]
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

export default function PitchPage() {
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
  const [game, setGame] = useState<PitchGameState | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRevealing, setIsRevealing] = useState(false)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [showMantra, setShowMantra] = useState(true)
  const [showCampaign, setShowCampaign] = useState(false)

  const lastPitchIdRef = useRef<string | null>(null)
  const realtimeConnectionKeyRef = useRef<string | null>(null)
  const lastRealtimeStatusRef = useRef<RealtimeStatus>("idle")
  const tokenRef = useRef<RealtimeToken | null>(null)
  const latestGameRef = useRef<PitchGameState | null>(null)

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
          setError(payload.error ?? "Unable to load pitch flow.")
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
          currentPitchIndex: gameData.currentPitchIndex ?? 0,
          pitchSequence: gameData.pitchSequence ?? [],
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
        setError("Unable to load pitch flow.")
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
        console.error("Failed to refresh pitch flow after disconnect", error)
      })
    } else if (realtimeStatus === "connected" && lastRealtimeStatusRef.current === "disconnected") {
      fetchGame({ silent: true }).catch((error) => {
        console.error("Failed to refresh pitch flow after reconnect", error)
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

    if (game.pitchSequence.length > 0) {
      return game.pitchSequence
        .map((id) => map.get(id))
        .filter((value): value is PitchAdlob => Boolean(value))
    }

    return [...game.adlobs].sort((a, b) => (a.pitchOrder ?? 0) - (b.pitchOrder ?? 0))
  }, [game])

  const pitchCount = orderedAdlobs.length
  const currentPitchIndex = Math.min(game?.currentPitchIndex ?? 0, Math.max(orderedAdlobs.length - 1, 0))
  const currentAdlob = orderedAdlobs[currentPitchIndex] ?? null

  useEffect(() => {
    const activePitchId = currentAdlob?.id ?? null
    if (lastPitchIdRef.current !== activePitchId) {
      setShowMantra(true)
      setShowCampaign(false)
      setIsRevealing(false)
      setIsAdvancing(false)
      lastPitchIdRef.current = activePitchId
    }
  }, [currentAdlob?.id])

  const currentPitcher = useMemo(() => {
    if (!game || !currentAdlob) return null
    return game.players.find((player) => player.id === currentAdlob.assignedPitcherId) ?? null
  }, [game, currentAdlob])

  const visualCanvas = useMemo(() => parseCanvasData(currentAdlob?.visualCanvasData), [currentAdlob])
  const headlineCanvas = useMemo(() => parseCanvasData(currentAdlob?.headlineCanvasData), [currentAdlob])

  const canControlPitch = !!currentPlayer && (currentPlayer.isHost || currentPlayer.id === currentAdlob?.assignedPitcherId)

  const handleRevealCampaign = async () => {
    if (!game || !currentPlayer || !currentAdlob) return
    if (showCampaign) return

    setIsRevealing(true)
    setError(null)

    try {
      await fetch(`/api/games/${roomCode}/pitch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: currentPlayer.id,
          action: "start",
        }),
      })

      setShowMantra(false)
      setShowCampaign(true)
    } catch (revealError) {
      console.error(revealError)
      setError(revealError instanceof Error ? revealError.message : "Failed to reveal campaign.")
    } finally {
      setIsRevealing(false)
    }
  }

  const handleAdvancePitch = async () => {
    if (!game || !currentPlayer || !currentAdlob) return

    setIsAdvancing(true)
    setError(null)

    try {
      await fetch(`/api/games/${roomCode}/pitch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: currentPlayer.id,
          action: "advance",
        }),
      })

      await fetchGame({ silent: true })
    } catch (advanceError) {
      console.error(advanceError)
      setError(advanceError instanceof Error ? advanceError.message : "Failed to advance pitch.")
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
          setGame((previous) => (previous ? (mergeSnapshotIntoState(previous, incoming) as PitchGameState) : previous))
        })

        const unsubscribeRoomState = addRealtimeListener("room_state", ({ snapshot: incoming }) => {
          setGame((previous) => (previous ? (mergeSnapshotIntoState(previous, incoming) as PitchGameState) : previous))
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
                  status: previous.status === "pitching" ? previous.status : "pitching",
                }
              : previous,
          )
          fetchGame({ silent: true }).catch((error) => {
            console.error("Failed to refresh pitch flow after phase change", error)
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
        console.error("Failed to initialize pitch realtime connection", error)
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
          Waiting for the host to queue up the next pitch...
        </div>
      )
    }

    return (
      <div className="retro-border bg-card p-8 space-y-8">
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">Big Idea</p>
          <p className="text-2xl font-bold">{currentAdlob.bigIdea ?? "Big idea still cooking..."}</p>
        </div>

        <div className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Visual Direction</p>
          {visualCanvas ? (
            <Canvas initialData={visualCanvas} readOnly className="pointer-events-none bg-muted" />
          ) : (
            <div className="retro-border bg-muted p-6 text-center font-mono text-sm text-muted-foreground">
              Visual sketch pending...
            </div>
          )}
          <p className="text-sm text-muted-foreground">{extractNotes(currentAdlob.visualCanvasData)}</p>
        </div>

        <div className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Headline Layout</p>
          {headlineCanvas ? (
            <Canvas initialData={headlineCanvas} readOnly className="pointer-events-none bg-muted" />
          ) : (
            <div className="retro-border bg-muted p-6 text-center font-mono text-sm text-muted-foreground">
              Headline layout pending...
            </div>
          )}
          <p className="text-sm text-muted-foreground">{extractNotes(currentAdlob.headlineCanvasData)}</p>
        </div>

        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">Campaign Mantra</p>
          <p className="text-lg leading-relaxed">{currentAdlob.mantra ?? "Waiting on a closer..."}</p>
        </div>

        {canControlPitch && (
          <Button onClick={handleAdvancePitch} size="lg" className="w-full" disabled={isAdvancing}>
            {isAdvancing
              ? "Advancing..."
              : currentPitchIndex + 1 >= pitchCount
                ? "Send to Voting"
                : "End Pitch"}
          </Button>
        )}
      </div>
    )
  }

  const renderMantraIntro = () => {
    if (!currentAdlob) {
      return (
        <div className="retro-border bg-primary p-8 text-center text-primary-foreground">
          <p className="text-2xl font-bold">Waiting for the next pitch...</p>
        </div>
      )
    }

    return (
      <div className="retro-border bg-primary p-12 text-center text-primary-foreground">
        <p className="text-3xl font-bold leading-relaxed">
          {currentAdlob.mantra ?? "This campaign mantra is still being polished."}
        </p>
        {canControlPitch && (
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

  const currentPitchLabel = useMemo(() => {
    if (!currentAdlob) {
      return "Pitch deck loading..."
    }
    return `Pitch ${currentPitchIndex + 1} of ${pitchCount}`
  }, [currentAdlob, currentPitchIndex, pitchCount])

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="retro-border bg-card px-6 py-4 text-center">
          <p className="mb-2 font-mono text-sm uppercase tracking-wider text-muted-foreground">Up Next</p>
          <h1 className="text-4xl font-bold">
            {currentPitcher ? (
              <>
                <span className="text-5xl">{currentPitcher.emoji}</span> {currentPitcher.name}
              </>
            ) : (
              "Assigning pitcher..."
            )}
          </h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">{currentPitchLabel}</p>
        </header>

        {error && <p className="font-mono text-sm font-medium text-destructive">{error}</p>}

        {loading || !game ? (
          <div className="retro-border bg-muted p-8 text-center font-mono text-sm text-muted-foreground">
            Loading pitch flow...
          </div>
        ) : (
          <>
            {showMantra && renderMantraIntro()}
            {showCampaign && renderCampaignSlide()}

            {!canControlPitch && (
              <div className="retro-border bg-muted p-6 text-center">
                <p className="font-mono text-sm text-muted-foreground">
                  {currentPitcher
                    ? `Watching ${currentPitcher.name}'s pitch...`
                    : "Waiting for the host to assign the next pitcher..."}
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
