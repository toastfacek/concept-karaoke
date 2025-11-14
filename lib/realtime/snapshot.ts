import type { RoomSnapshot } from "@concept-karaoke/realtime-shared"

import type { CreationPhase } from "@/lib/types"

export type SnapshotPlayer = {
  id: string
  name: string
  emoji: string
  isReady: boolean
  isHost: boolean
  joinedAt: string
  seatIndex: number
}

export interface SnapshotDrivenState<TPlayer extends SnapshotPlayer = SnapshotPlayer> {
  id: string
  code: string
  status: RoomSnapshot["status"]
  hostId: string
  players: TPlayer[]
  version: number
  currentPhase?: CreationPhase | null
  phaseStartTime?: string | null
}

export function stateToSnapshot<TState extends SnapshotDrivenState>(state: TState): RoomSnapshot {
  return {
    id: state.id,
    code: state.code,
    status: state.status,
    currentPhase: Object.prototype.hasOwnProperty.call(state, "currentPhase")
      ? state.currentPhase ?? null
      : null,
    phaseStartTime: Object.prototype.hasOwnProperty.call(state, "phaseStartTime")
      ? state.phaseStartTime ?? null
      : null,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      emoji: player.emoji,
      isReady: player.isReady,
      isHost: player.isHost,
      seatIndex: player.seatIndex,
    })),
    version: state.version,
  }
}

export function mergeSnapshotIntoState<TState extends SnapshotDrivenState>(
  state: TState,
  snapshot: RoomSnapshot,
): TState {
  if (state.version === snapshot.version) {
    return state
  }

  const existingPlayers = new Map(state.players.map((player) => [player.id, player]))
  const players = snapshot.players.map((player) => {
    const existing = existingPlayers.get(player.id)
    if (
      existing &&
      existing.name === player.name &&
      existing.emoji === player.emoji &&
      existing.isReady === player.isReady &&
      existing.isHost === player.isHost &&
      existing.seatIndex === player.seatIndex
    ) {
      return existing
    }

    return {
      id: player.id,
      name: player.name,
      emoji: player.emoji,
      isReady: player.isReady,
      isHost: player.isHost,
      joinedAt: existing?.joinedAt ?? new Date().toISOString(),
      seatIndex: player.seatIndex,
    } as TState["players"][number]
  }) as TState["players"]

  const hostId = players.find((player) => player.isHost)?.id ?? state.hostId

  const nextState: SnapshotDrivenState<TState["players"][number]> = {
    ...state,
    status: snapshot.status,
    hostId,
    players,
    version: snapshot.version,
  }

  if (Object.prototype.hasOwnProperty.call(state, "currentPhase")) {
    ;(nextState as SnapshotDrivenState<TState["players"][number]> & { currentPhase: CreationPhase | null }).currentPhase =
      snapshot.currentPhase ?? null
  }

  if (Object.prototype.hasOwnProperty.call(state, "phaseStartTime")) {
    ;(
      nextState as SnapshotDrivenState<TState["players"][number]> & { phaseStartTime: string | null }
    ).phaseStartTime = snapshot.phaseStartTime ?? null
  }

  return nextState as TState
}
