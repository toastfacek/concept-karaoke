# Concept Karaoke - Screen Flow & Navigation

## Complete Screen List

### 1. Home Screen (`/`)
**Purpose**: Entry point for creating or joining games

**Buttons**:
- **Create Game** → `/lobby/[roomId]` (after payment check)
- **Join Game** → `/join`

**Features**:
- App title and tagline
- How to play instructions
- Retro cassette futurism design

---

### 2. Join Screen (`/join`)
**Purpose**: Join existing game with code

**Inputs**:
- Game code (6 characters)
- Player name
- Emoji selection (24 options)

**Buttons**:
- **Join Game** → `/lobby/[roomId]`
- **Back to Home** → `/`

**Validation**:
- Code must be 6 characters
- Name required
- Emoji auto-selected

---

### 3. Lobby Screen (`/lobby/[roomId]`)
**Purpose**: Wait for players and prepare to start

**Features**:
- Display game code with copy button
- Player list with emoji + name
- Ready status indicators
- Min 3 players, max 8 players

**Buttons** (Players):
- **Ready/Unready** (toggles ready status)

**Buttons** (Host):
- **Start Game** → `/brief/[roomId]` (enabled when all ready + min players)

**Real-time Updates**:
- Players joining/leaving
- Ready status changes

---

### 4. Brief Screen (`/brief/[roomId]`)
**Purpose**: Generate and edit campaign brief

**Features**:
- Two-column layout with responsive design
- **Left column**: Product image (with diagonal stripe placeholder)
- **Right column**: Product Name (large purple heading), Category, Main Point, Audience
- **Bottom grid** (2x2): Business Problem, Objective, Strategy, Product Features
- Editable brief fields (9 total):
  - Product Name
  - Product Category (read-only, from game settings)
  - Cover Image URL (optional)
  - Main Point (4-8 word campaign message)
  - Audience (1-2 bullet points, renders as list)
  - Business Problem (1-3 bullet points, renders as list)
  - Objective (single paragraph)
  - Strategy (1-2 sentences)
  - Product Features (3 bullet points, renders as list)
- AI generation via OpenAI API
- Inline editing with pencil icons
- Bullet points automatically parse newline-separated text (`\n`) into HTML lists

**Buttons**:
- **Regenerate Brief** (calls AI API for new brief)
- **Lock Brief** (marks player ready)

**Flow**:
- When all players lock → `/create/[roomId]`

---

### 5. Creation Screen (`/create/[roomId]`)
**Purpose**: Four 60-second creation rounds

**Phases**:

#### Round 1: Big Idea
- Text input for campaign concept (1-2 sentences)
- 60-second timer
- Auto-advance when time expires

#### Round 2: Visual
- Canvas with drawing tools
- Shows previous player's Big Idea
- AI image generation option (TODO: Gemini Nano Banana)
- 60-second timer

#### Round 3: Headline
- Canvas with text tools
- Shows Big Idea + Visual
- Add headline with styling
- 60-second timer

#### Round 4: Mantra
- View complete AdLob (read-only)
- Text input for campaign description (50-100 words)
- 60-second timer

**Features**:
- Phase indicator
- Timer display (changes color at 10s warning)
- Previous work display
- Auto-save on phase completion

**Buttons**:
- **Submit & Continue** (manual advance)

**Flow**:
- After Mantra phase → `/present/[roomId]`

---

### 6. Present Screen (`/present/[roomId]`)
**Purpose**: Players present campaigns they didn't create

**Features**:
- Shows presenter name + emoji
- Presentation counter (e.g., "Presentation 2 of 4")
- Two-step reveal:
  1. Mantra displayed full screen
  2. Complete campaign revealed

**Buttons** (Presenter):
- **Reveal Campaign** (shows full AdLob)
- **End Presentation** (advances to next)

**Buttons** (Spectators):
- None (watch mode)

**Flow**:
- Cycles through all AdLobs
- After last presentation → `/vote/[roomId]`

---

### 7. Voting Screen (`/vote/[roomId]`)
**Purpose**: Vote for best campaign

**Features**:
- Grid layout of all campaigns
- Shows Big Idea, Visual, and Mantra
- Presenter name displayed
- Cannot vote for own presentation
- Click to select, then cast vote

**Buttons**:
- **Cast Vote** (submits selection)

**Flow**:
- After all votes → `/results/[roomId]`

---

### 8. Results Screen (`/results/[roomId]`)
**Purpose**: Display winner and vote breakdown

**Features**:
- Winner announcement with trophy
- Winning campaign displayed
- Vote count for all campaigns
- Ranked list of all AdLobs

**Buttons**:
- **Back to Home** → `/`
- **Play Again** → `/lobby/[roomId]` (new game)

---

## Navigation Flow Diagram

\`\`\`
┌─────────────┐
│   Home (/)  │
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│ Join (/join)│   │Create Game  │
└──────┬──────┘   │(with payment)│
       │          └──────┬───────┘
       │                 │
       └────────┬────────┘
                ▼
        ┌───────────────┐
        │Lobby          │
        │(/lobby/[id])  │
        └───────┬───────┘
                ▼
        ┌───────────────┐
        │Brief          │
        │(/brief/[id])  │
        └───────┬───────┘
                ▼
        ┌───────────────┐
        │Create Rounds  │
        │(/create/[id]) │
        │               │
        │• Big Idea     │
        │• Visual       │
        │• Headline     │
        │• Mantra       │
        └───────┬───────┘
                ▼
        ┌───────────────┐
        │Present        │
        │(/present/[id])│
        └───────┬───────┘
                ▼
        ┌───────────────┐
        │Vote           │
        │(/vote/[id])   │
        └───────┬───────┘
                ▼
        ┌───────────────┐
        │Results        │
        │(/results/[id])│
        └───────┬───────┘
                │
                ├─────────────┐
                │             │
                ▼             ▼
            Home        Play Again
                        (new lobby)
\`\`\`

---

## API Integration Points

### Database TODOs (Supabase)
- `/api/games/create` - Create game room
- `/api/games/join` - Add player to room
- `/api/games/start` - Start game
- `/api/games/[id]` - Get game state
- `/api/briefs/generate` - AI brief generation
- `/api/briefs/[id]` - Update brief
- `/api/adlobs/create` - Initialize AdLobs
- `/api/adlobs/[id]/big-idea` - Save big idea
- `/api/adlobs/[id]/visual` - Save visual
- `/api/adlobs/[id]/headline` - Save headline
- `/api/adlobs/[id]/mantra` - Save mantra
- `/api/votes` - Record vote
- `/api/storage/upload` - Upload images


### Real-time TODOs (Supabase Realtime)
- Room channel: `room:{roomId}`
- AdLob channels: `adlob:{adlobId}`
- Events: player joins/leaves, phase transitions, timer sync

---

## Sample Data Available

All screens use sample data from `/lib/sample-data.ts`:
- `samplePlayers` - 4 players with emojis
- `sampleBrief` - SnoozeButton Pro campaign
- `sampleAdLobs` - Complete AdLob with all phases
- `sampleGameRoom` - Game state
- `emojis` - 24 emoji options

---

## Testing the Flow

1. Start at `/` (Home)
2. Click "Create Game" → Goes to `/lobby/ABC123`
3. View lobby with sample players
4. Click "Start Game" → Goes to `/brief/ABC123`
5. Edit brief, click "Lock Brief & Start" → Goes to `/create/ABC123`
6. Complete all 4 creation rounds → Goes to `/present/ABC123`
7. View presentations, click through → Goes to `/vote/ABC123`
8. Select and vote → Goes to `/results/ABC123`
9. Click "Play Again" or "Back to Home"

All screens are fully functional with placeholder data and clear TODO markers for database integration.
