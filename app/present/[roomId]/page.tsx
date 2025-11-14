"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"

import { Canvas } from "@/components/canvas"
import { Button } from "@/components/ui/button"
import { PlayerList } from "@/components/player-list"
import { canvasStateSchema, cloneCanvasState, type CanvasState } from "@/lib/canvas"
import { loadPlayer, savePlayer, type StoredPlayer } from "@/lib/player-storage"
import { routes } from "@/lib/routes"
import { fetchWithRetry } from "@/lib/fetch-with-retry"
import { useRealtime } from "@/components/realtime-provider"
import { useRoomRealtime, type RoomRealtimeListenerHelpers } from "@/hooks/use-room-realtime"
import { mergeSnapshotIntoState, stateToSnapshot, type SnapshotDrivenState } from "@/lib/realtime/snapshot"
import type { RealtimeStatus } from "@/lib/realtime-client"

type GamePlayer = {
  id: string
  name: string
  emoji: string
  isReady: boolean
  isHost: boolean
  joinedAt: string
  seatIndex: number
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
  const realtime = useRealtime()
  const { send: sendRealtime, status: realtimeStatus } = realtime

  const [storedPlayer, setStoredPlayer] = useState<StoredPlayer | null>(null)
  const [game, setGame] = useState<PresentGameState | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRevealing, setIsRevealing] = useState(false)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [showPitch, setShowPitch] = useState(true)
  const [showCampaign, setShowCampaign] = useState(false)

  const lastPresentIdRef = useRef<string | null>(null)
  const lastRealtimeStatusRef = useRef<RealtimeStatus>("idle")
  const latestGameRef = useRef<PresentGameState | null>(null)
  const pendingRefreshTimeoutRef = useRef<number | null>(null)
  const pendingFetchRef = useRef<Promise<void> | null>(null)
  const lastFetchVersionRef = useRef<number>(0)

  const clearPendingRefresh = useCallback(() => {
    if (pendingRefreshTimeoutRef.current !== null) {
      window.clearTimeout(pendingRefreshTimeoutRef.current)
      pendingRefreshTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    setStoredPlayer(loadPlayer(roomCode))
  }, [roomCode])

  const fetchGame = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      // Deduplicate concurrent requests
      if (pendingFetchRef.current) {
        console.log("[present] Deduplicating concurrent fetchGame call")
        return pendingFetchRef.current
      }

      if (!silent) {
        setLoading(true)
        setError(null)
      }

      const fetchPromise = (async () => {
        try {
          // Present page needs players and adlobs to display campaigns
          const response = await fetchWithRetry(`/api/games/${roomCode}?include=players,adlobs`, { cache: "no-store" })
          const payload = await response.json()

          if (!response.ok || !payload.success) {
            setError(payload.error ?? "Unable to load presentation flow.")
            setGame(null)
            return
          }

          const gameData = payload.game
          const newVersion = typeof gameData.version === "number" ? gameData.version : 0

          // Ignore stale responses (version guard)
          if (newVersion < lastFetchVersionRef.current) {
            console.warn("[present] Ignoring stale response", {
              received: newVersion,
              current: lastFetchVersionRef.current,
            })
            return
          }

          lastFetchVersionRef.current = newVersion

        const players: GamePlayer[] = (gameData.players ?? []).map(
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
          pendingFetchRef.current = null
        }
      })()

      pendingFetchRef.current = fetchPromise
      return fetchPromise
    },
    [roomCode],
  )

  const scheduleSnapshotFallback = useCallback(() => {
    clearPendingRefresh()
    pendingRefreshTimeoutRef.current = window.setTimeout(() => {
      fetchGame({ silent: true }).catch((fallbackError) => {
        console.error("Failed to refresh presentation view after realtime fallback", fallbackError)
      })
      pendingRefreshTimeoutRef.current = null
    }, 2000)
  }, [clearPendingRefresh, fetchGame])

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

  const orderedPlayers = useMemo(() => {
    return [...(game?.players ?? [])].sort((a, b) => a.seatIndex - b.seatIndex)
  }, [game?.players])

  const currentPlayer = useMemo(() => {
    if (!storedPlayer) return null
    return orderedPlayers.find((player) => player.id === storedPlayer.id) ?? null
  }, [orderedPlayers, storedPlayer])

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

  const headlineCanvas = useMemo(() => parseCanvasData(currentAdlob?.headlineCanvasData), [currentAdlob])

  const canControlPresent = !!currentPlayer && (currentPlayer.isHost || currentPlayer.id === currentAdlob?.assignedPresenterId)

  const handleRevealCampaign = async () => {
    if (!game || !currentPlayer || !currentAdlob) return
    if (showCampaign) return

    setIsRevealing(true)
    setError(null)

    try {
      await fetchWithRetry(`/api/games/${roomCode}/present`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: currentPlayer.id,
          action: "start",
        }),
      })

      if (realtimeStatus === "connected") {
        sendRealtime({
          type: "presentation_state",
          roomCode,
          playerId: currentPlayer.id,
          presentIndex: currentPresentIndex,
          showCampaign: true,
        })
      }

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
      const response = await fetchWithRetry(`/api/games/${roomCode}/present`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: currentPlayer.id,
          action: "advance",
        }),
      })

      const result = await response.json()
      console.log("[PRESENT DEBUG] API response:", result)

      const nextStatus = typeof result.status === "string" ? result.status : null
      const phaseStartTime = typeof result.phaseStartTime === "string" ? result.phaseStartTime : new Date().toISOString()
      const previousStatus = latestGameRef.current?.status ?? game.status
      const nextPresentIndex = typeof result.nextPresentIndex === "number" ? result.nextPresentIndex : null

      setGame((previous) => {
        if (!previous) return previous
        return {
          ...previous,
          status: nextStatus ?? previous.status,
          currentPresentIndex: nextPresentIndex ?? previous.currentPresentIndex,
          phaseStartTime,
        }
      })

      if (nextStatus && nextStatus !== previousStatus) {
        sendRealtime({
          type: "set_status",
          roomCode,
          playerId: currentPlayer.id,
          status: nextStatus,
          currentPhase: null,
          phaseStartTime,
        })
      }

      if (result.success && result.status === "voting") {
        console.log("[PRESENT DEBUG] Moving to voting, redirecting...")
        if (realtimeStatus !== "connected") {
          await fetchGame({ silent: true })
        }
        router.push(routes.vote(roomCode))
        return
      }

      if (
        result.success &&
        typeof result.nextPresentIndex === "number" &&
        realtimeStatus === "connected"
      ) {
        sendRealtime({
          type: "presentation_state",
          roomCode,
          playerId: currentPlayer.id,
          presentIndex: result.nextPresentIndex,
          showCampaign: false,
        })
      }

      console.log("[PRESENT DEBUG] Not moving to voting, relying on realtime update...")
      if (realtimeStatus !== "connected") {
        await fetchGame({ silent: true })
      } else {
        scheduleSnapshotFallback()
      }
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

  const gameVersion = game?.version

  useEffect(() => {
    if (gameVersion != null) {
      clearPendingRefresh()
    }
  }, [gameVersion, clearPendingRefresh])

  useEffect(() => {
    return () => {
      clearPendingRefresh()
    }
  }, [clearPendingRefresh])

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
        setGame((previous) => (previous ? (mergeSnapshotIntoState(previous, incoming) as PresentGameState) : previous))
        clearPendingRefresh()
      })

      const unsubscribeRoomState = addListener("room_state", ({ snapshot: incoming }) => {
        setGame((previous) => (previous ? (mergeSnapshotIntoState(previous, incoming) as PresentGameState) : previous))
        clearPendingRefresh()
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
        clearPendingRefresh()
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
        clearPendingRefresh()
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
        clearPendingRefresh()
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
        clearPendingRefresh()
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
        clearPendingRefresh()
      })

      const unsubscribePresentationState = addListener("presentation_state", ({ presentIndex, showCampaign }) => {
        setGame((previous) =>
          previous
            ? {
                ...previous,
                currentPresentIndex: presentIndex,
              }
            : previous,
        )
        setShowCampaign(showCampaign)
        setShowPitch(!showCampaign)
        setIsRevealing(false)
        setIsAdvancing(false)
        clearPendingRefresh()
      })

      return [
        unsubscribeHello,
        unsubscribeRoomState,
        unsubscribePlayerJoined,
        unsubscribePlayerLeft,
        unsubscribeReady,
        unsubscribeStatusChanged,
        unsubscribePhaseChanged,
        unsubscribePresentationState,
      ]
    },
    [clearPendingRefresh],
  )

  useRoomRealtime({
    roomCode,
    playerId: storedPlayer?.id ?? null,
    enabled: Boolean(storedPlayer?.id && game),
    getInitialSnapshot,
    registerListeners: registerRealtimeListeners,
    realtime,
  })
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

    // Check for null presenter (should not happen with new assignment logic)
    if (!currentAdlob.assignedPresenterId) {
      return (
        <div className="retro-border bg-destructive p-8 text-center text-destructive-foreground">
          <p className="text-2xl font-bold mb-4">⚠️ Assignment Error</p>
          <p className="text-lg">This campaign has no assigned presenter.</p>
          <p className="text-sm mt-2">Please contact the host to restart the game.</p>
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
      {currentPresenter && (
        <div className="sticky top-6 z-10 mb-6 flex justify-end">
          <div className="retro-border inline-flex items-center gap-3 bg-card/90 px-4 py-2 shadow-md backdrop-blur">
            <span className="text-3xl leading-none">{currentPresenter.emoji}</span>
            <div className="text-left">
              <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Now Presenting</p>
              <p className="text-sm font-semibold">{currentPresenter.name}</p>
            </div>
          </div>
        </div>
      )}
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
              <PlayerList players={orderedPlayers} />
            </section>
          </>
        )}
      </div>
    </main>
  )
}
