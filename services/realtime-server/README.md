# Concept Karaoke Realtime Server

This workspace hosts the Node/TypeScript WebSocket service that will own the live game loop. During Phase 0 we keep the implementation minimal while establishing clean abstractions that make it easy to scale out later.

## Structure

- `src/index.ts` – executable entry point (currently a placeholder).
- `src/room-registry.ts` – storage-agnostic interface for managing room state and socket memberships.
- `src/memory-room-registry.ts` – in-memory implementation used for the single-node setup.
- `src/types.ts` – temporary server-side types; will be replaced once shared packages land.

## Scripts

All commands assume you run them from this directory:

- `pnpm install` – install dependencies locally (this package is not yet wired into the root workspace).
- `pnpm dev` – start the server with live reload via `tsx`.
- `pnpm build` – compile TypeScript to `dist/`.

> Until we promote this into a pnpm workspace, manage dependencies locally from this folder.

## Next Steps

1. Flesh out the WebSocket handshake and message routing in `src/index.ts`.
2. Replace the placeholder `RoomState` types with shared definitions imported from a common package.
3. Add persistence hooks (Postgres snapshots, analytics) once core loop migration reaches Phase 2.
4. Introduce Redis-backed `RoomRegistry` when horizontal scaling is needed.
