"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"

import { Canvas } from "@/components/canvas"
import { useRealtime } from "@/components/realtime-provider"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Timer } from "@/components/timer"
import { PlayerList } from "@/components/player-list"
import { canvasHasContent, canvasStateSchema, cloneCanvasState, type CanvasState } from "@/lib/canvas"
import { loadPlayer, savePlayer, type StoredPlayer } from "@/lib/player-storage"
import { routes } from "@/lib/routes"
import { mergeSnapshotIntoState, stateToSnapshot, type SnapshotDrivenState } from "@/lib/realtime/snapshot"
import { fetchRealtimeToken, type RealtimeToken } from "@/lib/realtime/token"
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
  mantra: string | null
  mantraAuthorId: string | null
  createdAt: string
  assignedPitcherId: string | null
  pitchOrder: number | null
  pitchStartedAt: string | null
  pitchCompletedAt: string | null
}

type GameState = SnapshotDrivenState & {
  players: GamePlayer[]
  currentPhase: CreationPhase | null
  phaseStartTime: string | null
  currentPitchIndex: number | null
  pitchSequence: string[]
  adlobs: AdLobRecord[]
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

function parseCanvasData(data: unknown): CanvasState | null {
  const parsed = canvasStateSchema.safeParse(data)
  if (!parsed.success) {
    return null
  }
  return cloneCanvasState(parsed.data)
}

function countWords(value: string): number {
  return value
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length
}

export default function CreatePage() {
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
  const [game, setGame] = useState<GameState | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTogglingReady, setIsTogglingReady] = useState(false)
  const [isAdvancingPhase, setIsAdvancingPhase] = useState(false)

  const [bigIdeaInput, setBigIdeaInput] = useState("")
  const [visualNotes, setVisualNotes] = useState("")
  const [headlineNotes, setHeadlineNotes] = useState("")
  const [mantraInput, setMantraInput] = useState("")
  const [visualCanvas, setVisualCanvas] = useState<CanvasState | null>(null)
  const [headlineCanvas, setHeadlineCanvas] = useState<CanvasState | null>(null)
  const lastPhaseRef = useRef<CreationPhase | null>(null)
  const lastAdlobIdRef = useRef<string | null>(null)
  const realtimeConnectionKeyRef = useRef<string | null>(null)
  const lastRealtimeStatusRef = useRef<RealtimeStatus>("idle")
  const tokenRef = useRef<RealtimeToken | null>(null)
  const latestGameRef = useRef<GameState | null>(null)

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
          currentPitchIndex: gameData.currentPitchIndex ?? null,
          pitchSequence: gameData.pitchSequence ?? [],
          players: (gameData.players ?? []).map((player: GamePlayer & { joined_at?: string }) => ({
            ...player,
            joinedAt: player.joinedAt ?? player.joined_at ?? new Date().toISOString(),
          })),
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

  useEffect(() => {
    latestGameRef.current = game
  }, [game])

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

        const unsubHello = addRealtimeListener("hello_ack", ({ snapshot: incoming }) => {
          setGame((previous) => (previous ? (mergeSnapshotIntoState(previous, incoming) as GameState) : previous))
        })

        const unsubRoomState = addRealtimeListener("room_state", ({ snapshot: incoming }) => {
          setGame((previous) => (previous ? (mergeSnapshotIntoState(previous, incoming) as GameState) : previous))
        })

        const unsubReady = addRealtimeListener("ready_update", ({ playerId: readyPlayerId, isReady, version }) => {
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
        })

        const unsubPhase = addRealtimeListener("phase_changed", ({ currentPhase, phaseStartTime, version }) => {
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
        })

        const unsubPlayerJoined = addRealtimeListener("player_joined", ({ player, version }) => {
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
                    }
                  : existing,
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
        })

        const unsubPlayerLeft = addRealtimeListener("player_left", ({ playerId: leftPlayerId, version }) => {
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
        })

        cleanupFns = [unsubHello, unsubRoomState, unsubReady, unsubPhase, unsubPlayerJoined, unsubPlayerLeft]
      } catch (error) {
        console.error("Failed to initialize realtime connection", error)
      }
    }

    void initialize()

    return () => {
      cancelled = true
      cleanupFns.forEach((fn) => fn())
      disconnectRealtime()
      realtimeConnectionKeyRef.current = null
    }
  }, [addRealtimeListener, connectRealtime, disconnectRealtime, roomCode, storedPlayer?.id])

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
      setHeadlineNotes("")
      setMantraInput("")
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
      setHeadlineNotes("")
      setMantraInput("")
      setVisualCanvas(null)
      setHeadlineCanvas(null)
    } else if (nextPhase === "visual") {
      setVisualNotes(extractNotes(currentAdlob.visualCanvasData))
      setVisualCanvas(parseCanvasData(currentAdlob.visualCanvasData))
      setHeadlineNotes("")
      setMantraInput("")
      setHeadlineCanvas(null)
    } else if (nextPhase === "headline") {
      setHeadlineNotes(extractNotes(currentAdlob.headlineCanvasData))
      setHeadlineCanvas(parseCanvasData(currentAdlob.headlineCanvasData))
      setMantraInput("")
    } else if (nextPhase === "mantra") {
      setMantraInput(currentAdlob.mantra ?? "")
    }
  }, [game, currentAdlob])

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
      let submissionEndpoint: string | null = null
      let submissionPayload: Record<string, unknown> | null = null

      if (game.currentPhase === "big_idea") {
        const text = bigIdeaInput.trim()
        if (text.length < 20) {
          setError("Big ideas need at least 20 characters to give others something to work with.")
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

        const notes = headlineNotes.trim()
        if (notes.length < 3) {
          setError("Give the copy a little more love — add 3+ characters for headline guidance.")
          setIsSubmitting(false)
          return
        }

        const canvasPayload = cloneCanvasState(headlineCanvas)
        canvasPayload.notes = notes

        submissionEndpoint = `/api/adlobs/${currentAdlob.id}/headline`
        submissionPayload = {
          canvasData: canvasPayload,
          createdBy: currentPlayer.id,
        }
      } else if (game.currentPhase === "mantra") {
        const text = mantraInput.trim()
        const words = countWords(text)

        if (words < 3) {
          setError("Mantras should be at least 3 words — give the pitch a little more runway.")
          setIsSubmitting(false)
          return
        }

        submissionEndpoint = `/api/adlobs/${currentAdlob.id}/mantra`
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

      await fetchGame({ silent: true })
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

      await fetchGame({ silent: true })
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
            <Canvas initialData={visualCanvas} onChange={setVisualCanvas} />
            <p className="font-mono text-xs text-muted-foreground">
              Sketch the layout and use the notes to tee up the next teammate.
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
                <p>{extractNotes(currentAdlob.visualCanvasData) || "Visual pending..."}</p>
              </div>
            </div>

            <Textarea
              value={headlineNotes}
              onChange={(event) => setHeadlineNotes(event.target.value)}
              placeholder="Add your headline text or placement notes..."
              rows={3}
              className="text-lg"
            />
            <Canvas initialData={headlineCanvas ?? headlineCanvasData ?? visualCanvasData ?? null} onChange={setHeadlineCanvas} />
            <p className="font-mono text-xs text-muted-foreground">
              Map the headline placement and note copy decisions so the final pitcher has a clear script.
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
              <div>
                <p className="font-mono text-xs uppercase text-muted-foreground">Visual Sketch</p>
                {visualCanvasData ? (
                  <Canvas
                    initialData={visualCanvasData}
                    readOnly
                    className="pointer-events-none bg-card sm:mx-auto sm:max-w-3xl"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Visual canvas pending...</p>
                )}
              </div>
              <div>
                <p className="font-mono text-xs uppercase text-muted-foreground">Headline Layout</p>
                {headlineCanvasData ? (
                  <Canvas
                    initialData={headlineCanvasData}
                    readOnly
                    className="pointer-events-none bg-card sm:mx-auto sm:max-w-3xl"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Headline canvas pending...</p>
                )}
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
              {countWords(mantraInput)} words (aim for 50-100)
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
