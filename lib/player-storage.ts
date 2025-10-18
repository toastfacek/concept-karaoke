const STORAGE_PREFIX = "concept-karaoke:player:"

export interface StoredPlayer {
  id: string
  name: string
  emoji: string
  isHost: boolean
}

function getStorageKey(roomCode: string) {
  return `${STORAGE_PREFIX}${roomCode.toUpperCase()}`
}

export function savePlayer(roomCode: string, player: StoredPlayer) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(getStorageKey(roomCode), JSON.stringify(player))
  } catch {
    // Ignore write failures (private browsing, quota exceeded, etc.)
  }
}

export function loadPlayer(roomCode: string): StoredPlayer | null {
  if (typeof window === "undefined") return null

  try {
    const value = window.localStorage.getItem(getStorageKey(roomCode))
    return value ? (JSON.parse(value) as StoredPlayer) : null
  } catch {
    return null
  }
}

export function clearPlayer(roomCode: string) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.removeItem(getStorageKey(roomCode))
  } catch {
    // Ignore removal failures
  }
}
