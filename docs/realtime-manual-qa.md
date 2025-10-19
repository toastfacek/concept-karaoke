# Realtime Manual QA Scripts

Structured manual tests for the Concept Karaoke realtime server. Run these scripts before major releases or whenever the WebSocket stack changes.

## Prerequisites
- Next.js app running locally with the latest build (`pnpm dev`) and pointing at the same Supabase project as the realtime server.
- Realtime server running locally (`pnpm --filter concept-karaoke-realtime-server dev`) with the logs visible.
- Two browser profiles (or profile + incognito) for host/guest flows.
- The latest integration tests passing (`pnpm --filter concept-karaoke-realtime-server test`).

## Happy Path: Host + Guest Ready Loop
1. Create a new room via the landing page (Profile A). Capture the join code.
2. Join as a guest from Profile B using the code. Confirm both players appear in the lobby.
3. Toggle ready states on each profile twice. Expect the other client to reflect the change instantly and the realtime server log to emit `ready_update_success`.
4. Start the game from the host profile. Verify both clients navigate to the brief screen and `phase_changed` fires in the logs.
5. Toggle host readiness to advance again; confirm the creation phase starts and timers kick in.

## Token Cache & Rejoin
1. Refresh Profile B during the creation phase. The client should reuse the cached realtime token, reconnect automatically, and receive the latest snapshot without hitting `/api/realtime/token` repeatedly.
2. Validate that `join_room_success` appears once in the realtime logs and that Profile A receives a `player_joined` broadcast on reconnect.

## Unauthorized Token Handling
1. With the dev tools network tab open on Profile B, capture a realtime join payload and modify the token in-flight (e.g., change the last character) before it reaches the server.
2. Confirm the client receives an `unauthorized` error, no player is added to the room state, and the log shows `token_verification_failed` + incremented `auth_failures_total`.

## Heartbeat & Disconnect Recovery
1. With both players in the lobby, disconnect Profile B’s WebSocket using the dev tools network tab (Disable cache + “Block request URL”).
2. Wait ~45 seconds. Ensure Profile A sees a `player_left` event, the server logs `heartbeat_timeout`, and the player’s ready state resets to `false`.

## Snapshot Persistence Smoke
1. Run through a full host/guest session (brief → creation → phase advance).
2. Inspect Supabase tables `room_snapshots` and `room_events` to confirm recent rows exist with the expected `room_code` and `version`.
3. If testing against a staging environment, verify metrics flush lines appear within 60 seconds and include `snapshots_persisted_total` and `event_persist_success_total`.

## Exit Criteria
- All scenarios above pass without manual intervention.
- No unexpected errors in realtime server logs.
- Metrics counters increment as described in `docs/realtime-runbook.md`.
