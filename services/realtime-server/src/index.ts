import "dotenv/config"
import { createServer } from "http"
import type { IncomingMessage } from "http"
import { randomUUID } from "node:crypto"

import {
  verifyRealtimeToken,
  type ClientToServerEvent,
  type PlayerSummary,
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
    const snapshot = initialSnapshot ? cloneSnapshot(initialSnapshot) : createPlaceholderSnapshot(roomCode)
    room = registry.ensureRoom(roomCode, snapshot)
  } else if (initialSnapshot) {
    registry.updateRoom(roomCode, (state) => {
      const next = cloneSnapshot(state)
      next.players = initialSnapshot.players.map((player) => ({ ...player }))
      next.status = initialSnapshot.status
      next.currentPhase = initialSnapshot.currentPhase
      next.phaseStartTime = initialSnapshot.phaseStartTime
      next.version = Math.max(state.version + 1, initialSnapshot.version ?? state.version + 1)
      return next
    })
    room = registry.getRoom(roomCode)
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

  const playerExists = room.state.players.some((player) => player.id === playerId)
  let didCreatePlayer = false
  if (!playerExists) {
    registry.updateRoom(roomCode, (state) => {
      const next = cloneSnapshot(state)
      const newPlayer: PlayerSummary = {
        id: playerId,
        name: `Player ${state.players.length + 1}`,
        emoji: "🤖",
        isReady: false,
        isHost: state.players.length === 0,
      }
      next.players = [...state.players, newPlayer]
      next.version = state.version + 1
      return next
    })
    didCreatePlayer = true
    metrics.increment("players_created_total")
  }

  attachClient(roomCode, socket, playerId)

  const currentRoom = registry.getRoom(roomCode)
  if (!currentRoom) return

  metrics.increment("join_room_success_total")
  logger.info("join_room_success", { roomCode, playerId, version: currentRoom.state.version })

  sendMessage(socket, {
    type: "hello_ack",
    roomCode,
    snapshot: currentRoom.state,
  })

  snapshotScheduler.schedule(currentRoom.state)

  if (didCreatePlayer) {
    try {
      await recordRoomEventImpl({
        roomCode,
        eventType: "player_joined",
        version: currentRoom.state.version,
        payload: { playerId },
      })
    } catch (error) {
      metrics.increment("event_persist_failures_total")
      logger.error("player_joined_event_persist_failed", { error: error instanceof Error ? error.message : "unknown" })
    }
  }

  const joinedPlayer = currentRoom.state.players.find((player) => player.id === playerId)
  if (joinedPlayer) {
    broadcast(
      roomCode,
      {
        type: "player_joined",
        roomCode,
        player: joinedPlayer,
        version: currentRoom.state.version,
      },
      socket,
    )
    logger.info("player_joined_broadcast", { roomCode, playerId, version: currentRoom.state.version })
  }
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

  const updated = registry.updateRoom(roomCode, (state) => {
    const next = cloneSnapshot(state)
    const phases: Array<RoomSnapshot["currentPhase"]> = [null, "big_idea", "visual", "headline", "pitch"]
    const currentIndex = phases.indexOf(state.currentPhase ?? null)
    const nextPhase = phases[(currentIndex + 1) % phases.length]
    next.currentPhase = nextPhase
    next.phaseStartTime = new Date().toISOString()
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

  httpServer = createServer()
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
