import { useCallback, useEffect, useRef, useState } from "react"
import type { RoomSnapshot, ServerToClientEvent } from "@concept-karaoke/realtime-shared"

import { useRealtime, type RealtimeContextValue } from "@/components/realtime-provider"
import { fetchRealtimeToken, type RealtimeToken } from "@/lib/realtime/token"

const TOKEN_REFRESH_BUFFER_MS = 5_000
const INITIAL_RECONNECT_DELAY_MS = 500
const MAX_RECONNECT_DELAY_MS = 30_000

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
  const { connect, disconnect, addListener, status } = context

  const tokenRef = useRef<RealtimeToken | null>(null)
  const connectionKeyRef = useRef<string | null>(null)
  const listenerCleanupRef = useRef<ListenerCleanup[]>([])
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<number | null>(null)
  const isDisposedRef = useRef(false)
  const [activeConnectionKey, setActiveConnectionKey] = useState<string | null>(null)

  const getInitialSnapshotRef = useRef(getInitialSnapshot)
  useEffect(() => {
    getInitialSnapshotRef.current = getInitialSnapshot
  }, [getInitialSnapshot])

  const addListenerRef = useRef(addListener)
  useEffect(() => {
    addListenerRef.current = addListener
  }, [addListener])

  const clearReconnectTimer = useCallback(() => {
    if (typeof window === "undefined") {
      reconnectTimerRef.current = null
      return
    }
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  const cleanupListeners = useCallback(() => {
    listenerCleanupRef.current.forEach((cleanup) => {
      try {
        cleanup()
      } catch (error) {
        console.error("useRoomRealtime: listener cleanup failed", error)
      }
    })
    listenerCleanupRef.current = []
  }, [])

  const establishConnection = useCallback(
    async ({ forceTokenRefresh = false }: { forceTokenRefresh?: boolean } = {}) => {
      if (!enabled || !playerId || isDisposedRef.current) {
        return false
      }

      const connectionKey = `${roomCode}:${playerId}`
      const initialSnapshot = getInitialSnapshotRef.current?.() ?? null
      if (!initialSnapshot) {
        return false
      }

      try {
        let token = tokenRef.current
        if (
          forceTokenRefresh ||
          !token ||
          token.expiresAt <= Date.now() + TOKEN_REFRESH_BUFFER_MS
        ) {
          token = await fetchRealtimeToken(roomCode, playerId)
          if (isDisposedRef.current) {
            return false
          }
          tokenRef.current = token
        }

        connect({
          roomCode,
          playerId,
          playerToken: token.token,
          initialSnapshot,
        })
        connectionKeyRef.current = connectionKey
        setActiveConnectionKey(connectionKey)
        reconnectAttemptRef.current = 0
        onConnect?.()
        return true
      } catch (error) {
        console.error("useRoomRealtime: failed to initialize realtime connection", error)
        return false
      }
    },
    [connect, enabled, onConnect, playerId, roomCode],
  )

  useEffect(() => {
    isDisposedRef.current = false
    if (!enabled || !playerId) {
      return () => {
        isDisposedRef.current = true
      }
    }

    const connectionKey = `${roomCode}:${playerId}`

    if (connectionKeyRef.current !== connectionKey) {
      void establishConnection()
    }

    return () => {
      isDisposedRef.current = true
      clearReconnectTimer()
      cleanupListeners()
      if (connectionKeyRef.current === connectionKey) {
        connectionKeyRef.current = null
        setActiveConnectionKey(null)
      }
      disconnect()
      onDisconnect?.()
    }
  }, [
    cleanupListeners,
    clearReconnectTimer,
    disconnect,
    establishConnection,
    enabled,
    onDisconnect,
    playerId,
    roomCode,
  ])

  useEffect(() => {
    if (!enabled || !playerId) {
      reconnectAttemptRef.current = 0
      clearReconnectTimer()
      return
    }

    const connectionKey = `${roomCode}:${playerId}`

    if (status === "connected") {
      reconnectAttemptRef.current = 0
      clearReconnectTimer()
      return
    }

    const shouldRetry = status === "disconnected" || status === "error"
    if (!shouldRetry) {
      clearReconnectTimer()
      return
    }

    if (connectionKeyRef.current !== connectionKey) {
      return
    }

    if (reconnectTimerRef.current !== null) {
      return
    }

    const attempt = reconnectAttemptRef.current + 1
    reconnectAttemptRef.current = attempt

    const delay =
      attempt === 1
        ? INITIAL_RECONNECT_DELAY_MS
        : Math.min(MAX_RECONNECT_DELAY_MS, INITIAL_RECONNECT_DELAY_MS * 2 ** (attempt - 1))

    if (typeof window === "undefined") {
      return
    }

    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null
      if (isDisposedRef.current) {
        return
      }
      if (!enabled || !playerId) {
        return
      }
      if (connectionKeyRef.current !== connectionKey) {
        return
      }

      connectionKeyRef.current = null
      setActiveConnectionKey(null)
      void establishConnection({ forceTokenRefresh: true })
    }, delay)
  }, [
    clearReconnectTimer,
    establishConnection,
    enabled,
    playerId,
    roomCode,
    status,
  ])

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

    const expectedConnectionKey = `${roomCode}:${playerId}`
    if (activeConnectionKey !== expectedConnectionKey) {
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
  }, [activeConnectionKey, enabled, playerId, registerListeners, roomCode])

  const expectedConnectionKey = playerId ? `${roomCode}:${playerId}` : null

  return {
    isConnected: activeConnectionKey === expectedConnectionKey,
  }
}
