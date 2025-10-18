"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"

import { Canvas } from "@/components/canvas"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Timer } from "@/components/timer"
import { PlayerList } from "@/components/player-list"
import { TABLES } from "@/lib/db"
import { loadPlayer, savePlayer, type StoredPlayer } from "@/lib/player-storage"
import { roomChannel } from "@/lib/realtime"
import { routes } from "@/lib/routes"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser"
import type { CreationPhase } from "@/lib/types"

type GamePlayer = {
  id: string
  name: string
  emoji: string
  isReady: boolean
  isHost: boolean
}

type AdLobRecord = {
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
}

const CREATION_SEQUENCE: CreationPhase[] = ["big_idea", "visual", "headline", "mantra"]

const PHASE_LABELS: Record<CreationPhase, string> = {
  big_idea: "Round 1: The Big Idea",
  visual: "Round 2: The Visual",
  headline: "Round 3: The Headline",
  mantra: "Round 4: The Mantra",
}

const PHASE_INSTRUCTIONS: Record<CreationPhase, string> = {
  big_idea: "What's the big idea for this campaign? Write 1-2 sentences that set the tone.",
  visual:
    "Bring the campaign to life visually. Sketch, describe, or plan the visual so the next teammate can build on it.",
  headline: "Drop a headline that sings. Integrate it with the visual concept so it feels polished.",
  mantra:
    "Write a 1-3 sentence mantra that sells the campaign with swagger (aim for 50-100 words). No edits to previous work—just riff.",
}

const PHASE_DURATION_MS = 60_000

function getPhaseIndex(phase: CreationPhase | null): number {
  if (!phase) return -1
  return CREATION_SEQUENCE.indexOf(phase)
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

export default function CreatePage() {
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
    currentPhase: CreationPhase | null
    phaseStartTime: string | null
    players: GamePlayer[]
    adlobs: AdLobRecord[]
  } | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTogglingReady, setIsTogglingReady] = useState(false)
  const [isAdvancingPhase, setIsAdvancingPhase] = useState(false)

  const [bigIdeaInput, setBigIdeaInput] = useState("")
  const [visualNotes, setVisualNotes] = useState("")
  const [headlineNotes, setHeadlineNotes] = useState("")
  const [mantraInput, setMantraInput] = useState("")

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
          setError(payload.error ?? "Unable to load creation round.")
          setGame(null)
          return
        }

        const gameData = payload.game

        setGame({
          id: gameData.id,
          code: gameData.code,
          status: gameData.status,
          hostId: gameData.hostId,
          currentPhase: gameData.currentPhase ?? null,
          phaseStartTime: gameData.phaseStartTime ?? null,
          players: gameData.players,
          adlobs: gameData.adlobs,
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
        setError("Unable to load creation round.")
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

  const playerIndex = useMemo(() => {
    if (!game || !currentPlayer) return -1
    return game.players.findIndex((player) => player.id === currentPlayer.id)
  }, [game, currentPlayer])

  const phaseIndex = useMemo(() => getPhaseIndex(game?.currentPhase ?? null), [game?.currentPhase])

  const currentAdlob = useMemo(() => {
    if (!game || !currentPlayer) return null
    if (!game.adlobs || game.adlobs.length === 0) return null
    if (playerIndex === -1) return null
    if (phaseIndex === -1) return null

    const totalPlayers = game.players.length
    if (totalPlayers === 0) return null

    const targetIndex = ((playerIndex - phaseIndex) % totalPlayers + totalPlayers) % totalPlayers
    return game.adlobs[targetIndex] ?? null
  }, [game, currentPlayer, playerIndex, phaseIndex])

  useEffect(() => {
    if (!game || !currentAdlob) {
      setBigIdeaInput("")
      setVisualNotes("")
      setHeadlineNotes("")
      setMantraInput("")
      return
    }

    if (game.currentPhase === "big_idea") {
      setBigIdeaInput(currentAdlob.bigIdea ?? "")
    } else if (game.currentPhase === "visual") {
      setVisualNotes(extractNotes(currentAdlob.visualCanvasData))
    } else if (game.currentPhase === "headline") {
      setHeadlineNotes(extractNotes(currentAdlob.headlineCanvasData))
    } else if (game.currentPhase === "mantra") {
      setMantraInput(currentAdlob.mantra ?? "")
    }
  }, [game?.currentPhase, currentAdlob?.id])

  const readyCount = useMemo(() => game?.players.filter((player) => player.isReady).length ?? 0, [game])
  const totalPlayers = game?.players.length ?? 0
  const everyoneReady = totalPlayers > 0 && readyCount === totalPlayers
  const phaseStartTime = game?.phaseStartTime ? new Date(game.phaseStartTime).getTime() : Date.now()
  const phaseEndTime = new Date(phaseStartTime + PHASE_DURATION_MS)

  const handleSubmitWork = async () => {
    if (!game || !currentPlayer || !currentAdlob || !game.currentPhase) return

    setIsSubmitting(true)
    setError(null)

    try {
      if (game.currentPhase === "big_idea") {
        const response = await fetch(`/api/adlobs/${currentAdlob.id}/big-idea`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: bigIdeaInput.trim(),
            createdBy: currentPlayer.id,
          }),
        })
        const payload = await response.json()
        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Failed to save big idea")
        }
      } else if (game.currentPhase === "visual") {
        const response = await fetch(`/api/adlobs/${currentAdlob.id}/visual`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            canvasData: { notes: visualNotes },
            imageUrls: [],
            createdBy: currentPlayer.id,
          }),
        })
        const payload = await response.json()
        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Failed to save visual")
        }
      } else if (game.currentPhase === "headline") {
        const response = await fetch(`/api/adlobs/${currentAdlob.id}/headline`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            canvasData: { notes: headlineNotes },
            createdBy: currentPlayer.id,
          }),
        })
        const payload = await response.json()
        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Failed to save headline")
        }
      } else if (game.currentPhase === "mantra") {
        const response = await fetch(`/api/adlobs/${currentAdlob.id}/mantra`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: mantraInput.trim(),
            createdBy: currentPlayer.id,
          }),
        })
        const payload = await response.json()
        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Failed to save mantra")
        }
      }

      await fetch(`/api/games/${roomCode}/players/${currentPlayer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isReady: true }),
      })

      await fetchGame({ silent: true })
    } catch (submitError) {
      console.error(submitError)
      setError(submitError instanceof Error ? submitError.message : "Failed to submit work.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleReady = async () => {
    if (!currentPlayer) return
    setIsTogglingReady(true)
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
      setIsTogglingReady(false)
    }
  }

  const handleAdvancePhase = async () => {
    if (!game || !currentPlayer) return

    setIsAdvancingPhase(true)
    setError(null)

    try {
      const response = await fetch(`/api/games/${roomCode}/phase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: currentPlayer.id }),
      })

      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to advance phase")
      }

      await fetchGame({ silent: true })
    } catch (advanceError) {
      console.error(advanceError)
      setError(advanceError instanceof Error ? advanceError.message : "Failed to advance phase.")
    } finally {
      setIsAdvancingPhase(false)
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
        { event: "*", schema: "public", table: TABLES.adLobs, filter: `room_id=eq.${game.id}` },
        () => fetchGame({ silent: true }),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, game?.id, game?.code, fetchGame])

  useEffect(() => {
    if (!game) return
    if (game.status === "creating") return

    const destinations: Partial<Record<string, string>> = {
      pitching: routes.pitch(roomCode),
      voting: routes.vote(roomCode),
      results: routes.results(roomCode),
    }

    const destination = destinations[game.status]
    if (destination) {
      router.push(destination)
    }
  }, [game, router, roomCode])

  const renderPhaseContent = () => {
    if (!game || !currentAdlob || !game.currentPhase) {
      return (
        <div className="retro-border bg-muted p-6 text-center font-mono text-sm text-muted-foreground">
          Waiting for the host to start the round...
        </div>
      )
    }

    switch (game.currentPhase) {
      case "big_idea":
        return (
          <div className="space-y-4">
            <Textarea
              value={bigIdeaInput}
              onChange={(event) => setBigIdeaInput(event.target.value)}
              placeholder="Enter your big idea..."
              rows={4}
              className="text-lg"
            />
            <p className="font-mono text-sm text-muted-foreground">{bigIdeaInput.length} characters</p>
          </div>
        )
      case "visual":
        return (
          <div className="space-y-4">
            <div className="retro-border bg-muted p-4">
              <p className="mb-2 font-mono text-xs uppercase text-muted-foreground">Previous: Big Idea</p>
              <p className="font-bold">{currentAdlob.bigIdea ?? "Waiting for big idea..."}</p>
            </div>

            <Textarea
              value={visualNotes}
              onChange={(event) => setVisualNotes(event.target.value)}
              placeholder="Describe the visual concept, layout notes, color ideas, or references..."
              rows={4}
              className="text-lg"
            />
            <Canvas readOnly className="pointer-events-none opacity-60" />
            <p className="font-mono text-xs text-muted-foreground">
              Canvas tooling coming soon — capture ideas in the notes for now.
            </p>
          </div>
        )
      case "headline":
        return (
          <div className="space-y-4">
            <div className="retro-border bg-muted p-4 space-y-2">
              <div>
                <p className="font-mono text-xs uppercase text-muted-foreground">Big Idea</p>
                <p className="font-bold">{currentAdlob.bigIdea ?? "Waiting for big idea..."}</p>
              </div>
              <div>
                <p className="font-mono text-xs uppercase text-muted-foreground">Visual Notes</p>
                <p>{visualNotes || extractNotes(currentAdlob.visualCanvasData) || "Visual pending..."}</p>
              </div>
            </div>

            <Textarea
              value={headlineNotes}
              onChange={(event) => setHeadlineNotes(event.target.value)}
              placeholder="Add your headline text or placement notes..."
              rows={3}
              className="text-lg"
            />
            <Canvas readOnly className="pointer-events-none opacity-60" />
            <p className="font-mono text-xs text-muted-foreground">
              Canvas support coming soon — jot the headline placement and copy in the notes for now.
            </p>
          </div>
        )
      case "mantra":
        return (
          <div className="space-y-4">
            <div className="retro-border bg-muted p-6 space-y-3">
              <div>
                <p className="font-mono text-xs uppercase text-muted-foreground">Big Idea</p>
                <p className="font-bold">{currentAdlob.bigIdea ?? "Waiting for big idea..."}</p>
              </div>
              <div>
                <p className="font-mono text-xs uppercase text-muted-foreground">Visual Notes</p>
                <p>{extractNotes(currentAdlob.visualCanvasData) || "Visual pending..."}</p>
              </div>
              <div>
                <p className="font-mono text-xs uppercase text-muted-foreground">Headline Notes</p>
                <p>{extractNotes(currentAdlob.headlineCanvasData) || "Headline pending..."}</p>
              </div>
            </div>

            <Textarea
              value={mantraInput}
              onChange={(event) => setMantraInput(event.target.value)}
              placeholder="Write your campaign mantra..."
              rows={4}
              className="text-lg"
            />
            <p className="font-mono text-sm text-muted-foreground">
              {mantraInput.split(" ").filter((word) => word.trim().length > 0).length} words (aim for 50-100)
            </p>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="retro-border bg-card px-6 py-3">
            <h1 className="text-2xl font-bold uppercase">
              {game?.currentPhase ? PHASE_LABELS[game.currentPhase] : "Creation Rounds"}
            </h1>
          </div>
          <Timer endTime={phaseEndTime} />
        </header>

        {error && <p className="font-mono text-sm font-medium text-destructive">{error}</p>}

        <section className="retro-border bg-card p-6 space-y-6">
          <p className="text-center font-mono text-lg">
            {game?.currentPhase ? PHASE_INSTRUCTIONS[game.currentPhase] : "Waiting for the host to kick off the round."}
          </p>

          {renderPhaseContent()}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              size="lg"
              className="w-full sm:w-auto"
              onClick={handleSubmitWork}
              disabled={isSubmitting || !currentPlayer || !game?.currentPhase}
            >
              {isSubmitting ? "Submitting..." : "Submit Work & Ready Up"}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={handleToggleReady}
              disabled={isTogglingReady || !currentPlayer}
            >
              {isTogglingReady ? "Updating..." : currentPlayer?.isReady ? "Mark Not Ready" : "Ready Up"}
            </Button>
            {currentPlayer?.isHost && (
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleAdvancePhase}
                disabled={!everyoneReady || isAdvancingPhase || !game?.currentPhase}
              >
                {isAdvancingPhase
                  ? "Advancing..."
                  : game?.currentPhase === "mantra"
                    ? "Move to Pitch"
                    : "Start Next Round"}
              </Button>
            )}
          </div>
        </section>

        <section className="retro-border bg-card p-6 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-bold uppercase">Players ({totalPlayers}/8)</h2>
            <div className="text-center font-mono text-sm text-muted-foreground sm:text-right">
              Ready: {readyCount}/{totalPlayers}
            </div>
          </div>

          {loading ? (
            <p className="font-mono text-sm text-muted-foreground">Loading players...</p>
          ) : game && game.players.length > 0 ? (
            <PlayerList players={game.players} showReady />
          ) : (
            <p className="font-mono text-sm text-muted-foreground">No players are connected right now.</p>
          )}
        </section>
      </div>
    </main>
  )
}
