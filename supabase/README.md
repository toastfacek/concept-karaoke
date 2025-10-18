# Supabase Database Setup

## Initial Setup

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and anon key

2. **Run Migrations**
   - Go to the SQL Editor in your Supabase dashboard
   - Copy the contents of `migrations/20250116_initial_schema.sql`
   - Execute the SQL

3. **Enable Realtime**
   - Go to Database > Replication in your Supabase dashboard
   - Enable replication for all tables:
     - `game_rooms`
     - `players`
     - `campaign_briefs`
     - `adlobs`
     - `votes`

4. **Set up Storage** (for Phase 2+)
   - Go to Storage in your Supabase dashboard
   - Create a new bucket called `adlob-images`
   - Set the bucket to public
   - Configure upload size limits (max 2MB per image)

## Database Schema

### Tables

#### game_rooms
Stores game session information.

**Columns:**
- `id` (UUID, PK): Unique game identifier
- `code` (VARCHAR(6), UNIQUE): 6-character join code
- `status` (VARCHAR): Current game status (lobby, briefing, creating, pitching, voting, results)
- `current_phase` (VARCHAR): Current creation phase (big_idea, visual, headline, mantra, pitch)
- `phase_start_time` (TIMESTAMP): When current phase started (for timer)
- `host_id` (UUID): Player ID of the game host
- `created_at` (TIMESTAMP): When game was created
- `updated_at` (TIMESTAMP): Last update time

#### players
Stores player information for each game.

**Columns:**
- `id` (UUID, PK): Unique player identifier
- `room_id` (UUID, FK): Reference to game_rooms
- `name` (VARCHAR(50)): Player display name
- `emoji` (VARCHAR(10)): Player's emoji avatar
- `is_ready` (BOOLEAN): Whether player is ready to proceed
- `is_host` (BOOLEAN): Whether player is the host
- `disconnected` (BOOLEAN): Whether player is currently disconnected
- `joined_at` (TIMESTAMP): When player joined

**Constraints:**
- UNIQUE (room_id, name): No duplicate names in same room
- ON DELETE CASCADE: Remove players when game deleted

#### campaign_briefs
Stores the advertising brief for each game.

**Columns:**
- `id` (UUID, PK): Unique brief identifier
- `room_id` (UUID, FK): Reference to game_rooms
- `product_name` (VARCHAR(100)): Fictional product name
- `product_category` (VARCHAR(100)): Type of product
- `business_problem` (TEXT): Challenge to solve
- `target_audience` (TEXT): Who the campaign targets
- `objective` (TEXT): What campaign should achieve
- `created_at` (TIMESTAMP): When brief was created
- `updated_at` (TIMESTAMP): Last update time

#### adlobs
Stores the ad campaign components (Ad-Like Objects).

**Columns:**
- `id` (UUID, PK): Unique AdLob identifier
- `room_id` (UUID, FK): Reference to game_rooms
- `brief_id` (UUID, FK): Reference to campaign_briefs
- **Big Idea:**
  - `big_idea_text` (TEXT): Campaign concept text
  - `big_idea_created_by` (UUID, FK): Reference to players
- **Visual:**
  - `visual_canvas_data` (JSONB): Serialized canvas state
  - `visual_image_urls` (TEXT[]): Array of image URLs
  - `visual_created_by` (UUID, FK): Reference to players
- **Headline:**
  - `headline_canvas_data` (JSONB): Canvas state with text styling
  - `headline_created_by` (UUID, FK): Reference to players
- **Mantra:**
  - `mantra_text` (TEXT): Sales pitch text
  - `mantra_created_by` (UUID, FK): Reference to players
- `assigned_pitcher` (UUID, FK): Player assigned to pitch this AdLob
- `vote_count` (INTEGER): Number of votes received
- `created_at` (TIMESTAMP): When AdLob was created
- `updated_at` (TIMESTAMP): Last update time

#### votes
Stores player votes for ad campaigns.

**Columns:**
- `id` (UUID, PK): Unique vote identifier
- `room_id` (UUID, FK): Reference to game_rooms
- `voter_id` (UUID, FK): Reference to players
- `adlob_id` (UUID, FK): Reference to adlobs
- `created_at` (TIMESTAMP): When vote was cast

**Constraints:**
- UNIQUE (voter_id, room_id): One vote per player per game

### Indexes

Performance indexes are created on:
- `game_rooms.code` (for fast game lookups)
- `players.room_id` (for player queries)
- `campaign_briefs.room_id`
- `adlobs.room_id`
- `votes.room_id`
- `votes.adlob_id`

### Row Level Security (RLS)

RLS is enabled on all tables with permissive policies for development. **Important:** In production, these should be tightened to:
- Only allow players to read/write data for games they're in
- Prevent vote manipulation
- Secure sensitive operations

### Realtime Subscriptions

The application uses Supabase Realtime for live updates. Subscribe to:

1. **Room Channel** (`room:{roomId}`)
   - Player joins/leaves
   - Game state changes
   - Phase transitions

2. **AdLob Updates** (individual adlobs)
   - Canvas changes
   - Completion status

## Helper Functions

The migration includes an `update_updated_at_column()` function that automatically updates `updated_at` timestamps on relevant tables.

## Future Enhancements

- Add indexes for common query patterns as they emerge
- Implement more granular RLS policies
- Add database functions for complex operations (e.g., vote tallying)
- Set up database backups
- Monitor query performance and optimize

## Troubleshooting

**Issue: Migration fails**
- Ensure UUID extension is available
- Check for existing tables with same names
- Verify you have proper permissions

**Issue: Realtime not working**
- Verify replication is enabled for all tables
- Check that RLS policies allow read access
- Confirm Supabase client is properly configured

**Issue: Slow queries**
- Review query patterns
- Check if indexes are being used (use EXPLAIN)
- Consider adding composite indexes for complex queries
