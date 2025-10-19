import type { WebSocket } from "ws"

import type { RoomContext, RoomRegistry, RoomCode, ConnectedClient } from "./room-registry.js"
import type { RoomSnapshot } from "@concept-karaoke/realtime-shared"

interface MutableRoomContext extends RoomContext {
  clients: Set<ConnectedClient>
}

class MemoryRoomRegistry implements RoomRegistry {
  private rooms = new Map<RoomCode, MutableRoomContext>()

  getRoom(code: RoomCode): RoomContext | undefined {
    return this.rooms.get(code)
  }

  ensureRoom(code: RoomCode, initialState: RoomSnapshot): RoomContext {
    let room = this.rooms.get(code)
    if (!room) {
      room = { code, state: initialState, clients: new Set() }
      this.rooms.set(code, room)
    }
    return room
  }

  updateRoom(code: RoomCode, updater: (state: RoomSnapshot) => RoomSnapshot): RoomContext | undefined {
    const room = this.rooms.get(code)
    if (!room) return undefined
    room.state = updater(room.state)
    return room
  }

  deleteRoom(code: RoomCode): void {
    this.rooms.delete(code)
  }

  listRooms(): Iterable<RoomContext> {
    return this.rooms.values()
  }

  attachClient(code: RoomCode, client: ConnectedClient): void {
    const room = this.rooms.get(code)
    if (!room) {
      throw new Error(`Room ${code} not found`)
    }
    room.clients.add(client)
  }

  detachClient(code: RoomCode, socket: WebSocket): void {
    const room = this.rooms.get(code)
    if (!room) {
      return
    }
    for (const client of room.clients) {
      if (client.socket === socket) {
        room.clients.delete(client)
        break
      }
    }
    if (room.clients.size === 0) {
      // Optionally auto-clean empty rooms; keep for now to avoid stale memory.
      // this.rooms.delete(code)
    }
  }
}

export function createMemoryRoomRegistry(): RoomRegistry {
  return new MemoryRoomRegistry()
}
