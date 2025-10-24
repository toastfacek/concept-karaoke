import { createHmac, timingSafeEqual } from "crypto"

export type CreationPhase = "big_idea" | "visual" | "headline" | "pitch" | null

export interface PlayerSummary {
  id: string
  name: string
  emoji: string
  isReady: boolean
  isHost: boolean
}

export interface RoomSnapshot {
  id: string
  code: string
  status: string
  currentPhase: CreationPhase
  phaseStartTime: string | null
  players: PlayerSummary[]
  version: number
}

export type ClientToServerEvent =
  | {
      type: "join_room"
      roomCode: string
      playerId: string
      playerToken: string
      initialSnapshot?: RoomSnapshot
    }
  | {
      type: "leave_room"
      roomCode: string
    }
  | {
      type: "set_ready"
      roomCode: string
      playerId: string
      isReady: boolean
    }
  | {
      type: "advance_phase"
      roomCode: string
      playerId: string
    }
  | {
      type: "heartbeat"
      roomCode: string
    }

export type ServerToClientEvent =
  | {
      type: "hello_ack"
      roomCode: string
      snapshot: RoomSnapshot
    }
  | {
      type: "room_state"
      snapshot: RoomSnapshot
    }
  | {
      type: "player_joined"
      roomCode: string
      player: PlayerSummary
      version: number
    }
  | {
      type: "player_left"
      roomCode: string
      playerId: string
      version: number
    }
  | {
      type: "ready_update"
      roomCode: string
      playerId: string
      isReady: boolean
      version: number
    }
  | {
      type: "phase_changed"
      roomCode: string
      currentPhase: CreationPhase
      phaseStartTime: string | null
      version: number
    }
  | {
      type: "settings_changed"
      roomCode: string
      productCategory: string
      phaseDurationSeconds: number
      version: number
    }
  | {
      type: "heartbeat"
      roomCode: string
      timestamp: number
    }
  | {
      type: "error"
      code: RealtimeErrorCode
      message: string
    }

export type RealtimeErrorCode =
  | "unauthorized"
  | "room_not_found"
  | "invalid_payload"
  | "player_not_found"
  | "forbidden"
  | "internal_error"

export type RealtimeMessage = ClientToServerEvent | ServerToClientEvent

export interface RealtimeAuthPayload {
  roomCode: string
  playerId: string
  exp: number
}

export function signRealtimeToken(payload: RealtimeAuthPayload, secret: string): string {
  const body = encodeBase64Url(JSON.stringify(payload))
  const signature = createHmac("sha256", secret).update(body).digest()
  return `${body}.${encodeBase64Url(signature)}`
}

export function verifyRealtimeToken(token: string, secret: string): RealtimeAuthPayload {
  const [body, signaturePart] = token.split(".")
  if (!body || !signaturePart) {
    throw new Error("Malformed token")
  }

  const expectedSignature = createHmac("sha256", secret).update(body).digest()
  const actualSignature = decodeBase64Url(signaturePart)

  if (expectedSignature.length !== actualSignature.length || !timingSafeEqual(expectedSignature, actualSignature)) {
    throw new Error("Invalid token signature")
  }

  const payloadJson = decodeBase64Url(body).toString("utf8")
  let payload: unknown
  try {
    payload = JSON.parse(payloadJson)
  } catch {
    throw new Error("Invalid token payload")
  }

  if (!isRealtimeAuthPayload(payload)) {
    throw new Error("Malformed token payload")
  }

  if (payload.exp * 1000 < Date.now()) {
    throw new Error("Token expired")
  }

  return payload
}

function isRealtimeAuthPayload(value: unknown): value is RealtimeAuthPayload {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return (
    typeof record.roomCode === "string" &&
    record.roomCode.length > 0 &&
    typeof record.playerId === "string" &&
    record.playerId.length > 0 &&
    typeof record.exp === "number"
  )
}

function encodeBase64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url")
}

function decodeBase64Url(input: string) {
  return Buffer.from(input, "base64url")
}
