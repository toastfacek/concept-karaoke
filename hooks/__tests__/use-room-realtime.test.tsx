import { cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/realtime/token", () => ({
  fetchRealtimeToken: vi.fn(async () => ({
    token: "mock-token",
    expiresAt: Date.now() + 60_000,
  })),
}))

import type { RealtimeContextValue } from "@/components/realtime-provider"
import { fetchRealtimeToken } from "@/lib/realtime/token"
import { useRoomRealtime } from "../use-room-realtime"

const mockedFetchRealtimeToken = vi.mocked(fetchRealtimeToken)

function createMockRealtime(overrides: Partial<RealtimeContextValue> = {}): RealtimeContextValue {
  const addListener = vi.fn(() => vi.fn())

  return {
    client: {} as unknown as RealtimeContextValue["client"],
    status: "connected",
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    addListener,
    ...overrides,
  }
}

const BASE_SNAPSHOT = {
  id: "room-id",
  code: "ROOM01",
  status: "results",
  currentPhase: null,
  phaseStartTime: null,
  players: [],
  version: 1,
} as const

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("useRoomRealtime", () => {
  it("connects once initial snapshot is available and disconnects on disable", async () => {
    const realtime = createMockRealtime()
    const listenerCleanup = vi.fn()
    const eventHandler = vi.fn()
    realtime.addListener.mockReturnValue(listenerCleanup)

    function Harness({ enabled }: { enabled: boolean }) {
      useRoomRealtime({
        roomCode: BASE_SNAPSHOT.code,
        playerId: enabled ? "player-1" : null,
        enabled,
        getInitialSnapshot: () => BASE_SNAPSHOT,
        registerListeners: ({ addListener }) => {
          addListener("hello_ack", eventHandler as never)
          return listenerCleanup
        },
        realtime,
      })
      return null
    }

    const { rerender } = render(<Harness enabled />)

    await waitFor(() => {
      expect(mockedFetchRealtimeToken).toHaveBeenCalledTimes(1)
      expect(realtime.connect).toHaveBeenCalledTimes(1)
    })

    rerender(<Harness enabled={false} />)

    await waitFor(() => {
      expect(listenerCleanup).toHaveBeenCalledTimes(1)
      expect(realtime.disconnect).toHaveBeenCalledTimes(1)
    })
  })

  it("reconnects when re-enabled after a disconnect", async () => {
    const realtime = createMockRealtime()
    const listenerCleanup = vi.fn()
    const eventHandler = vi.fn()
    realtime.addListener.mockReturnValue(listenerCleanup)

    function Harness({ enabled }: { enabled: boolean }) {
      useRoomRealtime({
        roomCode: BASE_SNAPSHOT.code,
        playerId: enabled ? "player-2" : null,
        enabled,
        getInitialSnapshot: () => BASE_SNAPSHOT,
        registerListeners: ({ addListener }) => {
          addListener("hello_ack", eventHandler as never)
          return listenerCleanup
        },
        realtime,
      })
      return null
    }

    const { rerender } = render(<Harness enabled />)

    await waitFor(() => {
      expect(realtime.connect).toHaveBeenCalledTimes(1)
    })

    rerender(<Harness enabled={false} />)
    await waitFor(() => {
      expect(realtime.disconnect).toHaveBeenCalledTimes(1)
    })

    rerender(<Harness enabled />)
    await waitFor(() => {
      expect(realtime.connect).toHaveBeenCalledTimes(2)
      expect(mockedFetchRealtimeToken).toHaveBeenCalledTimes(2)
    })
  })
})
