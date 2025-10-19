# Realtime Protocol Draft

This document tracks the initial contract between Concept Karaoke clients and the realtime Node service. It will evolve as we build out the service in Phase 0–1.

## Overview

- **Transport**: WebSocket (one connection per browser tab).
- **Encoding**: JSON messages with a top-level `type` discriminator.
- **Versioning**: Include `protocolVersion` in the handshake to support future breaking changes.

```json
{
  "type": "hello",
  "protocolVersion": 1,
  "roomCode": "ABC123",
  "playerToken": "<signed token from Next API>"
}
```

The server responds with `hello_ack` indicating success and the current canonical room state snapshot.

## Message Envelope

Every non-handshake message follows this structure:

```json
{
  "type": "player_ready",
  "roomCode": "ABC123",
  "payload": {
    "playerId": "uuid",
    "isReady": true,
    "timestamp": 1739900000000
  }
}
```

- `type`: string enum listed below.
- `roomCode`: optional for events scoped to a room (omitted for connection-level events).
- `payload`: type-specific body.
- `timestamp`: server-issued ms epoch for server broadcasts; clients may include optimistic timestamps on outbound events.

## Client → Server Events (Draft)

| Event | Payload | Notes |
| ----- | ------- | ----- |
| `join_room` | `{ roomCode, playerToken }` | Token validated by Next API; server responds with `room_state`. |
| `leave_room` | `{ roomCode }` | Sent on manual leave; server also handles abrupt disconnect. |
| `set_ready` | `{ roomCode, playerId, isReady }` | Optimistic UI updates on client; server rebroadcasts authoritative state. |
| `advance_phase` | `{ roomCode, playerId }` | Server validates host/ready requirements. |
| `submit_canvas_delta` | `{ roomCode, adlobId, phase, delta }` | Deltas TBD; likely strokes, text changes, image insertions. |
| `submit_big_idea` | `{ roomCode, adlobId, text }` | For non-visual rounds. |
| `heartbeat` | `{ roomCode }` | Optional keepalive from client (server also sends pings). |

## Server → Client Events (Draft)

| Event | Payload | Notes |
| ----- | ------- | ----- |
| `room_state` | `{ snapshot, version }` | Full authoritative state when joining or reconciling. |
| `player_joined` | `{ player, version }` | Includes incremental version stamp. |
| `player_left` | `{ playerId, version }` | |
| `ready_update` | `{ playerId, isReady, version }` | |
| `phase_changed` | `{ currentPhase, phaseStartTime, version }` | |
| `canvas_delta` | `{ adlobId, phase, delta, version }` | |
| `big_idea_submitted` | `{ adlobId, text, authorId, version }` | |
| `error` | `{ code, message }` | For validation or auth failures. |

`version` is a monotonically increasing integer per room, allowing clients to discard out-of-order events.

## Shared Types

We plan to export a `packages/shared/src` module with:

- `RoomState` – mirrors current `game` object (players, adlobs, phase timers).
- `CanvasState`, `CanvasDelta` – derived from `lib/canvas.ts`; delta schema still under design.
- `RealtimeEvent` union – discriminated union of all message shapes.
- `RealtimeErrorCode` enum – canonical error list (`unauthorized`, `room_not_found`, etc.).

The realtime server and Next.js client will both import these generated types (via pnpm workspace or published package).

## Open Questions

1. **Canvas delta granularity** – Do we send full state per submission, or smaller incremental ops? (Phase 1 scope decision.)
2. **Token issuance** – Should the Next API mint JWTs or short-lived signed payloads? Need to evaluate Supabase auth integration.
3. **Version strategy** – Single `version` per room vs per resource (players, adlobs). Leaning single counter for simplicity.
4. **Backpressure** – Need rate limiting for spammy clients; design throttle strategy in Phase 1.

We will keep this document updated as we answer these questions and refine the protocol.
