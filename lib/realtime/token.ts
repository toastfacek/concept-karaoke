export interface RealtimeToken {
  token: string
  expiresAt: number
}

export async function fetchRealtimeToken(roomCode: string, playerId: string): Promise<RealtimeToken> {
  const response = await fetch("/api/realtime/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomCode, playerId }),
  })

  const payload = await response.json().catch(() => null)

  if (
    !response.ok ||
    !payload?.success ||
    typeof payload.token !== "string" ||
    typeof payload.expiresAt !== "number"
  ) {
    const errorMessage = payload?.error ?? "Unable to issue realtime token"
    throw new Error(errorMessage)
  }

  return {
    token: payload.token,
    expiresAt: payload.expiresAt,
  }
}
