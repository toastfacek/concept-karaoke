"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"

import { BriefEditor } from "@/components/brief-editor"
import { BriefLoadingModal } from "@/components/brief-loading-modal"
import { Button } from "@/components/ui/button"
import { PlayerStatus } from "@/components/player-status"
import { loadPlayer, savePlayer, type StoredPlayer } from "@/lib/player-storage"
import { routes } from "@/lib/routes"
import { fetchWithRetry } from "@/lib/fetch-with-retry"
import { useRealtime } from "@/components/realtime-provider"
import { useRoomRealtime, type RoomRealtimeListenerHelpers } from "@/hooks/use-room-realtime"
import { mergeSnapshotIntoState, stateToSnapshot, type SnapshotDrivenState } from "@/lib/realtime/snapshot"
import type { RealtimeStatus } from "@/lib/realtime-client"

type CampaignBrief = {
  productName: string
  productCategory: string
  coverImageUrl?: string
  briefContent: string
}

type BriefRecord = CampaignBrief & {
  id: string
}

type GamePlayer = {
  id: string
  name: string
  emoji: string
  isReady: boolean
  isHost: boolean
  joinedAt: string
  seatIndex: number
}

const EMPTY_BRIEF: CampaignBrief = {
  productName: "",
  productCategory: "",
  briefContent: "",
  coverImageUrl: undefined,
}

type BriefGameState = SnapshotDrivenState<GamePlayer> & {
  brief: BriefRecord | null
}

export default function BriefPage() {
  const router = useRouter()
  const params = useParams()
  const roomCode = (params.roomId as string).toUpperCase()
  const realtime = useRealtime()
  const { send: sendRealtime, status: realtimeStatus } = realtime

  const [storedPlayer, setStoredPlayer] = useState<StoredPlayer | null>(null)
  const [game, setGame] = useState<BriefGameState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUpdatingReady, setIsUpdatingReady] = useState(false)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [showLoadingModal, setShowLoadingModal] = useState(false)
  const [showBriefReveal, setShowBriefReveal] = useState(false)
  const lastRealtimeStatusRef = useRef<RealtimeStatus>("idle")
  const latestGameRef = useRef<BriefGameState | null>(null)
  const initialLoadRef = useRef(true)
  const pendingFetchRef = useRef<Promise<void> | null>(null)
  const lastFetchVersionRef = useRef<number>(0)

  useEffect(() => {
    setStoredPlayer(loadPlayer(roomCode))
  }, [roomCode])

  const fetchGame = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      // Deduplicate concurrent requests
      if (pendingFetchRef.current) {
        console.log("[brief] Deduplicating concurrent fetchGame call")
        return pendingFetchRef.current
      }

      if (!silent) {
        setLoading(true)
        setError(null)
      }

      // Show loading modal on initial load
      if (initialLoadRef.current && !silent) {
        setShowLoadingModal(true)
      }

      const fetchPromise = (async () => {
        try {
          // Brief page only needs players and brief data, not heavy adlobs
          const response = await fetchWithRetry(`/api/games/${roomCode}?include=players,brief`, { cache: "no-store" })
          const payload = await response.json()

          if (!response.ok || !payload.success) {
            setError(payload.error ?? "Unable to load briefing room.")
            setGame(null)
            setShowLoadingModal(false)
            return
          }

          const briefResponse = payload.game.brief
            ? {
              id: payload.game.brief.id,
              productName: payload.game.brief.productName,
              productCategory: payload.game.brief.productCategory,
              coverImageUrl: payload.game.brief.coverImageUrl,
              briefContent: payload.game.brief.briefContent,
            }
            : null

          const gameData = payload.game
          const newVersion = typeof gameData.version === "number" ? gameData.version : 0

          // Ignore stale responses (version guard)
          if (newVersion < lastFetchVersionRef.current) {
            console.warn("[brief] Ignoring stale response", {
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
            id: payload.game.id,
            code: payload.game.code,
            status: payload.game.status,
            hostId: payload.game.hostId,
            players,
            brief: briefResponse,
            version: typeof payload.game.version === "number" ? payload.game.version : 0,
          })

          // Handle loading modal and reveal animation
          const shouldShowReveal = briefResponse && briefResponse.productName
          if (shouldShowReveal) {
            setTimeout(() => {
              setShowLoadingModal(false)
              setTimeout(() => {
                setShowBriefReveal(true)
              }, 200)
            }, 1500) // Keep modal visible for a minimum time for better UX
          }
          // If no brief content yet, keep modal visible (don't hide it)

          if (initialLoadRef.current) {
            initialLoadRef.current = false
          }

          const localPlayer = loadPlayer(roomCode)
          if (localPlayer) {
            const latest = payload.game.players.find((player: GamePlayer) => player.id === localPlayer.id)
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
          setError("Unable to load briefing room.")
          setGame(null)
          setShowLoadingModal(false)
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

  useEffect(() => {
    fetchGame()
  }, [fetchGame])

  useEffect(() => {
    if (realtimeStatus === "disconnected") {
      fetchGame({ silent: true }).catch((error) => {
        console.error("Failed to refresh briefing room after disconnect", error)
      })
    } else if (realtimeStatus === "connected" && lastRealtimeStatusRef.current === "disconnected") {
      fetchGame({ silent: true }).catch((error) => {
        console.error("Failed to refresh briefing room after reconnect", error)
      })
    }
    lastRealtimeStatusRef.current = realtimeStatus
  }, [fetchGame, realtimeStatus])

  const currentPlayer = useMemo(() => {
    if (!storedPlayer || !game) return null
    return game.players.find((player) => player.id === storedPlayer.id) ?? null
  }, [storedPlayer, game])

  const readyCount = useMemo(() => game?.players.filter((player) => player.isReady).length ?? 0, [game])
  const totalPlayers = game?.players.length ?? 0
  const everyoneReady = totalPlayers > 0 && readyCount === totalPlayers
  const isBriefing = game?.status === "briefing"

  const playerStatusData = useMemo(() => {
    return [...(game?.players ?? [])]
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((p) => ({
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        isReady: p.isReady,
        isYou: p.id === currentPlayer?.id,
      }))
  }, [game?.players, currentPlayer?.id])


  const handleToggleReady = async () => {
    if (!currentPlayer) return

    const desiredReady = !currentPlayer.isReady
    setIsUpdatingReady(true)
    setError(null)

    setGame((previous) =>
      previous
        ? {
          ...previous,
          players: previous.players.map((player) =>
            player.id === currentPlayer.id ? { ...player, isReady: desiredReady } : player,
          ),
        }
        : previous,
    )

    sendRealtime({
      type: "set_ready",
      roomCode,
      playerId: currentPlayer.id,
      isReady: desiredReady,
    })

    setIsUpdatingReady(false)

    try {
      const response = await fetch(`/api/games/${roomCode}/players/${currentPlayer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isReady: desiredReady }),
      })

      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to update ready state.")
      }

      await fetchGame({ silent: true })
    } catch (readyError) {
      console.error(readyError)
      setError(readyError instanceof Error ? readyError.message : "Unable to update ready state.")
      setGame((previous) =>
        previous
          ? {
            ...previous,
            players: previous.players.map((player) =>
              player.id === currentPlayer.id ? { ...player, isReady: !desiredReady } : player,
            ),
          }
          : previous,
      )
    } finally {
      setIsUpdatingReady(false)
    }
  }

  const handleRegenerate = async () => {
    if (!game) return
    setError(null)

    try {
      const response = await fetch("/api/briefs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: game.id }),
      })

      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to generate brief")
      }

      await fetchGame({ silent: true })
    } catch (generateError) {
      console.error(generateError)
      setError(generateError instanceof Error ? generateError.message : "Failed to generate brief.")
    }
  }

  const handleAdvanceToCreation = async () => {
    if (!game || !currentPlayer) return

    setIsAdvancing(true)
    setError(null)

    try {
      const response = await fetch(`/api/games/${roomCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "creating",
          playerId: currentPlayer.id,
        }),
      })

      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to advance game")
      }

      const nextStatus = typeof payload.status === "string" ? payload.status : null
      const nextCurrentPhase = payload.currentPhase ?? null
      const phaseStartTime = typeof payload.phaseStartTime === "string" ? payload.phaseStartTime : new Date().toISOString()

      if (nextStatus) {
        setGame((previous) =>
          previous
            ? {
              ...previous,
              status: nextStatus,
            }
            : previous,
        )

        sendRealtime({
          type: "set_status",
          roomCode,
          playerId: currentPlayer.id,
          status: nextStatus,
          currentPhase: nextCurrentPhase,
          phaseStartTime,
        })
      }

      if (payload.status === "creating" && game?.id) {
        const createResponse = await fetch("/api/adlobs/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: game.id,
            briefId: game.brief?.id,
          }),
        })

        if (!createResponse.ok) {
          const createPayload = await createResponse.json().catch(() => null)
          console.error("Failed to create AdLobs", createPayload ?? "")
        }
      }

      if (realtimeStatus !== "connected") {
        await fetchGame({ silent: true })
      }
    } catch (advanceError) {
      console.error(advanceError)
      setError(advanceError instanceof Error ? advanceError.message : "Failed to advance game.")
    } finally {
      setIsAdvancing(false)
    }
  }

  useEffect(() => {
    latestGameRef.current = game
  }, [game])

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
        setGame((previous) => (previous ? (mergeSnapshotIntoState(previous, incoming) as BriefGameState) : previous))
      })

      const unsubscribeRoomState = addListener("room_state", ({ snapshot: incoming }) => {
        setGame((previous) => (previous ? (mergeSnapshotIntoState(previous, incoming) as BriefGameState) : previous))
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
                joinedAt: new Date().toISOString(),
                seatIndex: player.seatIndex,
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

      const unsubscribeStatusChanged = addListener("status_changed", ({ status, version }) => {
        setGame((previous) =>
          previous
            ? {
              ...previous,
              status,
              version,
            }
            : previous,
        )
      })

      const unsubscribePhaseChanged = addListener("phase_changed", ({ version }) => {
        setGame((previous) =>
          previous
            ? {
              ...previous,
              version,
            }
            : previous,
        )
      })

      const unsubscribeBriefUpdated = addListener("brief_updated", ({ version }) => {
        console.log("[brief realtime] brief_updated", { roomCode, version })
        // Show loading modal if brief is being generated for the first time
        const hasBrief = game?.brief?.productName
        if (!hasBrief) {
          setShowLoadingModal(true)
        }
        // Refetch to get latest brief content from database
        fetchGame({ silent: true }).catch((err) => {
          console.error("Failed to refetch after brief update", err)
        })
      })

      return [
        unsubscribeHello,
        unsubscribeRoomState,
        unsubscribeReady,
        unsubscribePlayerJoined,
        unsubscribePlayerLeft,
        unsubscribeStatusChanged,
        unsubscribePhaseChanged,
        unsubscribeBriefUpdated,
      ]
    },
    [setGame, fetchGame, roomCode, game],
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
    if (game.status === "briefing") return

    const destinations: Partial<Record<string, string>> = {
      creating: routes.create(roomCode),
      presenting: routes.present(roomCode),
      voting: routes.vote(roomCode),
      results: routes.results(roomCode),
    }

    const destination = destinations[game.status]
    if (destination) {
      router.push(destination)
    }
  }, [game, router, roomCode])

  return (
    <main className="min-h-screen bg-background">
      <BriefLoadingModal
        isOpen={showLoadingModal}
        category={game?.brief?.productCategory ?? "All"}
      />

      {/* Main Container */}
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        {/* Header */}
        <div className="retro-border bg-card p-6 text-center">
          <h1 className="text-4xl font-bold uppercase">The Brief</h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            Collaborate on the campaign brief, ready up, and let the host launch the creation rounds.
          </p>
        </div>
        {error && <p className="mb-4 font-mono text-sm font-medium text-destructive">{error}</p>}

        <div className="flex gap-6">
          {/* Left Column - Brief Editor & Actions */}
          <div className="flex-1 space-y-6">
            <BriefEditor
              initialBrief={game?.brief ?? undefined}
              onRegenerate={handleRegenerate}
              isRegenerating={loading}
              showReveal={showBriefReveal}
            />

            {/* Info/Instructions */}
            {!currentPlayer && (
              <div className="retro-border bg-card p-8">
                <p className="text-center font-mono text-sm text-muted-foreground">
                  Join this lobby again to participate in the briefing.
                </p>
              </div>
            )}
          </div>

          {/* Right Sidebar - Player Status & Actions */}
          <div className="w-80 shrink-0 space-y-6 sticky top-6 self-start">
            <div className="retro-border bg-card p-4">
              <PlayerStatus players={playerStatusData} />

              {/* Ready Check & Actions */}
              {currentPlayer && (
                <div className="mt-4 pt-4 border-t-2 border-border space-y-3">
                  <Button
                    type="button"
                    onClick={handleToggleReady}
                    size="lg"
                    variant={currentPlayer.isReady ? "secondary" : "default"}
                    className="w-full"
                    disabled={isUpdatingReady || !isBriefing}
                  >
                    {isUpdatingReady ? "Updating..." : currentPlayer.isReady ? "Not Ready" : "Ready Up"}
                  </Button>

                  {currentPlayer.isHost && (
                    <>
                      <Button
                        type="button"
                        onClick={handleAdvanceToCreation}
                        size="lg"
                        className="w-full"
                        disabled={!everyoneReady || isAdvancing || !isBriefing}
                      >
                        {isAdvancing ? "Starting..." : "Start Creation Rounds"}
                      </Button>
                      {!everyoneReady && (
                        <p className="text-center text-xs text-muted-foreground">
                          Waiting for all players to ready up...
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
