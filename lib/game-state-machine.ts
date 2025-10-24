import type { CreationPhase, GameStatus } from "./types";
import { CREATION_PHASES, GAME_STATUSES } from "./types"

export interface GameStateSnapshot {
  status: GameStatus
  currentPhase: CreationPhase | null
}

export const INITIAL_GAME_STATE: GameStateSnapshot = {
  status: "lobby",
  currentPhase: null,
}

export const GAME_STATUS_TRANSITIONS: Record<GameStatus, readonly GameStatus[]> = {
  lobby: ["briefing"],
  briefing: ["creating"],
  creating: ["presenting"],
  presenting: ["voting"],
  voting: ["results"],
  results: ["lobby"], // Allows immediate replay via "Play Again"
} as const

export function canTransitionStatus(current: GameStatus, target: GameStatus): boolean {
  return GAME_STATUS_TRANSITIONS[current]?.includes(target) ?? false
}

export function assertCanTransitionStatus(current: GameStatus, target: GameStatus) {
  if (!canTransitionStatus(current, target)) {
    throw new Error(`Illegal game status transition: ${current} → ${target}`)
  }
}

export function getNextStatus(current: GameStatus): GameStatus | null {
  const [next] = GAME_STATUS_TRANSITIONS[current] ?? []
  return next ?? null
}

export const CREATION_PHASE_SEQUENCE: readonly CreationPhase[] = CREATION_PHASES

export function getInitialCreationPhase(): CreationPhase {
  return CREATION_PHASE_SEQUENCE[0]
}

export function isFinalCreationPhase(phase: CreationPhase): boolean {
  return CREATION_PHASE_SEQUENCE.indexOf(phase) === CREATION_PHASE_SEQUENCE.length - 1
}

export function getNextCreationPhase(phase: CreationPhase): CreationPhase | null {
  const index = CREATION_PHASE_SEQUENCE.indexOf(phase)
  if (index === -1 || index === CREATION_PHASE_SEQUENCE.length - 1) {
    return null
  }

  return CREATION_PHASE_SEQUENCE[index + 1]
}

export function assertValidGameState(state: GameStateSnapshot) {
  if (!GAME_STATUSES.includes(state.status)) {
    throw new Error(`Unknown game status: ${state.status}`)
  }

  if (state.status === "creating" && state.currentPhase === null) {
    throw new Error("Creation status requires an active creation phase")
  }

  if (state.status !== "creating" && state.currentPhase !== null) {
    throw new Error(`Creation phase must be null when status is ${state.status}`)
  }
}

export function transitionGameState(
  state: GameStateSnapshot,
  targetStatus: GameStatus,
  options: { nextPhase?: CreationPhase | null } = {},
): GameStateSnapshot {
  assertCanTransitionStatus(state.status, targetStatus)

  const nextState: GameStateSnapshot = {
    status: targetStatus,
    currentPhase:
      targetStatus === "creating"
        ? options.nextPhase ?? state.currentPhase ?? getInitialCreationPhase()
        : null,
  }

  assertValidGameState(nextState)
  return nextState
}

export function advanceCreationPhase(state: GameStateSnapshot): GameStateSnapshot {
  if (state.status !== "creating" || state.currentPhase === null) {
    throw new Error("Creation phase can only advance while status is 'creating'")
  }

  const nextPhase = getNextCreationPhase(state.currentPhase)

  if (!nextPhase) {
    // No more creation phases; promote to presenting
    return transitionGameState(
      { status: state.status, currentPhase: state.currentPhase },
      "presenting",
    )
  }

  return {
    status: "creating",
    currentPhase: nextPhase,
  }
}

export function isTerminalStatus(status: GameStatus): boolean {
  return status === "results"
}

export function requiresPhase(state: GameStateSnapshot): boolean {
  return state.status === "creating"
}
