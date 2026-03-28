-- Ctxl: AI Memory & Context as a Service
-- Initial schema

-- API keys for authentication
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL, -- first 8 chars for identification
  name TEXT NOT NULL DEFAULT 'Default',
  scopes TEXT NOT NULL DEFAULT 'read,write', -- comma-separated
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  expires_at TEXT,
  revoked_at TEXT
);

-- Projects (tenants)
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  owner_email TEXT,
  plan TEXT NOT NULL DEFAULT 'free', -- free, indie, pro, scale, enterprise
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  settings TEXT NOT NULL DEFAULT '{}' -- JSON settings
);

-- Memory store - the core product
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'default', -- user, session, agent, org, or custom
  scope_id TEXT NOT NULL DEFAULT 'global', -- the actual scope identifier
  kind TEXT NOT NULL DEFAULT 'text', -- text, fact, preference, conversation, document
  content TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}', -- JSON metadata
  embedding BLOB, -- float32 array stored as blob
  importance REAL NOT NULL DEFAULT 0.5, -- 0-1 importance score
  access_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT -- optional TTL
);

CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id);
CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(project_id, scope, scope_id);
CREATE INDEX IF NOT EXISTS idx_memories_kind ON memories(project_id, kind);
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(project_id, created_at DESC);

-- Sessions - persistent conversation sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  external_id TEXT, -- caller's own session ID
  scope TEXT NOT NULL DEFAULT 'default',
  scope_id TEXT NOT NULL DEFAULT 'global',
  summary TEXT, -- auto-generated rolling summary
  message_count INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_external ON sessions(project_id, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_external_unique ON sessions(project_id, external_id) WHERE external_id IS NOT NULL;

-- Session messages - conversation turns
CREATE TABLE IF NOT EXISTS session_messages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- user, assistant, system, tool
  content TEXT NOT NULL,
  token_estimate INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON session_messages(session_id, created_at);

-- Facts - auto-extracted structured knowledge
CREATE TABLE IF NOT EXISTS facts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'default',
  scope_id TEXT NOT NULL DEFAULT 'global',
  subject TEXT NOT NULL, -- who/what
  predicate TEXT NOT NULL, -- relationship/property
  object TEXT NOT NULL, -- value
  confidence REAL NOT NULL DEFAULT 1.0,
  source_memory_id TEXT REFERENCES memories(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  superseded_by TEXT REFERENCES facts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_facts_project ON facts(project_id);
CREATE INDEX IF NOT EXISTS idx_facts_scope ON facts(project_id, scope, scope_id);
CREATE INDEX IF NOT EXISTS idx_facts_subject ON facts(project_id, subject);

-- Usage tracking for billing
CREATE TABLE IF NOT EXISTS usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- store, recall, extract, session_create, etc.
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_usage_project ON usage_logs(project_id, created_at);
