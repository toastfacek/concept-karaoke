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

The app uses a **hybrid realtime approach**:

1. **Supabase Realtime** - For database change events (player joins, game updates)
2. **Custom WebSocket Server** - For time-critical coordination (timer sync, phase transitions, live canvas)

**Custom Realtime Client**: [lib/realtime-client.ts](lib/realtime-client.ts) provides a WebSocket client that connects to the realtime server. Events are defined in `packages/realtime-shared`.

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
- Version increment after mutations to trigger realtime refresh

Example: [app/api/games/create/route.ts](app/api/games/create/route.ts)

**Realtime Optimization Pattern** (all adlob phase routes):
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

// 4. Increment version to trigger realtime refresh
const { data: room } = await supabase
  .from(TABLES.gameRooms)
  .select("version")
  .eq("id", adlob.room_id)
  .single()

await supabase
  .from(TABLES.gameRooms)
  .update({ version: (room?.version ?? 0) + 1 })
  .eq("id", adlob.room_id)
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
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - For admin operations
- `OPENAI_API_KEY` - For brief generation
- `NEXT_PUBLIC_REALTIME_URL` - WebSocket server URL (defaults to `ws://localhost:8080`)

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
- Realtime synchronization with version increments
- Deterministic presenter assignment (round-robin)
- Adlob assignment locking to prevent mid-phase swapping
- Overwrite protection for concurrent content creation
- Sample data for testing

🚧 In Progress:
- Canvas component improvements (currently using Excalidraw)
- AI brief generation optimization
- Image generation for visual phase

## Key Files to Reference

- [lib/types.ts](lib/types.ts) - Domain types
- [lib/game-state-machine.ts](lib/game-state-machine.ts) - State transitions
- [lib/realtime-client.ts](lib/realtime-client.ts) - WebSocket client
- [lib/db.ts](lib/db.ts) - Table constants and utilities
- [SCREEN_FLOW.md](SCREEN_FLOW.md) - Detailed user flow
- [README.md](README.md) - Project overview
