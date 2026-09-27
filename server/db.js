import Database from 'better-sqlite3';
import fs from 'node:fs';

fs.mkdirSync('data', { recursive: true });
const db = new Database('data/partytube.db');
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY, video_id TEXT NOT NULL, playing INTEGER NOT NULL DEFAULT 0,
  position REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
export default db;
