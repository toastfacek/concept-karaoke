# Concept Karaoke

The Exquisite Corpse Ad Game - A multiplayer web game where players collaboratively create ad campaigns and pitch them improvisationally.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript, Shadcn UI
- **Design**: Cassette Futurism + Classic Ogilvy Advertising aesthetic
- **Database**: Supabase (PostgreSQL + Storage)
- **Realtime**: Custom WebSocket server (Node.js) + Supabase Realtime
- **AI**: OpenAI (brief generation) + Nano Banana (image generation)
- **Hosting**: Vercel (frontend) + Railway (realtime server)

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
├── canvas.tsx                 # Drawing canvas (Excalidraw integration)
├── brief-editor.tsx           # Editable campaign brief (two-column layout)
├── brief-view-dialog.tsx      # Read-only brief modal dialog
└── game-icons.tsx             # 30+ cartoony game icons

lib/
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
# Install dependencies
pnpm install

# Start the realtime server (Terminal 1)
cd services/realtime-server
pnpm dev

# Start the Next.js app (Terminal 2)
pnpm dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

**Required for Next.js** (`.env`):
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `NEXT_PUBLIC_REALTIME_URL` - WebSocket server URL (default: `http://localhost:8080`)
- `REALTIME_SHARED_SECRET` - JWT secret for realtime tokens
- `REALTIME_BROADCAST_SECRET` - Shared secret for API → WS communication
- `OPENAI_API_KEY` - (Optional) For AI brief generation

**Required for Realtime Server** (`services/realtime-server/.env`):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `REALTIME_SHARED_SECRET` - JWT secret (must match Next.js)
- `REALTIME_BROADCAST_SECRET` - Shared secret (must match Next.js)

### Useful Scripts

- `pnpm lint` — run ESLint across the project (foundation rules, warnings allowed for stubs)
- `pnpm exec tsc --noEmit` — TypeScript project-wide type check

## Current Status

✅ **Complete**:
- All UI screens with cassette futurism design
- Game state machine with phase transitions
- Supabase database integration
- **Single source of truth realtime architecture**
- **WebSocket server with authorization**
- **API → Database → WebSocket broadcast pattern**
- Deterministic presenter assignment
- Overwrite protection for concurrent edits
- Sample data for testing

🚧 **In Progress**:
- Canvas integration (Excalidraw/tldraw)
- AI brief generation optimization
- Image generation for visual phase

## Realtime Architecture

The app uses a **single source of truth pattern**:

1. Client sends HTTP request to API route
2. API route updates database (Supabase)
3. API route broadcasts event to WebSocket server
4. WebSocket server broadcasts to all clients in room
5. Clients receive instant updates

**Key Features**:
- Eliminates dual-write race conditions
- Guaranteed consistency between DB and WebSocket
- Server-side authorization for all WebSocket events
- Clients cannot spoof player IDs or manipulate other players

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation.

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
- Pre-filled campaign brief (9 fields with newline-separated bullets)
- Mock AdLobs and votes

All screens are functional and demonstrate the complete user experience.

### Campaign Brief Structure

The campaign brief contains 9 fields:
- **Product Name** - Main product name
- **Product Category** - Category from game settings
- **Cover Image URL** - Optional product image
- **Main Point** - 4-8 word campaign message
- **Audience** - 1-2 bullet points (newline-separated)
- **Business Problem** - 1-3 bullet points (newline-separated)
- **Objective** - Single paragraph
- **Strategy** - 1-2 sentences
- **Product Features** - 3 bullet points (newline-separated)

Bullet fields use `\n` to separate individual points, which are automatically rendered as proper HTML lists in the UI.
