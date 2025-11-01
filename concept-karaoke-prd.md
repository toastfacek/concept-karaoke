# Concept Karaoke - Product Requirements Document

> **⚠️ NOTE**: This is the original product requirements document. For current technical implementation, see [CLAUDE.md](CLAUDE.md) and [README.md](README.md).

## Overview

**Concept Karaoke** is a multiplayer web-based game that combines creative collaboration with improvisational performance. Players work together in an Exquisite Corpse style to build ad campaigns piece-by-piece, then pitch the final result without having seen the complete campaign beforehand.

**Target Session Length**: 15-20 minutes  
**Player Count**: 3-8 players (optimal: 4-8)  
**Platform**: Web-based

---

## Game Objectives

- Create a fun, creative social experience that works well over video calls
- Generate surprising and humorous ad campaigns through collaborative chaos
- Test players' improvisational pitching skills with minimal preparation
- Keep gameplay fast-paced with clear time constraints

---

## Core Game Loop

### Phase 1: Lobby & Setup
1. Players land on home screen
2. Option to "Create Game" or "Join Game" via 6-character code
3. Host creates game, receives shareable code
4. Players join lobby, each selects:
   - Display name
   - Emoji avatar
5. Lobby shows all connected players
6. Host clicks "Start Game" (minimum 3 players required)

### Phase 2: Brief Generation & Editing
1. AI generates a single creative brief with:
   - **Product Name**: Fictional brand name
   - **Product Category**: Type of product/service
   - **Business Problem**: What challenge needs solving
   - **Target Audience**: Who the campaign targets
   - **Objective**: What the campaign should achieve
2. Brief appears in templated format, editable by all players
3. Players can click "Regenerate Brief" for a new AI suggestion
4. Players can directly edit any field
5. When ready, any player can click "Lock Brief & Start"
6. All players must ready-up before proceeding

### Phase 3: The Exquisite Corpse Creation

Each phase has a **60-second timer**. All players work simultaneously on different AdLobs.

**Round 1: The Big Idea** (60 seconds)
- Each player receives a blank workspace
- Text input field: "What's the big idea for this campaign?"
- Players write 1-2 sentence campaign concept
- Timer expires → automatically advances

**Round 2: The Visual** (60 seconds)
- Each player receives the previous player's Big Idea
- 16:9 canvas workspace with tools:
  - Drawing tools (brush, shapes, eraser)
  - AI image generation (Gemini Nano Banana)
  - Ability to add, position, resize, and manipulate elements
  - Lightweight, Excalidraw/Figjam-style interface
- Players create visual representation of the campaign
- Timer expires → automatically advances

**Round 3: The Headline** (60 seconds)
- Each player receives Big Idea + Visual
- Text tool to add headline copy to the canvas
- Can adjust: placement, size, color, font
- Same canvas manipulation as Phase 2
- Timer expires → automatically advances

**Round 4: The Mantra** (60 seconds)
- Each player receives complete AdLob (Big Idea + Visual + Headline)
- **No editing allowed** - view-only for the AdLob
- Text input: "Write a sexy 1-3 sentence description that sells this campaign"
- 50-100 word limit
- Timer expires → automatically advances to Pitch Phase

### Phase 4: The Pitch

**Setup**:
- AdLobs are randomly assigned to players for pitching
- Assignment ensures no player pitches one they contributed to (when possible)
- Game enters presentation mode

**Pitch Sequence** (per AdLob):
1. Screen shows pitcher's name/emoji: "Up next: [Player Name] 🎤"
2. Mantra appears on screen (full screen text)
3. Pitcher reads Mantra aloud (they may or may not have written it)
4. Pitcher clicks "Reveal Campaign"
5. Full AdLob slide appears (16:9 canvas with all elements)
6. Pitcher improvises selling the campaign
7. Pitcher clicks "End Pitch" when complete
8. Next pitcher automatically queued

**After All Pitches**:
- All AdLobs displayed in grid view
- Each shows thumbnail with player name who pitched it
- Players vote for best campaign (cannot vote for own pitch)
- Votes are cast privately
- Results revealed publicly showing vote counts
- Winner announced 🏆

---

## Technical Specifications

### Tech Stack

**Frontend**:
- **Framework**: React 18+ with TypeScript
- **Styling**: Shadcn
- **Canvas Library**: 
  - Excalidraw libraries for drawing tools OR
  - Fabric.js for canvas manipulation
  - tldraw (open source alternative)
- **Real-time**: Supabase Realtime subscriptions
- **State Management**: Zustand or React Context
- **Routing**: React Router

**Backend**:
- **Database**: Supabase (PostgreSQL)
- **Real-time Sync**: Supabase Realtime
- **File Storage**: Supabase Storage (for generated images)
- **AI Integration**: 
  - OpenAI API for brief generation
  - Gemini Nano Banana for image generation

**Hosting & Deployment**:
- **Platform**: Vercel

### Data Models

```typescript
// Game Room
interface GameRoom {
  id: string;
  code: string; // 6-character join code
  status: 'lobby' | 'briefing' | 'creating' | 'pitching' | 'voting' | 'results';
  brief: CampaignBrief | null;
  currentPhase: 'big_idea' | 'visual' | 'headline' | 'mantra' | 'pitch';
  phaseStartTime: timestamp;
  createdAt: timestamp;
  hostId: string;
}

// Player
interface Player {
  id: string;
  roomId: string;
  name: string;
  emoji: string;
  isReady: boolean;
  isHost: boolean;
  joinedAt: timestamp;
}

// Campaign Brief
interface CampaignBrief {
  productName: string;
  productCategory: string;
  businessProblem: string;
  targetAudience: string;
  objective: string;
}

// AdLob (Ad-Like Object)
interface AdLob {
  id: string;
  roomId: string;
  briefId: string;
  bigIdea: {
    text: string;
    createdBy: string;
  };
  visual: {
    canvasData: object; // Serialized canvas state
    imageUrls: string[];
    createdBy: string;
  };
  headline: {
    canvasData: object; // Includes text styling/placement
    createdBy: string;
  };
  mantra: {
    text: string;
    createdBy: string;
  };
  assignedPitcher: string | null; // Player ID for pitch phase
  voteCount: number;
}

// Vote
interface Vote {
  id: string;
  roomId: string;
  voterId: string;
  adLobId: string;
  createdAt: timestamp;
}
```

### Real-time Requirements

**Supabase Realtime Channels**:
1. **Room Channel**: `room:{roomId}`
   - Player joins/leaves
   - Game state changes
   - Phase transitions
   - Timer synchronization

2. **AdLob Channels**: `adlob:{adlobId}`
   - Canvas updates (debounced)
   - Completion status
   - Pass-along triggers

**Event Types**:
- `player:joined`
- `player:left`
- `player:ready`
- `brief:updated`
- `brief:locked`
- `phase:started`
- `phase:completed`
- `adlob:passed`
- `pitch:started`
- `pitch:ended`
- `vote:cast`
- `game:completed`

### API Endpoints

**Game Management**:
- `POST /api/games/create` - Create new game room
- `POST /api/games/join` - Join game via code
- `POST /api/games/:id/start` - Start game
- `GET /api/games/:id` - Get game state

**Brief Generation**:
- `POST /api/briefs/generate` - Generate AI brief
- `PUT /api/briefs/:id` - Update brief

**AdLob Management**:
- `POST /api/adlobs` - Create AdLob
- `PUT /api/adlobs/:id/big-idea` - Update Big Idea
- `PUT /api/adlobs/:id/visual` - Update Visual
- `PUT /api/adlobs/:id/headline` - Update Headline
- `PUT /api/adlobs/:id/mantra` - Update Mantra
- `GET /api/adlobs/:id` - Get AdLob state

**Image Generation**:
- `POST /api/images/generate` - Generate image via Gemini

**Voting**:
- `POST /api/votes` - Cast vote
- `GET /api/games/:id/results` - Get vote results

### Canvas Implementation

**Core Features**:
- 16:9 aspect ratio (1920x1080 or 1600x900)
- Responsive scaling to fit viewport
- Pan and zoom capabilities
- Undo/redo functionality

**Drawing Tools**:
- Freehand drawing (pen tool)
- Basic shapes (rectangle, circle, line)
- Color picker
- Stroke width selector
- Eraser
- Clear canvas

**Text Tools** (Headline phase):
- Text input with formatting
- Font selection (3-5 options)
- Size adjustment
- Color picker
- Positioning/dragging

**Image Generation**:
- Text prompt input
- "Generate" button
- Loading state
- Generated image appears on canvas
- Can be repositioned/resized/deleted

**State Serialization**:
- Canvas state stored as JSON
- Images stored in Supabase Storage
- References to images in canvas JSON
- Efficient delta updates for real-time sync

### Timer System

- Server-managed timing
- `phaseStartTime` stored in database
- Clients calculate remaining time locally
- WebSocket broadcasts time warnings:
  - 30 seconds remaining
  - 10 seconds remaining
  - Time's up (auto-advance)
- Grace period handling for network issues

### Reconnection Logic

**Player Disconnects**:
1. Player marked as `disconnected` in database
2. Player slot held for 60 seconds
3. If reconnected within window:
   - Rejoin same room
   - Resume at current phase
   - Load current AdLob state
4. If timeout exceeded:
   - Player removed from game
   - Their in-progress work saved
   - Next player in rotation receives completed portion

**Host Disconnects**:
- Host privileges automatically transferred to next player
- New host can manage game state

### AI Integration

**Brief Generation** (OpenAI API):
```
Prompt Template:
"Generate a creative advertising brief for a fictional product. 
Include:
- Product Name: A catchy, memorable brand name
- Product Category: What type of product/service it is
- Business Problem: A challenge or need this product addresses
- Target Audience: Who would use this product
- Objective: What the ad campaign should achieve

Make it slightly absurd but grounded enough to be funny. 
Examples of good products: 'SnoozeButton Pro' (smart alarm), 
'Awkward Silence Filler' (conversation app)"

Response format: JSON
```

**Image Generation** (Gemini Nano Banana):
- User enters prompt
- Optional style parameters
- Generate 1:1 or 16:9 image
- Return URL for placement on canvas

### Performance Considerations

- Canvas state updates debounced (200ms)
- Image uploads optimized/compressed
- Lazy loading for pitch phase thumbnails
- Max file size limits (2MB per generated image)
- WebSocket message batching during creation phases

---

## User Interface Specifications

### Home Screen
- Large "Create Game" button
- "Join Game" input field + button
- Simple, clean design
- Brief explainer text: "The Exquisite Corpse ad game"

### Lobby Screen
- Game code displayed prominently (copyable)
- Player list with emoji + name
- Ready indicators
- "Start Game" button (host only, disabled until min players)
- "Leave Game" option

### Brief Screen
- Editable template form with fields
- "Regenerate Brief" button
- "Lock & Start" button
- Ready-up system (all players must ready)

### Creation Phase Screen
- Canvas workspace (majority of screen)
- Toolbar (left or top):
  - Drawing tools
  - Text tool (Headline phase only)
  - AI image prompt (Visual phase only)
- Timer display (prominent, top-right)
- Phase indicator: "Round 2: The Visual"
- Previous work display (read-only, collapsible sidebar)
- Auto-save indicator

### Pitch Phase Screen
- Large slide display (centered)
- Pitcher indicator: "[Emoji] [Name] is pitching"
- "Reveal Campaign" button (visible to pitcher only)
- "End Pitch" button (visible to pitcher only)
- Other players see spectator view

### Voting Screen
- Grid layout of all AdLobs
- Hover for larger preview
- Click to cast vote
- Vote confirmation
- Results display after all votes in

### Results Screen
- Winner announcement with confetti 🎉
- Vote breakdown per AdLob
- "Play Again" button (generates new game)
- "Leave Game" button

---

## Edge Cases & Error Handling

### Player Management
- **Player drops during creation**: Work is saved, next player gets partial AdLob
- **Player drops during pitch**: Skip to next pitcher automatically
- **All players drop**: Game room closes after 5 minutes of inactivity
- **Host leaves**: Transfer host to next player

### Network Issues
- **Slow connection**: Show loading states, extend timer slightly
- **Total disconnect**: 60-second reconnection window
- **Failed API calls**: Retry with exponential backoff, show error toast

### Content Issues
- **Empty submissions**: Allow progression but mark as "incomplete"
- **Offensive content**: No moderation (house rules), but store reports for future
- **AI generation fails**: Show error, allow retry or manual creation

### Timing Issues
- **Timer desync**: Server is source of truth, clients adjust
- **Player doesn't submit in time**: Auto-submit current state
- **Race conditions**: Use database transactions for vote counting

---

## Future Enhancements (V2+)

- Multiple rounds with cumulative scoring
- Spectator mode for additional viewers
- Replay/share completed campaigns
- Custom brief templates
- More drawing tools (layers, filters)
- Voice recording for pitches
- AI-assisted judging mode
- Tournament brackets
- Team mode (2v2 or 3v3)

---

## Success Metrics

- Average session completion rate
- Player retention (return visits)
- Average game duration
- Brief regeneration frequency
- Image generation usage vs. drawing
- Vote distribution (are winners clear or close?)
- Player feedback scores

---

## Development Phases

### Phase 1: MVP (Weeks 1-3)
- Basic lobby system
- Manual brief entry (no AI generation)
- Simple text-only phases (Big Idea, Headline, Mantra)
- Basic pitch flow
- Simple voting

### Phase 2: Canvas Implementation (Weeks 4-5)
- Drawing tools integration
- Canvas state management
- Image upload (not generation)
- Text styling for headlines

### Phase 3: AI Integration (Week 6)
- OpenAI API for brief generation
- Nano Banana for image generation
- Prompt engineering and refinement

### Phase 4: Polish & Testing (Weeks 7-8)
- Timer synchronization
- Reconnection logic
- UI/UX refinement
- Playtesting with real groups
- Bug fixes

### Phase 5: Launch Prep (Week 9)
- Performance optimization
- Railway deployment
- Error monitoring (Sentry?)
- Analytics integration
- Documentation

---

## Open Questions for Development

1. Should there be sound effects/music for phase transitions?
2. Do we need a tutorial/onboarding flow?
3. Should completed games be saved for replay/sharing?
4. What happens if someone joins mid-game?
5. Do we need rate limiting for AI generation to control costs?
6. Should there be a practice mode for solo testing?

---

## Appendix: Similar Games & Inspiration

- **Jackbox Games** (Party Pack series): UI patterns, hosting model
- **Gartic Phone**: Drawing pass-along mechanics
- **Casting Call**: Pitch performance gameplay
- **Figjam/Excalidraw**: Canvas collaboration UX
- **Cards Against Humanity**: Voting and judging flow
