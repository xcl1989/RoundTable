import Database from "better-sqlite3";
import { config } from "../config.js";
import { mkdirSync } from "fs";
import { dirname } from "path";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  mkdirSync(dirname(config.DB_PATH), { recursive: true });
  _db = new Database(config.DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
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
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_participants_discussion ON discussion_participants(discussion_id);
    CREATE INDEX IF NOT EXISTS idx_messages_discussion ON discussion_messages(discussion_id);
  `);

  const msgCols = db.prepare("PRAGMA table_info(discussion_messages)").all() as any[];
  if (!msgCols.some(c => c.name === "model_name")) {
    db.exec("ALTER TABLE discussion_messages ADD COLUMN model_name TEXT NOT NULL DEFAULT ''");
  }

  const discCols = db.prepare("PRAGMA table_info(discussions)").all() as any[];
  if (!discCols.some(c => c.name === "moderator_model")) {
    db.exec("ALTER TABLE discussions ADD COLUMN moderator_model TEXT NOT NULL DEFAULT ''");
  }
  if (!discCols.some(c => c.name === "role_count")) {
    db.exec("ALTER TABLE discussions ADD COLUMN role_count INTEGER NOT NULL DEFAULT 4");
  }

  const partCols = db.prepare("PRAGMA table_info(discussion_participants)").all() as any[];
  if (!partCols.some(c => c.name === "model_config")) {
    db.exec("ALTER TABLE discussion_participants ADD COLUMN model_config TEXT NOT NULL DEFAULT ''");
  }
}

export function createDiscussion(topic: string, mode: string = "roundtable", totalRounds: number = 3, roleCount: number = 4) {
  const db = getDb();
  const r = db.prepare(
    "INSERT INTO discussions (topic, mode, total_rounds, role_count) VALUES (?, ?, ?, ?)"
  ).run(topic, mode, totalRounds, roleCount);
  return getDiscussion(r.lastInsertRowid as number);
}

export function getDiscussion(id: number) {
  return getDb().prepare("SELECT * FROM discussions WHERE id = ?").get(id) as any;
}

export function listDiscussions() {
  return getDb().prepare(
    "SELECT id, title, topic, mode, status, total_rounds, current_round, created_at FROM discussions ORDER BY id DESC"
  ).all();
}

export function updateDiscussion(id: number, fields: Record<string, any>) {
  const db = getDb();
  const sets = Object.keys(fields).map(k => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE discussions SET ${sets}, updated_at = datetime('now','localtime') WHERE id = @id`).run({ id, ...fields });
  return getDiscussion(id);
}

export function addParticipant(discussionId: number, p: { name: string; role_prompt: string; color: string; type: string; sort_order: number }) {
  const db = getDb();
  const r = db.prepare(
    "INSERT INTO discussion_participants (discussion_id, name, role_prompt, color, type, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(discussionId, p.name, p.role_prompt, p.color, p.type, p.sort_order);
  return getParticipant(r.lastInsertRowid as number);
}

export function getParticipant(id: number) {
  return getDb().prepare("SELECT * FROM discussion_participants WHERE id = ?").get(id) as any;
}

export function listParticipants(discussionId: number) {
  return getDb().prepare(
    "SELECT * FROM discussion_participants WHERE discussion_id = ? AND status = 'active' ORDER BY sort_order"
  ).all(discussionId);
}

export function updateParticipant(id: number, fields: Record<string, any>) {
  const db = getDb();
  const sets = Object.keys(fields).map(k => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE discussion_participants SET ${sets} WHERE id = @id`).run({ id, ...fields });
}

export function removeParticipant(id: number) {
  getDb().prepare("UPDATE discussion_participants SET status = 'removed' WHERE id = ?").run(id);
}

export function addMessage(discussionId: number, msg: { participant_id: number | null; round: number; content: string; reasoning?: string; type: string; model_name?: string }) {
  const db = getDb();
  const r = db.prepare(
    "INSERT INTO discussion_messages (discussion_id, participant_id, round, content, reasoning, type, model_name) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(discussionId, msg.participant_id, msg.round, msg.content, msg.reasoning || "", msg.type, msg.model_name || "");
  return r.lastInsertRowid;
}

export function listMessages(discussionId: number) {
  return getDb().prepare(
    "SELECT * FROM discussion_messages WHERE discussion_id = ? ORDER BY id ASC"
  ).all(discussionId);
}
