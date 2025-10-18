"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"

import { BriefEditor } from "@/components/brief-editor"
import { Button } from "@/components/ui/button"
import { PlayerList } from "@/components/player-list"
import { TABLES } from "@/lib/db"
import { loadPlayer, savePlayer, type StoredPlayer } from "@/lib/player-storage"
import { roomChannel } from "@/lib/realtime"
import { routes } from "@/lib/routes"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser"

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
}

const EMPTY_BRIEF: CampaignBrief = {
  productName: "",
  productCategory: "",
  businessProblem: "",
  targetAudience: "",
  objective: "",
}

export default function BriefPage() {
  const router = useRouter()
  const params = useParams()
  const roomCode = (params.roomId as string).toUpperCase()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  const [storedPlayer, setStoredPlayer] = useState<StoredPlayer | null>(null)
  const [game, setGame] = useState<{
    id: string
    code: string
    status: string
    hostId: string
    players: GamePlayer[]
    brief: BriefRecord | null
  } | null>(null)
  const [briefDraft, setBriefDraft] = useState<CampaignBrief>(EMPTY_BRIEF)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSavingBrief, setIsSavingBrief] = useState(false)
  const [isLockingBrief, setIsLockingBrief] = useState(false)
  const [isUpdatingReady, setIsUpdatingReady] = useState(false)
  const [isAdvancing, setIsAdvancing] = useState(false)

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
          setError(payload.error ?? "Unable to load briefing room.")
          setGame(null)
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

        setGame({
          id: payload.game.id,
          code: payload.game.code,
          status: payload.game.status,
          hostId: payload.game.hostId,
          players: payload.game.players,
          brief: briefResponse,
        })

        setBriefDraft(briefResponse ?? EMPTY_BRIEF)

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

  const currentPlayer = useMemo(() => {
    if (!storedPlayer || !game) return null
    return game.players.find((player) => player.id === storedPlayer.id) ?? null
  }, [storedPlayer, game])

  const readyCount = useMemo(() => game?.players.filter((player) => player.isReady).length ?? 0, [game])
  const totalPlayers = game?.players.length ?? 0
  const everyoneReady = totalPlayers > 0 && readyCount === totalPlayers
  const isBriefing = game?.status === "briefing"

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
    } catch (lockError) {
      console.error(lockError)
      setError(lockError instanceof Error ? lockError.message : "Failed to lock brief.")
    } finally {
      setIsLockingBrief(false)
    }
  }

  const handleToggleReady = async () => {
    if (!currentPlayer) return
    setIsUpdatingReady(true)
    setError(null)

    try {
      const response = await fetch(`/api/games/${roomCode}/players/${currentPlayer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isReady: !currentPlayer.isReady }),
      })

      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to update ready state.")
      }
    } catch (readyError) {
      console.error(readyError)
      setError(readyError instanceof Error ? readyError.message : "Unable to update ready state.")
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
    if (!game?.id) {
      return
    }

    const channel = supabase
      .channel(roomChannel(game.code))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLES.players, filter: `room_id=eq.${game.id}` },
        () => fetchGame({ silent: true }),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: TABLES.gameRooms, filter: `id=eq.${game.id}` },
        () => fetchGame({ silent: true }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLES.campaignBriefs, filter: `room_id=eq.${game.id}` },
        () => fetchGame({ silent: true }),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, game?.id, game?.code, fetchGame])

  useEffect(() => {
    if (!game) return
    if (game.status === "briefing") return

    const destinations: Partial<Record<string, string>> = {
      creating: routes.create(roomCode),
      pitching: routes.pitch(roomCode),
      voting: routes.vote(roomCode),
      results: routes.results(roomCode),
    }

    const destination = destinations[game.status]
    if (destination) {
      router.push(destination)
    }
  }, [game, router, roomCode])

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="retro-border bg-card p-6 text-center">
          <h1 className="text-4xl font-bold uppercase">Brief Generation</h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            Collaborate on the campaign brief, ready up, and let the host launch the creation rounds.
          </p>
        </div>

        {error && <p className="font-mono text-sm font-medium text-destructive">{error}</p>}

        <BriefEditor
          initialBrief={briefDraft}
          onChange={setBriefDraft}
          onSave={handleSaveBrief}
          onLock={currentPlayer?.isHost ? handleLockBrief : undefined}
          onRegenerate={handleRegenerate}
          isLocked={!isBriefing || loading}
          isSaving={isSavingBrief}
          isLocking={isLockingBrief}
        />

        <div className="retro-border bg-card p-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold uppercase">Players ({totalPlayers}/8)</h2>
            <Button variant="ghost" size="sm" onClick={() => fetchGame()} disabled={loading}>
              Refresh
            </Button>
          </div>

          {loading && <p className="font-mono text-sm text-muted-foreground">Loading players...</p>}

          {!loading && game && game.players.length > 0 && <PlayerList players={game.players} showReady />}

          {!loading && game && game.players.length === 0 && (
            <p className="font-mono text-sm text-muted-foreground">No players are connected right now.</p>
          )}
        </div>

        <div className="retro-border bg-card p-8 space-y-6">
          <div className="text-center">
            <p className="mb-2 text-lg font-bold">
              Ready Check ({readyCount}/{totalPlayers})
            </p>
            <div className="flex justify-center gap-2">
              {Array.from({ length: totalPlayers }).map((_, index) => (
                <div
                  key={index}
                  className={`size-4 rounded-full ${index < readyCount ? "bg-primary" : "bg-muted"}`}
                />
              ))}
            </div>
          </div>

          {currentPlayer ? (
            <div className="space-y-3">
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
                <Button
                  type="button"
                  onClick={handleAdvanceToCreation}
                  size="lg"
                  className="w-full"
                  disabled={!everyoneReady || isAdvancing || !isBriefing}
                >
                  {isAdvancing ? "Starting..." : "Start Creation Rounds"}
                </Button>
              )}
            </div>
          ) : (
            <p className="text-center font-mono text-sm text-muted-foreground">
              Join this lobby again to participate in the briefing.
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
