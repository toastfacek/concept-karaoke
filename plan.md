# Concept Karaoke Delivery Plan

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

### Dependencies & Notes
- Supabase service role env vars must be populated locally for API route access.
- Canvas, AI, and pitch flows remain out of scope—stub any downstream calls.
- Ensure data model keeps future phases in mind (timestamps, foreign keys) but stay lean for Week 1–2 delivery.
