"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"

import { BriefEditor } from "@/components/brief-editor"
import { BriefLoadingModal } from "@/components/brief-loading-modal"
import { Button } from "@/components/ui/button"
import { PlayerStatus } from "@/components/player-status"
import { loadPlayer, savePlayer, type StoredPlayer } from "@/lib/player-storage"
import { routes } from "@/lib/routes"
import { useRealtime } from "@/components/realtime-provider"
import { useRoomRealtime, type RoomRealtimeListenerHelpers } from "@/hooks/use-room-realtime"
import { mergeSnapshotIntoState, stateToSnapshot, type SnapshotDrivenState } from "@/lib/realtime/snapshot"
import type { RealtimeStatus } from "@/lib/realtime-client"

type CampaignBrief = {
  productName: string
  productCategory: string
  businessProblem: string
  targetAudience: string
  objective: string
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
}

const EMPTY_BRIEF: CampaignBrief = {
  productName: "",
  productCategory: "",
  businessProblem: "",
  targetAudience: "",
  objective: "",
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
  const [briefDraft, setBriefDraft] = useState<CampaignBrief>(EMPTY_BRIEF)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSavingBrief, setIsSavingBrief] = useState(false)
  const [isLockingBrief, setIsLockingBrief] = useState(false)
  const [isUpdatingReady, setIsUpdatingReady] = useState(false)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [showLoadingModal, setShowLoadingModal] = useState(false)
  const [showBriefReveal, setShowBriefReveal] = useState(false)
  const lastRealtimeStatusRef = useRef<RealtimeStatus>("idle")
  const latestGameRef = useRef<BriefGameState | null>(null)
  const initialLoadRef = useRef(true)

  useEffect(() => {
    setStoredPlayer(loadPlayer(roomCode))
  }, [roomCode])

  const fetchGame = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) {
        setLoading(true)
        setError(null)
      }

      // Show loading modal on initial load
      if (initialLoadRef.current && !silent) {
        setShowLoadingModal(true)
      }

      try {
        const response = await fetch(`/api/games/${roomCode}`, { cache: "no-store" })
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
              businessProblem: payload.game.brief.businessProblem,
              targetAudience: payload.game.brief.targetAudience,
              objective: payload.game.brief.objective,
            }
          : null

        const players: GamePlayer[] = (payload.game.players ?? []).map((player: GamePlayer & { joined_at?: string }) => ({
          id: player.id,
          name: player.name,
          emoji: player.emoji,
          isReady: player.isReady,
          isHost: player.isHost,
          joinedAt: player.joinedAt ?? player.joined_at ?? new Date().toISOString(),
        }))

        setGame({
          id: payload.game.id,
          code: payload.game.code,
          status: payload.game.status,
          hostId: payload.game.hostId,
          players,
          brief: briefResponse,
          version: typeof payload.game.version === "number" ? payload.game.version : 0,
        })

        setBriefDraft(briefResponse ?? EMPTY_BRIEF)

        // If this is initial load and brief has content, trigger reveal animation
        if (initialLoadRef.current && briefResponse && briefResponse.productName) {
          setTimeout(() => {
            setShowLoadingModal(false)
            setTimeout(() => {
              setShowBriefReveal(true)
            }, 200)
          }, 1500) // Keep modal visible for a minimum time for better UX
          initialLoadRef.current = false
        } else if (initialLoadRef.current) {
          setShowLoadingModal(false)
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
    return (game?.players ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      isReady: p.isReady,
      isYou: p.id === currentPlayer?.id,
    }))
  }, [game?.players, currentPlayer?.id])

  const persistBrief = useCallback(
    async (draft: CampaignBrief) => {
      if (!game?.brief) {
        throw new Error("Brief not ready yet.")
      }

      const response = await fetch(`/api/briefs/${game.brief.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: draft.productName,
          productCategory: draft.productCategory,
          businessProblem: draft.businessProblem,
          targetAudience: draft.targetAudience,
          objective: draft.objective,
        }),
      })

      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to save brief")
      }

      const updatedBrief: BriefRecord = {
        id: payload.brief.id,
        productName: payload.brief.productName,
        productCategory: payload.brief.productCategory,
        businessProblem: payload.brief.businessProblem,
        targetAudience: payload.brief.targetAudience,
        objective: payload.brief.objective,
      }

      setGame((previous) =>
        previous
          ? {
              ...previous,
              brief: updatedBrief,
            }
          : previous,
      )
      setBriefDraft(updatedBrief)

      return updatedBrief
    },
    [game],
  )

  const handleSaveBrief = async (draft: CampaignBrief) => {
    setIsSavingBrief(true)
    setError(null)
    try {
      await persistBrief(draft)
    } catch (saveError) {
      console.error(saveError)
      setError(saveError instanceof Error ? saveError.message : "Failed to save brief.")
    } finally {
      setIsSavingBrief(false)
    }
  }

  const handleLockBrief = async (draft: CampaignBrief) => {
    if (!currentPlayer) return

    setIsLockingBrief(true)
    setError(null)
    try {
      await persistBrief(draft)

      const response = await fetch(`/api/games/${roomCode}/players/${currentPlayer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isReady: true }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to lock brief")
      }

      sendRealtime({
        type: "set_ready",
        roomCode,
        playerId: currentPlayer.id,
        isReady: true,
      })

      setGame((previous) =>
        previous
          ? {
              ...previous,
              players: previous.players.map((player) =>
                player.id === currentPlayer.id ? { ...player, isReady: true } : player,
              ),
            }
          : previous,
      )
    } catch (lockError) {
      console.error(lockError)
      setError(lockError instanceof Error ? lockError.message : "Failed to lock brief.")
    } finally {
      setIsLockingBrief(false)
    }
  }

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

      const generated: CampaignBrief = {
        productName: payload.brief.productName,
        productCategory: payload.brief.productCategory,
        businessProblem: payload.brief.businessProblem,
        targetAudience: payload.brief.targetAudience,
        objective: payload.brief.objective,
      }

      setBriefDraft(generated)
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

      await fetchGame({ silent: true })
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
    const snapshotSource = latestGameRef.current
    return snapshotSource ? stateToSnapshot(snapshotSource) : null
  }, [])

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

      const unsubscribePhaseChanged = addListener("phase_changed", ({ version }) => {
        setGame((previous) =>
          previous
            ? {
                ...previous,
                version,
                status: previous.status === "creating" ? previous.status : "creating",
              }
            : previous,
        )
        fetchGame({ silent: true }).catch((error) => {
          console.error("Failed to refresh briefing room after phase change", error)
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
    [fetchGame, setGame],
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

      {/* Header */}
      <header className="retro-border border-b-4 bg-card p-6 text-center">
        <h1 className="text-4xl font-bold uppercase">Brief Generation</h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          Collaborate on the campaign brief, ready up, and let the host launch the creation rounds.
        </p>
      </header>

      {/* Main 2-Column Layout */}
      <div className="mx-auto max-w-7xl p-6">
        {error && <p className="mb-4 font-mono text-sm font-medium text-destructive">{error}</p>}

        <div className="flex gap-6">
          {/* Left Column - Brief Editor & Actions */}
          <div className="flex-1 space-y-6">
            <BriefEditor
              initialBrief={briefDraft}
              onChange={setBriefDraft}
              onSave={handleSaveBrief}
              onLock={currentPlayer?.isHost ? handleLockBrief : undefined}
              onRegenerate={handleRegenerate}
              isLocked={!isBriefing || loading}
              isSaving={isSavingBrief}
              isLocking={isLockingBrief}
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
