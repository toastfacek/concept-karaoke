-- Add persistent seating order for players
ALTER TABLE players
ADD COLUMN seat_index INTEGER;

WITH ordered AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY room_id ORDER BY joined_at, id) - 1 AS seat_index
  FROM players
)
UPDATE players
SET seat_index = ordered.seat_index
FROM ordered
WHERE ordered.id = players.id;

ALTER TABLE players
ALTER COLUMN seat_index SET NOT NULL;

ALTER TABLE players
ADD CONSTRAINT players_room_id_seat_index_unique UNIQUE (room_id, seat_index);
