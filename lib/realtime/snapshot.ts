import type { RoomSnapshot } from "@concept-karaoke/realtime-shared"

import type { CreationPhase } from "@/lib/types"

export type SnapshotPlayer = {
  id: string
  name: string
  emoji: string
  isReady: boolean
  isHost: boolean
  joinedAt?: string
}

export interface SnapshotDrivenState {
  id: string
  code: string
  status: string
  hostId: string
  players: SnapshotPlayer[]
  version: number
  currentPhase?: CreationPhase | null
  phaseStartTime?: string | null
}

export function stateToSnapshot<T extends SnapshotDrivenState>(state: T): RoomSnapshot {
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
    })),
    version: state.version,
  }
}

export function mergeSnapshotIntoState<T extends SnapshotDrivenState>(state: T, snapshot: RoomSnapshot): T {
  const players = snapshot.players.map((player) => {
    const existing = state.players.find((candidate) => candidate.id === player.id)
    return {
      id: player.id,
      name: player.name,
      emoji: player.emoji,
      isReady: player.isReady,
      isHost: player.isHost,
      joinedAt: existing?.joinedAt ?? new Date().toISOString(),
    }
  })

  const hostId = players.find((player) => player.isHost)?.id ?? state.hostId

  const nextState: SnapshotDrivenState = {
    ...state,
    status: snapshot.status,
    hostId,
    players,
    version: snapshot.version,
  }

  if (Object.prototype.hasOwnProperty.call(state, "currentPhase")) {
    ;(nextState as SnapshotDrivenState & { currentPhase: CreationPhase | null }).currentPhase =
      snapshot.currentPhase ?? null
  }

  if (Object.prototype.hasOwnProperty.call(state, "phaseStartTime")) {
    ;(nextState as SnapshotDrivenState & { phaseStartTime: string | null }).phaseStartTime =
      snapshot.phaseStartTime ?? null
  }

  return nextState as T
}
