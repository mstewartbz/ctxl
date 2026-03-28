// Cloudflare Worker bindings
export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  OPENAI_API_KEY?: string;
  JWT_SECRET?: string;
}

// Core types
export interface Project {
  id: string;
  name: string;
  owner_email: string | null;
  plan: 'free' | 'indie' | 'pro' | 'scale' | 'enterprise';
  created_at: string;
  settings: string;
}

export interface Memory {
  id: string;
  project_id: string;
  scope: string;
  scope_id: string;
  kind: 'text' | 'fact' | 'preference' | 'conversation' | 'document';
  content: string;
  metadata: string;
  embedding: ArrayBuffer | null;
  importance: number;
  access_count: number;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export interface Session {
  id: string;
  project_id: string;
  external_id: string | null;
  scope: string;
  scope_id: string;
  summary: string | null;
  message_count: number;
  token_count: number;
  created_at: string;
  updated_at: string;
  metadata: string;
}

export interface SessionMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  token_estimate: number;
  created_at: string;
  metadata: string;
}

export interface Fact {
  id: string;
  project_id: string;
  scope: string;
  scope_id: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  source_memory_id: string | null;
  created_at: string;
  updated_at: string;
  superseded_by: string | null;
}

export interface ApiKey {
  id: string;
  project_id: string;
  key_hash: string;
  key_prefix: string;
  name: string;
  scopes: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

// API request/response types
export interface StoreMemoryRequest {
  content: string;
  scope?: string;
  scope_id?: string;
  kind?: Memory['kind'];
  metadata?: Record<string, unknown>;
  importance?: number;
  expires_in?: number; // seconds
}

export interface RecallRequest {
  query: string;
  scope?: string;
  scope_id?: string;
  kind?: Memory['kind'];
  limit?: number;
  min_score?: number;
  max_age?: number; // seconds
  budget_tokens?: number; // context budgeting
}

export interface RecallResult {
  id: string;
  content: string;
  kind: string;
  scope: string;
  scope_id: string;
  score: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateSessionRequest {
  external_id?: string;
  scope?: string;
  scope_id?: string;
  metadata?: Record<string, unknown>;
}

export interface AddMessageRequest {
  role: SessionMessage['role'];
  content: string;
  metadata?: Record<string, unknown>;
}

export interface GetContextRequest {
  budget_tokens?: number;
  include_summary?: boolean;
  include_memories?: boolean;
  memory_query?: string;
  memory_limit?: number;
}

// Plan limits
export const PLAN_LIMITS = {
  free: { memories: 1000, api_calls: 10000, projects: 1 },
  indie: { memories: 50000, api_calls: 100000, projects: 5 },
  pro: { memories: 500000, api_calls: 1000000, projects: -1 }, // -1 = unlimited
  scale: { memories: 5000000, api_calls: 10000000, projects: -1 },
  enterprise: { memories: -1, api_calls: -1, projects: -1 },
} as const;
