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
- **Monitoring**: Sentry (error tracking) + Custom metrics (performance)

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

### Adlob Assignment & Rotation Logic

During the creation phase, players rotate through different adlobs using a **stable, deterministic assignment system**:

**Rotation Formula**: `(playerIndex + phaseIndex) % adlobs.length`

This creates a Latin square where:
- Each player works on different adlobs across phases
- Each adlob is worked on by different players in each phase
- No collisions (two players on same adlob)

**Critical Implementation Details** ([app/create/[roomId]/page.tsx:531-574](app/create/[roomId]/page.tsx#L531-L574)):

1. **Stable Player Indexing**: Always sorts players by `joinedAt` before calculating `playerIndex`
   - Prevents realtime events from reordering arrays and changing player indices mid-session
   - Ensures same player always has same index throughout game

2. **Stable Adlob Ordering**: Always sorts adlobs by `createdAt` (with ID fallback) before indexing
   - Matches API sorting behavior exactly
   - Prevents array reordering from affecting assignments

3. **Phase Locking**: `lockedAdlobId` only updates when `phaseIndex` changes
   - Prevents mid-phase swapping when realtime events fire
   - Content (big idea + visual + headline + pitch) always travels with correct adlob

**Example for 3 players, 3 adlobs:**
| Phase | P0 | P1 | P2 |
|-------|----|----|-----|
| big_idea (0) | Adlob A | Adlob B | Adlob C |
| visual (1) | Adlob B | Adlob C | Adlob A |
| headline (2) | Adlob C | Adlob A | Adlob B |
| pitch (3) | Adlob A | Adlob B | Adlob C |

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
- **CampaignBrief** - AI-generated product brief with prose format:
  - `productName` - Product name (2-4 words)
  - `productCategory` - Product category (from game settings)
  - `coverImageUrl` - Optional AI-generated product image URL
  - `briefContent` - Prose campaign brief (80-120 words) with markdown bold subheadings: **What Is It**, **Who It's For**, **The Difference**, **Main Message**
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

### Brief UI Components

The campaign brief is displayed using two specialized components with a consistent layout:

**[components/brief-editor.tsx](components/brief-editor.tsx)** - Brief display used during briefing stage:
- **Two-column layout**: Product image (left, 1fr) with hatched placeholder pattern when no image; Brief prose content (right, 2fr)
- **Product Category**: Displayed below image (read-only, set from game settings)
- **Markdown rendering**: Parses `**bold**` syntax to render subheadings
- **Paragraph parsing**: Splits on `\n\n` to create proper paragraph spacing
- **Typography hierarchy**:
  - Product Name: Large purple heading (text-3xl, purple-600) at top
  - Bold subheadings: Rendered from markdown `**text**` syntax
  - Body text: Readable size with proper spacing (text-sm leading-relaxed)
- **No edit functionality**: Briefs can only be regenerated, not manually edited
- **Regenerate button**: Allows host to generate a new brief via AI

**[components/brief-view-dialog.tsx](components/brief-view-dialog.tsx)** - Read-only brief modal used during creation/presentation:
- **Same layout structure** as BriefEditor for consistency
- **Same markdown rendering**: Parses bold subheadings and paragraphs
- **Modal format**: Dialog overlay with scrollable content

**Key design decisions**:
1. **Prose format**: Brief is a single 80-120 word prose field with markdown formatting, not separate structured fields
2. **Markdown bold subheadings**: AI generates content with `**What Is It**`, `**Who It's For**`, `**The Difference**`, `**Main Message**` as section markers
3. **Image placeholder**: Diagonal stripe pattern using CSS gradients when `coverImageUrl` is null
4. **Two-column layout**: Product image (1fr) + brief content (2fr) on desktop, stacked on mobile
5. **No manual editing**: Removed inline editing and "Lock Brief" - players only ready up to confirm the AI-generated brief
6. **Cassette aesthetic**: Maintains retro borders, monospace labels, and bold typography throughout

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
- `NEXT_PUBLIC_SENTRY_DSN` - Sentry project DSN for error tracking (optional, production only)

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
- `sampleBrief` - Pre-filled campaign brief in prose format (80-120 words with markdown bold subheadings)
- `sampleAdLobs` - Complete AdLob examples
- `sampleGameRoom` - Game state
- `emojis` - 24 emoji options

**Note**: `sampleBrief` demonstrates the correct prose format with `**Bold Subheadings**` and paragraph breaks (`\n\n`) separating sections.

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

## Performance & Monitoring

### Monitoring Architecture

The application has comprehensive observability across all layers:

**1. Error Tracking (Sentry)**
- Client-side, server-side, and edge runtime monitoring
- Session replay for debugging production issues
- Automatic error capture with stack traces
- Configuration files: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- Instrumentation: `instrumentation.ts` (Next.js hook)

**2. Custom Metrics System** ([lib/metrics.ts](lib/metrics.ts))
- In-memory circular buffer (10k metrics max)
- Metric types: `db_query`, `api_request`, `realtime_event`, `cache_hit`, `cache_miss`, `error`
- Percentile calculations (P50, P95, P99) for latency analysis
- Time-windowed statistics (default 60s window)
- Utility function: `measure()` for wrapping async operations

**3. Metrics API** ([app/api/metrics/route.ts](app/api/metrics/route.ts))
- `GET /api/metrics?window=60000` - Retrieve statistics
- `DELETE /api/metrics` - Clear metrics
- Returns: query rates, latency percentiles, cache hit rates, error rates

**4. Realtime Server Metrics** ([services/realtime-server/src/metrics.ts](services/realtime-server/src/metrics.ts))
- `MetricsRecorder` class with current + lifetime counters
- Tracks: WebSocket connections, messages, broadcasts, errors
- HTTP endpoint: `GET /api/metrics` exposes stats + active room count
- Auto-flush every 60s (configurable)

**5. Admin Dashboard** ([app/admin/metrics/page.tsx](app/admin/metrics/page.tsx))
- Real-time dashboard at `/admin/metrics`
- Auto-refreshes every 5 seconds
- Displays both API server and WebSocket server metrics
- Visual cards for all key performance indicators

### Performance Patterns

**Request Deduplication Pattern** (all game pages):
```typescript
const pendingFetchRef = useRef<Promise<void> | null>(null)
const lastFetchVersionRef = useRef(0)

const fetchGame = useCallback(async () => {
  // Deduplicate concurrent requests
  if (pendingFetchRef.current) {
    console.log("Deduplicating concurrent fetchGame call")
    return pendingFetchRef.current
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetchWithRetry(`/api/games/${roomId}?include=all`)
      const data = await response.json()

      // Ignore stale responses
      const newVersion = data.game?.version ?? 0
      if (newVersion < lastFetchVersionRef.current) {
        console.warn("Ignoring stale response")
        return
      }
      lastFetchVersionRef.current = newVersion

      setGameState(data.game)
    } finally {
      pendingFetchRef.current = null
    }
  })()

  pendingFetchRef.current = fetchPromise
  return fetchPromise
}, [roomId])
```

**Retry Logic with Exponential Backoff** ([lib/fetch-with-retry.ts](lib/fetch-with-retry.ts)):
```typescript
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      // Don't retry 4xx client errors
      if (response.status >= 400 && response.status < 500) {
        return response
      }

      // Retry 5xx server errors
      if (response.status >= 500 && attempt < maxRetries) {
        const delay = 100 * Math.pow(2, attempt) // 100ms, 200ms, 400ms
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      return response
    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries) {
        const delay = 100 * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error("Max retries exceeded")
}
```

**Conditional Query Loading** (API optimization):
```typescript
// Client requests only needed data
const response = await fetch(`/api/games/${roomId}?include=players,brief`)

// API route builds dynamic query
const includePlayers = includeParam === "all" || includeParam.includes("players")
const includeBrief = includeParam === "all" || includeParam.includes("brief")
const includeAdlobs = includeParam === "all" || includeParam.includes("adlobs")

let query = supabase.from(TABLES.gameRooms).select("*, version")
if (includePlayers) query = query.select("*, players(*)")
if (includeBrief) query = query.select("*, campaign_briefs(*)")
if (includeAdlobs) query = query.select("*, adlobs(*)")
```

**Metrics Instrumentation Pattern**:
```typescript
import { measure, metrics } from "@/lib/metrics"

export async function GET(request: Request) {
  const apiStartTime = performance.now()

  try {
    // Wrap database query with measure()
    const { data: room, error } = await measure(
      "db_query",
      "game_fetch",
      async () => supabase.from(TABLES.gameRooms).select("*").eq("id", id).maybeSingle(),
      { identifier: id }
    )

    if (error) throw error

    // Record successful API request
    metrics.record({
      type: "api_request",
      name: "GET /api/games/[id]",
      duration: performance.now() - apiStartTime,
      metadata: { status: 200, gameStatus: room.status }
    })

    return NextResponse.json({ success: true, game: room })
  } catch (error) {
    // Record error
    metrics.record({
      type: "error",
      name: "GET /api/games/[id]",
      duration: performance.now() - apiStartTime,
      metadata: { error: String(error) }
    })

    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}
```

**Cache Headers** (reduce database load):
```typescript
return NextResponse.json(
  { success: true, game: room },
  {
    headers: {
      "Cache-Control": "private, max-age=0, stale-while-revalidate=2",
      "CDN-Cache-Control": "max-age=0",
    },
  }
)
```

### Performance Achievements

Based on completed performance optimization phases (see [PERFORMANCE_FIX_PLAN.md](PERFORMANCE_FIX_PLAN.md)):

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Database queries/min | 100 | 1-2 | 98% reduction |
| Response time (P95) | 10s | 200-500ms | 95% reduction |
| Timeout error rate | 60% | <0.1% | 99.8% reduction |
| Query payload size | 1.2MB | 50KB | 96% reduction |
| Max concurrent players | 4-6 | 12 | 2x capacity |

**Key Optimizations**:
- ✅ Request deduplication + cache headers (Phase 1)
- ✅ Conditional query loading (Phase 2)
- ✅ Retry logic with exponential backoff (Phase 3)
- ✅ Deduplication across all pages (Phase 5)
- ✅ Monitoring & Observability (Phase 6)

## Common Gotchas

1. **State Machine Validation** - Always use `canTransitionStatus()` before changing game status. Invalid transitions throw errors.

2. **Phase vs Status** - `currentPhase` is only set during "creating" status. It must be null for all other statuses.

3. **Realtime Channel Lifecycle** - Subscribe to channels on component mount, unsubscribe on unmount to prevent memory leaks.

4. **Room Code Format** - 6 characters, alphanumeric excluding confusing chars (I, O, 0, 1). Generated via `generateRoomCode()` in [lib/db.ts](lib/db.ts).

5. **Player Identity** - Stored in localStorage, not session-based. Players can rejoin after refresh using stored playerId.

6. **Workspace Commands** - Some packages (like realtime-server) have their own dependencies. Always check if you need to `cd` into a package directory.

7. **Adlob Assignment Locking** - During creation phases, adlob assignments are locked when a phase starts to prevent mid-phase swapping. The assignment uses `lockedAdlobId` state that only updates when `phaseIndex` changes.

8. **Stable Player/Adlob Indexing** - Both `playerIndex` and adlob calculations use stable sorting (by `joinedAt` and `createdAt` respectively) to ensure deterministic assignment even when realtime events reorder arrays. This prevents collision bugs where multiple players get assigned the same adlob. See [app/create/[roomId]/page.tsx:531-574](app/create/[roomId]/page.tsx#L531-L574).

9. **Presenter Assignment** - Presenters are assigned deterministically via round-robin when transitioning to "presenting" status. `player[i]` always presents `adlob[i]` (both ordered by creation time). Never rely on `pitch_created_by` for presenter assignment.

10. **Version Increments** - All adlob phase update routes (big-idea, visual, headline, pitch) increment `game_rooms.version` to trigger realtime refresh. This ensures all clients see updates immediately.

11. **Overwrite Protection** - Each phase route checks if content was already created by a different player and returns 409 conflict to prevent overwrites. First player to submit "wins" and locks that phase.

12. **Winner Display** - Results page displays the winning campaign's big idea text rather than the presenter's name, reflecting the collaborative nature of campaign creation across multiple players. See [app/results/[roomId]/page.tsx:367](app/results/[roomId]/page.tsx#L367).

13. **Request Deduplication Required** - All game pages must use `pendingFetchRef` to prevent concurrent API requests from realtime event storms. Without deduplication, rapid events cause database timeouts. Always include version guards (`lastFetchVersionRef`) to ignore stale responses.

14. **Metrics Instrumentation** - When adding new API routes, wrap database queries with `measure()` and record API request metrics to maintain observability. Use `performance.now()` for timing, not `Date.now()`. See [app/api/games/[id]/route.ts](app/api/games/[id]/route.ts) for the pattern.

15. **Retry All Fetches** - Use `fetchWithRetry()` for all API requests, not raw `fetch()`. This provides automatic retry with exponential backoff for transient 5xx errors and network failures. Never retry 4xx client errors.

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
- **Stable adlob assignment with collision prevention** (fixed rotation formula + stable sorting)
- Adlob assignment locking to prevent mid-phase swapping
- Overwrite protection for concurrent content creation
- Winner display shows big idea instead of player name
- Sample data for testing
- **Performance optimizations** (98% DB load reduction, 95% latency reduction)
- **Comprehensive monitoring** (Sentry + custom metrics + admin dashboard)
- **Request deduplication + retry logic** across all game pages

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

**Brief Components**:
- [components/brief-editor.tsx](components/brief-editor.tsx) - Editable brief display with two-column layout
- [components/brief-view-dialog.tsx](components/brief-view-dialog.tsx) - Read-only brief modal dialog
- [app/api/briefs/generate/route.ts](app/api/briefs/generate/route.ts) - AI brief generation endpoint

**Performance & Monitoring**:
- [lib/metrics.ts](lib/metrics.ts) - Custom metrics collector with percentile calculations
- [lib/fetch-with-retry.ts](lib/fetch-with-retry.ts) - Retry logic with exponential backoff
- [app/api/metrics/route.ts](app/api/metrics/route.ts) - Metrics API endpoint
- [services/realtime-server/src/metrics.ts](services/realtime-server/src/metrics.ts) - WebSocket metrics
- [app/admin/metrics/page.tsx](app/admin/metrics/page.tsx) - Real-time admin dashboard
- `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` - Sentry configuration
- `instrumentation.ts` - Next.js instrumentation hook

**Documentation**:
- [SCREEN_FLOW.md](SCREEN_FLOW.md) - Detailed user flow
- [README.md](README.md) - Project overview
- [PERFORMANCE_FIX_PLAN.md](PERFORMANCE_FIX_PLAN.md) - Performance optimization phases and results
