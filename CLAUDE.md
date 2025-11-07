# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Concept Karaoke** is a multiplayer web game where players collaboratively create ad campaigns and pitch them improvisationally in an "exquisite corpse" style. Players work on different parts of a campaign (Big Idea, Visual, Headline, Pitch) without seeing the complete picture until presentation time.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **UI**: Shadcn UI with Radix UI primitives, Tailwind CSS 4
- **Database**: Supabase (PostgreSQL + Storage)
- **Realtime**: Custom WebSocket server (Node.js)
- **AI**: OpenAI for brief generation
- **Package Manager**: pnpm with monorepo workspace
- **Hosting**: Vercel (frontend) + Railway (realtime server)

## Monorepo Structure

This is a pnpm workspace monorepo with three packages:

1. **`.` (root)** - Next.js web application
2. **`packages/realtime-shared`** - Shared TypeScript types for realtime communication
3. **`services/realtime-server`** - WebSocket server for game state and realtime coordination

## Development Commands

```bash
# Install dependencies
pnpm install

# Run Next.js dev server
pnpm dev

# Build Next.js app
pnpm build

# Type checking
pnpm exec tsc --noEmit

# Linting
pnpm lint

# Realtime server (from services/realtime-server)
cd services/realtime-server
pnpm dev    # Development with live reload
pnpm build  # Compile TypeScript
```

## Core Architecture

### Game State Machine

The game flow is strictly sequenced through a state machine defined in [lib/game-state-machine.ts](lib/game-state-machine.ts):

**Game Statuses**: `lobby → briefing → creating → presenting → voting → results`

**Creation Phases** (during "creating" status): `big_idea → visual → headline → pitch`

Key functions:
- `canTransitionStatus()` - Validates state transitions
- `getNextCreationPhase()` - Advances through creation phases
- `advanceCreationPhase()` - Transitions to next phase or "presenting" status

### Realtime Architecture

The app uses a **single source of truth architecture** with hybrid realtime delivery:

**Architecture Pattern (API → Database → WebSocket)**:
1. Client sends HTTP request to API route
2. API route updates database (Supabase)
3. API route broadcasts event to WebSocket server via HTTP
4. WebSocket server broadcasts to all connected clients in room
5. Clients receive realtime updates via WebSocket

**Key Components**:
- **API Routes** - Single source of truth for mutations
- **WebSocket Server** - Broadcasts state changes to connected clients
- **Broadcast Endpoint** - [services/realtime-server/src/index.ts:688-740](services/realtime-server/src/index.ts#L688-L740) receives HTTP POST from API routes
- **Broadcast Helper** - [lib/realtime-broadcast.ts](lib/realtime-broadcast.ts) called by API routes after DB writes
- **Custom Realtime Client** - [lib/realtime-client.ts](lib/realtime-client.ts) connects to WebSocket server
- **Shared Types** - Event definitions in `packages/realtime-shared`

**Security**:
- WebSocket handlers verify player identity via connection metadata
- `set_ready` handler checks `playerId` matches authenticated socket
- `advance_phase` handler verifies player is host
- Server state is authoritative - client snapshots only for version detection

**Channel naming**:
- `room:{roomId}` for game-wide events
- `adlob:{adlobId}` for per-campaign events

### Data Model

Core types in [lib/types.ts](lib/types.ts):

- **GameRoom** - Game instance with status, phase timing, settings
- **Player** - User in a game with name, emoji, ready state
- **CampaignBrief** - AI-generated product brief (5 fields)
- **AdLob** - A campaign with 4 phases: `bigIdea`, `visual`, `headline`, `pitch`

Database table constants in [lib/db.ts](lib/db.ts): `game_rooms`, `players`, `campaign_briefs`, `adlobs`, `votes`

### API Route Structure

All API routes follow this pattern:
- Zod schema validation for request payloads
- Supabase admin client for database operations
- Snake case in database, camel case in API responses
- Consistent error handling with `{ success: false, error: "message" }`
- **WebSocket broadcast after DB write** (for coordination events like ready state, phase changes)

Example: [app/api/games/create/route.ts](app/api/games/create/route.ts)

**Realtime Broadcast Pattern** (coordination routes):
```typescript
// 1. Update database
const { data: player } = await supabase
  .from(TABLES.players)
  .update({ is_ready: isReady })
  .eq("id", playerId)
  .single()

// 2. Broadcast to WebSocket clients
await broadcastToRoom(roomCode, {
  type: "ready_update",
  roomCode,
  playerId,
  isReady,
  version: 0, // WS server manages version
})

// 3. Return response
return NextResponse.json({ success: true, player })
```

**Routes with WebSocket broadcast**:

*Game Flow & Coordination:*
- [app/api/games/join/route.ts](app/api/games/join/route.ts) - Player joins (`player_joined`)
- [app/api/games/start/route.ts](app/api/games/start/route.ts) - Game starts (`status_changed`)
- [app/api/games/[id]/players/[playerId]/route.ts](app/api/games/[id]/players/[playerId]/route.ts) - Ready state changes (`ready_update`)
- [app/api/games/[id]/phase/route.ts](app/api/games/[id]/phase/route.ts) - Phase advancement (`phase_changed`)
- [app/api/games/[id]/present/route.ts](app/api/games/[id]/present/route.ts) - Presentation flow (`status_changed`)
- [app/api/games/[id]/route.ts](app/api/games/[id]/route.ts) - Status transitions (`status_changed`)
- [app/api/votes/route.ts](app/api/votes/route.ts) - Vote submission & results (`status_changed`)

*Settings & Configuration:*
- [app/api/games/[id]/settings/route.ts](app/api/games/[id]/settings/route.ts) - Game settings (`settings_changed`)
- [app/api/briefs/[id]/route.ts](app/api/briefs/[id]/route.ts) - Brief updates (`brief_updated`)

*Content Creation:*
- [app/api/adlobs/[id]/big-idea/route.ts](app/api/adlobs/[id]/big-idea/route.ts) - Big idea submission (`content_submitted`)
- [app/api/adlobs/[id]/visual/route.ts](app/api/adlobs/[id]/visual/route.ts) - Visual submission (`content_submitted`)
- [app/api/adlobs/[id]/headline/route.ts](app/api/adlobs/[id]/headline/route.ts) - Headline submission (`content_submitted`)
- [app/api/adlobs/[id]/pitch/route.ts](app/api/adlobs/[id]/pitch/route.ts) - Pitch submission (`content_submitted`)

**Overwrite Protection Pattern** (adlob phase routes):
```typescript
// 1. Check for existing content from different creator
const { data: adlob } = await supabase
  .from(TABLES.adLobs)
  .select("id, room_id, phase_created_by")
  .eq("id", adlobId)
  .maybeSingle()

// 2. Prevent overwrites (409 conflict)
if (adlob.phase_created_by && adlob.phase_created_by !== createdBy) {
  return NextResponse.json(
    { success: false, error: "Content already created by another player" },
    { status: 409 }
  )
}

// 3. Update content
await supabase.from(TABLES.adLobs).update({ ... }).eq("id", adlobId)

// 4. Increment version and broadcast
const { data: room } = await supabase
  .from(TABLES.gameRooms)
  .select("version, code")
  .eq("id", adlob.room_id)
  .single()

await supabase
  .from(TABLES.gameRooms)
  .update({ version: (room?.version ?? 0) + 1 })
  .eq("id", adlob.room_id)

// 5. Broadcast to WebSocket clients
if (room) {
  await broadcastToRoom(room.code, {
    type: "content_submitted",
    roomCode: room.code,
    adlobId: adlobId,
    phase: "big_idea", // or "visual", "headline", "pitch"
    playerId: createdBy,
    version: 0,
  })
}
```

### Client Management

Player sessions are managed via:
- **Server**: [lib/supabase/server.ts](lib/supabase/server.ts) - For Server Components and API routes
- **Browser**: [lib/supabase/browser.ts](lib/supabase/browser.ts) - For Client Components
- **Admin**: [lib/supabase/admin.ts](lib/supabase/admin.ts) - For privileged operations (service role key)

Player identity is stored in browser localStorage via [lib/player-storage.ts](lib/player-storage.ts).

### Game Flow

Detailed flow documented in [SCREEN_FLOW.md](SCREEN_FLOW.md). Key screens:

1. **Home** (`/`) - Create or join game
2. **Join** (`/join`) - Enter code, name, emoji
3. **Lobby** (`/lobby/[roomId]`) - Wait for 3-8 players
4. **Brief** (`/brief/[roomId]`) - Generate/edit campaign brief
5. **Create** (`/create/[roomId]`) - 4 rounds of 60s creation (with locked adlob assignment per phase)
6. **Present** (`/present/[roomId]`) - Present campaigns (assigned deterministically via round-robin)
7. **Vote** (`/vote/[roomId]`) - Vote for best campaign
8. **Results** (`/results/[roomId]`) - Winner announcement

### Design System

Cassette Futurism + Classic Ogilvy Advertising aesthetic:
- **Colors**: Electric Blue (#0047FF), Hot Pink (#FF006E), Highlight Yellow (#FFD60A)
- **Typography**: Space Grotesk (headings), IBM Plex Mono (code/labels)
- **Style**: Retro borders, hard shadows, bold typography, scanline effects
- 30+ cartoony game icons in [components/game-icons.tsx](components/game-icons.tsx)

## Important Patterns

### Environment Variables

Use [lib/env.ts](lib/env.ts) for runtime environment parsing. Required variables:

**Next.js App** (`.env`):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - For admin operations
- `OPENAI_API_KEY` - For brief generation
- `NEXT_PUBLIC_REALTIME_URL` - WebSocket server URL (e.g., `http://localhost:8080` for dev, Railway URL for prod)
- `REALTIME_SHARED_SECRET` - JWT secret for realtime token generation
- `REALTIME_BROADCAST_SECRET` - Shared secret for API → WS server communication

**Realtime Server** (`services/realtime-server/.env`):
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - For persistence operations
- `REALTIME_SHARED_SECRET` - JWT secret for validating client tokens (must match Next.js)
- `REALTIME_BROADCAST_SECRET` - Shared secret for accepting broadcast requests (must match Next.js)

### Database Operations

Always use snake_case for database columns, camelCase for TypeScript:

```typescript
// Database insert
await supabase.from(TABLES.gameRooms).insert({
  id: roomId,
  room_code: code,
  current_phase: phase,
})

// Transform to API response
return NextResponse.json({
  room: {
    id: room.id,
    roomCode: room.room_code,
    currentPhase: room.current_phase,
  }
})
```

### Route Building

Use [lib/routes.ts](lib/routes.ts) for type-safe route generation:

```typescript
import { routes } from "@/lib/routes"

router.push(routes.lobby(roomId))
router.push(routes.create(roomId))
```

### Sample Data

[lib/sample-data.ts](lib/sample-data.ts) provides mock data for testing UI without database:
- `samplePlayers` - 4 test players
- `sampleBrief` - Pre-filled campaign brief
- `sampleAdLobs` - Complete AdLob examples
- `sampleGameRoom` - Game state
- `emojis` - 24 emoji options

## Supabase Schema

Schema types are in [lib/database.types.ts](lib/database.types.ts). To regenerate after schema changes:

```bash
npx supabase gen types typescript --project-id <project-id> > lib/database.types.ts
```

Migrations are in [supabase/migrations/](supabase/migrations/).

## Realtime Server Details

The WebSocket server in `services/realtime-server`:
- Uses in-memory state for Phase 0 (single-node)
- Room registry abstraction for future scaling (Redis-backed)
- Handles timer sync, phase transitions, live updates
- Deployed to Railway with nixpacks configuration

To work on the realtime server, navigate to `services/realtime-server` and run commands there.

## Common Gotchas

1. **State Machine Validation** - Always use `canTransitionStatus()` before changing game status. Invalid transitions throw errors.

2. **Phase vs Status** - `currentPhase` is only set during "creating" status. It must be null for all other statuses.

3. **Realtime Channel Lifecycle** - Subscribe to channels on component mount, unsubscribe on unmount to prevent memory leaks.

4. **Room Code Format** - 6 characters, alphanumeric excluding confusing chars (I, O, 0, 1). Generated via `generateRoomCode()` in [lib/db.ts](lib/db.ts).

5. **Player Identity** - Stored in localStorage, not session-based. Players can rejoin after refresh using stored playerId.

6. **Workspace Commands** - Some packages (like realtime-server) have their own dependencies. Always check if you need to `cd` into a package directory.

7. **Adlob Assignment Locking** - During creation phases, adlob assignments are locked when a phase starts to prevent mid-phase swapping. The assignment uses `lockedAdlobId` state that only updates when `phaseIndex` changes.

8. **Presenter Assignment** - Presenters are assigned deterministically via round-robin when transitioning to "presenting" status. `player[i]` always presents `adlob[i]` (both ordered by creation time). Never rely on `pitch_created_by` for presenter assignment.

9. **Version Increments** - All adlob phase update routes (big-idea, visual, headline, pitch) increment `game_rooms.version` to trigger realtime refresh. This ensures all clients see updates immediately.

10. **Overwrite Protection** - Each phase route checks if content was already created by a different player and returns 409 conflict to prevent overwrites. First player to submit "wins" and locks that phase.

## Testing the Application

The app is fully navigable with sample data. Start at `/` and follow the game flow. All screens are functional but database operations need implementation where TODOs are marked.

## Current Development Status

✅ Complete:
- All UI screens with cassette futurism design
- Game state machine with phase transitions
- Type-safe route handling
- Supabase client setup and database integration
- Realtime client architecture with WebSocket server
- **Single source of truth realtime architecture (API → DB → WS broadcast)**
- **Server-side authorization for WebSocket handlers**
- **Eliminated dual-write pattern for consistency**
- Deterministic presenter assignment (round-robin)
- Adlob assignment locking to prevent mid-phase swapping
- Overwrite protection for concurrent content creation
- Sample data for testing

🚧 In Progress:
- Canvas component improvements (currently using Excalidraw)
- AI brief generation optimization
- Image generation for visual phase

## Realtime Architecture Deep Dive

### Why Single Source of Truth?

**Previous Architecture (Dual-Write)**:
- Client → WebSocket (optimistic update)
- Client → API → Database (persistent update)
- Problems: Race conditions, inconsistent state, complex error handling

**Current Architecture (Single Source)**:
- Client → API → Database → WebSocket broadcast
- Benefits: Guaranteed consistency, simpler code, single error path

### WebSocket Server Authorization

All WebSocket handlers now verify player identity:

**`set_ready` handler**:
```typescript
const meta = connectionMeta.get(socket)
if (!meta || meta.playerId !== playerId) {
  return sendError("forbidden")
}
```

**`advance_phase` handler**:
```typescript
const actor = room.state.players.find(p => p.id === meta.playerId)
if (!actor || !actor.isHost) {
  return sendError("forbidden")
}
```

### Client Snapshot Handling

Server is authoritative - client snapshots only for version detection:

```typescript
if (clientVersion > serverVersion) {
  logger.warn("client_version_ahead", { ... })
  // Server state remains authoritative
}
```

### Broadcast Endpoint

The realtime server exposes `POST /api/broadcast` for API routes:

```typescript
{
  roomCode: string,
  event: ServerToClientEvent,
  secret: string // REALTIME_BROADCAST_SECRET
}
```

Secured with shared secret to prevent unauthorized broadcasts.

### WebSocket Event Types

All events are defined in [packages/realtime-shared/src/index.ts](packages/realtime-shared/src/index.ts).

**State-Changing Events** (update server snapshot):
- `player_joined` - New player joins game (adds to players array)
- `ready_update` - Player ready state changes (updates player.isReady)
- `status_changed` - Game status transitions (updates status, phase, timestamp)
- `phase_changed` - Creation phase advances (updates currentPhase, timestamp)
- `settings_changed` - Game settings updated (increments version for refetch)
- `brief_updated` - Campaign brief edited (increments version for refetch)
- `content_submitted` - Player submits work (increments version, sends notification)

**Broadcast-Only Events** (no server state mutation):
- `player_left` - Player disconnects (handled by disconnect handler)
- `presentation_state` - Ephemeral presentation UI state
- `room_state` - Full snapshot synchronization
- `hello_ack` - Connection acknowledgment with current snapshot
- `heartbeat` - Keep-alive ping
- `error` - Error messages to client

## Key Files to Reference

**Core**:
- [lib/types.ts](lib/types.ts) - Domain types
- [lib/game-state-machine.ts](lib/game-state-machine.ts) - State transitions
- [lib/db.ts](lib/db.ts) - Table constants and utilities

**Realtime**:
- [lib/realtime-client.ts](lib/realtime-client.ts) - WebSocket client
- [lib/realtime-broadcast.ts](lib/realtime-broadcast.ts) - API → WS broadcast helper
- [services/realtime-server/src/index.ts](services/realtime-server/src/index.ts) - WebSocket server
- [packages/realtime-shared/src/index.ts](packages/realtime-shared/src/index.ts) - Shared event types

**Documentation**:
- [SCREEN_FLOW.md](SCREEN_FLOW.md) - Detailed user flow
- [README.md](README.md) - Project overview
