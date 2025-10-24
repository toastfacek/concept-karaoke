# Concept Karaoke Delivery Plan

## Recent Work Summary (February 2025)

### Completed
- **Canvas WYSIWYG Improvements**: Migrated test page improvements to main game UI
  - Fixed canvas clearing circular state update issues
  - Fixed text tool double-click bug and improved editing UX
  - Added create phase test page with enhanced canvas controls
- **Game Flow Refinements**:
  - Removed 20-character minimum requirement for big idea phase
  - Updated brief generation flow
  - Added game settings selection interface
- **Terminology Refactor (Partial)**:
  - Renamed `/app/pitch` → `/app/present` route
  - Updated core types: `CREATION_PHASES` now uses `"pitch"` instead of `"mantra"`
  - Updated state machine: `creating` → `presenting` transition
  - **⚠️ IN PROGRESS**: Database migrations written but not yet applied (see Terminology Refactor Project section below)

### Current State
- **Unstaged Changes**: Multiple deleted files (`app/api/adlobs/[id]/mantra/route.ts`, `app/api/games/[id]/pitch/route.ts`, `app/pitch/[roomId]/page.tsx`)
- **New Files**: Pitch API endpoint and present routes/pages ready to replace old structure
- **Database Migrations Ready**: Two migration files waiting to be applied via Supabase dashboard
- **Main Branch**: On `main`, ~1,000 lines removed, ~270 lines added in working tree

### Next Session Priorities
1. **Apply database migrations** through Supabase dashboard (blocking for deployment)
2. Complete terminology refactor code updates (~180 references remaining across 23-25 files)
3. Regenerate `lib/database.types.ts` after migrations
4. Test complete game flow end-to-end
5. Update documentation to reflect terminology changes

---

## Stack Alignment
- Next.js 15 (App Router), React, TypeScript
- Shadcn UI component library with its generated utility pipeline
- Supabase (Postgres, Realtime, Storage)
- Jest + React Testing Library (unit) and Playwright (e2e)

## Phased Roadmap
1. **Phase 0 – Foundations (Week 0–1)** ✅
   - [x] Confirm Shadcn UI setup, linting, formatting, and shared primitives (Button, Input, etc.).
   - [x] Ensure Supabase client utilities, env loading, and base layout are ready.
   - [x] Capture non-prod configuration (`.env.example`), README setup, and CI placeholder scripts.

2. **Phase 1 – Lobby Experience (Week 1–2)**
   - Finalize open lobby flows so anyone can create or join games without account requirements.

3. **Phase 2 – Lobby Loop (Week 2–3)**
   - Build create/join flows, lobby page UI, ready toggles, and realtime presence on `room:{roomId}`.
   - Enforce minimum player counts and host-only start controls.

4. **Phase 3 – Briefing & Realtime Core (Week 3–4)**
   - Deliver editable brief screen with manual inputs, regenerate stub, and broadcast updates to players.
   - Lock brief once all players ready; persist server-controlled phase timing metadata.

5. **Phase 4 – Creation Rounds MVP (Week 4–5)**
   - Implement sequential text-only rounds (Big Idea, Headline, Mantra) with 60-second timers and autosave.
   - Manage AdLob pass-offs and end-to-end state transitions inside Supabase.

6. **Phase 5 – Pitch & Voting (Week 5–6)**
   - Add presentation flow with randomized pitcher assignment, spectator modes, voting grid, and results reveal.

7. **Phase 6 – Canvas & Media Upgrade (Week 6–7)**
   - Integrate collaborative canvas tooling for Visual/Headline phases, persist serialized 16:9 layouts.
   - Support Supabase Storage image uploads and reconciliation on handoff.

8. **Phase 7 – AI Enhancements (Week 7–8)**
   - Wire Gemini brief generation and Nano Banana image prompts with prompt presets and retry handling.
   - Establish rate limiting and cost controls.

9. **Phase 8 – Resilience & Polish (Week 8–9)**
   - Harden timers, reconnection logic, debounced realtime updates, and accessibility.
   - Run structured playtests, triage UX issues, and add analytics events for success metrics.

10. **Phase 9 – Launch Prep & Operations (Week 9+)**
    - Finalize monitoring (Sentry), analytics dashboards, documentation, and Vercel deployment.
    - Park future enhancements (tutorials, mid-game joins, moderation) for post-launch planning.

## Phase 1 – Lobby Experience Plan (Week 1–2)

### Objectives
- Let anyone create a room or join with a code—zero account setup or auth requirements.
- Establish reliable lobby presence so player lists and ready states stay in sync.
- Capture lightweight configuration (room name, optional settings) to prep later phases.

### Deliverables
- [x] `app/page.tsx`: CTA section that spins up a room instantly and surfaces the join code.
- [x] `app/join/page.tsx`: Form that accepts code, display name, emoji and routes to lobby.
- [x] `app/lobby/[roomId]/page.tsx`: Lobby UI with live player list, ready toggle, host start control.
- [x] `app/brief/[roomId]/page.tsx`: Shared brief editing screen with realtime updates and host start.
- [x] `app/create/[roomId]/page.tsx`: Creation rounds interface tied to Supabase state and phase timers.
- [x] Supabase schema seed for `game_rooms`, `players`, `player_status` tables with realtime channels wired in `lib/realtime.ts`.
- [x] Minimal lobby state helpers (`lib/game-state-machine.ts`, `lib/routes.ts`) supporting host/guest flows.
- [ ] Happy-path Playwright script that walks Create → Lobby → Ready toggle interactions using stubbed APIs.

### Key Tasks
- [x] **Room lifecycle**: Implement `/api/games/create` POST to insert room, generate join code, return redirect target.
- [x] **Join flow**: Implement `/api/games/join` POST that validates code, creates player row, returns lobby payload.
- [x] **Realtime presence**: Subscribe clients to `room:{roomId}` channel; broadcast join/leave/ready updates.
- [x] **Ready logic**: Enforce minimum three ready players before enabling start; persist `is_ready` on toggle.
- [x] **Host tools**: Auto-assign first player as host, transfer host if they disconnect, gate “Start Game” button accordingly.
- [x] **Error/edge handling**: Surface inline validation (invalid code, lobby full), add optimistic reconnect for refresh.
- [x] **Briefing collaboration**: Persist brief edits, regenerate stubs, and broadcast updates while players ready up.
- [x] **Brief lock & advance**: Gate creation phase on host command with everyone ready, resetting readiness between stages.
- [x] **Creation rounds**: Capture per-phase submissions, manage ready signals, and advance hosts through Supabase state.
- [x] **Brief generation**: Swap Gemini stubs for OpenAI-powered briefs, store results, and hydrate clients realtime.

### Dependencies & Notes
- Supabase service role env vars must be populated locally for API route access.
- Canvas, AI, and pitch flows remain out of scope—stub any downstream calls.
- Ensure data model keeps future phases in mind (timestamps, foreign keys) but stay lean for Week 1–2 delivery.

## Realtime Service Migration Plan

### Phase 0 – Foundations (1–2 days)
- Document the WebSocket protocol (event enum, payload schemas, error handling) in `docs/realtime-protocol.md`.
- Bootstrap `services/realtime-server/` with TypeScript, `ws` (uWebSockets.js later if needed), shared game types, linting, and tests.
- Implement a `RoomRegistry` abstraction hiding storage (in-memory Map now, Redis-capable later).
- Add a React realtime client provider (`lib/realtime-client.ts`) that manages the socket lifecycle, exposes `send/subscribe`, and falls back to REST on reconnect.

### Phase 1 – Core Loop Migration (3–5 days)
- Move join/leave/ready/phase logic to the realtime server; keep Postgres writes async for durability.
- Update creation/lobby flows to consume socket events (`room_state`, `player_joined`, `ready_update`, etc.) instead of Supabase polling.
- Stream canvas deltas through the socket so the server remains authoritative for in-room state.
- Expand realtime adoption to other live pages (lobby, brief, pitch) and remove redundant Supabase realtime subscriptions.

### Phase 2 – Persistence & Fallbacks (2–3 days)
- Build a snapshot pipeline to flush room state to Postgres on key transitions or a timed cadence (`room_snapshots`, `room_events`).
- Provide client rehydration on reconnect (snapshot fetch or socket RPC) before resubscribing to live deltas.
- Add heartbeat/timeout handling and REST fallback logic when the socket drops.
- Harden authentication on the socket handshake with signed tokens validated by the realtime server.
- Replace creation/lobby/brief/pitch Supabase realtime listeners with the new socket client once token auth lands.

**Remaining Tasks**
- [x] Issue signed realtime tokens from `/api/realtime/token` and cache them on the client.
- [x] Validate tokens inside the Node websocket handshake; reject invalid/expired signatures.
- [x] Update creation/lobby/brief/pitch flows to fetch tokens and connect via the realtime provider.
- [x] Remove Supabase channel subscriptions from those pages after socket parity is confirmed.

### Phase 3 – Observability & Docs (1–2 days)
- [x] Instrument structured logging and basic metrics (join counts, broadcast latency, errors).
- [x] Write an operational runbook (`docs/realtime-runbook.md`) covering deployment, env vars, scaling hooks, and how to swap the registry for Redis.
- [x] Create integration tests that spin up the WS server in-memory, simulate multiple clients, and assert state convergence; define manual QA scripts for host/guest flows.

---

## Terminology Refactor Project (October 2025)

### Background & Motivation
Renamed `/app/pitch` → `/app/present` to distinguish between:
- **"Pitch"** (Creation Phase Round 4): Writing the pitch/rationale during creation
- **"Presenting"** (Game Phase): Sharing completed campaigns with others

However, legacy terminology (e.g., "mantra", "pitching", "pitcher") remained in database and code, creating confusion for:
- Future development and LLM-assisted coding
- New developers understanding the codebase
- Code consistency and maintainability

### Terminology Schema (Confirmed)
| Concept | Old Name | New Name | Scope |
|---------|----------|----------|-------|
| Creation Round 4 | `mantra` | `pitch` | DB columns, API, UI labels |
| Presentation Phase | `pitching` | `presenting` | DB status, state machine |
| Person Presenting | `pitcher` | `presenter` | DB columns, code refs |

### Completed Work ✅

#### 1. Database Migrations Created
**Files:**
- `supabase/migrations/20250206_rename_mantra_to_pitch.sql`
- `supabase/migrations/20250207_rename_pitching_to_presenting.sql`

**Changes:**
- `mantra_text` → `pitch_text`
- `mantra_created_by` → `pitch_created_by`
- Game phase enum: `"mantra"` → `"pitch"`
- Game status enum: `"pitching"` → `"presenting"`
- `assigned_pitcher` → `assigned_presenter`
- `current_pitch_index` → `current_present_index`
- `pitch_sequence` → `present_sequence`
- `pitch_order` → `present_order`
- `pitch_started_at` → `present_started_at`
- `pitch_completed_at` → `present_completed_at`

**Status:** ⚠️ **PENDING MANUAL APPLICATION**
- Migrations are written but need to be applied via Supabase dashboard
- Must be applied before code changes are deployed

#### 2. Core TypeScript Types Updated
**Files:**
- `lib/types.ts`: Updated `GAME_STATUSES`, `CREATION_PHASES`, `AdLob` interface
- `lib/game-state-machine.ts`: Updated status transitions (`creating` → `presenting`)

**Changes:**
```typescript
// Before
GAME_STATUSES = ["lobby", "briefing", "creating", "pitching", "voting", "results"]
CREATION_PHASES = ["big_idea", "visual", "headline", "mantra"]
creating: ["pitching"]

// After
GAME_STATUSES = ["lobby", "briefing", "creating", "presenting", "voting", "results"]
CREATION_PHASES = ["big_idea", "visual", "headline", "pitch"]
creating: ["presenting"]
```

### Remaining Work 🚧

#### Estimated Scope
- **Files to modify:** 23-25 files
- **Code references:** ~180 remaining updates
- **Time estimate:** 4-6 hours

#### 3. Database Types (Auto-generated)
**File:** `lib/database.types.ts`
- **Status:** Partially updated manually
- **Action needed:** Re-generate from Supabase after migrations are applied
- **Command:** `npx supabase gen types typescript --project-id ajkiqcirngxsmtscrxfe > lib/database.types.ts`

#### 4. API Endpoints

**A. Creation Phase Endpoint**
- **Old:** `app/api/adlobs/[id]/mantra/route.ts`
- **New:** `app/api/adlobs/[id]/pitch/route.ts`
- **Changes needed:**
  - Rename file/folder
  - Update column names: `mantra_text` → `pitch_text`, `mantra_created_by` → `pitch_created_by`
  - Update error messages
- **Affects:** `app/create/[roomId]/page.tsx` fetch call (line 518)

**B. Presentation Phase Endpoint**
- **Old:** `app/api/games/[id]/pitch/route.ts`
- **New:** `app/api/games/[id]/present/route.ts`
- **Changes needed:**
  - Rename file/folder
  - Update all variable names: `pitcher` → `presenter`
  - Update column names: `assigned_pitcher` → `assigned_presenter`, etc.
  - Update error messages: "pitch" → "present"
- **Affects:** `app/present/[roomId]/page.tsx` fetch calls (lines 235, 262)

#### 5. Frontend Components (Major Files)

**A. Creation Page** (`app/create/[roomId]/page.tsx`)
- Lines 39-40: `mantraAuthorId` → `pitchAuthorId`
- Line 57: Update `CREATION_SEQUENCE`
- Lines 63, 72: Update `PHASE_LABELS` and `PHASE_INSTRUCTIONS`
- Line 122: `mantraInput` → `pitchInput`
- Lines 408-438: All mantra state references
- Lines 509-518: Submission endpoint and field references
- Lines 744-777: UI rendering

**B. Present Page** (`app/present/[roomId]/page.tsx`)
- Lines 26-47: Rename types `PitchAdlob` → `PresentAdlob`, `PitchGameState` → `PresentGameState`
- Line 69: `PitchPage` → `PresentPage`
- Lines 87-94: Rename all refs with "pitch" prefix
- Lines 133-134, 193-225: Update field names
- Lines 235, 262: Update API endpoint calls
- Lines 217-225: `currentPitcher` → `currentPresenter`
- Line 254: `handleAdvancePitch` → `handleAdvancePresent`

**C. Game Phase Routes** (3 files)
- `app/api/games/[id]/phase/route.ts` (lines 100-142)
- `app/api/games/[id]/route.ts` (lines 204-250)
- Both need: Status checks `"pitching"` → `"presenting"`, column name updates

**D. Navigation Pages** (3 files) - ✅ Already updated
- `app/lobby/[roomId]/page.tsx:426`
- `app/create/[roomId]/page.tsx:657`
- `app/brief/[roomId]/page.tsx:573`

**E. Voting & Results Pages** (2 files)
- `app/vote/[roomId]/page.tsx`
- `app/results/[roomId]/page.tsx`
- Update: `assignedPitcher` → `assignedPresenter` references

#### 6. Realtime Services (3 files)

**A. Shared Types** (`packages/realtime-shared/src/index.ts`)
- Update event names: `pitchStarted` → `presentStarted`, `pitchEnded` → `presentEnded`
- Update field names in interfaces

**B. Server** (`services/realtime-server/src/index.ts`)
- Update event handlers to use new names
- Update broadcast logic

**C. Client** (`lib/realtime.ts`)
- Lines 13-14: Update event enum values

#### 7. Sample Data (`lib/sample-data.ts`)
- Update sample AdLob data to use new field names
- Update assigned pitcher references

#### 8. Documentation (4 files)
- `SCREEN_FLOW.md`: ✅ Already updated for `/present` route
- `concept-karaoke-prd.md`: Update terminology throughout
- `technical-design-doc.md`: Update technical specifications
- `README.md`: Update if it references game phases

### Deployment Strategy

**Critical Path:**
1. ⚠️ **Apply database migrations** (Supabase dashboard)
2. Regenerate `lib/database.types.ts` from updated schema
3. Complete all code updates
4. Deploy backend (API routes) first
5. Deploy frontend immediately after
6. Deploy realtime server in sync
7. Monitor for errors and mismatches

**Rollback Plan:**
- Keep reverse migrations ready
- Database backup before migration
- Git commit before deployment for quick revert
- Monitor error rates after deployment

### Risk Assessment
- **HIGH RISK**: Database migrations (column renames, enum updates)
- **MEDIUM RISK**: API endpoint changes (breaking changes for old clients)
- **MEDIUM RISK**: Realtime event name mismatches
- **LOW RISK**: TypeScript type updates (compile-time safety)

### Next Steps
1. Apply database migrations manually through Supabase dashboard
2. Continue with API route renames and updates
3. Update frontend components systematically
4. Update realtime services
5. Test complete game flow
6. Update documentation
