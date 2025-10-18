Concept Karaoke — Technical Design Doc (Next.js + Supabase + Vercel)

This document turns the PRD into an explicit build plan an AI (or a human) can follow step‑by‑step. Keep everything minimal and shippable; favor simple choices.

⸻

0) Tech Stack
	•	Frontend: Next.js (App Router) + React + TypeScript + Shadcn UI
	•	Auth/DB/Realtime/Storage: Supabase (Postgres + Auth + Realtime + Storage)
	•	Hosting: Vercel (frontend + Next.js API routes)
	•	Testing: Jest + React Testing Library (unit), Playwright (e2e)

⸻

1) Product Assumptions (from PRD → MVP choices)
	•	Players: 3–8 per room (host creates, others join via 6‑char code).
	•	Phases: Lobby → Brief (gen & edit) → Creation Rounds (Big Idea → Visual → Headline → Mantra, each 60s) → Pitch → Voting → Results.
	•	Realtime via Supabase Realtime channels (room + adlob channels) with server‑authoritative timers stored in DB.
	•	Image handling: Uploads to Supabase Storage (AI image gen can be stubbed first; optional later).

⸻

2) File / Folder Structure

/ (repo root)
├─ app/
│  ├─ layout.tsx
│  ├─ globals.css
│  ├─ page.tsx                      # Home (Create / Join)
│  ├─ join/
│  │  └─ page.tsx                   # Join by code
│  ├─ lobby/[roomId]/
│  │  └─ page.tsx                   # Lobby screen
│  ├─ brief/[roomId]/
│  │  └─ page.tsx                   # Brief generation & edit
│  ├─ create/[roomId]/
│  │  └─ page.tsx                   # Creation rounds (Big Idea, Visual, Headline, Mantra)
│  ├─ pitch/[roomId]/
│  │  └─ page.tsx                   # Pitch flow
│  ├─ vote/[roomId]/
│  │  └─ page.tsx                   # Voting grid
│  ├─ results/[roomId]/
│  │  └─ page.tsx                   # Results & winner
│  ├─ api/
│  │  ├─ games/
│  │  │  ├─ create/route.ts         # POST create game (requires paid host)
│  │  │  ├─ join/route.ts           # POST join with code
│  │  │  ├─ start/route.ts          # POST start game (host only)
│  │  │  └─ [id]/route.ts           # GET game state
│  │  ├─ briefs/
│  │  │  ├─ generate/route.ts       # POST AI generate brief (optional V1: stub)
│  │  │  └─ [id]/route.ts           # PUT update brief
│  │  ├─ adlobs/
│  │  │  ├─ create/route.ts         # POST create adlob
│  │  │  ├─ [id]/big-idea/route.ts  # PUT big idea
│  │  │  ├─ [id]/visual/route.ts    # PUT visual
│  │  │  ├─ [id]/headline/route.ts  # PUT headline
│  │  │  └─ [id]/mantra/route.ts    # PUT mantra
│  │  ├─ votes/
│  │  │  └─ route.ts                # POST vote
│  │  └─ storage/
│  │     └─ upload/route.ts         # POST signed upload (optional)
│  └─ (not-found.tsx | error.tsx)
├─ components/
│  ├─ Button.tsx
│  ├─ Input.tsx
│  ├─ Timer.tsx
│  ├─ Canvas.tsx                     # Excalidraw/tldraw wrapper (MVP: simple JSON canvas)
│  ├─ PlayerList.tsx
│  ├─ BriefEditor.tsx
│  ├─ PitchControls.tsx
│  ├─ VoteGrid.tsx
│  └─ Toast.tsx
├─ lib/
│  ├─ env.ts                        # runtime env parsing (zod)
│  ├─ database.types.ts             # Supabase generated types placeholder
│  ├─ supabase/
│  │  ├─ browser.ts                 # browser Supabase client
│  │  ├─ server.ts                  # server Supabase client
│  │  └─ admin.ts                   # service role Supabase client
│  ├─ auth.ts                       # helpers (getUser, requireUser)
│  ├─ db.ts                         # table constants + room code helper
│  ├─ realtime.ts                   # channel names + helpers
│  ├─ routes.ts                     # route/URL builders
│  ├─ validation.ts                 # zod schemas
│  └─ utils.ts                      # className merger
├─ prisma/ (not used; Supabase manages schema)
├─ scripts/
│  └─ seed.ts (optional)
├─ supabase/
│  ├─ migrations/                    # SQL for tables, RLS, policies
│  └─ storage-buckets.sql
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
├─ .env.example
├─ package.json
├─ tsconfig.json
├─ postcss.config.mjs
├─ components.json                 # Shadcn component registry config
└─ README.md


⸻

3) Pages & Buttons (by route)

3.1 / (Home)

UI: App name, short tagline, big primary buttons.
	•	Buttons:
	•	Create Game → starts auth if needed → calls /api/games/create → on success redirect to /lobby/[roomId] (created from API).
	•	Join Game (secondary) → takes to /join.

3.2 /join

UI: Input for 6‑char code, display name, emoji picker; Join.
	•	Buttons:
	•	Join → POST /api/games/join with code, name, emoji → push to /lobby/[roomId].

3.3 /lobby/[roomId]

UI: Shows code, players list (emoji+name), ready toggles; host has Start Game.
	•	Buttons:
	•	Ready/Unready (players)
	•	Start Game (host only; enabled

⸻

4) Game State Machine

	•	Canonical source of truth is the `game_rooms` row (`status`, `currentPhase`, `phaseStartTime`).
	•	State transitions are codified in `lib/game-state-machine.ts` (see `GAME_STATUS_TRANSITIONS` + `CREATION_PHASE_SEQUENCE`).
	•	Valid status order: lobby → briefing → creating → pitching → voting → results → lobby (for replay).
	•	While `status === "creating"` a creation phase must be active (`big_idea` → `visual` → `headline` → `mantra`); outside of creation the phase is `null`.
	•	All mutating endpoints must call `transitionGameState` / `advanceCreationPhase` so illegal jumps throw server-side errors instead of relying on client heuristics.
	•	Realtime broadcasts (`room:{roomId}`) fan out the updated snapshot; clients render strictly from that payload and avoid local branching logic.
