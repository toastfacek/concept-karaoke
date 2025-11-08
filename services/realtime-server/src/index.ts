import "dotenv/config"
import { createServer } from "http"
import type { IncomingMessage, ServerResponse } from "http"
import { randomUUID } from "node:crypto"

import {
  verifyRealtimeToken,
  type ClientToServerEvent,
  type GameStatus,
  type RoomSnapshot,
  type ServerToClientEvent,
} from "@concept-karaoke/realtime-shared"
import WebSocket, { WebSocketServer } from "ws"
import type { RawData } from "ws"

import { createMemoryRoomRegistry } from "./memory-room-registry.js"
import type { ConnectedClient, RoomRegistry } from "./room-registry.js"
import { SnapshotScheduler } from "./snapshot-scheduler.js"
import {
  persistRoomSnapshot as defaultPersistRoomSnapshot,
  recordRoomEvent as defaultRecordRoomEvent,
} from "./persistence.js"
import { logger } from "./logger.js"
import { MetricsRecorder } from "./metrics.js"

const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080
const HEARTBEAT_INTERVAL_MS = 15_000
const HEARTBEAT_TIMEOUT_MS = 45_000
const VALID_GAME_STATUSES: ReadonlyArray<GameStatus> = ["lobby", "briefing", "creating", "presenting", "voting", "results"]
const BROADCAST_SECRET = process.env.REALTIME_BROADCAST_SECRET

interface ConnectionMeta {
  roomCode?: string
  playerId?: string
  lastHeartbeat: number
  heartbeatTimer?: NodeJS.Timeout
}

export interface StartRealtimeServerOptions {
  port?: number
  sharedSecret?: string
  metricsFlushIntervalMs?: number
  registry?: RoomRegistry
  snapshotFlushDelayMs?: number
  persistence?: {
    persistRoomSnapshot?: typeof defaultPersistRoomSnapshot
    recordRoomEvent?: typeof defaultRecordRoomEvent
  }
}

let registry: RoomRegistry
let connectionMeta: Map<WebSocket, ConnectionMeta>
let metrics: MetricsRecorder
let snapshotScheduler: SnapshotScheduler
let persistRoomSnapshotImpl = defaultPersistRoomSnapshot
let recordRoomEventImpl = defaultRecordRoomEvent
let realtimeSharedSecret: string
let httpServer: ReturnType<typeof createServer> | null = null
let wss: WebSocketServer | null = null
let listeningPort: number | null = null
let isShuttingDown = false
let serverStarted = false
let signalsBound = false

const DEFAULT_METRICS_FLUSH_INTERVAL_MS = Number(process.env.METRICS_FLUSH_INTERVAL_MS ?? 60_000)

function sendMessage(socket: WebSocket, message: ServerToClientEvent) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message))
  }
}

function cloneSnapshot(snapshot: RoomSnapshot): RoomSnapshot {
  return {
    ...snapshot,
    players: snapshot.players.map((player) => ({ ...player })),
  }
}

function createPlaceholderSnapshot(roomCode: string): RoomSnapshot {
  return {
    id: randomUUID(),
    code: roomCode,
    status: "creating",
    currentPhase: null,
    phaseStartTime: null,
    players: [],
    version: 0,
  }
}

function attachClient(roomCode: string, socket: WebSocket, playerId: string) {
  const room = registry.getRoom(roomCode)
  if (!room) {
    throw new Error(`Room ${roomCode} not initialized`)
  }
  const client: ConnectedClient = { socket, playerId }
  registry.attachClient(roomCode, client)
  const meta: ConnectionMeta = {
    roomCode,
    playerId,
    lastHeartbeat: Date.now(),
  }
  connectionMeta.set(socket, meta)
  startHeartbeatMonitor(socket, meta)
}

function broadcast(roomCode: string, message: ServerToClientEvent, exclude?: WebSocket) {
  const room = registry.getRoom(roomCode)
  if (!room) return
  for (const client of room.clients) {
    if (client.socket === exclude) continue
    sendMessage(client.socket, message)
  }
}

function broadcastRoomState(roomCode: string, snapshot: RoomSnapshot, exclude?: WebSocket) {
  const snapshotCopy = cloneSnapshot(snapshot)
  broadcast(
    roomCode,
    {
      type: "room_state",
      snapshot: snapshotCopy,
    },
    exclude,
  )
}

async function handleJoinRoom(socket: WebSocket, payload: ClientToServerEvent & { type: "join_room" }) {
  metrics.increment("join_room_attempts_total")
  const { roomCode, playerId, playerToken, initialSnapshot } = payload
  if (!roomCode || !playerId) {
    sendMessage(socket, {
      type: "error",
      code: "invalid_payload",
      message: "Missing roomCode or playerId",
    })
    return
  }

  if (!playerToken) {
    metrics.increment("join_room_failures_total")
    logger.warn("join_room_missing_token", { roomCode, playerId })
    sendMessage(socket, {
      type: "error",
      code: "invalid_payload",
      message: "Missing authentication token",
    })
    return
  }

  let authPayload
  try {
    authPayload = verifyRealtimeToken(playerToken, realtimeSharedSecret)
  } catch (error) {
    metrics.increment("auth_failures_total")
    logger.warn("token_verification_failed", {
      roomCode,
      playerId,
      error: error instanceof Error ? error.message : "unknown_error",
    })
    sendMessage(socket, {
      type: "error",
      code: "unauthorized",
      message: "Invalid realtime token",
    })
    return
  }

  if (authPayload.roomCode !== roomCode || authPayload.playerId !== playerId) {
    metrics.increment("join_room_failures_total")
    logger.warn("token_mismatch", { roomCode, playerId, tokenRoom: authPayload.roomCode, tokenPlayer: authPayload.playerId })
    sendMessage(socket, {
      type: "error",
      code: "forbidden",
      message: "Token does not match player or room",
    })
    return
  }

  let room = registry.getRoom(roomCode)

  if (!room) {
    // If no room exists, create a placeholder snapshot
    // In production, this should fetch from database instead of trusting client
    const snapshot = initialSnapshot ? cloneSnapshot(initialSnapshot) : createPlaceholderSnapshot(roomCode)
    room = registry.ensureRoom(roomCode, snapshot)
    logger.info("room_initialized_from_client", { roomCode, version: snapshot.version })
  } else if (initialSnapshot) {
    // Client provided a snapshot, but we only use it to detect version mismatches
    // Server state is authoritative - do not merge client data
    const clientVersion = initialSnapshot.version ?? 0
    const serverVersion = room.state.version

    if (clientVersion > serverVersion) {
      logger.warn("client_version_ahead", {
        roomCode,
        clientVersion,
        serverVersion,
        playerId,
      })
      // In production, fetch latest state from database here
      // For now, server state remains authoritative
    }
  }

  if (!room) {
    metrics.increment("join_room_failures_total")
    logger.warn("join_room_room_not_found", { roomCode, playerId })
    sendMessage(socket, {
      type: "error",
      code: "room_not_found",
      message: "Room could not be initialized",
    })
    return
  }

  // Don't create placeholder players - let API broadcasts handle player creation
  // This ensures all player data (name, emoji) comes from the authoritative source
  const playerExists = room.state.players.some((player) => player.id === playerId)

  if (!playerExists) {
    logger.info("player_not_in_snapshot_yet", {
      roomCode,
      playerId,
      message: "Player will be added via API broadcast"
    })
  }

  // Attach client regardless - they'll receive player data via player_joined broadcast from API
  attachClient(roomCode, socket, playerId)

  const currentRoom = registry.getRoom(roomCode)
  if (!currentRoom) return

  metrics.increment("join_room_success_total")
  logger.info("join_room_success", { roomCode, playerId, version: currentRoom.state.version })

  // Send current snapshot - player will be added when API broadcasts player_joined
  sendMessage(socket, {
    type: "hello_ack",
    roomCode,
    snapshot: currentRoom.state,
  })

  snapshotScheduler.schedule(currentRoom.state)

  broadcastRoomState(roomCode, currentRoom.state, socket)
}

async function handleSetReady(socket: WebSocket, payload: ClientToServerEvent & { type: "set_ready" }) {
  metrics.increment("ready_update_attempts_total")
  const { roomCode, playerId, isReady } = payload
  if (!roomCode || !playerId) {
    sendMessage(socket, {
      type: "error",
      code: "invalid_payload",
      message: "Missing roomCode or playerId",
    })
    return
  }

  // Verify the player ID matches the authenticated socket
  const meta = connectionMeta.get(socket)
  if (!meta || meta.playerId !== playerId) {
    metrics.increment("ready_update_failures_total")
    logger.warn("ready_update_unauthorized", { roomCode, payloadPlayerId: playerId, socketPlayerId: meta?.playerId })
    sendMessage(socket, {
      type: "error",
      code: "forbidden",
      message: "Player ID does not match authenticated connection",
    })
    return
  }

  const room = registry.getRoom(roomCode)
  if (!room) {
    metrics.increment("ready_update_failures_total")
    logger.warn("ready_update_room_not_found", { roomCode, playerId })
    sendMessage(socket, {
      type: "error",
      code: "room_not_found",
      message: "Room not initialized",
    })
    return
  }

  // Verify player exists in room
  const player = room.state.players.find((p) => p.id === playerId)
  if (!player) {
    metrics.increment("ready_update_failures_total")
    logger.warn("ready_update_player_not_found", { roomCode, playerId })
    sendMessage(socket, {
      type: "error",
      code: "player_not_found",
      message: "Player not found in room",
    })
    return
  }

  const updated = registry.updateRoom(roomCode, (state) => {
    const next = cloneSnapshot(state)
    const target = next.players.find((player) => player.id === playerId)
    if (target) {
      target.isReady = isReady
      next.version = state.version + 1
    }
    return next
  })

  if (!updated) return

  broadcast(roomCode, {
    type: "ready_update",
    roomCode,
    playerId,
    isReady,
    version: updated.state.version,
  })

  broadcastRoomState(roomCode, updated.state)

  snapshotScheduler.schedule(updated.state)

  metrics.increment("ready_update_success_total")
  logger.debug("ready_update_success", { roomCode, playerId, isReady, version: updated.state.version })

  try {
    await recordRoomEventImpl({
      roomCode,
      eventType: "player_ready",
      version: updated.state.version,
      payload: { playerId, isReady },
    })
    metrics.increment("event_persist_success_total")
  } catch (error) {
    metrics.increment("event_persist_failures_total")
    logger.error("player_ready_event_persist_failed", { error: error instanceof Error ? error.message : "unknown" })
  }
}

async function handleAdvancePhase(socket: WebSocket, payload: ClientToServerEvent & { type: "advance_phase" }) {
  metrics.increment("phase_change_attempts_total")
  const { roomCode } = payload
  if (!roomCode) {
    sendMessage(socket, {
      type: "error",
      code: "invalid_payload",
      message: "Missing roomCode",
    })
    return
  }

  // Verify the player is authenticated
  const meta = connectionMeta.get(socket)
  if (!meta || !meta.playerId) {
    metrics.increment("phase_change_failures_total")
    logger.warn("phase_change_unauthorized", { roomCode, playerId: meta?.playerId })
    sendMessage(socket, {
      type: "error",
      code: "forbidden",
      message: "Player not authenticated",
    })
    return
  }

  const room = registry.getRoom(roomCode)
  if (!room) {
    metrics.increment("phase_change_failures_total")
    logger.warn("phase_change_room_not_found", { roomCode })
    sendMessage(socket, {
      type: "error",
      code: "room_not_found",
      message: "Room not found",
    })
    return
  }

  // Verify player is the host
  const actor = room.state.players.find((p) => p.id === meta.playerId)
  if (!actor || !actor.isHost) {
    metrics.increment("phase_change_failures_total")
    logger.warn("phase_change_not_host", { roomCode, playerId: meta.playerId, isHost: actor?.isHost })
    sendMessage(socket, {
      type: "error",
      code: "forbidden",
      message: "Only the host can advance the phase",
    })
    return
  }

  const updated = registry.updateRoom(roomCode, (state) => {
    const next = cloneSnapshot(state)
    const phases: Array<RoomSnapshot["currentPhase"]> = [null, "big_idea", "visual", "headline", "pitch"]
    const currentIndex = phases.indexOf(state.currentPhase ?? null)
    const nextPhase = phases[(currentIndex + 1) % phases.length]
    next.currentPhase = nextPhase
    next.phaseStartTime = new Date().toISOString()
    next.players = next.players.map((player) => ({
      ...player,
      isReady: false,
    }))
    next.version = state.version + 1
    return next
  })

  if (!updated) {
    metrics.increment("phase_change_failures_total")
    logger.warn("phase_change_room_not_found", { roomCode })
    return
  }

  broadcast(roomCode, {
    type: "phase_changed",
    roomCode,
    currentPhase: updated.state.currentPhase,
    phaseStartTime: updated.state.phaseStartTime,
    version: updated.state.version,
  })

  broadcastRoomState(roomCode, updated.state)

  snapshotScheduler.schedule(updated.state)
  try {
    await recordRoomEventImpl({
      roomCode,
      eventType: "phase_changed",
      version: updated.state.version,
      payload: { currentPhase: updated.state.currentPhase, phaseStartTime: updated.state.phaseStartTime },
    })
    metrics.increment("event_persist_success_total")
  } catch (error) {
    logger.error("phase_changed_event_persist_failed", { error: error instanceof Error ? error.message : "unknown" })
    metrics.increment("event_persist_failures_total")
  }

  metrics.increment("phase_change_success_total")
  logger.info("phase_changed_broadcast", {
    roomCode,
    currentPhase: updated.state.currentPhase,
    version: updated.state.version,
  })
}

async function handleSetStatus(socket: WebSocket, payload: ClientToServerEvent & { type: "set_status" }) {
  metrics.increment("status_update_attempts_total")
  const { roomCode, playerId, status, currentPhase, phaseStartTime } = payload
  if (!roomCode || !playerId || !status) {
    sendMessage(socket, {
      type: "error",
      code: "invalid_payload",
      message: "Missing roomCode, playerId, or status",
    })
    return
  }

  if (!VALID_GAME_STATUSES.includes(status)) {
    metrics.increment("status_update_failures_total")
    logger.warn("status_update_invalid_status", { roomCode, playerId, status })
    sendMessage(socket, {
      type: "error",
      code: "invalid_payload",
      message: `Invalid status value: ${status}`,
    })
    return
  }

  const room = registry.getRoom(roomCode)
  if (!room) {
    metrics.increment("status_update_failures_total")
    logger.warn("status_update_room_not_found", { roomCode, playerId })
    sendMessage(socket, {
      type: "error",
      code: "room_not_found",
      message: "Room not initialized",
    })
    return
  }

  const actor = room.state.players.find((player) => player.id === playerId)
  if (!actor) {
    metrics.increment("status_update_failures_total")
    logger.warn("status_update_player_not_found", { roomCode, playerId })
    sendMessage(socket, {
      type: "error",
      code: "player_not_found",
      message: "Player not found in this room",
    })
    return
  }

  const requiresHost = status !== "results"

  if (requiresHost && !actor.isHost) {
    metrics.increment("status_update_failures_total")
    logger.warn("status_update_forbidden", { roomCode, playerId })
    sendMessage(socket, {
      type: "error",
      code: "forbidden",
      message: "Only the host can change game status",
    })
    return
  }

  const normalizedPhaseStart = phaseStartTime ?? new Date().toISOString()

  const updated = registry.updateRoom(roomCode, (state) => {
    const next = cloneSnapshot(state)
    next.status = status
    next.currentPhase = currentPhase
    next.phaseStartTime = normalizedPhaseStart
    next.version = state.version + 1
    return next
  })

  if (!updated) {
    return
  }

  broadcast(roomCode, {
    type: "status_changed",
    roomCode,
    status,
    currentPhase,
    phaseStartTime: normalizedPhaseStart,
    version: updated.state.version,
  })

  broadcastRoomState(roomCode, updated.state)

  snapshotScheduler.schedule(updated.state)

  try {
    await recordRoomEventImpl({
      roomCode,
      eventType: "status_changed",
      version: updated.state.version,
      payload: {
        status,
        currentPhase,
        phaseStartTime: normalizedPhaseStart,
      },
    })
    metrics.increment("event_persist_success_total")
  } catch (error) {
    metrics.increment("event_persist_failures_total")
    logger.error("status_changed_event_persist_failed", { error: error instanceof Error ? error.message : "unknown" })
  }

  metrics.increment("status_update_success_total")
  logger.info("status_update_success", {
    roomCode,
    playerId,
    status,
    version: updated.state.version,
  })
}

async function handlePresentationState(
  _socket: WebSocket,
  payload: ClientToServerEvent & { type: "presentation_state" },
) {
  const { roomCode, playerId, presentIndex, showCampaign } = payload
  const room = registry.getRoom(roomCode)
  if (!room) {
    logger.warn("presentation_state_room_not_found", { roomCode, playerId })
    return
  }

  const actor = room.state.players.find((player) => player.id === playerId)
  if (!actor) {
    logger.warn("presentation_state_player_not_found", { roomCode, playerId })
    return
  }

  broadcast(roomCode, {
    type: "presentation_state",
    roomCode,
    presentIndex,
    showCampaign,
    version: room.state.version,
  })
  logger.debug("presentation_state_broadcast", { roomCode, playerId, presentIndex, showCampaign })
}

async function handleMessage(socket: WebSocket, event: ClientToServerEvent) {
  switch (event.type) {
    case "join_room":
      await handleJoinRoom(socket, event)
      break
    case "set_ready":
      await handleSetReady(socket, event)
      break
    case "advance_phase":
      await handleAdvancePhase(socket, event)
      break
    case "set_status":
      await handleSetStatus(socket, event)
      break
    case "presentation_state":
      await handlePresentationState(socket, event)
      break
    case "leave_room":
      await handleDisconnect(socket)
      break
    case "heartbeat":
      registerHeartbeat(socket)
      break
    default:
      metrics.increment("unsupported_events_total")
      logger.warn("unsupported_event", { eventType: (event as { type: string }).type })
      sendMessage(socket, {
        type: "error",
        code: "invalid_payload",
        message: `Unsupported event type: ${(event as { type: string }).type}`,
      })
  }
}

async function handleDisconnect(socket: WebSocket) {
  const meta = connectionMeta.get(socket)
  if (!meta?.roomCode) return

  metrics.increment("disconnects_total")
  logger.info("ws_client_disconnected", { roomCode: meta.roomCode, playerId: meta.playerId })
  registry.detachClient(meta.roomCode, socket)
  stopHeartbeatMonitor(socket)
  connectionMeta.delete(socket)

  const room = registry.updateRoom(meta.roomCode, (state) => {
    const next = cloneSnapshot(state)
    const target = next.players.find((player) => player.id === meta.playerId)
    if (target) {
      target.isReady = false
      next.version = state.version + 1
    }
    return next
  })

  if (room && meta.playerId) {
    broadcast(meta.roomCode, {
      type: "player_left",
      roomCode: meta.roomCode,
      playerId: meta.playerId,
      version: room.state.version,
    })

    broadcastRoomState(meta.roomCode, room.state)

    snapshotScheduler.schedule(room.state)

    try {
      await recordRoomEventImpl({
        roomCode: meta.roomCode,
        eventType: "player_left",
        version: room.state.version,
        payload: { playerId: meta.playerId },
      })
    } catch (error) {
      metrics.increment("event_persist_failures_total")
      logger.error("player_left_event_persist_failed", { error: error instanceof Error ? error.message : "unknown" })
    }
  }
}

function parseMessage(raw: RawData): ClientToServerEvent | null {
  try {
    const json = JSON.parse(raw.toString())
    return json as ClientToServerEvent
  } catch (error) {
    metrics.increment("ws_message_parse_failures_total")
    logger.error("ws_message_parse_failed", { error: error instanceof Error ? error.message : "unknown" })
    return null
  }
}

function parseRequestBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = ""
    req.on("data", (chunk) => {
      body += chunk.toString()
    })
    req.on("end", () => {
      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(error)
      }
    })
    req.on("error", reject)
  })
}

function handleHttpRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "POST" && req.url === "/api/broadcast") {
    void handleBroadcastRequest(req, res)
  } else if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ status: "ok", port: listeningPort }))
  } else {
    res.writeHead(404, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Not found" }))
  }
}

async function handleBroadcastRequest(req: IncomingMessage, res: ServerResponse) {
  metrics.increment("http_broadcast_attempts_total")

  try {
    const body = await parseRequestBody(req)
    const payload = body as { roomCode?: string; event?: ServerToClientEvent; secret?: string }

    if (!BROADCAST_SECRET) {
      logger.error("broadcast_no_secret_configured")
      res.writeHead(500, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Broadcast secret not configured" }))
      return
    }

    if (payload.secret !== BROADCAST_SECRET) {
      metrics.increment("http_broadcast_auth_failures_total")
      console.log("[WS DEBUG] Secret mismatch:", {
        received: payload.secret?.slice(0, 10) + "...",
        expected: BROADCAST_SECRET?.slice(0, 10) + "...",
        match: payload.secret === BROADCAST_SECRET
      })
      logger.warn("broadcast_auth_failed", { roomCode: payload.roomCode })
      res.writeHead(403, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Invalid secret" }))
      return
    }

    if (!payload.roomCode || !payload.event) {
      metrics.increment("http_broadcast_failures_total")
      logger.warn("broadcast_invalid_payload", { roomCode: payload.roomCode })
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Missing roomCode or event" }))
      return
    }

    let room = registry.getRoom(payload.roomCode)
    if (!room) {
      // Room doesn't exist yet - create it with empty snapshot
      // This can happen when API broadcasts before any client connects
      logger.info("broadcast_creating_room", { roomCode: payload.roomCode })
      const emptySnapshot = createPlaceholderSnapshot(payload.roomCode)
      room = registry.ensureRoom(payload.roomCode, emptySnapshot)
      metrics.increment("broadcast_room_created_total")
    }

    // Update room state before broadcasting for stateful events
    const event = payload.event
    switch (event.type) {
      case "player_joined": {
        const updated = registry.updateRoom(payload.roomCode, (state) => {
          const next = cloneSnapshot(state)
          const existingIndex = next.players.findIndex((p) => p.id === event.player.id)

          if (existingIndex >= 0) {
            // Update existing player
            next.players[existingIndex] = {
              id: event.player.id,
              name: event.player.name,
              emoji: event.player.emoji,
              isReady: event.player.isReady,
              isHost: event.player.isHost,
            }
          } else {
            // Add new player
            next.players.push({
              id: event.player.id,
              name: event.player.name,
              emoji: event.player.emoji,
              isReady: event.player.isReady,
              isHost: event.player.isHost,
            })
          }

          next.version = state.version + 1
          return next
        })

        // Immediately broadcast room_state to all connected clients with the updated snapshot
        // This ensures all clients get fresh data with the new player
        if (updated) {
          broadcastRoomState(payload.roomCode, updated.state)
        }

        logger.debug("broadcast_state_updated", {
          roomCode: payload.roomCode,
          eventType: "player_joined",
          playerId: event.player.id
        })
        break
      }

      case "ready_update": {
        registry.updateRoom(payload.roomCode, (state) => {
          const next = cloneSnapshot(state)
          const player = next.players.find((p) => p.id === event.playerId)

          if (player) {
            player.isReady = event.isReady
            next.version = state.version + 1
          }

          return next
        })
        logger.debug("broadcast_state_updated", {
          roomCode: payload.roomCode,
          eventType: "ready_update",
          playerId: event.playerId
        })
        break
      }

      case "status_changed": {
        registry.updateRoom(payload.roomCode, (state) => {
          const next = cloneSnapshot(state)
          next.status = event.status
          next.currentPhase = event.currentPhase
          next.phaseStartTime = event.phaseStartTime
          next.version = state.version + 1
          return next
        })
        logger.debug("broadcast_state_updated", {
          roomCode: payload.roomCode,
          eventType: "status_changed",
          status: event.status
        })
        break
      }

      case "phase_changed": {
        registry.updateRoom(payload.roomCode, (state) => {
          const next = cloneSnapshot(state)
          next.currentPhase = event.currentPhase
          next.phaseStartTime = event.phaseStartTime
          next.version = state.version + 1
          return next
        })
        logger.debug("broadcast_state_updated", {
          roomCode: payload.roomCode,
          eventType: "phase_changed",
          phase: event.currentPhase
        })
        break
      }

      case "settings_changed": {
        registry.updateRoom(payload.roomCode, (state) => {
          const next = cloneSnapshot(state)
          next.version = state.version + 1
          return next
        })
        logger.debug("broadcast_state_updated", {
          roomCode: payload.roomCode,
          eventType: "settings_changed"
        })
        break
      }

      case "brief_updated": {
        registry.updateRoom(payload.roomCode, (state) => {
          const next = cloneSnapshot(state)
          next.version = state.version + 1
          return next
        })
        logger.debug("broadcast_state_updated", {
          roomCode: payload.roomCode,
          eventType: "brief_updated",
          briefId: event.briefId
        })
        break
      }

      case "content_submitted": {
        registry.updateRoom(payload.roomCode, (state) => {
          const next = cloneSnapshot(state)
          next.version = state.version + 1
          return next
        })
        logger.debug("broadcast_state_updated", {
          roomCode: payload.roomCode,
          eventType: "content_submitted",
          phase: event.phase,
          playerId: event.playerId
        })
        break
      }

      // Broadcast-only events (no state mutation needed)
      case "player_left":
      case "presentation_state":
      case "room_state":
      case "hello_ack":
      case "heartbeat":
      case "error":
        // These events don't require state updates
        logger.debug("broadcast_only_event", {
          roomCode: payload.roomCode,
          eventType: event.type
        })
        break
    }

    const clientCount = room.clients.size
    console.log(`[WS broadcast] Received ${payload.event.type} for room ${payload.roomCode}, broadcasting to ${clientCount} clients`)

    broadcast(payload.roomCode, payload.event)

    metrics.increment("http_broadcast_success_total")
    logger.info("broadcast_success", { roomCode: payload.roomCode, eventType: payload.event.type, clientCount })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ success: true, clientCount }))
  } catch (error) {
    metrics.increment("http_broadcast_failures_total")
    logger.error("broadcast_error", { error: error instanceof Error ? error.message : "unknown" })
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

export async function startRealtimeServer(options: StartRealtimeServerOptions = {}) {
  if (serverStarted) {
    throw new Error("Realtime server already started")
  }

  registry = options.registry ?? createMemoryRoomRegistry()
  connectionMeta = new Map<WebSocket, ConnectionMeta>()
  persistRoomSnapshotImpl = options.persistence?.persistRoomSnapshot ?? defaultPersistRoomSnapshot
  recordRoomEventImpl = options.persistence?.recordRoomEvent ?? defaultRecordRoomEvent

  realtimeSharedSecret =
    options.sharedSecret ??
    process.env.REALTIME_SHARED_SECRET ??
    (() => {
      throw new Error("REALTIME_SHARED_SECRET environment variable is required for the realtime server")
    })()

  const metricsFlushInterval = options.metricsFlushIntervalMs ?? DEFAULT_METRICS_FLUSH_INTERVAL_MS
  metrics = new MetricsRecorder(metricsFlushInterval, (snapshot) => {
    logger.info("metrics_flush", { metrics: snapshot })
  })

  snapshotScheduler = new SnapshotScheduler(
    async (snapshot) => {
      await persistRoomSnapshotImpl(snapshot)
      metrics.increment("snapshots_persisted_total")
    },
    options.snapshotFlushDelayMs,
  )

  httpServer = createServer(handleHttpRequest)
  wss = new WebSocketServer({ server: httpServer })

  wss.on("connection", (socket: WebSocket, request: IncomingMessage) => {
    metrics.increment("ws_connections_total")
    logger.info("ws_client_connected", { remoteAddress: request.socket.remoteAddress })

    socket.on("message", async (raw: RawData) => {
      metrics.increment("ws_messages_total")
      const event = parseMessage(raw)
      if (!event) {
        sendMessage(socket, {
          type: "error",
          code: "invalid_payload",
          message: "Unable to parse message",
        })
        return
      }
      try {
        await handleMessage(socket, event)
      } catch (error) {
        metrics.increment("ws_message_handler_failures_total")
        logger.error("ws_message_handler_failed", { error: error instanceof Error ? error.message : "unknown" })
      }
    })

    socket.on("close", () => {
      void handleDisconnect(socket)
    })

    socket.on("error", (error: Error) => {
      metrics.increment("ws_socket_errors_total")
      logger.error("ws_socket_error", { error: error instanceof Error ? error.message : "unknown" })
      void handleDisconnect(socket)
    })
  })

  const port = options.port ?? DEFAULT_PORT

  await new Promise<void>((resolve) => {
    httpServer!.listen(port, () => {
      const address = httpServer!.address()
      listeningPort = typeof address === "object" && address ? address.port : port
      logger.info("realtime_server_listening", { port: listeningPort })
      resolve()
    })
  })

  serverStarted = true
  isShuttingDown = false

  if (!signalsBound) {
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.on(signal, () => {
        void shutdown({ signal, exitProcess: true })
      })
    }
    signalsBound = true
  }

  return { port: listeningPort }
}

export function getRealtimeServerPort(): number {
  if (!serverStarted || listeningPort == null) {
    throw new Error("Realtime server is not listening")
  }
  return listeningPort
}

export async function stopRealtimeServer() {
  await shutdown({ exitProcess: false })
}

function registerHeartbeat(socket: WebSocket) {
  const meta = connectionMeta.get(socket)
  if (!meta) return
  meta.lastHeartbeat = Date.now()
}

function startHeartbeatMonitor(socket: WebSocket, meta: ConnectionMeta) {
  if (meta.heartbeatTimer) {
    clearInterval(meta.heartbeatTimer)
  }
  meta.heartbeatTimer = setInterval(() => {
    if (socket.readyState !== WebSocket.OPEN) {
      stopHeartbeatMonitor(socket)
      return
    }
    const elapsed = Date.now() - meta.lastHeartbeat
    if (elapsed > HEARTBEAT_TIMEOUT_MS) {
      metrics.increment("heartbeat_timeouts_total")
      logger.warn("heartbeat_timeout", { roomCode: meta.roomCode, playerId: meta.playerId })
      stopHeartbeatMonitor(socket)
      socket.terminate()
      void handleDisconnect(socket)
      return
    }
    if (meta.roomCode) {
      sendMessage(socket, {
        type: "heartbeat",
        roomCode: meta.roomCode,
        timestamp: Date.now(),
      })
    }
  }, HEARTBEAT_INTERVAL_MS)
}

function stopHeartbeatMonitor(socket: WebSocket) {
  const meta = connectionMeta.get(socket)
  if (!meta || !meta.heartbeatTimer) return
  clearInterval(meta.heartbeatTimer)
  delete meta.heartbeatTimer
}

async function shutdown(options: { signal?: NodeJS.Signals; exitProcess: boolean }) {
  if (!serverStarted || isShuttingDown) {
    if (options.exitProcess) {
      process.exit(0)
    }
    return
  }

  isShuttingDown = true
  logger.warn("realtime_server_shutdown_signal", { signal: options.signal ?? "manual" })

  try {
    await snapshotScheduler.shutdown()
  } catch (error) {
    logger.error("snapshot_flush_shutdown_failed", { error: error instanceof Error ? error.message : "unknown" })
  }

  metrics.shutdown()

  await new Promise<void>((resolve) => {
    wss?.close(() => {
      httpServer?.close(() => resolve())
    })
    setTimeout(() => resolve(), 5_000)
  })

  for (const socket of connectionMeta.keys()) {
    stopHeartbeatMonitor(socket)
  }
  connectionMeta.clear()
  listeningPort = null
  httpServer = null
  wss = null

  serverStarted = false
  isShuttingDown = false
  logger.info("realtime_server_shutdown_complete", { signal: options.signal ?? "manual" })

  if (options.exitProcess) {
    process.exit(0)
  }
}

if (process.env.NODE_ENV !== "test") {
  void startRealtimeServer().catch((error) => {
    logger.error("realtime_server_start_failed", { error: error instanceof Error ? error.message : "unknown" })
    process.exit(1)
  })
}
