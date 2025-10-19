# Realtime Client Integration Plan

This note outlines how the Next.js app will connect to the realtime WebSocket service introduced in Phase 0.

## Provider & Hook

- Add `lib/realtime-client.ts` that exports a `RealtimeClient` class responsible for:
  - Opening/closing a single browser WebSocket connection.
  - Queuing outbound messages until the socket is ready.
  - Dispatching inbound events to registered listeners (simple pub/sub).
  - Emitting heartbeats and reconnecting with exponential backoff.
- Expose a React context (`RealtimeProvider`) and hook (`useRealtime`) to share the client across pages.
  - Provider is instantiated in `app/layout.tsx` (client-side) and re-used on route transitions.

## Handshake Flow

1. Client fetches a signed `playerToken` from a Next.js API route (re-using existing Supabase session data).
2. `RealtimeClient` opens `ws(s)://<service-host>?roomCode=ABC123` and sends `hello`.
3. On success, server responds with `room_state` and optional `version`.
4. Reconnection replays queued messages and requests a fresh snapshot.

## Event Handling

- Existing pages (lobby, create, brief, pitch) move their Supabase polling logic into event handlers:
  - Subscribe to `room_state`, `player_joined`, `ready_update`, etc.
  - Apply state updates via `setGame` reducers with version guards.
- Mutating actions (`handleToggleReady`, canvas submissions) call `realtime.send({ type: '...' })` and optimistically update local UI. On error events, revert the changes.

## REST Fallback

- On connection loss > N seconds, provider exposes `status = 'offline'` so pages can show a banner.
- Pages call existing REST endpoints (`/api/games/:code`) to refresh snapshots while offline.
- When socket reconnects, a `room_state` snapshot merges with optimistic local state.

## Next Steps

- Implement `RealtimeClient` skeleton with connection state tracking.
- Refactor `app/create/[roomId]/page.tsx` to consume the new context behind a feature flag.
- Gradually replace Supabase realtime subscriptions with socket-driven updates once server endpoints are stable.
