import { useEffect, useRef } from "react"
import type { RoomSnapshot, ServerToClientEvent } from "@concept-karaoke/realtime-shared"

import { useRealtime, type RealtimeContextValue } from "@/components/realtime-provider"
import { fetchRealtimeToken, type RealtimeToken } from "@/lib/realtime/token"

const TOKEN_REFRESH_BUFFER_MS = 5_000

type ListenerCleanup = () => void

type AddListener = <T extends ServerToClientEvent["type"]>(
  type: T,
  listener: (payload: Extract<ServerToClientEvent, { type: T }>) => void,
) => () => void

export interface RoomRealtimeListenerHelpers {
  addListener: AddListener
}

export type RoomRealtimeListenerRegistrar = (
  helpers: RoomRealtimeListenerHelpers,
) => ListenerCleanup | ListenerCleanup[] | void

interface UseRoomRealtimeOptions {
  roomCode: string
  playerId?: string | null
  enabled?: boolean
  getInitialSnapshot: () => RoomSnapshot | null
  registerListeners?: RoomRealtimeListenerRegistrar
  onConnect?: () => void
  onDisconnect?: () => void
  realtime?: RealtimeContextValue
}

export function useRoomRealtime({
  roomCode,
  playerId = null,
  enabled = true,
  getInitialSnapshot,
  registerListeners,
  onConnect,
  onDisconnect,
  realtime,
}: UseRoomRealtimeOptions) {
  const fallbackRealtime = useRealtime()
  const context = realtime ?? fallbackRealtime
  const { connect, disconnect, addListener } = context

  const tokenRef = useRef<RealtimeToken | null>(null)
  const connectionKeyRef = useRef<string | null>(null)
  const listenerCleanupRef = useRef<ListenerCleanup[]>([])

  const getInitialSnapshotRef = useRef(getInitialSnapshot)
  useEffect(() => {
    getInitialSnapshotRef.current = getInitialSnapshot
  }, [getInitialSnapshot])

  const addListenerRef = useRef(addListener)
  useEffect(() => {
    addListenerRef.current = addListener
  }, [addListener])

  useEffect(() => {
    if (!enabled || !playerId) {
      return
    }

    const connectionKey = `${roomCode}:${playerId}`
    if (connectionKeyRef.current === connectionKey) {
      return
    }

    let cancelled = false
    let didConnect = false

    const establishConnection = async () => {
      const initialSnapshot = getInitialSnapshotRef.current?.() ?? null
      if (!initialSnapshot) {
        return
      }

      try {
        let token = tokenRef.current
        if (!token || token.expiresAt <= Date.now() + TOKEN_REFRESH_BUFFER_MS) {
          token = await fetchRealtimeToken(roomCode, playerId)
          if (cancelled) return
          tokenRef.current = token
        }

        connect({
          roomCode,
          playerId,
          playerToken: token.token,
          initialSnapshot,
        })
        connectionKeyRef.current = connectionKey
        didConnect = true
        onConnect?.()
      } catch (error) {
        console.error("useRoomRealtime: failed to initialize realtime connection", error)
      }
    }

    void establishConnection()

    return () => {
      cancelled = true
      if (!didConnect) {
        return
      }

      listenerCleanupRef.current.forEach((cleanup) => {
        try {
          cleanup()
        } catch (error) {
          console.error("useRoomRealtime: listener cleanup failed", error)
        }
      })
      listenerCleanupRef.current = []

      disconnect()
      onDisconnect?.()

      if (connectionKeyRef.current === connectionKey) {
        connectionKeyRef.current = null
      }
    }
  }, [enabled, playerId, roomCode, connect, disconnect, onConnect, onDisconnect])

  useEffect(() => {
    listenerCleanupRef.current.forEach((cleanup) => {
      try {
        cleanup()
      } catch (error) {
        console.error("useRoomRealtime: listener cleanup failed", error)
      }
    })
    listenerCleanupRef.current = []

    if (!enabled || !playerId || !registerListeners) {
      return
    }

    const activeConnectionKey = `${roomCode}:${playerId}`
    if (connectionKeyRef.current !== activeConnectionKey) {
      return
    }

    const result = registerListeners({
      addListener: (type, listener) => addListenerRef.current(type, listener),
    })

    if (Array.isArray(result)) {
      listenerCleanupRef.current = result.filter(Boolean)
    } else if (typeof result === "function") {
      listenerCleanupRef.current = [result]
    }

    return () => {
      listenerCleanupRef.current.forEach((cleanup) => {
        try {
          cleanup()
        } catch (error) {
          console.error("useRoomRealtime: listener cleanup failed", error)
        }
      })
      listenerCleanupRef.current = []
    }
  }, [enabled, playerId, roomCode, registerListeners])

  return {
    isConnected: connectionKeyRef.current === (playerId ? `${roomCode}:${playerId}` : null),
  }
}
