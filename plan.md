# Concept Karaoke Delivery Plan

## Stack Alignment
- Next.js 15 (App Router), React, TypeScript
- Shadcn UI component library with its generated utility pipeline
- Supabase (Postgres, Auth, Realtime, Storage)
- Jest + React Testing Library (unit) and Playwright (e2e)

## Phased Roadmap
1. **Phase 0 – Foundations (Week 0–1)** ✅
   - [x] Confirm Shadcn UI setup, linting, formatting, and shared primitives (Button, Input, etc.).
   - [x] Ensure Supabase client utilities, env loading, and base layout are ready.
   - [x] Capture non-prod configuration (`.env.example`), README setup, and CI placeholder scripts.

2. **Phase 1 – Access & Permissions (Week 1–2)**
   - Implement Supabase Auth with host/guest roles and gating rules during game creation.

3. **Phase 2 – Lobby Loop (Week 2–3)**
   - Build create/join flows, lobby page UI, ready toggles, and realtime presence on `room:{roomId}`.
   - Enforce minimum player counts and host-only start controls.

4. **Phase 3 – Briefing & Realtime Core (Week 3–4)**
   - Deliver editable brief screen with manual inputs, regenerate stub, and broadcast updates to players.
   - Lock brief once all players ready; persist server-authoritative phase timing metadata.

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
