# Concept Karaoke Delivery Plan

## Project Status Overview

**Current Status**: MVP Complete - Ready for Testing & Polish 🎉

The core game is fully functional with all major features implemented:
- Complete game flow from lobby through results
- AI-powered campaign brief generation
- Real-time multiplayer collaboration
- Canvas-based creative tools
- Voting and results system

**What's Next**: Focus on polish, multi-player testing, and launch preparation (Phase 8-9)

---

## Streamlining & Performance Opportunities (Nov 2025)

1. ✅ **Stabilize realtime client context** — `components/realtime-provider.tsx:45`
   - Memoized `connect`/`disconnect`/`send`/`addListener` so heartbeat-driven status updates no longer churn callback identities or tear down WebSocket effects. Realtime consumers now hold a stable client reference without triggering reconnect loops.

2. ✅ **Extract shared realtime room hook** — `hooks/use-room-realtime.ts`, `app/(lobby|brief|create|present|vote|results)/[roomId]/page.tsx`
   - `useRoomRealtime` now owns snapshot hand-off, token refresh, and listener lifecycle across every phase (lobby → results), cutting hundreds of duplicated lines and keeping reconnection logic consistent. Added unit coverage (`hooks/__tests__/use-room-realtime.test.tsx`) to verify we reconnect cleanly after disconnects.

3. ✅ **Rely on realtime updates instead of fallback refetches** — `app/lobby/[roomId]/page.tsx:180-252`, `app/create/[roomId]/page.tsx:569-662`, `app/present/[roomId]/page.tsx:248-283`
   - Ready toggles and phase transitions now stay optimistic and lean on websocket broadcasts; we only schedule a lightweight, 2‑second fallback fetch when the client isn’t connected or an ack never arrives. This halves redundant API calls while retaining resilience if realtime hiccups.

4. ✅ **Trim deep canvas diffing work** — `components/canvas.tsx:62-208, 528-835`
   - Canvas state updates now bump a monotonically increasing `version`, allowing `statesEqual` to short-circuit on matching revisions instead of walking every stroke/text/image. All debug logging has been removed and the initial-data effect now applies updates only when the incoming version changes, drastically cutting render thrash on busy boards.

5. ✅ **Batch room data fetches** — `app/api/games/[id]/route.ts`, `lib/serializers/game.ts`
   - Replaced the triple Supabase round-trip with a single relational select that pulls players, adlobs, and the brief together, then normalize it via a shared serializer. All pages now read the same canonical game payload, shaving repeated data-munging and improving cold-load latency.

6. ✅ **Tighten snapshot merge performance** — `lib/realtime/snapshot.ts`
   - Snapshot merges now index players by id, reuse existing objects when nothing changed, and skip work entirely if the version already matches. Joined-at timestamps no longer churn on every update, which keeps React memoization intact even with large lobbies.

---

## Recent Work Summary (October 2025)

### Completed (Latest Session - October 24, 2025)
- **Auto-Generated Briefs with Animated Reveal - COMPLETE** ✅
  - Integrated Gemini API in `/api/games/start` to auto-generate campaign briefs
  - Created `BriefLoadingModal` component with animated loading states
  - Added reveal animation to `BriefEditor` component
  - Brief page shows loading modal on initial load with smooth transitions
  - Fallback to empty brief if AI generation fails
  - Seamless transition from lobby to brief with AI-generated content

- **Brief Access During Creation Rounds - COMPLETE** ✅
  - Created `BriefViewDialog` component for read-only brief viewing
  - Added "View Brief" button underneath timer in all creation phases
  - Players can reference campaign brief throughout all 4 creation rounds
  - No additional API calls needed (brief already fetched in game state)
  - Maintains context for all players during collaborative creation

- **Terminology Refactor - COMPLETE** ✅
  - Applied database migrations via Supabase MCP (mantra→pitch, pitching→presenting)
  - Regenerated `lib/database.types.ts` from updated schema
  - Updated all 27 files with new terminology across codebase
  - Fixed present API to handle room codes (was causing 500 error)
  - All TypeScript compilation passing with zero errors

- **Voting System Implementation - COMPLETE** ✅
  - Implemented full `/api/votes` endpoint with validation:
    - Prevents duplicate votes
    - Prevents self-voting
    - Auto-transitions game to "results" when all votes are in
  - Updated vote page to fetch and display real game data
  - Updated results page to show actual vote counts and winner
  - Added loading states and error handling
  - Data persistence verified in Supabase database

### Previous Completed Work
- **Canvas WYSIWYG Improvements**: Migrated test page improvements to main game UI
  - Fixed canvas clearing circular state update issues
  - Fixed text tool double-click bug and improved editing UX
  - Added create phase test page with enhanced canvas controls
- **Game Flow Refinements**:
  - Removed 20-character minimum requirement for big idea phase
  - Updated brief generation flow
  - Added game settings selection interface

### Current State
- **Main Branch**: Commit `a32ce84` - All changes committed and pushed ✅
- **Database**: Migrations applied, schema updated with new terminology ✅
- **Game Flow**: Fully functional from lobby → auto-generated briefing → creating (with brief access) → presenting → voting → results ✅
- **Data Persistence**: All game data properly saved and retrieved from Supabase ✅
- **AI Integration**: Gemini API generating campaign briefs automatically ✅

### Current Feature Set (What's Working)
1. **Game Creation & Joining**
   - Instant room creation with shareable codes
   - Join flow with display name and emoji selection
   - No authentication required

2. **Lobby System**
   - Real-time player list with presence
   - Ready toggle system
   - Host controls (minimum 3 players)
   - Game settings selection

3. **Campaign Brief Phase**
   - Auto-generated AI briefs using Gemini API
   - Animated loading modal with reveal
   - Editable brief fields (product, category, audience, etc.)
   - Host can start game when all players ready

4. **Creation Rounds** (4 rounds, 60s each)
   - Round 1: Big Idea (text input)
   - Round 2: Headline (canvas + text)
   - Round 3: Visual (canvas)
   - Round 4: Pitch (text input)
   - "View Brief" button available during all rounds
   - Canvas with WYSIWYG editing tools
   - AdLob handoff between players

5. **Presentation Phase**
   - Randomized presenter assignment
   - Display completed campaigns
   - Spectator mode for non-presenting players

6. **Voting Phase**
   - Vote grid showing all campaigns
   - Prevents self-voting and duplicate votes
   - Auto-advance to results when complete

7. **Results Phase**
   - Winner announcement with vote counts
   - Ranked display of all campaigns
   - "Play Again" option

8. **Real-time Features**
   - WebSocket-based game state sync
   - Player presence tracking
   - Phase transitions
   - Canvas collaboration

9. **Technical Features**
   - TypeScript with strict typing
   - Supabase for database and real-time
   - Next.js 15 App Router
   - Shadcn UI components
   - Custom realtime server implementation

### Known Issues & Potential Improvements
1. **Canvas Rendering in Vote/Results** - Canvas visuals not currently displayed in voting/results pages (only text content shown)
2. **Vote Updates** - Voting page polls for status changes rather than using realtime websocket updates
3. **Multi-player Testing** - Need comprehensive testing with 3+ simultaneous players
4. **Reconnection Handling** - Edge cases around player disconnection/reconnection need hardening
5. **Performance** - Canvas operations and realtime updates could be optimized for larger player counts
6. **Accessibility** - Keyboard navigation and screen reader support not yet implemented
7. **Error Handling** - Could improve user-facing error messages and recovery flows
8. **Analytics** - No tracking of game metrics or user behavior yet

### Next Session Priorities
1. ✅ ~~Apply database migrations~~ (COMPLETE)
2. ✅ ~~Complete terminology refactor~~ (COMPLETE)
3. ✅ ~~Regenerate database types~~ (COMPLETE)
4. ✅ ~~Implement voting system~~ (COMPLETE)
5. ✅ ~~Auto-generate briefs with AI~~ (COMPLETE)
6. ✅ ~~Add brief access during creation rounds~~ (COMPLETE)
7. **Canvas visual display improvements** - Show actual canvas renders in vote/results pages
8. **Realtime vote updates** - Replace polling with websocket events
9. **Multi-player testing** - Test with 3-5 simultaneous players, fix bugs
10. **End-to-end playtesting** - Complete game flow validation

---

## Stack Alignment
- Next.js 15 (App Router), React, TypeScript
- Shadcn UI component library with its generated utility pipeline
- Supabase (Postgres, Realtime, Storage)
- Jest + React Testing Library (unit) and Playwright (e2e)

## Phased Roadmap

### Completed Phases ✅
1. **Phase 0 – Foundations** ✅
   - [x] Shadcn UI setup, linting, formatting, shared primitives
   - [x] Supabase client utilities, env loading, base layout
   - [x] Configuration and README setup

2. **Phase 1 – Lobby Experience** ✅
   - [x] Open lobby flows (create/join without accounts)
   - [x] Room code generation and validation

3. **Phase 2 – Lobby Loop** ✅
   - [x] Create/join flows, lobby page UI
   - [x] Ready toggles and realtime presence
   - [x] Minimum player counts and host controls

4. **Phase 3 – Briefing & Realtime Core** ✅
   - [x] Editable brief screen with AI generation
   - [x] Broadcast updates to players
   - [x] Lock brief and phase timing metadata

5. **Phase 4 – Creation Rounds MVP** ✅
   - [x] Sequential rounds (Big Idea, Headline, Visual, Pitch)
   - [x] 60-second timers with autosave
   - [x] AdLob pass-offs and state transitions

6. **Phase 5 – Pitch & Voting** ✅
   - [x] Presentation flow with randomized presenter assignment
   - [x] Spectator modes
   - [x] Voting grid with validation
   - [x] Results reveal with winner announcement

7. **Phase 6 – Canvas & Media Upgrade** ✅
   - [x] Collaborative canvas for Visual/Headline phases
   - [x] WYSIWYG editing tools
   - [x] Canvas state persistence

8. **Phase 7 – AI Enhancements** ✅
   - [x] Gemini brief generation with animated loading
   - [x] Auto-generation on game start
   - [x] Fallback handling

### In Progress / Next Phases
9. **Phase 8 – Resilience & Polish** 🔄
   - [x] Canvas visual display in vote/results pages ✅
   - [x] Multi-player testing infrastructure (TESTING_GUIDE.md, test rotation tools) ✅
   - [x] Performance optimizations (November 2025 streamlining) ✅
   - [ ] Individual vote tracking via websocket (auto-transition works, but vote count updates missing)
   - [ ] Timer hardening and reconnection logic
   - [ ] Accessibility improvements
   - [ ] Analytics event tracking (Vercel Analytics installed but not implemented)

10. **Phase 9 – Launch Prep & Operations** 🔄
    - [x] Monitoring (Sentry) integration ✅
    - [x] Custom analytics dashboards (/admin/metrics) ✅
    - [x] Documentation updates (comprehensive) ✅
    - [ ] Vercel deployment optimization
    - [ ] Automated testing infrastructure (Jest/Playwright)
    - [ ] Load testing for multi-player scenarios
    - [ ] Future enhancements backlog organization

11. **Phase 10 – Content Marketing & Growth** 🆕
    - [ ] SEO foundation (OG tags, sitemap, robots.txt, structured data)
    - [ ] Social sharing features (share buttons, dynamic OG images)
    - [ ] Marketing pages (about, FAQ, how-to-play, contact)
    - [ ] Blog system with MDX support
    - [ ] SEO-optimized content (10+ articles)
    - [ ] Product Hunt launch preparation
    - [ ] Social media strategy and community features

## Phase 1-7 Implementation Details - ✅ COMPLETE

All core game phases (Lobby, Briefing, Creation, Presenting, Voting, Canvas, AI) are fully implemented and functional. See "Current Feature Set" above for details on what's working.

### Key Deliverables Completed
- [x] Full game flow from create → join → lobby → brief → create → present → vote → results
- [x] Realtime WebSocket server with player presence and state sync
- [x] Canvas collaboration with WYSIWYG editing
- [x] AI-powered brief generation with Gemini
- [x] Voting system with validation and auto-transitions
- [x] Database schema with migrations applied
- [x] Type-safe API routes and frontend components

## Realtime Service - ✅ COMPLETE

Custom WebSocket-based realtime server implementation completed with the following features:

### Implemented Features
- [x] WebSocket server with token-based authentication
- [x] Room registry abstraction (in-memory, Redis-capable)
- [x] React realtime client provider with lifecycle management
- [x] Player presence tracking (join/leave/ready events)
- [x] Real-time state synchronization across all game phases
- [x] Canvas delta streaming for collaborative editing
- [x] Snapshot-based persistence to Postgres
- [x] Heartbeat/timeout handling with fallback logic
- [x] Structured logging and metrics
- [x] Integration across all game pages (lobby, brief, create, present)

### Architecture
- **Server**: Node.js WebSocket server (`services/realtime-server/`)
- **Client**: React provider (`components/realtime-provider.tsx`)
- **Shared Types**: Common event types (`packages/realtime-shared/`)
- **Persistence**: Snapshot scheduler with configurable flush intervals
- **Metrics**: Connection counts, broadcast latency, error tracking

---

## Implementation Archive

### Terminology Refactor - ✅ COMPLETE (October 24, 2025)
Renamed `/app/pitch` → `/app/present` to distinguish between:
- **"Pitch"** (Creation Phase Round 4): Writing the pitch/rationale during creation
- **"Presenting"** (Game Phase): Sharing completed campaigns with others

**Key Changes:**
- Applied database migrations (mantra→pitch, pitching→presenting)
- Updated 27 files with consistent terminology
- All TypeScript compilation passing
- Committed to main branch (commit `697c39c`)

### Voting System - ✅ COMPLETE (October 24, 2025)
Built complete voting system with real data persistence and automatic game state transitions.

**Features:**
- Full vote validation (prevents duplicate votes and self-voting)
- Auto-transitions game to "results" when all votes are in
- Real-time vote counting and winner display
- Committed to main branch (commit `697c39c`)

---

## Future Features & Roadmap

### Custom Brief Upload: PPTX/Slides Import

**Status**: Design Phase - Not Yet Implemented
**Target Users**: Teams with existing briefs, agencies reusing client decks
**Goal**: Allow users to upload campaign briefs from PPTX or Google Slides instead of AI generation

**Date Designed**: November 2025

#### Core Concept

Many creative briefs already exist in PowerPoint or Google Slides format. Instead of manually transcribing them into the AI generator or brief editor, users should be able to upload a document and have the system extract the relevant fields automatically. This feature would complement the existing AI generation, giving users flexibility in how they input campaign briefs.

**Key Philosophy**:
- **Preserve existing workflow** - Keep AI generation as primary option
- **Add flexibility** - Support teams with pre-existing briefs
- **Maintain structure** - Extracted briefs use same 9-field format
- **Template-based** - Clear slide structure for reliable parsing

#### Implementation Approach

**Recommended Strategy**: Add upload as **alternative to AI generation** rather than replacement.

**Briefing Stage Flow**:
1. Host enters briefing stage (existing flow)
2. Two options presented:
   - **Generate Brief** (existing AI generation)
   - **Upload Brief** (new PPTX/Slides upload)
3. After upload, brief populates BriefEditor for review/refinement
4. Host can edit any extracted fields before locking
5. Lock brief and continue game (existing flow)

**Benefits**:
- Preserves AI generation for teams without existing briefs
- Allows hybrid workflows (upload, then refine with AI suggestions)
- Separate validation logic for uploaded vs. generated briefs
- Clear UX with distinct entry points

#### Required Brief Fields

Based on existing `CampaignBrief` type (9 fields):

**Required Text Fields** (8):
- `productName` - Product name (VARCHAR 100)
- `productCategory` - Product category (VARCHAR 100)
- `mainPoint` - Main campaign message (4-8 words)
- `audience` - Target audience (1-2 bullet points, newline-separated)
- `businessProblem` - Business problem (1-3 bullet points, newline-separated)
- `objective` - Campaign objective (single paragraph)
- `strategy` - Campaign strategy (1-2 sentences)
- `productFeatures` - Key product features (exactly 3 bullet points, newline-separated)

**Optional Field** (1):
- `coverImageUrl` - Product image URL (extracted from slides or left empty)

**Bullet Point Format**: Fields like `audience`, `businessProblem`, and `productFeatures` must store text separated by `\n` (newline character) for proper UI rendering.

#### Document Template Structure

**Slide Mapping** (Template-Based Approach):

```
Slide 1: Product Overview
- Title: Product Name
- Image: Product image (optional)
- Body: Product Category

Slide 2: Main Point
- Title: "Main Point" or "Key Message"
- Body: 4-8 word phrase

Slide 3: Audience
- Title: "Audience" or "Target Audience"
- Bullets: 1-2 bullet points

Slide 4: Business Problem
- Title: "Business Problem" or "Challenge"
- Bullets: 1-3 bullet points

Slide 5: Objective
- Title: "Objective" or "Goal"
- Body: Single paragraph

Slide 6: Strategy
- Title: "Strategy" or "Approach"
- Body: 1-2 sentences

Slide 7: Product Features
- Title: "Product Features" or "Key Features"
- Bullets: Exactly 3 bullet points
```

**Parsing Logic**:
1. Identify slides by title keywords (case-insensitive matching)
2. Extract text content from slide body
3. Convert bullet points to newline-separated strings (`\n`)
4. Extract first image found in deck as product image
5. Validate all required fields are present

#### Technical Architecture

##### New API Route

**`POST /api/briefs/upload`**

**Request**:
```typescript
// FormData with:
{
  file: File, // PPTX file
  roomId: string,
  playerId: string
}
```

**Response**:
```typescript
{
  success: boolean,
  brief?: CampaignBrief,
  error?: string,
  missingFields?: string[] // For partial uploads
}
```

**Processing Flow**:
1. Validate file type (PPTX only initially)
2. Parse PPTX using library (see below)
3. Extract fields using template matching
4. Extract first image and upload to Supabase Storage
5. Validate extracted brief with Zod schema
6. Insert/update `campaign_briefs` table
7. Broadcast `brief_updated` event to WebSocket
8. Return brief object for BriefEditor display

##### Document Parsing Libraries

**PPTX Options** (Node.js):
- **`pptxgenjs`** (read mode) - Popular, well-maintained
- **`node-office-parser`** - Comprehensive Office format support
- **`officegen`** - Alternative with good text extraction

**Recommended**: `pptxgenjs` for initial implementation

**Google Slides Support** (Future):
- Require users to export as PPTX first
- Or integrate Google Slides API (requires OAuth complexity)

##### File Upload & Storage

**Reuse Existing Infrastructure**:
- `lib/supabase-storage.ts` - Already has `uploadProductImage()` utility
- Supabase Storage bucket: `product-images`
- Upload route stub exists at `/api/storage/upload` (needs implementation)

**Image Extraction**:
1. Parse PPTX for embedded images
2. Extract first image as base64
3. Upload to Supabase Storage using existing utility
4. Store public URL in `campaign_briefs.cover_image_url`

##### Validation Schema

**Reuse Existing Zod Schema**:
```typescript
// From /app/api/briefs/[id]/route.ts
const briefSchema = z.object({
  productName: z.string().min(1).max(100),
  productCategory: z.string().min(1).max(100),
  mainPoint: z.string().min(1),
  audience: z.string().min(1),
  businessProblem: z.string().min(1),
  objective: z.string().min(1),
  strategy: z.string().min(1),
  productFeatures: z.string().min(1),
  coverImageUrl: z.string().optional(),
})
```

**Validation Approach**:
- **Option A**: Strict validation - Block upload if any required field is missing
- **Option B**: Partial upload - Allow upload, user fills in missing fields via BriefEditor
- **Recommended**: Option B (partial upload with manual completion)

##### WebSocket Broadcast

**After Upload**, broadcast to all players:
```typescript
await broadcastToRoom(roomCode, {
  type: "brief_updated",
  roomCode,
  briefId: brief.id,
  version: 0,
})
```

Uses existing broadcast helper from `lib/realtime-broadcast.ts`.

#### UI Integration

##### Briefing Page Modifications

**File**: `app/brief/[roomId]/page.tsx`

**New Components**:
1. **Upload Modal** - File picker and upload progress
2. **Upload Button** - Alongside "Generate Brief" button
3. **Parsing Feedback** - Show extracted fields for review
4. **Missing Fields Warning** - Indicate which fields need manual input

**Layout** (Host View):
```
┌─────────────────────────────────────────┐
│ Campaign Brief                          │
├─────────────────────────────────────────┤
│ [Generate Brief] [Upload Brief]         │
│                                         │
│ [BriefEditor Component]                 │
│ - Product Name: [extracted or empty]    │
│ - Category: [extracted or empty]        │
│ - Main Point: [extracted or empty]      │
│ - Audience: [extracted or empty]        │
│ - Business Problem: [extracted or empty]│
│ - Objective: [extracted or empty]       │
│ - Strategy: [extracted or empty]        │
│ - Product Features: [extracted or empty]│
│                                         │
│ [Lock Brief]                            │
└─────────────────────────────────────────┘
```

##### Upload Modal Component

**File**: `components/brief-upload-modal.tsx` (new)

**Features**:
- File drag-and-drop zone
- PPTX file type validation
- Upload progress indicator
- Parsing status feedback
- Error handling for invalid files

**States**:
1. **Idle** - Ready to accept file
2. **Uploading** - File transfer in progress
3. **Parsing** - Extracting fields from document
4. **Success** - Brief extracted, ready to review
5. **Error** - Parsing failed, show error message

#### Open Design Questions

**1. Document Format Priority**:
- **PPTX only** initially (simplest, most common)
- Add Google Slides later (requires API integration)
- PDF support (would require OCR, significantly more complex)

**2. Parsing Strategy**:
- **Template-based** (strict slide order/titles) - Recommended for MVP
- **Smart parsing** (AI/NLP identifies fields) - Future enhancement
- **Manual mapping** (user maps slides to fields) - Fallback option

**3. Validation Approach**:
- **Strict** - Block upload if any required field missing (prevents confusion)
- **Partial** - Allow upload, user completes missing fields (more flexible)
- **Recommended**: Partial with clear "missing fields" indicators

**4. Image Handling**:
- Extract first image automatically (recommended)
- User selects which image during upload (more control)
- Skip image extraction, allow upload without image (simplest)

**5. User Permissions**:
- Host only (matches AI generation) - Recommended
- Any player (more flexible, could cause conflicts)

**6. Template Distribution**:
- Provide downloadable PPTX template for users
- Document template structure in help/docs
- Include example brief PPTX in repo

#### Implementation Files

##### New Files to Create

**API Routes**:
- `app/api/briefs/upload/route.ts` - Upload and parse PPTX endpoint

**Utilities**:
- `lib/parse-pptx-brief.ts` - PPTX parsing and field extraction logic
- `lib/brief-validation.ts` - Shared validation helpers

**Components**:
- `components/brief-upload-modal.tsx` - Upload UI modal
- `components/brief-upload-button.tsx` - Trigger button component

**Assets**:
- `public/brief-template.pptx` - Example template for users

##### Files to Modify

**Existing Files**:
- `app/brief/[roomId]/page.tsx` - Add upload button and modal
- `lib/types.ts` - Add upload-specific types if needed
- `app/api/storage/upload/route.ts` - Implement file upload logic (currently stub)

**Documentation**:
- `README.md` - Document brief upload feature
- `CLAUDE.md` - Add brief upload to feature list

#### Package Dependencies

**New Packages**:
```json
{
  "pptxgenjs": "^3.12.0"
}
```

#### Implementation Timeline

**Estimated Effort**: 2-3 weeks

**Week 1**: Core Parsing & API
- Install PPTX parsing library
- Implement `/api/briefs/upload` route
- Build `parse-pptx-brief.ts` utility
- Test with sample PPTX files

**Week 2**: UI Integration
- Create upload modal component
- Add upload button to briefing page
- Implement error handling and feedback
- Test end-to-end upload flow

**Week 3**: Polish & Documentation
- Create example PPTX template
- Add user documentation
- Handle edge cases (malformed files, missing fields)
- Multi-player testing

#### Success Metrics

**Adoption**:
- % of games using upload vs. AI generation
- Upload success rate (valid files parsed correctly)

**Quality**:
- % of uploads requiring manual field completion
- User satisfaction with extracted briefs

**Technical**:
- Parsing accuracy across different PPTX formats
- Upload/parsing performance (<5 seconds target)

#### Risk Mitigation

**1. PPTX Format Variations**:
- Different PowerPoint versions create different XML structures
- Mitigation: Test with multiple PowerPoint versions (2016, 2019, 365, Mac)
- Fallback: Clear error messages, manual field entry

**2. Slide Structure Variations**:
- Users may not follow template exactly
- Mitigation: Fuzzy title matching (case-insensitive, keyword-based)
- Fallback: Partial extraction with manual completion

**3. Large File Uploads**:
- PPTX files with many images could be large
- Mitigation: File size limit (10MB max recommended)
- Upload progress indicator

**4. Bullet Point Formatting**:
- Nested bullets, inconsistent spacing
- Mitigation: Flatten nested bullets, normalize whitespace
- Validation: Ensure newline separation for UI rendering

**5. Missing Images**:
- Not all briefs will have product images
- Mitigation: Make image extraction optional
- Fallback: Use existing diagonal stripe placeholder

#### Future Enhancements

**Post-MVP Improvements**:
- **Google Slides API Integration** - Direct import from Google Slides URL
- **Smart Parsing** - AI-powered field identification (less reliant on template)
- **PDF Support** - Parse PDF briefs using OCR
- **Collaborative Upload** - Multiple players contribute to brief sections
- **Brief Library** - Save/reuse uploaded briefs across games
- **Template Variants** - Support multiple template structures

---

### Studio Mode: Async Creative Collaboration

**Status**: Design Complete - Not Yet Implemented
**Target Users**: Creative teams, ad agencies, remote collaborators, distributed teams
**Goal**: Transform Concept Karaoke into a turn-based, email-driven creative routing system for async collaboration

**Date Designed**: November 2025

#### Core Concept

Studio Mode pivots from "party game" to **professional creative collaboration tool**. Instead of synchronous 60-second rounds, campaigns route through team members asynchronously via email notifications (similar to conquerclub.com turn-based model). Each player contributes 3 concepts per phase when it's their turn, creating a low-pressure ideation environment that mirrors real agency creative routes.

**Key Philosophy**:
- **Exquisite corpse building** - Core experience preserved from Live Mode
- **No bad ideas** - Low-pressure ideation, getting "badlobs" out
- **Async flexibility** - Work on your schedule, no strict timing except team courtesy
- **Team collaboration** - Designed for real briefs and real creative teams

#### Game Flow

**Phase 1: Setup**
- Create Studio game with name and settings
- Invite 3-7 players via email
- Configure contributions per phase (default: 3, range: 1-5)
- Set reminder timing (default: 24 hours)

**Phase 2: Briefing**
- Async collaborative brief editing (reuses existing `BriefEditor`)
- Host locks brief to advance to routing
- Email notifications when brief is ready

**Phase 3: Routing (Turn-Based Creation)**

Each player receives email notification when it's their turn. They contribute 3 responses for 3 different campaigns, then pass to next player.

**Round 1 - Big Idea** (Enhanced):
- Input: Campaign brief
- Create: 3 big ideas with:
  - Concept description (2-3 sentences)
  - Reference links with URL previews
  - Notes for next person (context/intent)
- Time: Work at your pace, no hard deadline
- Urgency: Team is waiting on you!

**Round 2 - Visual**:
- Input: Brief + 3 Big Ideas (with references)
- Create: 3 visuals responding to each idea
  - Mobile-optimized drawing tools
  - AI image generation option
  - Canvas annotations
- Time: ~10-15 minutes of drawing
- Pass to: Next player

**Round 3 - Headline**:
- Input: Brief + Big Ideas + Visuals
- Create: 3 headlines (text on canvas)
- Time: Quick text input
- Pass to: Next player

**Round 4 - Pitch/Rationale**:
- Input: Complete campaigns (Big Idea + Visual + Headline)
- Create: 3 pitch notes (50-100 words each)
  - Why this works
  - Key insight
  - How it ladders to brief
- Pass to: Gallery view

**Phase 4: Gallery**
- All 12 completed campaigns visible (4 players × 3 campaigns)
- Emoji reactions on each campaign
- Text comments and threaded discussions
- Export as PDF or shareable web link
- Optional: Schedule live review session

**Phase 5: Archive**
- Game marked complete
- Remains in dashboard for reference
- Can be reopened for additional comments

#### Campaign Structure

- **Volume**: 4 players × 3 contributions per phase = 12 unique campaigns
- **Lineage**: Each campaign tracked through all contributors
  - Example: "Brief → P1's idea → P2's visual → P3's headline → P4's pitch"
- **Rotation**: Each player works on 3 different campaigns per phase (not the same 3)
- **No overwrites**: First submission wins (same as Live Mode)

#### Turn Notification System

**Email Template**:
```
Subject: Your turn in [Room Name]! 🎨

Hi [Player Name],

It's your turn to contribute [Visual/Headline/Pitch] in [Room Name].

You have 3 campaigns waiting for your input.

[View Brief] [Contribute Now]

Your team is counting on you! ⏱️

Need help? Reply to this email.
```

**Notification Types**:
1. **Your Turn** - When campaigns arrive at your desk
2. **Reminder** - After 24 hours if not completed (configurable)
3. **Phase Complete** - When all players finish a round
4. **Gallery Ready** - When all 4 rounds complete
5. **New Comment** - When someone comments on a campaign

#### No-Show & Player Management

**If player doesn't respond**:
- After 24hrs: Automated reminder email
- After 3 days: Notification to other players ("P2 is holding up the route")
- Host options:
  - **Send manual reminder** (nudge button)
  - **Skip their turn** (mark campaigns as "incomplete")
  - **Add their contribution** (cover for them)
  - **Replace player** (invite someone new via email)

**Replacement Flow**:
- New player sees context: "Taking over for P2 in Visual Phase"
- Can view all prior work in the game
- Contributes their pieces from current phase forward
- Game continues seamlessly

#### Technical Architecture

##### Database Schema Changes

**New Tables**:

```sql
-- Game mode differentiation
ALTER TABLE game_rooms
  ADD COLUMN game_mode TEXT DEFAULT 'live'
  CHECK (game_mode IN ('live', 'studio'));
ALTER TABLE game_rooms
  ADD COLUMN contributions_per_phase INTEGER DEFAULT 3;

-- Turn queue management
CREATE TABLE turn_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
  current_phase TEXT NOT NULL,
  current_player_id UUID REFERENCES players(id),
  deadline TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign contributions (3 per player per phase)
CREATE TABLE campaign_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
  campaign_index INTEGER NOT NULL, -- 0, 1, 2
  phase TEXT NOT NULL CHECK (phase IN ('big_idea', 'visual', 'headline', 'pitch')),
  player_id UUID REFERENCES players(id),
  content JSONB NOT NULL, -- {text, images, references, notes}
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, campaign_index, phase)
);

-- Campaign comments/reactions
CREATE TABLE campaign_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
  campaign_index INTEGER NOT NULL,
  player_id UUID REFERENCES players(id),
  comment_type TEXT CHECK (comment_type IN ('text', 'emoji')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

##### New API Routes

**Studio Game Management**:
- `POST /api/studio/create` - Create studio game, send email invites
- `POST /api/studio/[id]/invite` - Invite additional players
- `GET /api/studio/[id]/turn` - Get current turn info
- `POST /api/studio/[id]/contribute` - Submit 3 contributions
- `POST /api/studio/[id]/skip-player` - Skip inactive player
- `POST /api/studio/[id]/replace-player` - Replace with new email

**Gallery & Interaction**:
- `GET /api/studio/[roomId]/campaigns` - Fetch all campaigns with reactions/comments
- `POST /api/studio/campaigns/[index]/react` - Add emoji reaction
- `POST /api/studio/campaigns/[index]/comment` - Add text comment
- `GET /api/studio/[roomId]/export` - Generate PDF export

##### New Files to Create

**Core Logic**:
- `lib/studio-state-machine.ts` - Turn-based state management
- `lib/studio-notifications.ts` - Email notification handlers
- `lib/email.ts` - Email service utilities (Resend integration)

**Pages**:
- `app/studio/create/page.tsx` - Studio game creation
- `app/studio/[roomId]/briefing/page.tsx` - Async briefing
- `app/studio/[roomId]/contribute/page.tsx` - Turn workspace
- `app/studio/[roomId]/gallery/page.tsx` - Campaign gallery
- `app/studio/dashboard/page.tsx` - User dashboard

**Components**:
- `components/studio-contribution-input.tsx` - Phase-specific inputs
- `components/studio-big-idea-input.tsx` - Text + URL links + notes
- `components/studio-visual-input.tsx` - Mobile canvas + AI gen
- `components/studio-headline-input.tsx` - Text on canvas
- `components/studio-pitch-input.tsx` - Textarea with word count
- `components/campaign-card.tsx` - Gallery campaign display
- `components/campaign-reactions.tsx` - Emoji reactions UI
- `components/campaign-comments.tsx` - Comment threads

##### Files to Modify

- `lib/types.ts` - Add Studio-specific types
- `lib/database.types.ts` - Regenerate with new tables
- `lib/env.ts` - Add email service variables
- `components/canvas.tsx` - Mobile optimization
- `app/page.tsx` - Add "Create Studio Game" option
- `lib/routes.ts` - Add studio route helpers

#### UI Components

**Turn Workspace Layout** (`/studio/[roomId]/contribute`):

```
┌─────────────────────────────────────────┐
│ Studio: [Room Name]                     │
│ Phase: Visual (Round 2 of 4)            │
├─────────────────────────────────────────┤
│ [View Brief]                            │
├─────────────────────────────────────────┤
│ Campaign 1                              │
│ ┌───────────────────────────────────┐   │
│ │ Previous work:                    │   │
│ │ Big Idea: "Smart home for pets"  │   │
│ │ References: [link previews]       │   │
│ │                                   │   │
│ │ Your visual:                      │   │
│ │ [Mobile-optimized canvas]         │   │
│ │ [AI Generate] [Draw] [Clear]      │   │
│ └───────────────────────────────────┘   │
│                                         │
│ Campaign 2 [Similar structure]          │
│ Campaign 3 [Similar structure]          │
├─────────────────────────────────────────┤
│ [Submit & Pass to Next Player]          │
└─────────────────────────────────────────┘
```

**Gallery View** (`/studio/[roomId]/gallery`):

```
┌─────────────────────────────────────────┐
│ Studio Gallery: [Room Name]             │
│ [View Brief] [Export PDF] [Share Link]  │
├─────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
│ │ C1  │ │ C2  │ │ C3  │ │ C4  │ ...    │
│ │ 👍 3│ │ 💡 5│ │ ❤️ 2│ │ 🔥 4│        │
│ │ 💬 2│ │ 💬 1│ │ 💬 3│ │ 💬 0│        │
│ └─────┘ └─────┘ └─────┘ └─────┘        │
└─────────────────────────────────────────┘

[Click campaign to expand detail view]

┌─────────────────────────────────────────┐
│ Campaign 3 Detail View                  │
├─────────────────────────────────────────┤
│ Big Idea: [Content + ref links]         │
│ Created by: P1 (2 days ago)             │
│                                         │
│ Visual: [Canvas render]                 │
│ Created by: P2 (1 day ago)              │
│                                         │
│ Headline: [Text on canvas]              │
│ Created by: P3 (12 hours ago)           │
│                                         │
│ Pitch: [Rationale text]                 │
│ Created by: P4 (3 hours ago)            │
├─────────────────────────────────────────┤
│ 💡 🔥 ❤️ 👍 👎 [Quick reactions]         │
├─────────────────────────────────────────┤
│ Comments (3)                            │
│ ┌─────────────────────────────────────┐ │
│ │ P1: "Love the visual direction!"    │ │
│ │ P2: "This solves the brief perfectly"│ │
│ │ P4: "Strong concept, needs polish"  │ │
│ └─────────────────────────────────────┘ │
│ [Add comment...]                        │
└─────────────────────────────────────────┘
```

#### Mobile Optimization

**Drawing Tools Adaptation**:
- Touch-based drawing with simplified tool palette
- Larger brush sizes optimized for finger drawing
- Quick color selection (5-6 core colors)
- Prominent undo/clear buttons
- AI image generation as easy alternative

**Responsive Design**:
- All contribution inputs work on mobile browsers
- Email links open mobile-optimized workspace
- Gallery scrolls horizontally on phone
- Campaign details stack vertically

#### Authentication System

**Required for Email Notifications**:
- Supabase Auth (email/password)
- Login/signup pages
- Password reset flow
- Link localStorage playerId to auth userId
- Protected routes middleware

**User Experience**:
- First-time users sign up via email invite
- Returning users log in to access dashboard
- Dashboard shows active studio games
- "Your Turn" indicator for pending work

#### Email Service Integration

**Provider**: Resend (or SendGrid)

**Environment Variables**:
```
RESEND_API_KEY=
STUDIO_REMINDER_HOURS=24
STUDIO_AUTO_SKIP_DAYS=7
```

**Email Templates**:
1. **Turn Notification** - Action required
2. **Reminder** - Follow-up after 24hrs
3. **Phase Complete** - Progress update
4. **Gallery Ready** - Final notification
5. **Comment Notification** - Engagement alert

#### Implementation Timeline (12 Weeks)

**Week 1-2: Foundation & Authentication**
- Supabase Auth setup
- Database schema extensions
- Email service integration (Resend)
- Email templates

**Week 3: Studio Game Creation**
- Studio game type selection UI
- Studio settings form
- Email invite system
- Studio state machine logic

**Week 4: Briefing Phase**
- Async briefing UI (reuse BriefEditor)
- Host lock brief control
- Email notifications

**Week 5-6: Turn-Based Routing**
- Turn workspace UI
- Phase-specific input components
- Mobile-optimized drawing tools
- AI image generation integration
- Turn advancement API logic

**Week 7: Gallery & Review**
- Gallery view UI
- Campaign detail modals
- Emoji reactions system
- Comment threads
- PDF export functionality

**Week 8: Email & Queue Management**
- Email notification system
- Turn queue management
- Reminder automation
- Player skip/replace flows

**Week 9-10: Polish & Optional Features**
- Studio dashboard
- Settings panel
- Optional live review scheduling
- Analytics tracking

**Week 11-12: Testing & Launch**
- End-to-end testing with real teams
- Email deliverability testing
- Mobile responsiveness validation
- Beta launch with 5-10 teams
- Public launch

**MVP Target**: Week 8 (without optional features)
**Full Launch Target**: Week 12

#### Key Design Decisions

1. **3 Contributions Per Phase** - Configurable (1-5) but defaults to 3
   - Balances creative output with time commitment
   - 3 drawings = ~10-15 minutes (heaviest lift)

2. **Enhanced Big Idea Phase** - More detail than Live Mode
   - Reference links with URL previews
   - Notes for next person (context/intent)
   - Evens out effort across phases

3. **Skip Presentations Entirely** - No live performance layer
   - Biggest departure from Live Mode
   - Focus on collaborative creation, not performance
   - Optional: Schedule separate live review session

4. **Email-Only Notifications** - No mobile app (Phase 1)
   - Simpler implementation
   - Requires auth/login system
   - Mobile-responsive web interface

5. **Emoji + Text Comments** - No collaborative editing
   - Reactions for quick feedback
   - Comments for discussion
   - Campaigns remain as created (no post-edits)

#### Success Metrics

**Engagement**:
- Game completion rate: Target >70%
- Average turn completion time: Target <48 hours
- Player retention: Target >80% complete all phases
- Gallery engagement: Target >5 comments per game

**Quality**:
- Email open rates: Target >60%
- Mobile completion rate: Target >40%
- Campaign quality (subjective team feedback)

**Growth**:
- Studio games created per week
- Average team size
- Repeat usage (same team, multiple games)

#### Risk Mitigation

1. **Email Deliverability**
   - Test with multiple email providers
   - Set up DKIM/SPF records
   - Monitor bounce rates

2. **Player Dropouts**
   - Make skip/replace flows intuitive
   - Clear communication about expectations
   - Host tools to manage inactive players

3. **Mobile Drawing Frustration**
   - Provide AI generation as easy alternative
   - Simplify touch controls
   - Set expectations in instructions

4. **Notification Fatigue**
   - Allow frequency preferences
   - Batch notifications intelligently
   - Make emails valuable, not spammy

5. **Scope Creep**
   - Launch Week 8 MVP first
   - Gather feedback before adding features
   - Optional features can wait for v2

#### Key Differences from Live Mode

| Aspect | Live Mode | Studio Mode |
|--------|-----------|-------------|
| **Timing** | Synchronous 60s rounds | Async turn-based (days) |
| **Players** | All online simultaneously | Work independently |
| **Contributions** | 1 per phase | 3 per phase (configurable) |
| **Urgency** | Timer pressure | Team courtesy pressure |
| **Presentation** | Live improvised pitches | Skip presentations entirely |
| **Notifications** | In-app only | Email-driven workflow |
| **Auth** | Anonymous (localStorage) | Required (email accounts) |
| **Gallery** | Simple results screen | Rich comments/reactions |
| **Use Case** | Party game, live sessions | Professional collaboration tool |
| **Game Length** | 15-20 minutes | 4-7 days typical |
| **Campaign Volume** | 4 campaigns (1 per player) | 12 campaigns (3 per player) |

#### Technical Dependencies

**New Packages**:
```json
{
  "resend": "^3.0.0",
  "@supabase/auth-helpers-nextjs": "latest",
  "react-medium-image-zoom": "^5.0.0",
  "html2canvas": "^1.4.1",
  "jspdf": "^2.5.0"
}
```

**Environment Variables**:
```
NEXT_PUBLIC_SUPABASE_JWT_SECRET=
RESEND_API_KEY=
STUDIO_REMINDER_HOURS=24
STUDIO_AUTO_SKIP_DAYS=7
```

#### Future Enhancements (Post-Launch)

- **Mobile App** - Native iOS/Android with push notifications
- **Slack Integration** - Notifications via Slack instead of email
- **Calendar Integration** - Schedule live review sessions automatically
- **Advanced Analytics** - Team creativity metrics, response time tracking
- **AI Insights** - Suggest improvements to campaigns using AI
- **Template Briefs** - Pre-made briefs for common categories
- **Team Workspaces** - Persistent team accounts with game history
- **Voting Phase** - Optional voting after gallery review
- **Video Pitches** - Record pitch videos for campaigns
- **Export Options** - PowerPoint, Keynote, Figma export

---

## Phase 10: Content Marketing & Growth - Implementation Plan

**Status**: Not Yet Started  
**Target**: Drive organic traffic and build user base through SEO, content, and viral features  
**Priority**: High (prerequisite for monetization)

### Overview

The codebase is production-ready but has zero marketing infrastructure. This phase focuses on making Concept Karaoke discoverable, shareable, and viral through foundational SEO, social features, and content marketing.

For complete details on all 4 tiers, success metrics, and technical implementation, see the full Phase 10 plan above (lines 1220-1857).

### Quick Summary

**Tier 1: Foundation (Week 1-2)** - SEO & Social Basics
- SEO metadata (OG tags, Twitter cards, sitemap, robots.txt)
- Social sharing (share buttons, dynamic OG images, public results)
- Analytics (Vercel Analytics event tracking)
- Marketing pages (about, FAQ, how-to-play)

**Tier 2: Content Engine (Month 1-2)** - Blog & SEO
- Blog system with MDX
- 10 SEO-optimized articles
- Long-tail keyword targeting

**Tier 3: Distribution (Month 2-4)** - Scale
- Product Hunt launch
- Social media strategy
- Community features (gallery, leaderboard)
- Partnerships (YouTubers, podcasts, universities)

**Tier 4: Advanced (Month 4+)** - Amplification
- Viral mechanics
- Interactive tools
- Paid acquisition

**Expected Traffic Growth**:
- Month 1: 50-100 organic visitors
- Month 3: 100-500 organic visitors
- Month 6: 500-2,000 organic visitors
- Month 12: 2,000-10,000 organic visitors

---

