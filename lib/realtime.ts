export const roomChannel = (roomId: string) => `room:${roomId}`
export const adlobChannel = (adlobId: string) => `adlob:${adlobId}`

export const realtimeEvents = {
  playerJoined: "player:joined",
  playerLeft: "player:left",
  playerReady: "player:ready",
  briefUpdated: "brief:updated",
  briefLocked: "brief:locked",
  phaseStarted: "phase:started",
  phaseCompleted: "phase:completed",
  adlobPassed: "adlob:passed",
  pitchStarted: "pitch:started",
  pitchEnded: "pitch:ended",
  voteCast: "vote:cast",
  gameCompleted: "game:completed",
} as const

export type RealtimeEvent = (typeof realtimeEvents)[keyof typeof realtimeEvents]
