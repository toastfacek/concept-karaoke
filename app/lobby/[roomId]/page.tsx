"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Copy, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PlayerList } from "@/components/player-list"
import { TABLES } from "@/lib/db"
import { loadPlayer, savePlayer, type StoredPlayer } from "@/lib/player-storage"
import { roomChannel } from "@/lib/realtime"
import { routes } from "@/lib/routes"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser"

type LobbyPlayer = {
  id: string
  name: string
  emoji: string
  isReady: boolean
  isHost: boolean
}

export default function LobbyPage() {
  const router = useRouter()
  const params = useParams()
  const roomCode = (params.roomId as string).toUpperCase()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  const [storedPlayer, setStoredPlayer] = useState<StoredPlayer | null>(null)
  const [lobby, setLobby] = useState<{
    id: string
    code: string
    status: string
    players: LobbyPlayer[]
    hostId: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isUpdatingReady, setIsUpdatingReady] = useState(false)
  const [isStarting, setIsStarting] = useState(false)

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

        const players: LobbyPlayer[] = payload.game.players ?? []

        setLobby({
          id: payload.game.id,
          code: payload.game.code,
          status: payload.game.status,
          hostId: payload.game.hostId,
          players,
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

  const currentPlayer = useMemo(() => {
    if (!storedPlayer || !lobby) return null
    return lobby.players.find((player) => player.id === storedPlayer.id) ?? null
  }, [storedPlayer, lobby])

  const isHost = currentPlayer?.isHost ?? false
  const isReady = currentPlayer?.isReady ?? false
  const allReady = lobby?.players.every((player) => player.isReady) ?? false
  const minPlayers = (lobby?.players.length ?? 0) >= 3

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToggleReady = async () => {
    if (!currentPlayer) return

    setIsUpdatingReady(true)
    setError(null)

    try {
      const response = await fetch(`/api/games/${roomCode}/players/${currentPlayer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isReady: !isReady }),
      })

      const payload = await response.json()

      if (!response.ok || !payload.success) {
        setError(payload.error ?? "Unable to update ready state.")
        return
      }

      setLobby((previous) =>
        previous
          ? {
              ...previous,
              players: previous.players.map((player) =>
                player.id === currentPlayer.id ? { ...player, isReady: payload.player.isReady } : player,
              ),
            }
          : previous,
      )
    } catch (readyError) {
      console.error(readyError)
      setError("Unable to update ready state.")
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
    if (!lobby?.id) {
      return
    }

    const channel = supabase
      .channel(roomChannel(lobby.code))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLES.players, filter: `room_id=eq.${lobby.id}` },
        () => {
          fetchLobby({ silent: true })
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: TABLES.gameRooms, filter: `id=eq.${lobby.id}` },
        () => {
          fetchLobby({ silent: true })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, lobby?.id, lobby?.code, fetchLobby])

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
                  onClick={handleStartGame}
                  disabled={!allReady || !minPlayers || isStarting}
                  size="lg"
                  className="w-full"
                >
                  {isStarting ? "Starting..." : "Start Game"}
                </Button>
                {!minPlayers && (
                  <p className="text-center font-mono text-sm text-muted-foreground">
                    Need at least 3 players to start
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
