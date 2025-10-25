"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"

import { FileText } from "lucide-react"

import { Canvas } from "@/components/canvas"
import { BriefViewDialog } from "@/components/brief-view-dialog"
import { useRealtime } from "@/components/realtime-provider"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Timer } from "@/components/timer"
import { PhaseProgressHorizontal } from "@/components/phase-progress-horizontal"
import { PlayerStatus } from "@/components/player-status"
import { useRoomRealtime, type RoomRealtimeListenerHelpers } from "@/hooks/use-room-realtime"
import { canvasHasContent, canvasStateSchema, cloneCanvasState, type CanvasState } from "@/lib/canvas"
import { loadPlayer, savePlayer, type StoredPlayer } from "@/lib/player-storage"
import { routes } from "@/lib/routes"
import { mergeSnapshotIntoState, stateToSnapshot, type SnapshotDrivenState } from "@/lib/realtime/snapshot"
import type { CreationPhase } from "@/lib/types"
import type { RealtimeStatus } from "@/lib/realtime-client"

type GamePlayer = {
  id: string
  name: string
  emoji: string
  isReady: boolean
  isHost: boolean
  joinedAt: string
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
  pitch: string | null
  pitchAuthorId: string | null
  createdAt: string
  assignedPresenterId: string | null
  presentOrder: number | null
  presentStartedAt: string | null
  presentCompletedAt: string | null
}

type CampaignBrief = {
  productName: string
  productCategory: string
  businessProblem: string
  targetAudience: string
  objective: string
}

type GameState = SnapshotDrivenState<GamePlayer> & {
  currentPhase: CreationPhase | null
  phaseStartTime: string | null
  currentPresentIndex: number | null
  presentSequence: string[]
  adlobs: AdLobRecord[]
  phaseDurationSeconds: number
  brief: CampaignBrief | null
}

const CREATION_SEQUENCE: CreationPhase[] = ["big_idea", "visual", "headline", "pitch"]

const PHASE_LABELS: Record<CreationPhase, string> = {
  big_idea: "Round 1: The Big Idea",
  visual: "Round 2: The Visual",
  headline: "Round 3: The Headline",
  pitch: "Round 4: The Pitch",
}

const PHASE_INSTRUCTIONS: Record<CreationPhase, string> = {
  big_idea: "What's the big idea for this campaign? Write 1-2 sentences that set the tone.",
  visual:
    "Bring the campaign to life visually. Sketch, describe, or plan the visual so the next teammate can build on it.",
  headline: "Drop a headline that sings. Integrate it with the visual concept so it feels polished.",
  pitch:
    "Write a pitch that sells the campaign with swagger (aim for 50-100 words). No edits to previous work—just riff.",
}

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

function parseCanvasData(data: unknown): CanvasState | null {
  const parsed = canvasStateSchema.safeParse(data)
  if (!parsed.success) {
    return null
  }
  return cloneCanvasState(parsed.data)
}

export default function CreatePage() {
  const router = useRouter()
  const params = useParams()
  const roomCode = (params.roomId as string).toUpperCase()
  const realtime = useRealtime()
  const { send: sendRealtime, status: realtimeStatus } = realtime

  const [storedPlayer, setStoredPlayer] = useState<StoredPlayer | null>(null)
  const [game, setGame] = useState<GameState | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTogglingReady, setIsTogglingReady] = useState(false)
  const [isAdvancingPhase, setIsAdvancingPhase] = useState(false)
  const [isBriefDialogOpen, setIsBriefDialogOpen] = useState(false)

  const [bigIdeaInput, setBigIdeaInput] = useState("")
  const [visualNotes, setVisualNotes] = useState("")
  const [pitchInput, setPitchInput] = useState("")
  const [visualCanvas, setVisualCanvas] = useState<CanvasState | null>(null)
  const [headlineCanvas, setHeadlineCanvas] = useState<CanvasState | null>(null)
  const lastPhaseRef = useRef<CreationPhase | null>(null)
  const lastAdlobIdRef = useRef<string | null>(null)
  const lastRealtimeStatusRef = useRef<RealtimeStatus>("idle")
  const latestGameRef = useRef<GameState | null>(null)
  const pendingRefreshTimeoutRef = useRef<number | null>(null)

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
      if (!silent) {
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
          currentPresentIndex: gameData.currentPresentIndex ?? null,
          presentSequence: gameData.presentSequence ?? [],
          players: (gameData.players ?? []).map((player: GamePlayer & { joined_at?: string }) => ({
            ...player,
            joinedAt: player.joinedAt ?? player.joined_at ?? new Date().toISOString(),
          })),
          adlobs: gameData.adlobs,
          version: typeof gameData.version === "number" ? gameData.version : 0,
          phaseDurationSeconds: gameData.phaseDurationSeconds ?? 60,
          brief: gameData.brief
            ? {
                productName: gameData.brief.productName,
                productCategory: gameData.brief.productCategory,
                businessProblem: gameData.brief.businessProblem,
                targetAudience: gameData.brief.targetAudience,
                objective: gameData.brief.objective,
              }
            : null,
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
        // no-op
      }
    },
    [roomCode],
  )

  const scheduleSnapshotFallback = useCallback(() => {
    clearPendingRefresh()
    pendingRefreshTimeoutRef.current = window.setTimeout(() => {
      fetchGame({ silent: true }).catch((fallbackError) => {
        console.error("Failed to refresh creation view after realtime fallback", fallbackError)
      })
      pendingRefreshTimeoutRef.current = null
    }, 2000)
  }, [clearPendingRefresh, fetchGame])

  useEffect(() => {
    fetchGame()
  }, [fetchGame])

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

  useEffect(() => {
    if (realtimeStatus === "disconnected") {
      fetchGame({ silent: true }).catch((error) => {
        console.error("Failed to refresh snapshot after disconnect", error)
      })
    } else if (realtimeStatus === "connected" && lastRealtimeStatusRef.current === "disconnected") {
      fetchGame({ silent: true }).catch((error) => {
        console.error("Failed to refresh snapshot after reconnect", error)
      })
    }
    lastRealtimeStatusRef.current = realtimeStatus
  }, [fetchGame, realtimeStatus])

  const getInitialSnapshot = useCallback(() => {
    const snapshotSource = latestGameRef.current
    return snapshotSource ? stateToSnapshot(snapshotSource) : null
  }, [])

  const registerRealtimeListeners = useCallback(
    ({ addListener }: RoomRealtimeListenerHelpers) => {
      const unsubscribeHello = addListener("hello_ack", ({ snapshot: incoming }) => {
        setGame((previous) => (previous ? (mergeSnapshotIntoState(previous, incoming) as GameState) : previous))
        clearPendingRefresh()
      })

      const unsubscribeRoomState = addListener("room_state", ({ snapshot: incoming }) => {
        setGame((previous) => (previous ? (mergeSnapshotIntoState(previous, incoming) as GameState) : previous))
        clearPendingRefresh()
      })

      const unsubscribeReady = addListener("ready_update", ({ playerId: readyPlayerId, isReady, version }) => {
        setGame((previous) =>
          previous
            ? {
                ...previous,
                version,
                players: previous.players.map((player) =>
                  player.id === readyPlayerId
                    ? { ...player, isReady, joinedAt: player.joinedAt ?? new Date().toISOString() }
                    : { ...player, joinedAt: player.joinedAt ?? new Date().toISOString() },
                ),
            }
          : previous,
        )
        clearPendingRefresh()
      })

      const unsubscribePhase = addListener("phase_changed", ({ currentPhase, phaseStartTime, version }) => {
        setGame((previous) =>
          previous
            ? {
                ...previous,
                currentPhase,
                phaseStartTime,
                version,
            }
          : previous,
        )
        clearPendingRefresh()
      })

      const unsubscribePlayerJoined = addListener("player_joined", ({ player, version }) => {
        setGame((previous) => {
          if (!previous) return previous
          const exists = previous.players.some((existing) => existing.id === player.id)
          if (exists) {
            const updatedPlayers = previous.players.map((existing) =>
              existing.id === player.id
                ? {
                    ...existing,
                    name: player.name,
                    emoji: player.emoji,
                    isReady: player.isReady,
                    isHost: player.isHost,
                    joinedAt: existing.joinedAt ?? new Date().toISOString(),
                  }
                : { ...existing, joinedAt: existing.joinedAt ?? new Date().toISOString() },
            )
            const hostId = updatedPlayers.find((candidate) => candidate.isHost)?.id ?? previous.hostId
            return {
              ...previous,
              version,
              players: updatedPlayers,
              hostId,
            }
          }
          const updatedPlayers = [
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
          const hostId = updatedPlayers.find((candidate) => candidate.isHost)?.id ?? previous.hostId
            return {
              ...previous,
              version,
              players: updatedPlayers,
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
                  player.id === leftPlayerId
                    ? { ...player, isReady: false, joinedAt: player.joinedAt ?? new Date().toISOString() }
                    : { ...player, joinedAt: player.joinedAt ?? new Date().toISOString() },
                ),
                hostId:
                  previous.players.find((player) => player.isHost)?.id === leftPlayerId
                    ? previous.players.find((player) => player.id !== leftPlayerId && player.isHost)?.id ?? previous.hostId
                    : previous.hostId,
            }
          : previous,
        )
        clearPendingRefresh()
      })

      return [unsubscribeHello, unsubscribeRoomState, unsubscribeReady, unsubscribePhase, unsubscribePlayerJoined, unsubscribePlayerLeft]
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

  const visualCanvasData = useMemo(() => parseCanvasData(currentAdlob?.visualCanvasData), [currentAdlob])
  const headlineCanvasData = useMemo(() => parseCanvasData(currentAdlob?.headlineCanvasData), [currentAdlob])

  useEffect(() => {
    const nextPhase = game?.currentPhase ?? null
    const nextAdlobId = currentAdlob?.id ?? null

    const phaseChanged = lastPhaseRef.current !== nextPhase
    const adlobChanged = lastAdlobIdRef.current !== nextAdlobId

    if (!game || !currentAdlob) {
      setBigIdeaInput("")
      setVisualNotes("")
      setPitchInput("")
      setVisualCanvas(null)
      setHeadlineCanvas(null)
      lastPhaseRef.current = nextPhase
      lastAdlobIdRef.current = nextAdlobId
      return
    }

    if (!phaseChanged && !adlobChanged) {
      return
    }

    lastPhaseRef.current = nextPhase
    lastAdlobIdRef.current = nextAdlobId

    if (nextPhase === "big_idea") {
      setBigIdeaInput(currentAdlob.bigIdea ?? "")
      setVisualNotes("")
      setPitchInput("")
      setVisualCanvas(null)
      setHeadlineCanvas(null)
    } else if (nextPhase === "visual") {
      setVisualNotes(extractNotes(currentAdlob.visualCanvasData))
      setVisualCanvas(parseCanvasData(currentAdlob.visualCanvasData))
      setPitchInput("")
      setHeadlineCanvas(null)
    } else if (nextPhase === "headline") {
      setHeadlineCanvas(parseCanvasData(currentAdlob.headlineCanvasData))
      setPitchInput("")
    } else if (nextPhase === "pitch") {
      setPitchInput(currentAdlob.pitch ?? "")
    }
  }, [game, currentAdlob])

  const readyCount = useMemo(() => game?.players.filter((player) => player.isReady).length ?? 0, [game])
  const totalPlayers = game?.players.length ?? 0
  const everyoneReady = totalPlayers > 0 && readyCount === totalPlayers
  const phaseStartTime = game?.phaseStartTime ? new Date(game.phaseStartTime).getTime() : Date.now()
  const phaseDurationMs = (game?.phaseDurationSeconds ?? 60) * 1000
  const phaseEndTime = new Date(phaseStartTime + phaseDurationMs)

  // Computed values for sidebar components
  const completedPhases = useMemo((): CreationPhase[] => {
    const phases: CreationPhase[] = []
    if (currentAdlob) {
      if (currentAdlob.bigIdea) phases.push("big_idea")
      if (currentAdlob.visualCanvasData) phases.push("visual")
      if (currentAdlob.headlineCanvasData) phases.push("headline")
      if (currentAdlob.pitch) phases.push("pitch")
    }
    return phases
  }, [currentAdlob])

  const playerStatusData = useMemo(() => {
    return (game?.players ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      isReady: p.isReady,
      isYou: p.id === currentPlayer?.id,
    }))
  }, [game?.players, currentPlayer?.id])

  const handleSubmitWork = async () => {
    if (!game || !currentPlayer || !currentAdlob || !game.currentPhase) return

    setIsSubmitting(true)
    setError(null)

    try {
      let submissionEndpoint: string | null = null
      let submissionPayload: Record<string, unknown> | null = null

      if (game.currentPhase === "big_idea") {
        const text = bigIdeaInput.trim()
        if (text.length === 0) {
          setError("Give your other players something to work with!")
          setIsSubmitting(false)
          return
        }

        submissionEndpoint = `/api/adlobs/${currentAdlob.id}/big-idea`
        submissionPayload = {
          text,
          createdBy: currentPlayer.id,
        }
      } else if (game.currentPhase === "visual") {
        if (!visualCanvas || !canvasHasContent(visualCanvas)) {
          setError("Sketch or jot something on the canvas before submitting.")
          setIsSubmitting(false)
          return
        }

        const notes = visualNotes.trim()
        if (notes.length < 10) {
          setError("Add at least one sentence (10+ characters) of visual guidance for the next teammate.")
          setIsSubmitting(false)
          return
        }

        const canvasPayload = cloneCanvasState(visualCanvas)
        canvasPayload.notes = notes

        submissionEndpoint = `/api/adlobs/${currentAdlob.id}/visual`
        submissionPayload = {
          canvasData: canvasPayload,
          imageUrls: [],
          createdBy: currentPlayer.id,
        }
      } else if (game.currentPhase === "headline") {
        if (!headlineCanvas || !canvasHasContent(headlineCanvas)) {
          setError("Block out the headline layout on the canvas so the final team can see the plan.")
          setIsSubmitting(false)
          return
        }

        const canvasPayload = cloneCanvasState(headlineCanvas)

        submissionEndpoint = `/api/adlobs/${currentAdlob.id}/headline`
        submissionPayload = {
          canvasData: canvasPayload,
          createdBy: currentPlayer.id,
        }
      } else if (game.currentPhase === "pitch") {
        const text = pitchInput.trim()

        submissionEndpoint = `/api/adlobs/${currentAdlob.id}/pitch`
        submissionPayload = {
          text,
          createdBy: currentPlayer.id,
        }
      }

      if (!submissionEndpoint || !submissionPayload) {
        setIsSubmitting(false)
        return
      }

      const response = await fetch(submissionEndpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submissionPayload),
      })
      const phasePayload = await response.json()

      if (!response.ok || !phasePayload.success) {
        throw new Error(phasePayload.error ?? "Failed to save your work")
      }

      await fetch(`/api/games/${roomCode}/players/${currentPlayer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isReady: true }),
      })

      if (realtimeStatus !== "connected") {
        await fetchGame({ silent: true })
      } else {
        scheduleSnapshotFallback()
      }
    } catch (submitError) {
      console.error(submitError)
      setError(submitError instanceof Error ? submitError.message : "Failed to submit work.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleReady = async () => {
    if (!currentPlayer || !game) return

    const desiredReady = !currentPlayer.isReady

    setIsTogglingReady(true)
    setError(null)

    setGame((previous) =>
      previous
        ? {
            ...previous,
            players: previous.players.map((player) =>
              player.id === currentPlayer.id
                ? { ...player, isReady: desiredReady, joinedAt: player.joinedAt ?? new Date().toISOString() }
                : { ...player, joinedAt: player.joinedAt ?? new Date().toISOString() },
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
      setGame((previous) =>
        previous
          ? {
              ...previous,
              players: previous.players.map((player) =>
                player.id === currentPlayer.id
                  ? { ...player, isReady: !desiredReady, joinedAt: player.joinedAt ?? new Date().toISOString() }
                  : { ...player, joinedAt: player.joinedAt ?? new Date().toISOString() },
              ),
            }
          : previous,
      )
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

      sendRealtime({
        type: "advance_phase",
        roomCode,
        playerId: currentPlayer.id,
      })

      if (realtimeStatus !== "connected") {
        await fetchGame({ silent: true })
      } else {
        scheduleSnapshotFallback()
      }
    } catch (advanceError) {
      console.error(advanceError)
      setError(advanceError instanceof Error ? advanceError.message : "Failed to advance phase.")
    } finally {
      setIsAdvancingPhase(false)
    }
  }

  useEffect(() => {
    if (!game) return
    if (game.status === "creating") return

    const destinations: Partial<Record<string, string>> = {
      presenting: routes.present(roomCode),
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
            <div className="rounded border-2 border-border bg-muted/50 p-3">
              <p className="text-xs font-bold uppercase text-muted-foreground">Big Idea Context:</p>
              <p className="text-sm">{currentAdlob.bigIdea ?? "Waiting for big idea..."}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visual-notes">Visual Notes</Label>
              <Textarea
                id="visual-notes"
                value={visualNotes}
                onChange={(event) => setVisualNotes(event.target.value)}
                placeholder="Describe your visual concept, provide guidance for the next phase..."
                rows={4}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{visualNotes.length} characters</span>
                {visualNotes.length < 10 && (
                  <span className="text-amber-600">Add at least 10 characters for context</span>
                )}
                {visualNotes.length >= 10 && canvasHasContent(visualCanvas) && (
                  <span className="text-green-600">Complete! ✓</span>
                )}
              </div>
            </div>

            <Canvas initialData={visualCanvas} onChange={setVisualCanvas} />
          </div>
        )
      case "headline":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              {currentAdlob.bigIdea && (
                <div className="rounded border-2 border-border bg-muted/50 p-3">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Big Idea:</p>
                  <p className="text-sm">{currentAdlob.bigIdea}</p>
                </div>
              )}

              {extractNotes(currentAdlob.visualCanvasData) && (
                <div className="rounded border-2 border-border bg-muted/50 p-3">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Visual Notes:</p>
                  <p className="text-sm">{extractNotes(currentAdlob.visualCanvasData)}</p>
                </div>
              )}
            </div>

            <Canvas initialData={headlineCanvas ?? headlineCanvasData ?? visualCanvasData ?? null} onChange={setHeadlineCanvas} />
          </div>
        )
      case "pitch":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              {currentAdlob.bigIdea && (
                <div className="rounded border-2 border-border bg-muted/50 p-3">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Big Idea:</p>
                  <p className="text-sm">{currentAdlob.bigIdea}</p>
                </div>
              )}

              {extractNotes(currentAdlob.visualCanvasData) && (
                <div className="rounded border-2 border-border bg-muted/50 p-3">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Visual Notes:</p>
                  <p className="text-sm">{extractNotes(currentAdlob.visualCanvasData)}</p>
                </div>
              )}
            </div>

            <Textarea
              value={pitchInput}
              onChange={(event) => setPitchInput(event.target.value)}
              placeholder="Write your pitch..."
              rows={4}
              className="text-lg"
            />

            {headlineCanvasData && (
              <div className="rounded border-2 border-border bg-muted/50 p-3">
                <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Headline Layout:</p>
                <Canvas
                  initialData={headlineCanvasData}
                  readOnly
                  className="pointer-events-none bg-card"
                />
              </div>
            )}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Simplified Header */}
      <header className="bg-muted py-4">
        <div className="mx-auto max-w-7xl px-6">
          <div className="retro-border border-b-4 bg-muted p-4">
            <h1 className="text-2xl font-bold uppercase">
              {game?.currentPhase ? PHASE_LABELS[game.currentPhase] : "Creation Rounds"}
            </h1>
          </div>
        </div>
      </header>

      {/* Main 2-Column Layout */}
      <div className="mx-auto max-w-7xl p-6">
        {error && <p className="mb-4 font-mono text-sm font-medium text-destructive">{error}</p>}

        <div className="flex gap-6">
          {/* Left Column - Main Workspace */}
          <div className="flex-1 space-y-6">
            <section className="retro-border bg-card p-6 space-y-6">
              <p className="text-center font-mono text-lg">
                {game?.currentPhase
                  ? PHASE_INSTRUCTIONS[game.currentPhase]
                  : "Waiting for the host to kick off the round."}
              </p>

              {renderPhaseContent()}
            </section>
          </div>

          {/* Right Sidebar - Status & Progress */}
          <div className="w-80 shrink-0 space-y-6 sticky top-6 self-start">
            {/* Phase Progress */}
            <div className="retro-border bg-card p-4">
              <PhaseProgressHorizontal
                currentPhase={game?.currentPhase ?? "big_idea"}
                completedPhases={completedPhases}
              />
            </div>

            {/* View Brief Button */}
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setIsBriefDialogOpen(true)}
            >
              <FileText className="size-4" />
              View Brief
            </Button>

            {/* Timer */}
            <div className="retro-border bg-card p-4">
              <Timer endTime={phaseEndTime} className="w-full" />
            </div>

            {/* Player Status */}
            <div className="retro-border bg-card p-4">
              <PlayerStatus players={playerStatusData} />

              <div className="mt-4 pt-4 border-t-2 border-border space-y-3">
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  onClick={handleSubmitWork}
                  disabled={isSubmitting || !currentPlayer || !game?.currentPhase}
                >
                  {isSubmitting ? "Submitting..." : "Submit Work & Ready Up"}
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="secondary"
                  className="w-full"
                  onClick={handleToggleReady}
                  disabled={isTogglingReady || !currentPlayer}
                >
                  {isTogglingReady ? "Updating..." : currentPlayer?.isReady ? "Mark Not Ready" : "Ready Up"}
                </Button>
              </div>

              {currentPlayer?.isHost && (
                <div className="mt-4 pt-4 border-t-2 border-border">
                  <Button
                    type="button"
                    size="lg"
                    variant="default"
                    className="w-full"
                    onClick={handleAdvancePhase}
                    disabled={!everyoneReady || isAdvancingPhase || !game?.currentPhase}
                  >
                    {isAdvancingPhase
                      ? "Advancing..."
                      : game?.currentPhase === "pitch"
                        ? "Move to Present"
                        : "Start Next Round"}
                  </Button>
                  {!everyoneReady && (
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      Waiting for all players to ready up...
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <BriefViewDialog
        brief={game?.brief ?? null}
        isOpen={isBriefDialogOpen}
        onOpenChange={setIsBriefDialogOpen}
      />
    </main>
  )
}
