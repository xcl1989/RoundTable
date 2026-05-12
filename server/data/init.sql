-- Roundtable Database Initialization
-- This file contains the complete schema, including all migrations.
-- Run: sqlite3 server/data/roundtable.db < server/data/init.sql

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS discussions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    topic TEXT NOT NULL,
    question TEXT NOT NULL DEFAULT '',
    news_summary TEXT NOT NULL DEFAULT '',
    mode TEXT NOT NULL DEFAULT 'roundtable',
    total_rounds INTEGER NOT NULL DEFAULT 10,
    current_round INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    moderator_session_id TEXT NOT NULL DEFAULT '',
    moderator_model TEXT NOT NULL DEFAULT '',
    role_count INTEGER NOT NULL DEFAULT 4,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS discussion_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discussion_id INTEGER NOT NULL REFERENCES discussions(id),
    name TEXT NOT NULL,
    role_prompt TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '#1890ff',
    type TEXT NOT NULL DEFAULT 'ai',
    sort_order INTEGER NOT NULL DEFAULT 0,
    session_id TEXT NOT NULL DEFAULT '',
    wants_to_speak INTEGER NOT NULL DEFAULT 0,
    model_config TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS discussion_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discussion_id INTEGER NOT NULL REFERENCES discussions(id),
    participant_id INTEGER,
    round INTEGER NOT NULL DEFAULT 0,
    content TEXT NOT NULL DEFAULT '',
    reasoning TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'ai',
    model_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_participants_discussion ON discussion_participants(discussion_id);
CREATE INDEX IF NOT EXISTS idx_messages_discussion ON discussion_messages(discussion_id);
