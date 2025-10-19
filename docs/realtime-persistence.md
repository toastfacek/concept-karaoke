# Realtime Persistence Notes

Phase 2 introduces snapshot persistence so the realtime server can recover state after restarts and feed historical analytics.

## Snapshot Scheduler (server)

- `services/realtime-server/src/snapshot-scheduler.ts` coalesces rapid-fire room updates into a single async flush (current delay: 1s).
- `persistSnapshot` is currently a stub that logs the payload; it will be replaced with a Supabase/Postgres insert (`room_snapshots`, `room_events` tables).
- Snapshots fire on:
  - Player join/leave (`handleJoinRoom`, `handleDisconnect`)
  - Ready toggles (`handleSetReady`)
  - Phase changes (`handleAdvancePhase`)
  - Additional hooks (canvas deltas, etc.) will be wired when those events migrate to the socket.

## Database Model (planned)

| Table | Purpose |
| ----- | ------- |
| `room_snapshots` | Stores compressed JSON of the entire room state (`snapshot`, `version`, `captured_at`). |
| `room_events` | Append-only log of significant events (join, leave, ready toggle, phase change) for analytics and replay. |

Snapshots should be idempotent per `(room_code, version)` so the server can safely retry on failure.

## Client Rehydration

- Pages call the existing REST `/api/games/:code` endpoint when the socket disconnects or reconnects to resync authoritative state.
- On reconnect the realtime handshake (`hello_ack`) also delivers the latest snapshot, which we merge with local state.

## Heartbeats & Timeouts

- The server sends `heartbeat` events every 15s and expects a client `heartbeat` message in return; idle sockets terminate after 45s.
- The `RealtimeClient` now emits `heartbeat` messages and surfaces connection status so pages can trigger REST fallbacks.

## TODO

- Wire `persistSnapshot` to Supabase service credentials.
- Add a background worker to flush accumulated events when the server shuts down.
- Extend snapshots to include AdLob/canvas data once the schema is ported to the realtime server.
