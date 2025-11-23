import * as Sentry from "@sentry/nextjs"
import type { GameRoom, Player } from "@/lib/types"

/**
 * Update Sentry context with game session information
 * Call this whenever game state changes to enrich bug reports
 */
export function updateGameContext(
  room: GameRoom | null,
  currentPlayer: Player | null,
  allPlayers: Player[]
) {
  // Set game session context
  Sentry.setContext("game_session", {
    room_code: room?.code,
    room_status: room?.status,
    current_phase: room?.currentPhase,
    player_count: allPlayers.length,
    phase_duration: room?.phaseDurationSeconds,
    created_at: room?.createdAt,
  })

  // Set user identity (non-PII)
  if (currentPlayer) {
    Sentry.setUser({
      id: currentPlayer.id,
      username: currentPlayer.name,
    })
  }

  // Set tags for filtering in Sentry dashboard
  Sentry.setTags({
    "game.is_host": currentPlayer?.isHost ? "true" : "false",
    "game.phase": room?.currentPhase || "none",
    "game.status": room?.status || "unknown",
    "game.player_count": allPlayers.length.toString(),
  })
}

/**
 * Clear game context when leaving a game
 */
export function clearGameContext() {
  Sentry.setContext("game_session", null)
  Sentry.setUser(null)
  Sentry.setTags({
    "game.is_host": undefined,
    "game.phase": undefined,
    "game.status": undefined,
    "game.player_count": undefined,
  })
}
