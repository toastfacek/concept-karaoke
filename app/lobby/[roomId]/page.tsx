"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Copy, Check } from "lucide-react"

import { useRealtime } from "@/components/realtime-provider"
import { Button } from "@/components/ui/button"
import { PlayerList } from "@/components/player-list"
import { loadPlayer, savePlayer, type StoredPlayer } from "@/lib/player-storage"
import { routes } from "@/lib/routes"
import { mergeSnapshotIntoState, stateToSnapshot, type SnapshotDrivenState } from "@/lib/realtime/snapshot"
import type { RealtimeStatus } from "@/lib/realtime-client"
import { fetchRealtimeToken, type RealtimeToken } from "@/lib/realtime/token"

type LobbyPlayer = {
  id: string
  name: string
  emoji: string
  isReady: boolean
  isHost: boolean
  joinedAt: string
}

type LobbyState = SnapshotDrivenState<LobbyPlayer>

export default function LobbyPage() {
  const router = useRouter()
  const params = useParams()
  const roomCode = (params.roomId as string).toUpperCase()
  const {
    connect: connectRealtime,
    disconnect: disconnectRealtime,
    send: sendRealtime,
    addListener: addRealtimeListener,
    status: realtimeStatus,
  } = useRealtime()

  const [storedPlayer, setStoredPlayer] = useState<StoredPlayer | null>(null)
  const [lobby, setLobby] = useState<LobbyState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isUpdatingReady, setIsUpdatingReady] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const realtimeConnectionKeyRef = useRef<string | null>(null)
  const lastRealtimeStatusRef = useRef<RealtimeStatus>("idle")
  const tokenRef = useRef<RealtimeToken | null>(null)
  const latestLobbyRef = useRef<LobbyState | null>(null)

  useEffect(() => {
    setStoredPlayer(loadPlayer(roomCode))
  }, [roomCode])

  const fetchLobby = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) {
        setLoading(true)
        setError(null)
      }

      try {
        const response = await fetch(`/api/games/${roomCode}`, { cache: "no-store" })
        const payload = await response.json()

        if (!response.ok || !payload.success) {
          setError(payload.error ?? "Unable to load lobby.")
          setLobby(null)
          return
        }

        const players: LobbyPlayer[] = (payload.game.players ?? []).map((player: LobbyPlayer & { joined_at?: string }) => ({
          id: player.id,
          name: player.name,
          emoji: player.emoji,
          isReady: player.isReady,
          isHost: player.isHost,
          joinedAt: player.joinedAt ?? player.joined_at ?? new Date().toISOString(),
        }))

        setLobby({
          id: payload.game.id,
          code: payload.game.code,
          status: payload.game.status,
          hostId: payload.game.hostId,
          players,
          version: typeof payload.game.version === "number" ? payload.game.version : 0,
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
      }
    },
    [roomCode],
  )

  useEffect(() => {
    fetchLobby()
  }, [fetchLobby])

  useEffect(() => {
    latestLobbyRef.current = lobby
  }, [lobby])

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

    sendRealtime({
      type: "set_ready",
      roomCode,
      playerId: currentPlayer.id,
      isReady: desiredReady,
    })

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

      await fetchLobby({ silent: true })
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

      await fetchLobby({ silent: true })
    } catch (startError) {
      console.error(startError)
      setError("Unable to start game.")
    } finally {
      setIsStarting(false)
    }
  }

  useEffect(() => {
    const snapshotSource = latestLobbyRef.current
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
          setLobby((previous) => (previous ? (mergeSnapshotIntoState(previous, incoming) as LobbyState) : previous))
        })

        const unsubscribeRoomState = addRealtimeListener("room_state", ({ snapshot: incoming }) => {
          setLobby((previous) => (previous ? (mergeSnapshotIntoState(previous, incoming) as LobbyState) : previous))
        })

        const unsubscribeReady = addRealtimeListener("ready_update", ({ playerId: readyPlayerId, isReady, version }) => {
          setLobby((previous) =>
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

        const unsubscribePlayerJoined = addRealtimeListener("player_joined", ({ player, version }) => {
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
        })

        const unsubscribePlayerLeft = addRealtimeListener("player_left", ({ playerId: leftPlayerId, version }) => {
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
        })

        const unsubscribePhaseChanged = addRealtimeListener("phase_changed", ({ version }) => {
          setLobby((previous) =>
            previous
              ? {
                  ...previous,
                  version,
                  status: previous.status === "creating" ? previous.status : "creating",
                }
              : previous,
          )
          fetchLobby({ silent: true }).catch((error) => {
            console.error("Failed to refresh lobby after phase change", error)
          })
        })

        cleanupFns = [
          unsubscribeHello,
          unsubscribeRoomState,
          unsubscribeReady,
          unsubscribePlayerJoined,
          unsubscribePlayerLeft,
          unsubscribePhaseChanged,
        ]
      } catch (error) {
        console.error("Failed to initialize lobby realtime connection", error)
      }
    }

    void initialize()

    return () => {
      cancelled = true
      cleanupFns.forEach((fn) => fn())
      disconnectRealtime()
      realtimeConnectionKeyRef.current = null
    }
  }, [addRealtimeListener, connectRealtime, disconnectRealtime, fetchLobby, roomCode, storedPlayer?.id])

  useEffect(() => {
    if (!lobby) return
    if (lobby.status === "lobby") return

    const destinations: Partial<Record<string, string>> = {
      briefing: routes.brief(roomCode),
      creating: routes.create(roomCode),
      pitching: routes.pitch(roomCode),
      voting: routes.vote(roomCode),
      results: routes.results(roomCode),
    }

    const destination = destinations[lobby.status] ?? null
    if (destination) {
      router.push(destination)
    }
  }, [lobby, router, roomCode])

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-8">
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

        <div className="retro-border bg-card p-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold uppercase">
              Players ({lobby?.players.length ?? 0}/8)
            </h2>
            <Button variant="ghost" size="sm" onClick={() => fetchLobby()} disabled={loading}>
              Refresh
            </Button>
          </div>

          {error && <p className="mb-4 text-sm font-medium text-destructive">{error}</p>}

          {loading && <p className="font-mono text-sm text-muted-foreground">Loading lobby...</p>}

          {!loading && lobby && lobby.players.length > 0 && <PlayerList players={lobby.players} showReady />}

          {!loading && lobby && lobby.players.length === 0 && (
            <p className="font-mono text-sm text-muted-foreground">No players in the lobby yet.</p>
          )}

          {!loading && !lobby && !error && (
            <p className="font-mono text-sm text-muted-foreground">Lobby unavailable. Try rejoining.</p>
          )}
        </div>

        <div className="retro-border bg-card p-8">
          <div className="space-y-4">
            {!currentPlayer && (
              <p className="text-center font-mono text-sm text-muted-foreground">
                We couldn&apos;t find your player in this lobby. Join again with the code to participate.
              </p>
            )}

            {currentPlayer && !isHost && (
              <Button
                onClick={handleToggleReady}
                size="lg"
                variant={isReady ? "secondary" : "default"}
                className="w-full"
                disabled={isUpdatingReady}
              >
                {isUpdatingReady ? "Updating..." : isReady ? "Not Ready" : "Ready Up"}
              </Button>
            )}

            {currentPlayer && isHost && (
              <>
                <Button
                  onClick={handleToggleReady}
                  size="lg"
                  variant={isReady ? "secondary" : "default"}
                  className="w-full"
                  disabled={isUpdatingReady}
                >
                  {isUpdatingReady ? "Updating..." : isReady ? "Mark Not Ready" : "Ready Up"}
                </Button>
                <Button
                  onClick={handleStartGame}
                  disabled={!allReady || !minPlayers || isStarting}
                  size="lg"
                  className="w-full"
                >
                  {isStarting ? "Starting..." : "Start Game"}
                </Button>
                {!minPlayers && (
                  <p className="text-center font-mono text-sm text-muted-foreground">
                    Need at least one player to start
                  </p>
                )}
                {minPlayers && !allReady && (
                  <p className="text-center font-mono text-sm text-muted-foreground">
                    Waiting for all players to ready up...
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
