'use client'

import type {
  ClientToServerEvent,
  RoomSnapshot,
  ServerToClientEvent,
} from "@concept-karaoke/realtime-shared"

export type RealtimeStatus = "idle" | "connecting" | "connected" | "disconnected" | "error"

type EventListener<T extends ServerToClientEvent["type"]> = (
  payload: Extract<ServerToClientEvent, { type: T }>,
) => void

interface ConnectOptions {
  roomCode: string
  playerId: string
  playerToken: string
  initialSnapshot?: RoomSnapshot
}

export class RealtimeClient {
  private socket: WebSocket | null = null
  private listeners = new Map<ServerToClientEvent["type"], Set<Function>>()
  private statusListeners = new Set<(status: RealtimeStatus) => void>()
  private status: RealtimeStatus = "idle"
  private connectOptions: ConnectOptions | null = null
  private readonly serverUrl: string
  private heartbeatTimer: number | null = null
  private outboundQueue: ClientToServerEvent[] = []
  private readonly maxQueueSize = 100

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl
  }

  get currentStatus(): RealtimeStatus {
    return this.status
  }

  onStatusChange(listener: (status: RealtimeStatus) => void) {
    this.statusListeners.add(listener)
    return () => {
      this.statusListeners.delete(listener)
    }
  }

  on<T extends ServerToClientEvent["type"]>(type: T, listener: EventListener<T>) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    const bucket = this.listeners.get(type)!
    bucket.add(listener)
    return () => {
      bucket.delete(listener)
      if (bucket.size === 0) {
        this.listeners.delete(type)
      }
    }
  }

  connect(options: ConnectOptions) {
    if (typeof window === "undefined") {
      return
    }

    this.connectOptions = options

    if (this.socket) {
      this.socket.close()
      this.socket = null
    }

    const wsUrl = this.buildWebSocketUrl(options.roomCode)
    const socket = new WebSocket(wsUrl)
    this.socket = socket
    this.updateStatus("connecting")

    socket.addEventListener("open", () => {
      this.updateStatus("connected")
      const joinEvent: ClientToServerEvent = {
        type: "join_room",
        roomCode: options.roomCode,
        playerId: options.playerId,
        playerToken: options.playerToken,
        initialSnapshot: options.initialSnapshot,
      }
      socket.send(JSON.stringify(joinEvent))
      this.flushQueue()
      this.startHeartbeat()
    })

    socket.addEventListener("message", (event) => {
      try {
        const parsed = JSON.parse(event.data) as ServerToClientEvent
        this.dispatch(parsed)
      } catch (error) {
        console.error("[realtime-client] Failed to parse message", error)
      }
    })

    socket.addEventListener("close", () => {
      this.stopHeartbeat()
      this.updateStatus("disconnected")
    })

    socket.addEventListener("error", (error) => {
      console.error("[realtime-client] socket error", error)
      this.updateStatus("error")
      this.stopHeartbeat()
    })
  }

  disconnect() {
    this.connectOptions = null
    this.stopHeartbeat()
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.outboundQueue = []
    this.updateStatus("disconnected")
  }

  send(event: ClientToServerEvent) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      if (this.outboundQueue.length > 0) {
        this.flushQueue()
      }
      this.socket.send(JSON.stringify(event))
      return
    }

    if (this.outboundQueue.length >= this.maxQueueSize) {
      this.outboundQueue.shift()
      console.warn("[realtime-client] outbound queue is full, dropping oldest event")
    }
    this.outboundQueue.push(event)
  }

  private flushQueue() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return
    }

    while (this.outboundQueue.length > 0) {
      const nextEvent = this.outboundQueue.shift()
      if (!nextEvent) {
        continue
      }

      try {
        this.socket.send(JSON.stringify(nextEvent))
      } catch (error) {
        console.error("[realtime-client] failed to send queued event", error)
        // Requeue the event at the front so we can retry later.
        this.outboundQueue.unshift(nextEvent)
        break
      }
    }
  }

  private buildWebSocketUrl(roomCode: string) {
    try {
      const url = new URL(this.serverUrl)
      url.searchParams.set("room", roomCode)
      return url.toString()
    } catch {
      // Fallback for relative paths, e.g., ws://localhost:8080
      if (this.serverUrl.includes("://")) {
        return `${this.serverUrl}?room=${encodeURIComponent(roomCode)}`
      }
      const protocol = window.location.protocol === "https:" ? "wss" : "ws"
      return `${protocol}://${window.location.host}${this.serverUrl}?room=${encodeURIComponent(roomCode)}`
    }
  }

  private updateStatus(status: RealtimeStatus) {
    this.status = status
    for (const listener of this.statusListeners) {
      listener(status)
    }
  }

  private dispatch(event: ServerToClientEvent) {
    const bucket = this.listeners.get(event.type)
    if (!bucket) return
    for (const listener of bucket) {
      ;(listener as (payload: ServerToClientEvent) => void)(event)
    }
  }

  private startHeartbeat() {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer)
    }
    if (!this.connectOptions) return
    this.heartbeatTimer = window.setInterval(() => {
      if (!this.connectOptions) return
      this.send({
        type: "heartbeat",
        roomCode: this.connectOptions.roomCode,
      })
    }, 15_000)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}

export function createRealtimeClient(): RealtimeClient {
  const baseUrl = process.env.NEXT_PUBLIC_REALTIME_URL ?? "ws://localhost:8080"
  return new RealtimeClient(baseUrl)
}
