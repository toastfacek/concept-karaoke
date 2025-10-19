# Realtime Server Runbook

This document captures operational guidance for deploying and maintaining the Concept Karaoke realtime service.

## Overview

- **Service**: `services/realtime-server`
- **Purpose**: Authoritative game loop for room state, player readiness, phase transitions, and canvas deltas.
- **Transport**: WebSocket (`ws`), JSON messages matching `@concept-karaoke/realtime-shared`.
- **Persistence**: Supabase Postgres (`room_snapshots`, `room_events`) via service role.
- **Metrics & Logs**: Structured JSON logs to stdout; counters emitted every 60s via `MetricsRecorder`.

## Deployment

### Environment Variables

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `PORT` | No (default `8080`) | HTTP/WebSocket listen port |
| `LOG_LEVEL` | No (default `info`) | `debug` \| `info` \| `warn` \| `error` |
| `METRICS_FLUSH_INTERVAL_MS` | No (default `60000`) | Interval for metrics flush; set to `0` to disable |
| `SUPABASE_URL` | **Yes** | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Supabase service role key (used for persistence) |
| `REALTIME_SHARED_SECRET` | **Yes** | HMAC secret for signed realtime tokens |

### Build & Run

```bash
pnpm install
pnpm build
pnpm start
```

For local development:

```bash
pnpm exec tsx watch src/index.ts
```

### Local Development Checklist
- Ensure `REALTIME_SHARED_SECRET`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` are present in your shell (`.env.local` is ignored by Git—copy values from 1Password).
- Install workspace dependencies from the monorepo root: `pnpm install`.
- Build shared types before starting the dev server: `pnpm --filter @concept-karaoke/realtime-shared build`.
- Run the realtime server in watch mode: `pnpm --filter concept-karaoke-realtime-server dev`.
- Tail structured logs in a split terminal; use `jq` or `pino-pretty` to highlight `message`, `roomCode`, and `playerId` fields.

### Cloud Deployment Checklist
- Ensure `.env` values above are configured in the hosting platform (Fly.io, Render, etc.).
- Expose port `8080` (or chosen `PORT`) with WebSocket support.
- Configure log drain/aggregation (e.g., DataDog, Loki) to ingest JSON logs.
- Optional: reduce `METRICS_FLUSH_INTERVAL_MS` (e.g., 10s) if fine-grained metrics are required.

## Runtime Components

### Room Registry
- Current implementation: in-memory map keyed by room code.
- Each room entry retains current snapshot and connected clients.
- Empty rooms persist in memory until process restart; future Redis support will allow shared state.

### Snapshot Scheduler
- Coalesces rapid state changes into a single async Supabase insert.
- Flushes on interval or shutdown.
- Logs errors via `logger.error`.

### Metrics
- Counters tracked: connection attempts, message totals, handler failures, heartbeat timeouts, snapshot/event persistence success/failure, etc.
- Flush output format: `{ level: "info", message: "metrics_flush", metrics: { ... } }`.

| Metric | Description |
| ------ | ----------- |
| `ws_connections_total` | Successful WebSocket handshakes |
| `ws_messages_total` | All inbound messages processed |
| `ws_message_parse_failures_total` | JSON parse errors on inbound payloads |
| `ws_message_handler_failures_total` | Exceptions thrown during handler execution |
| `join_room_attempts_total` / `_success_total` / `_failures_total` | Authentication and room attachment outcomes |
| `ready_update_attempts_total` / `_success_total` / `_failures_total` | Ready toggle handling |
| `phase_change_attempts_total` / `_success_total` / `_failures_total` | Phase advance workflow |
| `heartbeat_timeouts_total` | Clients forcibly disconnected after missing heartbeats |
| `snapshots_persisted_total` | Snapshot batches written by `SnapshotScheduler` |
| `event_persist_success_total` / `_failures_total` | Durable event write outcomes |

Set up dashboards with rate() views over these counters; alert when failures spike or success counters flatline for >5 minutes while rooms are active.

## Redis / Horizontal Scaling Path

Currently single-node. To scale horizontally:

1. **Registry abstraction**: Replace `createMemoryRoomRegistry` with a Redis-backed implementation (clustered by room code).
   - Each node handles a shard of room codes (consistent hashing).
   - Use Redis pub/sub for cross-node broadcasts.

2. **Snapshot Scheduler**: Consider centralized queue (e.g., Redis streams) to avoid duplicate writes.

3. **Token Validation**: Already stateless; shared secret works across instances.

4. **Sticky Sessions**: If using load balancer, configure stickiness to keep a room on the same node (or route via consistent hashing).

## Alerting & Monitoring

Suggested alerts (post-integration with logging/metrics backend):
- `heartbeat_timeouts_total` spike.
- `event_persist_failures_total` > threshold.
- `ws_message_parse_failures_total` > threshold.
- Process restart count, memory usage (external metrics).

## Recovery Procedures

### Process Crash / Restart
1. Process manager (systemd, PM2, Fly machines) restarts binary.
2. Snapshot scheduler flushed outstanding state during shutdown; clients reconnect and rehydrate via `/api/games/:code`.
3. Verify logs show `realtime_server_listening`.

### Supabase Outage
1. Events/snapshots queue will log persistence failures.
2. The server continues functioning (in-memory); persistence resumes once Supabase returns.
3. Monitor `event_persist_failures_total`.

### Token Issues
1. If clients receive `unauthorized` on join, ensure `REALTIME_SHARED_SECRET` matches between Next.js API and realtime server.
2. Check `/api/realtime/token` logs for errors.

## Maintenance Tasks

- **Rotate Secrets**: Update `SUPABASE_SERVICE_ROLE_KEY` and `REALTIME_SHARED_SECRET`; redeploy Next.js API and realtime server simultaneously.
- **Migrations**: Apply new Supabase migrations before deploying updated server clients.
- **Log Level Adjustments**: Set `LOG_LEVEL=debug` temporarily for troubleshooting, revert to `info` in production.

## Testing & QA
- **Automated integration tests**: `pnpm --filter concept-karaoke-realtime-server test` spins up the server in-memory, simulates multi-client flows, and validates join/ready/phase lifecycles. Run before every deploy.
- **Manual QA scripts**: See `docs/realtime-manual-qa.md` for host/guest happy paths, reconnect scenarios, and regression sweeps to complete when pushing to staging.
- **Smoke test** (post-deploy): Use the Next.js app to create a room, connect two browsers, confirm ready toggles broadcast, advance to the next phase, and validate structured logs + metrics reflect the interactions.

## Incident Response Tips
- **Auth errors**: Spikes in `auth_failures_total` or `join_room_failures_total` usually indicate a mismatched `REALTIME_SHARED_SECRET` between Next.js and the realtime service. Re-issue tokens and redeploy both services.
- **Snapshot backlog**: If `snapshots_persisted_total` stalls while rooms are active, bump logging to `debug` and monitor `snapshot_persist_failed` entries—Redis or Supabase connectivity is likely degraded.
- **Heartbeat storms**: Sudden increases in `heartbeat_timeouts_total` can precede mass disconnects. Check hosting CPU/memory, look for load balancer resets, and consider raising `HEARTBEAT_TIMEOUT_MS` temporarily.

## Open Follow-ups

- Implement Redis-backed `RoomRegistry` once horizontal scale is required.
- Integrate metrics sink (Prometheus, StatsD) if richer dashboards are needed.
- Automate structured log ingestion into central observability stack.
