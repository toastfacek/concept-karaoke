import { logger } from "./logger.js"
import type { RoomSnapshot } from "@concept-karaoke/realtime-shared"

type PersistSnapshot = (snapshot: RoomSnapshot) => Promise<void>

interface PendingEntry {
  snapshot: RoomSnapshot
  timer: NodeJS.Timeout
}

const DEFAULT_FLUSH_DELAY_MS = 1000

export class SnapshotScheduler {
  private readonly persist: PersistSnapshot
  private readonly flushDelay: number
  private readonly pending = new Map<string, PendingEntry>()

  constructor(persist: PersistSnapshot, flushDelay = DEFAULT_FLUSH_DELAY_MS) {
    this.persist = persist
    this.flushDelay = flushDelay
  }

  schedule(snapshot: RoomSnapshot) {
    const existing = this.pending.get(snapshot.code)
    if (existing) {
      existing.snapshot = snapshot
      return
    }

    const timer = setTimeout(() => {
      this.pending.delete(snapshot.code)
      this.flush(snapshot).catch((error) => {
        logger.error("snapshot_persist_failed", { error: error instanceof Error ? error.message : "unknown" })
      })
    }, this.flushDelay)

    this.pending.set(snapshot.code, {
      snapshot,
      timer,
    })
  }

  async flush(snapshot: RoomSnapshot) {
    await this.persist(snapshot)
  }

  async flushAll() {
    const entries = Array.from(this.pending.values())
    this.pending.clear()

    for (const entry of entries) {
      clearTimeout(entry.timer)
      try {
        await this.persist(entry.snapshot)
      } catch (error) {
        logger.error("snapshot_flushall_failed", { error: error instanceof Error ? error.message : "unknown" })
      }
    }
  }

  async shutdown() {
    await this.flushAll()
  }
}
