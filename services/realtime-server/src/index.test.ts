import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { Mock } from "vitest"
import WebSocket from "ws"
import type { RawData } from "ws"

import { signRealtimeToken, type PlayerSummary, type RoomSnapshot, type ServerToClientEvent } from "@concept-karaoke/realtime-shared"
import type { StartRealtimeServerOptions } from "./index.js"

const TEST_SECRET = "test-secret"
const ROOM_CODE = "ROOM123"

let startRealtimeServer: (options?: StartRealtimeServerOptions) => Promise<{ port: number | null }>
let stopRealtimeServer: () => Promise<void>
let getRealtimeServerPort: () => number

let persistRoomSnapshotMock: Mock<[RoomSnapshot], Promise<void>>
let recordRoomEventMock: Mock<
  [
    {
      roomCode: string
      eventType: string
      version?: number
      payload?: Record<string, unknown>
    },
  ],
  Promise<void>
>

const sockets: WebSocket[] = []

beforeAll(async () => {
  process.env.REALTIME_SERVER_AUTOSTART = "false"
  process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? "http://localhost"
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test-service-role"

  const mod = await import("./index.js")
  startRealtimeServer = mod.startRealtimeServer
  stopRealtimeServer = mod.stopRealtimeServer
  getRealtimeServerPort = mod.getRealtimeServerPort
})

beforeEach(async () => {
  persistRoomSnapshotMock = vi.fn(async (_snapshot: RoomSnapshot) => {})
  recordRoomEventMock = vi.fn(
    async (_event: {
      roomCode: string
      eventType: string
      version?: number
      payload?: Record<string, unknown>
    }) => {},
  )

  await startRealtimeServer({
    port: 0,
    sharedSecret: TEST_SECRET,
    metricsFlushIntervalMs: 0,
    snapshotFlushDelayMs: 5,
    persistence: {
      persistRoomSnapshot: persistRoomSnapshotMock,
      recordRoomEvent: recordRoomEventMock,
    },
  })
})

afterEach(async () => {
  for (const socket of sockets) {
    socket.removeAllListeners()
    if (socket.readyState === WebSocket.OPEN) {
      socket.close()
    }
  }
  sockets.length = 0
  vi.clearAllMocks()
  await stopRealtimeServer()
})

describe("realtime server integration", () => {
  it("broadcasts joins and ready updates between clients", async () => {
    const port = getRealtimeServerPort()
    const hostSnapshot = makeSnapshot({
      id: "snapshot-host",
      version: 1,
      players: [
        makePlayer({
          id: "player-1",
          name: "Host Player",
          isHost: true,
        }),
      ],
    })

    const hostClient = await connectClient({
      port,
      playerId: "player-1",
      snapshot: hostSnapshot,
    })
    const hostAck = await hostClient.ack
    assertHelloAck(hostAck)
    expect(hostAck.snapshot.players).toHaveLength(1)

    const secondSnapshot = makeSnapshot({
      id: "snapshot-join",
      version: 2,
      players: [
        ...hostSnapshot.players,
        makePlayer({
          id: "player-2",
          name: "Second Player",
        }),
      ],
    })

    const joinBroadcast = waitForMessage<Extract<ServerToClientEvent, { type: "player_joined" }>>(hostClient.socket, (msg): msg is Extract<ServerToClientEvent, { type: "player_joined" }> => {
      return msg.type === "player_joined" && msg.player.id === "player-2"
    })

    const secondClient = await connectClient({
      port,
      playerId: "player-2",
      snapshot: secondSnapshot,
    })
    const secondAck = await secondClient.ack
    assertHelloAck(secondAck)
    expect(secondAck.snapshot.players).toHaveLength(2)

    const joined = await joinBroadcast
    expect(joined.player.id).toBe("player-2")
    expect(joined.version).toBeGreaterThanOrEqual(secondSnapshot.version)

    const readyUpdatePromise = waitForMessage<Extract<ServerToClientEvent, { type: "ready_update" }>>(hostClient.socket, (msg): msg is Extract<ServerToClientEvent, { type: "ready_update" }> => {
      return msg.type === "ready_update" && msg.playerId === "player-2" && msg.isReady
    })

    secondClient.socket.send(
      JSON.stringify({
        type: "set_ready",
        roomCode: ROOM_CODE,
        playerId: "player-2",
        isReady: true,
      }),
    )

    const readyUpdate = await readyUpdatePromise
    expect(readyUpdate.type).toBe("ready_update")
    expect(readyUpdate.version).toBeGreaterThanOrEqual(joined.version)

    await waitForSchedulerFlush()

    expect(persistRoomSnapshotMock).toHaveBeenCalled()
    const readyEventCall = recordRoomEventMock.mock.calls.find((call) => call[0].eventType === "player_ready")
    expect(readyEventCall).toBeDefined()
    expect(readyEventCall?.[0]).toMatchObject({
      roomCode: ROOM_CODE,
      payload: { playerId: "player-2", isReady: true },
    })
  })

  it("advances phases and records events", async () => {
    const port = getRealtimeServerPort()
    const hostSnapshot = makeSnapshot({
      id: "snapshot-phase",
      version: 5,
      players: [
        makePlayer({
          id: "player-1",
          name: "Host Player",
          isHost: true,
        }),
      ],
    })

    const hostClient = await connectClient({
      port,
      playerId: "player-1",
      snapshot: hostSnapshot,
    })
    const hostAck = await hostClient.ack
    assertHelloAck(hostAck)
    expect(hostAck.snapshot.currentPhase).toBeNull()

    const phaseChangedPromise = waitForMessage<Extract<ServerToClientEvent, { type: "phase_changed" }>>(
      hostClient.socket,
      (msg): msg is Extract<ServerToClientEvent, { type: "phase_changed" }> => msg.type === "phase_changed",
    )

    hostClient.socket.send(
      JSON.stringify({
        type: "advance_phase",
        roomCode: ROOM_CODE,
        playerId: "player-1",
      }),
    )

    const phaseChanged = await phaseChangedPromise
    expect(phaseChanged.currentPhase).toBe("big_idea")
    expect(phaseChanged.version).toBeGreaterThan(hostAck.snapshot.version)

    await waitForSchedulerFlush()

    const phaseEventCall = recordRoomEventMock.mock.calls.find((call) => call[0].eventType === "phase_changed")
    expect(phaseEventCall).toBeDefined()
    expect(phaseEventCall?.[0]).toMatchObject({
      roomCode: ROOM_CODE,
      payload: { currentPhase: "big_idea" },
    })
    expect(persistRoomSnapshotMock).toHaveBeenCalled()
  })

  it("broadcasts host status changes immediately", async () => {
    const port = getRealtimeServerPort()
    const initialSnapshot = makeSnapshot({
      id: "snapshot-status",
      version: 7,
      players: [
        makePlayer({
          id: "player-1",
          name: "Host Player",
          isHost: true,
        }),
        makePlayer({
          id: "player-2",
          name: "Guest Player",
        }),
      ],
    })

    const hostClient = await connectClient({
      port,
      playerId: "player-1",
      snapshot: initialSnapshot,
    })
    const hostAck = await hostClient.ack
    assertHelloAck(hostAck)

    const guestClient = await connectClient({
      port,
      playerId: "player-2",
      snapshot: initialSnapshot,
    })
    await guestClient.ack

    const statusChangedPromise = waitForMessage<Extract<ServerToClientEvent, { type: "status_changed" }>>(
      guestClient.socket,
      (message): message is Extract<ServerToClientEvent, { type: "status_changed" }> =>
        message.type === "status_changed" && message.status === "briefing",
    )

    const phaseStartTime = new Date().toISOString()

    hostClient.socket.send(
      JSON.stringify({
        type: "set_status",
        roomCode: ROOM_CODE,
        playerId: "player-1",
        status: "briefing",
        currentPhase: null,
        phaseStartTime,
      }),
    )

    const statusChanged = await statusChangedPromise
    expect(statusChanged.status).toBe("briefing")
    expect(statusChanged.phaseStartTime).toBe(phaseStartTime)
    expect(statusChanged.version).toBeGreaterThan(hostAck.snapshot.version)

    await waitForSchedulerFlush()

    const statusEventCall = recordRoomEventMock.mock.calls.find((call) => call[0].eventType === "status_changed")
    expect(statusEventCall).toBeDefined()
    expect(statusEventCall?.[0]).toMatchObject({
      roomCode: ROOM_CODE,
      eventType: "status_changed",
      payload: {
        status: "briefing",
        currentPhase: null,
        phaseStartTime,
      },
    })
  })

  it("allows non-hosts to broadcast results status", async () => {
    const port = getRealtimeServerPort()
    const initialSnapshot = makeSnapshot({
      id: "snapshot-results",
      version: 12,
      players: [
        makePlayer({
          id: "player-1",
          name: "Host Player",
          isHost: true,
        }),
        makePlayer({
          id: "player-2",
          name: "Guest Player",
        }),
      ],
    })

    const hostClient = await connectClient({
      port,
      playerId: "player-1",
      snapshot: initialSnapshot,
    })
    await hostClient.ack

    const guestClient = await connectClient({
      port,
      playerId: "player-2",
      snapshot: initialSnapshot,
    })
    await guestClient.ack

    const statusChangedPromise = waitForMessage<Extract<ServerToClientEvent, { type: "status_changed" }>>(
      hostClient.socket,
      (message): message is Extract<ServerToClientEvent, { type: "status_changed" }> =>
        message.type === "status_changed" && message.status === "results",
    )

    const phaseStartTime = new Date().toISOString()

    guestClient.socket.send(
      JSON.stringify({
        type: "set_status",
        roomCode: ROOM_CODE,
        playerId: "player-2",
        status: "results",
        currentPhase: null,
        phaseStartTime,
      }),
    )

    const statusChanged = await statusChangedPromise
    expect(statusChanged.status).toBe("results")
    expect(statusChanged.phaseStartTime).toBe(phaseStartTime)
  })

  it("does not overwrite newer room state with stale snapshot", async () => {
    const port = getRealtimeServerPort()
    const initialSnapshot = makeSnapshot({
      id: "snapshot-initial",
      version: 1,
      players: [
        makePlayer({
          id: "player-1",
          name: "Host Player",
          isHost: true,
        }),
      ],
    })

    const hostClient = await connectClient({
      port,
      playerId: "player-1",
      snapshot: initialSnapshot,
    })
    await hostClient.ack

    const joinBroadcast = waitForMessage<Extract<ServerToClientEvent, { type: "player_joined" }>>(
      hostClient.socket,
      (message): message is Extract<ServerToClientEvent, { type: "player_joined" }> =>
        message.type === "player_joined" && message.player.id === "player-2",
    )

    const secondSnapshot = makeSnapshot({
      id: "snapshot-guest",
      version: 2,
      players: [
        ...initialSnapshot.players,
        makePlayer({
          id: "player-2",
          name: "Guest Player",
        }),
      ],
    })

    const guestClient = await connectClient({
      port,
      playerId: "player-2",
      snapshot: secondSnapshot,
    })
    await guestClient.ack
    await joinBroadcast

    hostClient.socket.close()
    await waitForSchedulerFlush()

    const staleSnapshot = makeSnapshot({
      id: "snapshot-stale",
      version: 1,
      players: [
        makePlayer({
          id: "player-1",
          name: "Host Player",
          isHost: true,
        }),
      ],
    })

    const reconnectedHost = await connectClient({
      port,
      playerId: "player-1",
      snapshot: staleSnapshot,
    })
    const ack = await reconnectedHost.ack
    assertHelloAck(ack)
    expect(ack.snapshot.players).toHaveLength(2)
    const playerIds = ack.snapshot.players.map((player) => player.id)
    expect(playerIds).toContain("player-2")
  })
})

async function connectClient(options: { port: number; playerId: string; snapshot?: RoomSnapshot }) {
  const socket = new WebSocket(`ws://127.0.0.1:${options.port}`)
  sockets.push(socket)

  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve())
    socket.once("error", (error) => reject(error))
  })

  const ackPromise = waitForMessage<Extract<ServerToClientEvent, { type: "hello_ack" }>>(
    socket,
    (msg): msg is Extract<ServerToClientEvent, { type: "hello_ack" }> => msg.type === "hello_ack",
  )

  const joinPayload: ClientJoinPayload = {
    type: "join_room",
    roomCode: ROOM_CODE,
    playerId: options.playerId,
    playerToken: signRealtimeToken(
      {
        roomCode: ROOM_CODE,
        playerId: options.playerId,
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      TEST_SECRET,
    ),
  }

  if (options.snapshot) {
    joinPayload.initialSnapshot = options.snapshot
  }

  socket.send(JSON.stringify(joinPayload))

  return { socket, ack: ackPromise }
}

type MessagePredicate<T extends ServerToClientEvent> =
  | ((msg: ServerToClientEvent) => msg is T)
  | ((msg: ServerToClientEvent) => boolean)

function waitForMessage<T extends ServerToClientEvent = ServerToClientEvent>(
  socket: WebSocket,
  predicate: MessagePredicate<T>,
  timeout = 2000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const handler = (raw: RawData) => {
      let message: ServerToClientEvent
      try {
        message = JSON.parse(raw.toString()) as ServerToClientEvent
      } catch {
        return
      }

      if (predicate(message)) {
        cleanup()
        resolve(message as T)
      }
    }

    const cleanup = () => {
      clearTimeout(timer)
      socket.off("message", handler)
    }

    const timer = setTimeout(() => {
      cleanup()
      reject(new Error("Timed out waiting for realtime message"))
    }, timeout)

    socket.on("message", handler)
  })
}

function assertHelloAck(message: ServerToClientEvent): asserts message is Extract<ServerToClientEvent, { type: "hello_ack" }> {
  if (message.type !== "hello_ack") {
    throw new Error(`Expected hello_ack message but received ${message.type}`)
  }
}

async function waitForSchedulerFlush() {
  await new Promise((resolve) => setTimeout(resolve, 20))
}

function makeSnapshot(overrides: Partial<RoomSnapshot>): RoomSnapshot {
  return {
    id: overrides.id ?? "snapshot-default",
    code: overrides.code ?? ROOM_CODE,
    status: overrides.status ?? "lobby",
    currentPhase: overrides.currentPhase ?? null,
    phaseStartTime: overrides.phaseStartTime ?? null,
    players: overrides.players ?? [],
    version: overrides.version ?? 1,
  }
}

function makePlayer(overrides: Partial<PlayerSummary> & { id: string }): PlayerSummary {
  return {
    id: overrides.id,
    name: overrides.name ?? `Player ${overrides.id}`,
    emoji: overrides.emoji ?? "🎤",
    isReady: overrides.isReady ?? false,
    isHost: overrides.isHost ?? false,
  }
}

interface ClientJoinPayload {
  type: "join_room"
  roomCode: string
  playerId: string
  playerToken: string
  initialSnapshot?: RoomSnapshot
}
