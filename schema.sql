
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  photo TEXT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  winner_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  loser_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  score TEXT NOT NULL,
  date TEXT NULL,
  meta TEXT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_matches_winner ON matches(winner_id);
CREATE INDEX IF NOT EXISTS idx_matches_loser ON matches(loser_id);
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date);

-- Add photo column to existing players table if it doesn't exist (commented out as it already exists)
-- ALTER TABLE players ADD COLUMN photo TEXT NULL;
