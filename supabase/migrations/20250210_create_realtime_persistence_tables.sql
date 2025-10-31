-- Ensure uuid generation helpers are available (noop if already installed)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Realtime room snapshots capture the full authoritative state for recovery.
CREATE TABLE IF NOT EXISTS public.room_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_code VARCHAR(6) NOT NULL,
    version INTEGER NOT NULL,
    snapshot JSONB NOT NULL,
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Realtime room events capture append-only change history for auditing/debugging.
CREATE TABLE IF NOT EXISTS public.room_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_code VARCHAR(6) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    version INTEGER,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Helpful indexes for fetching the latest snapshot/event streams per room.
CREATE INDEX IF NOT EXISTS idx_room_snapshots_code_version
    ON public.room_snapshots (room_code, version DESC);

CREATE INDEX IF NOT EXISTS idx_room_events_code_created_at
    ON public.room_events (room_code, created_at DESC);

-- Supabase requires RLS enabled; keep permissive until auth rules are defined.
ALTER TABLE public.room_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'room_snapshots'
          AND policyname = 'Allow all on room_snapshots'
    ) THEN
        CREATE POLICY "Allow all on room_snapshots"
            ON public.room_snapshots
            FOR ALL
            USING (true);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'room_events'
          AND policyname = 'Allow all on room_events'
    ) THEN
        CREATE POLICY "Allow all on room_events"
            ON public.room_events
            FOR ALL
            USING (true);
    END IF;
END
$$;
