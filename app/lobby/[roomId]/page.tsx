"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Copy, Check } from "lucide-react"

import { useRealtime } from "@/components/realtime-provider"
import { Button } from "@/components/ui/button"
import { PlayerStatus } from "@/components/player-status"
import { GameSettings } from "@/components/game-settings"
import { useRoomRealtime, type RoomRealtimeListenerHelpers } from "@/hooks/use-room-realtime"
import { loadPlayer, savePlayer, type StoredPlayer } from "@/lib/player-storage"
import { routes } from "@/lib/routes"
import { mergeSnapshotIntoState, stateToSnapshot, type SnapshotDrivenState } from "@/lib/realtime/snapshot"
import type { RealtimeStatus } from "@/lib/realtime-client"
import type { BriefStyle, ProductCategory, PhaseDuration } from "@/lib/types"

type LobbyPlayer = {
  id: string
  name: string
  emoji: string
  isReady: boolean
  isHost: boolean
  joinedAt: string
  seatIndex: number
}

type LobbyState = SnapshotDrivenState<LobbyPlayer> & {
  productCategory: string
  phaseDurationSeconds: number
  briefStyle: string
}

export default function LobbyPage() {
  const router = useRouter()
  const params = useParams()
  const roomCode = (params.roomId as string).toUpperCase()
  const realtime = useRealtime()
  const { status: realtimeStatus } = realtime

  const [storedPlayer, setStoredPlayer] = useState<StoredPlayer | null>(null)
  const [lobby, setLobby] = useState<LobbyState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isUpdatingReady, setIsUpdatingReady] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const lastRealtimeStatusRef = useRef<RealtimeStatus>("idle")
  const latestLobbyRef = useRef<LobbyState | null>(null)
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

  const fetchLobby = useCallback(
    async ({ silent = false, force = false }: { silent?: boolean; force?: boolean } = {}) => {
      // Deduplicate concurrent requests
      if (pendingFetchRef.current && !force) {
        console.log("[lobby] Deduplicating concurrent fetchLobby call")
        return pendingFetchRef.current
      }

      if (!silent) {
        setLoading(true)
        setError(null)
      }

      const fetchPromise = (async () => {
        try {
          const response = await fetch(`/api/games/${roomCode}`, { cache: "no-store" })
          const payload = await response.json()

          if (!response.ok || !payload.success) {
            setError(payload.error ?? "Unable to load lobby.")
            setLobby(null)
            return
          }

          const newVersion = typeof payload.game.version === "number" ? payload.game.version : 0

          // Ignore stale responses
          if (newVersion < lastFetchVersionRef.current) {
            console.warn("[lobby] Ignoring stale response", {
              received: newVersion,
              current: lastFetchVersionRef.current,
            })
            return
          }

          lastFetchVersionRef.current = newVersion

          const players: LobbyPlayer[] = (payload.game.players ?? []).map(
            (player: Partial<LobbyPlayer> & { joined_at?: string; seat_index?: number }) => ({
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

          setLobby({
            id: payload.game.id,
            code: payload.game.code,
            status: payload.game.status,
            hostId: payload.game.hostId,
            players,
            version: newVersion,
            productCategory: payload.game.productCategory ?? "All",
            phaseDurationSeconds: payload.game.phaseDurationSeconds ?? 60,
            briefStyle: payload.game.briefStyle ?? "wacky",
          })

          const localPlayer = loadPlayer(roomCode)
          if (localPlayer) {
            const latestPlayer = players.find((player) => player.id === localPlayer.id)
            if (latestPlayer) {
              const syncedPlayer: StoredPlayer = {
                id: latestPlayer.id,
                name: latestPlayer.name,
                emoji: latestPlayer.emoji,
                isHost: latestPlayer.isHost,
              }
              savePlayer(roomCode, syncedPlayer)
              setStoredPlayer(syncedPlayer)
            }
          }
        } catch (fetchError) {
          console.error(fetchError)
          setError("Unable to load lobby.")
          setLobby(null)
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
      fetchLobby({ silent: true }).catch((fallbackError) => {
        console.error("Failed to refresh lobby after realtime fallback", fallbackError)
      })
      pendingRefreshTimeoutRef.current = null
    }, 2000)
  }, [clearPendingRefresh, fetchLobby])

  useEffect(() => {
    fetchLobby()
  }, [fetchLobby])

  useEffect(() => {
    latestLobbyRef.current = lobby
  }, [lobby])

  const lobbyVersion = lobby?.version

  useEffect(() => {
    if (lobbyVersion != null) {
      clearPendingRefresh()
    }
  }, [lobbyVersion, clearPendingRefresh])

  useEffect(() => {
    return () => {
      clearPendingRefresh()
    }
  }, [clearPendingRefresh])

  useEffect(() => {
    if (realtimeStatus === "disconnected") {
      fetchLobby({ silent: true }).catch((error) => {
        console.error("Failed to refresh lobby after disconnect", error)
      })
    } else if (realtimeStatus === "connected" && lastRealtimeStatusRef.current === "disconnected") {
      fetchLobby({ silent: true }).catch((error) => {
        console.error("Failed to refresh lobby after reconnect", error)
      })
    }
    lastRealtimeStatusRef.current = realtimeStatus
  }, [fetchLobby, realtimeStatus])

  const currentPlayer = useMemo(() => {
    if (!storedPlayer || !lobby) return null
    return lobby.players.find((player) => player.id === storedPlayer.id) ?? null
  }, [storedPlayer, lobby])

  const isHost = currentPlayer?.isHost ?? false
  const isReady = currentPlayer?.isReady ?? false
  const allReady = lobby?.players.every((player) => player.isReady) ?? false
  const minPlayers = (lobby?.players.length ?? 0) >= 1

  const playerStatusData = useMemo(() => {
    return [...(lobby?.players ?? [])]
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((p) => ({
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        isReady: p.isReady,
        isYou: p.id === currentPlayer?.id,
      }))
  }, [lobby?.players, currentPlayer?.id])

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToggleReady = async () => {
    if (!currentPlayer) return

    const desiredReady = !isReady
    setIsUpdatingReady(true)
    setError(null)

    setLobby((previous) =>
      previous
        ? {
            ...previous,
            players: previous.players.map((player) =>
              player.id === currentPlayer.id ? { ...player, isReady: desiredReady } : player,
            ),
          }
        : previous,
    )

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

      const nextStatus = typeof payload.status === "string" ? payload.status : null

      if (nextStatus) {
        setLobby((previous) =>
          previous
            ? {
                ...previous,
                status: nextStatus,
              }
            : previous,
        )
      }

      if (realtimeStatus !== "connected") {
        await fetchLobby({ silent: true })
      } else {
        scheduleSnapshotFallback()
      }
    } catch (readyError) {
      console.error(readyError)
      setError(readyError instanceof Error ? readyError.message : "Unable to update ready state.")
      setLobby((previous) =>
        previous
          ? {
              ...previous,
              players: previous.players.map((player) =>
                player.id === currentPlayer.id ? { ...player, isReady } : player,
              ),
            }
          : previous,
      )
    } finally {
      setIsUpdatingReady(false)
    }
  }

  const handleStartGame = async () => {
    if (!lobby || !currentPlayer) return

    setIsStarting(true)
    setError(null)

    try {
      const response = await fetch("/api/games/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: lobby.code,
          playerId: currentPlayer.id,
        }),
      })

      const payload = await response.json()

      if (!response.ok || !payload.success) {
        setError(payload.error ?? "Unable to start game.")
        return
      }

      const nextStatus = typeof payload.status === "string" ? payload.status : null

      if (nextStatus) {
        setLobby((previous) =>
          previous
            ? {
                ...previous,
                status: nextStatus,
              }
            : previous,
        )
      }

      if (realtimeStatus !== "connected") {
        await fetchLobby({ silent: true })
      } else {
        scheduleSnapshotFallback()
      }
    } catch (startError) {
      console.error(startError)
      setError("Unable to start game.")
    } finally {
      setIsStarting(false)
    }
  }

  const handleSettingsChange = (settings: { productCategory: string; phaseDurationSeconds: number; briefStyle: string }) => {
    setLobby((previous) =>
      previous
        ? {
            ...previous,
            productCategory: settings.productCategory,
            phaseDurationSeconds: settings.phaseDurationSeconds,
            briefStyle: settings.briefStyle,
          }
        : previous,
    )
  }

  const getInitialSnapshot = useCallback(() => {
    if (lobby) {
      return stateToSnapshot(lobby)
    }
    const snapshotSource = latestLobbyRef.current
    return snapshotSource ? stateToSnapshot(snapshotSource) : null
  }, [lobby])

  const registerRealtimeListeners = useCallback(
    ({ addListener }: RoomRealtimeListenerHelpers) => {
      const unsubscribeHello = addListener("hello_ack", ({ snapshot: incoming }) => {
        console.log("[lobby realtime] hello_ack", { roomCode, version: incoming.version, players: incoming.players.length })
        setLobby((previous) => (previous ? (mergeSnapshotIntoState(previous, incoming) as LobbyState) : previous))
        clearPendingRefresh()
      })

      const unsubscribeRoomState = addListener("room_state", ({ snapshot: incoming }) => {
        console.log("[lobby realtime] room_state", { roomCode, version: incoming.version, players: incoming.players.length })
        setLobby((previous) => (previous ? (mergeSnapshotIntoState(previous, incoming) as LobbyState) : previous))
        clearPendingRefresh()
      })

      const unsubscribeReady = addListener("ready_update", ({ playerId: readyPlayerId, isReady, version }) => {
        console.log("[lobby realtime] ready_update", { roomCode, playerId: readyPlayerId, isReady, version })
        setLobby((previous) =>
          previous
            ? {
                ...previous,
                version,
                players: previous.players.map((player) => (player.id === readyPlayerId ? { ...player, isReady } : player)),
              }
            : previous,
        )
        clearPendingRefresh()
      })

      const unsubscribePlayerJoined = addListener("player_joined", ({ player, version }) => {
        console.log("[lobby realtime] player_joined", { roomCode, playerId: player.id, version })
        setLobby((previous) => {
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
        clearPendingRefresh()
      })

      const unsubscribePlayerLeft = addListener("player_left", ({ playerId: leftPlayerId, version }) => {
        console.log("[lobby realtime] player_left", { roomCode, playerId: leftPlayerId, version })
        setLobby((previous) =>
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

      const unsubscribeStatusChanged = addListener("status_changed", ({ status, version }) => {
        console.log("[lobby realtime] status_changed", { roomCode, status, version })
        setLobby((previous) =>
          previous
            ? {
                ...previous,
                status,
                version,
            }
          : previous,
        )
        clearPendingRefresh()
      })

      const unsubscribePhaseChanged = addListener("phase_changed", ({ version }) => {
        console.log("[lobby realtime] phase_changed", { roomCode, version })
        setLobby((previous) =>
          previous
            ? {
                ...previous,
                version,
            }
          : previous,
        )
        clearPendingRefresh()
      })

      const unsubscribeSettingsChanged = addListener(
        "settings_changed",
        ({ productCategory, phaseDurationSeconds, version }) => {
          console.log("[lobby realtime] settings_changed", {
            roomCode,
            productCategory,
            phaseDurationSeconds,
            version,
          })
          setLobby((previous) =>
            previous
              ? {
                  ...previous,
                  version,
                  productCategory,
                  phaseDurationSeconds,
                }
              : previous,
          )
          clearPendingRefresh()
        },
      )

      return [
        unsubscribeHello,
        unsubscribeRoomState,
        unsubscribeReady,
        unsubscribePlayerJoined,
        unsubscribePlayerLeft,
        unsubscribeStatusChanged,
        unsubscribePhaseChanged,
        unsubscribeSettingsChanged,
      ]
    },
    [clearPendingRefresh, roomCode],
  )

  useRoomRealtime({
    roomCode,
    playerId: storedPlayer?.id ?? null,
    enabled: Boolean(storedPlayer?.id && lobby),
    getInitialSnapshot,
    registerListeners: registerRealtimeListeners,
    realtime,
  })

  useEffect(() => {
    if (!lobby) return
    if (lobby.status === "lobby") return

    const destinations: Partial<Record<string, string>> = {
      briefing: routes.brief(roomCode),
      creating: routes.create(roomCode),
      presenting: routes.present(roomCode),
      voting: routes.vote(roomCode),
      results: routes.results(roomCode),
    }

    const destination = destinations[lobby.status] ?? null
    if (destination) {
      router.push(destination)
    }
  }, [lobby, router, roomCode])

  return (
    <main className="min-h-screen bg-background p-6">
      {/* Main Container */}
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header with Game Code */}
        <div className="retro-border bg-card p-8 text-center">
          <h1 className="mb-4 text-5xl font-bold uppercase">Game Lobby</h1>

          <div className="retro-border inline-flex items-center gap-4 bg-primary px-8 py-4 text-primary-foreground">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider">Game Code</p>
              <p className="text-3xl font-bold tracking-widest">{roomCode}</p>
            </div>
            <Button size="icon" variant="secondary" onClick={handleCopyCode} className="shrink-0">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>

          <p className="mt-4 font-mono text-sm text-muted-foreground">Share this code with your friends to join</p>
        </div>

        {/* 2-Column Layout */}
        <div className="flex gap-6">
          {/* Left Column - Main Content */}
          <div className="flex-1 space-y-6">
            {/* Game Settings */}
            {lobby && currentPlayer && (
              <GameSettings
                productCategory={lobby.productCategory as ProductCategory}
                phaseDurationSeconds={lobby.phaseDurationSeconds as PhaseDuration}
                briefStyle={lobby.briefStyle as BriefStyle}
                isHost={isHost}
                roomCode={roomCode}
                playerId={currentPlayer.id}
                onSettingsChange={handleSettingsChange}
              />
            )}

            {/* Info/Instructions */}
            {!currentPlayer && !loading && (
              <div className="retro-border bg-card p-8">
                <p className="text-center font-mono text-sm text-muted-foreground">
                  We couldn&apos;t find your player in this lobby. Join again with the code to participate.
                </p>
              </div>
            )}

            {error && (
              <div className="retro-border bg-card p-8">
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
            )}
          </div>

          {/* Right Sidebar - Player Status & Actions */}
          <div className="w-80 shrink-0 space-y-6 sticky top-6 self-start">
            <div className="retro-border bg-card p-4">
              <PlayerStatus players={playerStatusData} />

              {/* Ready Actions */}
              {currentPlayer && (
                <div className="mt-4 pt-4 border-t-2 border-border space-y-3">
                  <Button
                    onClick={handleToggleReady}
                    size="lg"
                    variant={isReady ? "secondary" : "default"}
                    className="w-full"
                    disabled={isUpdatingReady}
                  >
                    {isUpdatingReady ? "Updating..." : isReady ? "Not Ready" : "Ready Up"}
                  </Button>

                  {isHost && (
                    <>
                      <Button
                        onClick={handleStartGame}
                        disabled={!allReady || !minPlayers || isStarting}
                        size="lg"
                        className="w-full"
                      >
                        {isStarting ? "Starting..." : "Start Game"}
                      </Button>
                      {!minPlayers && (
                        <p className="text-center text-xs text-muted-foreground">
                          Need at least one player to start
                        </p>
                      )}
                      {minPlayers && !allReady && (
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
