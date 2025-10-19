-- Realtime persistence tables

CREATE TABLE room_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_code VARCHAR(6) NOT NULL,
    version INTEGER NOT NULL,
    snapshot JSONB NOT NULL,
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE room_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_code VARCHAR(6) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    version INTEGER,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_room_snapshots_code_version ON room_snapshots(room_code, version DESC);
CREATE INDEX idx_room_events_code_created_at ON room_events(room_code, created_at DESC);

ALTER TABLE room_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on room_snapshots" ON room_snapshots FOR ALL USING (true);
CREATE POLICY "Allow all on room_events" ON room_events FOR ALL USING (true);
