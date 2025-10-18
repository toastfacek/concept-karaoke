-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Game Rooms Table
CREATE TABLE game_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(6) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('lobby', 'briefing', 'creating', 'pitching', 'voting', 'results')),
    current_phase VARCHAR(20) CHECK (current_phase IN ('big_idea', 'visual', 'headline', 'mantra', 'pitch')),
    phase_start_time TIMESTAMP WITH TIME ZONE,
    host_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Players Table
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    emoji VARCHAR(10) NOT NULL,
    is_ready BOOLEAN DEFAULT FALSE,
    is_host BOOLEAN DEFAULT FALSE,
    disconnected BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, name)
);

-- Campaign Briefs Table
CREATE TABLE campaign_briefs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
    product_name VARCHAR(100) NOT NULL,
    product_category VARCHAR(100) NOT NULL,
    business_problem TEXT NOT NULL,
    target_audience TEXT NOT NULL,
    objective TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AdLobs Table
CREATE TABLE adlobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
    brief_id UUID REFERENCES campaign_briefs(id) ON DELETE CASCADE,

    -- Big Idea
    big_idea_text TEXT,
    big_idea_created_by UUID REFERENCES players(id) ON DELETE SET NULL,

    -- Visual
    visual_canvas_data JSONB,
    visual_image_urls TEXT[],
    visual_created_by UUID REFERENCES players(id) ON DELETE SET NULL,

    -- Headline
    headline_canvas_data JSONB,
    headline_created_by UUID REFERENCES players(id) ON DELETE SET NULL,

    -- Mantra
    mantra_text TEXT,
    mantra_created_by UUID REFERENCES players(id) ON DELETE SET NULL,

    -- Pitch Assignment
    assigned_pitcher UUID REFERENCES players(id) ON DELETE SET NULL,

    vote_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Votes Table
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
    voter_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    adlob_id UUID NOT NULL REFERENCES adlobs(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(voter_id, room_id)
);

-- Indexes for Performance
CREATE INDEX idx_game_rooms_code ON game_rooms(code);
CREATE INDEX idx_players_room_id ON players(room_id);
CREATE INDEX idx_campaign_briefs_room_id ON campaign_briefs(room_id);
CREATE INDEX idx_adlobs_room_id ON adlobs(room_id);
CREATE INDEX idx_votes_room_id ON votes(room_id);
CREATE INDEX idx_votes_adlob_id ON votes(adlob_id);

-- Updated At Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply Updated At Triggers
CREATE TRIGGER update_game_rooms_updated_at BEFORE UPDATE ON game_rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_briefs_updated_at BEFORE UPDATE ON campaign_briefs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_adlobs_updated_at BEFORE UPDATE ON adlobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE adlobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow all operations for now - can be tightened in production)
CREATE POLICY "Allow all on game_rooms" ON game_rooms FOR ALL USING (true);
CREATE POLICY "Allow all on players" ON players FOR ALL USING (true);
CREATE POLICY "Allow all on campaign_briefs" ON campaign_briefs FOR ALL USING (true);
CREATE POLICY "Allow all on adlobs" ON adlobs FOR ALL USING (true);
CREATE POLICY "Allow all on votes" ON votes FOR ALL USING (true);
