# Concept Karaoke

The Exquisite Corpse Ad Game - A multiplayer web game where players collaboratively create ad campaigns and pitch them improvisationally.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript, Shadcn UI
- **Design**: Cassette Futurism + Classic Ogilvy Advertising aesthetic
- **Database**: Supabase (PostgreSQL + Realtime + Storage) - TODO
- **AI**: Gemini API (brief generation) + Nano Banana (image generation) - TODO
- **Hosting**: Vercel

## Project Structure

\`\`\`
app/
├── page.tsx                    # Home screen
├── join/page.tsx              # Join game with code
├── lobby/[roomId]/page.tsx    # Lobby & player management
├── brief/[roomId]/page.tsx    # Brief generation & editing
├── create/[roomId]/page.tsx   # Creation rounds (4 phases)
├── pitch/[roomId]/page.tsx    # Pitch presentations
├── vote/[roomId]/page.tsx     # Voting screen
├── results/[roomId]/page.tsx  # Results & winner
└── api/                       # API routes (all with TODOs)

components/
├── ui/                        # shadcn components
├── timer.tsx                  # 60-second countdown
├── player-list.tsx            # Player display with emojis
├── canvas.tsx                 # Drawing canvas (TODO: integrate library)
├── brief-editor.tsx           # Campaign brief form
└── game-icons.tsx             # 30+ cartoony game icons

lib/
├── auth.ts                   # Supabase auth helpers
├── database.types.ts         # Supabase (placeholder) typed schema
├── db.ts                     # Table constants and code generator
├── env.ts                    # Runtime env parsing
├── realtime.ts               # Channel + event constants
├── game-state-machine.ts     # Shared state machine helpers
├── routes.ts                 # Route builders
├── sample-data.ts            # Mock data for testing
├── supabase/
│   ├── admin.ts              # Service role client
│   ├── browser.ts            # Browser client
│   └── server.ts             # Server client
├── types.ts                  # Domain interfaces
└── utils.ts                  # cn() helper
\`\`\`

## Game Flow

1. **Home** → Create or Join game
2. **Join** → Enter code, name, emoji
3. **Lobby** → Wait for players (3-8), ready up
4. **Brief** → Generate/edit campaign brief
5. **Create** → 4 rounds of 60s each:
   - Big Idea (text)
   - Visual (canvas)
   - Headline (canvas + text)
   - Mantra (text)
6. **Pitch** → Present campaigns (assigned randomly)
7. **Vote** → Vote for best campaign
8. **Results** → Winner announced

See `SCREEN_FLOW.md` for detailed navigation and features.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

Copy `.env.example` to `.env` and populate the Supabase keys. At a minimum, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` so the app can connect to Supabase locally.

### Useful Scripts

- `pnpm lint` — run ESLint across the project (foundation rules, warnings allowed for stubs)
- `pnpm exec tsc --noEmit` — TypeScript project-wide type check

## Current Status

All screens are built with:
- Clean, retro-styled layouts
- Sample data for testing
- Full navigation flow
- Placeholder components

### TODO: Database Integration

All API routes in `app/api/` have comprehensive TODO comments for:
- Supabase database operations
- Realtime subscriptions
- AI API integration
- File storage

### TODO: Canvas Integration

The Canvas component (`components/canvas.tsx`) needs integration with:
- Excalidraw, tldraw, or Fabric.js
- Drawing tools (pen, shapes, text)
- Image generation (Gemini Nano Banana)
- State serialization for database

### TODO: Real-time Features

Implement Supabase Realtime for:
- Player joins/leaves
- Phase transitions
- Timer synchronization
- Live canvas updates

## Design System

The app uses a cassette futurism aesthetic with:
- **Colors**: Electric Blue (#0047FF), Hot Pink (#FF006E), Highlight Yellow (#FFD60A)
- **Typography**: Space Grotesk (headings), IBM Plex Mono (code/labels)
- **Style**: Retro borders, hard shadows, bold type, scanline effects
- **Icons**: 30+ cartoony game icons in `components/game-icons.tsx`

## Testing

Navigate through the complete flow using sample data:
- Game code: `ABC123`
- 4 sample players with emojis
- Pre-filled campaign brief
- Mock AdLobs and votes

All screens are functional and demonstrate the complete user experience.
