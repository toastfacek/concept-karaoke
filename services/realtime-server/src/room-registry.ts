import type { WebSocket } from "ws"

import type { RoomSnapshot } from "@concept-karaoke/realtime-shared"

export type RoomCode = string

export interface ConnectedClient {
  socket: WebSocket
  playerId: string
}

export interface RoomContext {
  code: RoomCode
  state: RoomSnapshot
  clients: Set<ConnectedClient>
}

export interface RoomRegistry {
  getRoom(code: RoomCode): RoomContext | undefined
  ensureRoom(code: RoomCode, initialState: RoomSnapshot): RoomContext
  updateRoom(code: RoomCode, updater: (state: RoomSnapshot) => RoomSnapshot): RoomContext | undefined
  deleteRoom(code: RoomCode): void
  listRooms(): Iterable<RoomContext>
  attachClient(code: RoomCode, client: ConnectedClient): void
  detachClient(code: RoomCode, socket: WebSocket): void
}
