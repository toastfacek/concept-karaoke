'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"

import type { ClientToServerEvent, RoomSnapshot, ServerToClientEvent } from "@concept-karaoke/realtime-shared"

import { createRealtimeClient, type RealtimeClient, type RealtimeStatus } from "@/lib/realtime-client"

type Status = RealtimeStatus

export interface RealtimeContextValue {
  client: RealtimeClient
  status: Status
  connect: (options: {
    roomCode: string
    playerId: string
    playerToken: string
    initialSnapshot?: RoomSnapshot
  }) => void
  disconnect: () => void
  send: (event: ClientToServerEvent) => void
  addListener<T extends ServerToClientEvent["type"]>(
    type: T,
    listener: (payload: Extract<ServerToClientEvent, { type: T }>) => void,
  ): () => void
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<RealtimeClient | null>(null)
  if (!clientRef.current) {
    clientRef.current = createRealtimeClient()
  }
  const client = clientRef.current!
  const [status, setStatus] = useState(client.currentStatus)

  useEffect(() => {
    const unsubscribe = client.onStatusChange((nextStatus) => {
      setStatus(nextStatus)
    })
    return unsubscribe
  }, [client])

  const connect = useCallback<RealtimeContextValue["connect"]>(
    (options) => {
      client.connect(options)
    },
    [client],
  )

  const disconnect = useCallback<RealtimeContextValue["disconnect"]>(() => {
    client.disconnect()
  }, [client])

  const send = useCallback<RealtimeContextValue["send"]>(
    (event) => {
      client.send(event)
    },
    [client],
  )

  const addListener = useCallback<RealtimeContextValue["addListener"]>(
    (type, listener) => client.on(type, listener),
    [client],
  )

  const value = useMemo<RealtimeContextValue>(
    () => ({
      client,
      status,
      connect,
      disconnect,
      send,
      addListener,
    }),
    [client, status, connect, disconnect, send, addListener],
  )

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtime() {
  const context = useContext(RealtimeContext)
  if (!context) {
    throw new Error("useRealtime must be used within a RealtimeProvider")
  }
  return context
}
