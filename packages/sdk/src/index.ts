/**
 * Ctxl SDK — AI Memory & Context as a Service
 *
 * @example
 * ```ts
 * import { Ctxl } from '@ctxl/sdk';
 *
 * const ctx = new Ctxl('ctxl_your_api_key');
 *
 * // Store a memory
 * await ctx.memory.store({
 *   content: 'User prefers dark mode',
 *   scope: 'user',
 *   scope_id: 'user_123',
 * });
 *
 * // Recall relevant context
 * const { results } = await ctx.memory.recall({
 *   query: 'user preferences',
 *   budget_tokens: 2000,
 * });
 * ```
 */

// Types
export interface CtxlConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface StoreOptions {
  content: string;
  scope?: string;
  scope_id?: string;
  kind?: 'text' | 'fact' | 'preference' | 'conversation' | 'document';
  metadata?: Record<string, unknown>;
  importance?: number;
  expires_in?: number;
}

export interface StoreResult {
  id: string;
  scope: string;
  scope_id: string;
  kind: string;
  has_embedding: boolean;
  created_at: string;
}

export interface RecallOptions {
  query: string;
  scope?: string;
  scope_id?: string;
  kind?: string;
  limit?: number;
  min_score?: number;
  max_age?: number;
  budget_tokens?: number;
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

export interface RecallResponse {
  results: RecallResult[];
  count: number;
  query: string;
}

export interface MemoryItem {
  id: string;
  content: string;
  kind: string;
  scope: string;
  scope_id: string;
  metadata: Record<string, unknown>;
  importance: number;
  access_count: number;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export interface ListOptions {
  scope?: string;
  scope_id?: string;
  kind?: string;
  limit?: number;
  offset?: number;
}

export interface SessionCreateOptions {
  external_id?: string;
  scope?: string;
  scope_id?: string;
  metadata?: Record<string, unknown>;
}

export interface SessionInfo {
  id: string;
  external_id: string | null;
  scope: string;
  scope_id: string;
  summary: string | null;
  message_count: number;
  token_count: number;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

export interface MessageOptions {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ContextOptions {
  budget_tokens?: number;
  include_summary?: boolean;
  include_memories?: boolean;
  memory_query?: string;
  memory_limit?: number;
}

export interface ContextBlock {
  type: string;
  content: string;
  tokens: number;
}

export interface ContextResponse {
  session_id: string;
  context: ContextBlock[];
  total_tokens: number;
  budget_tokens: number;
  budget_used_pct: number;
}

export interface ProjectInfo {
  id: string;
  name: string;
  plan: string;
  usage: {
    memories: number;
    sessions: number;
    api_calls_30d: number;
    tokens_30d: number;
  };
}

// Error class
export class CtxlError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'CtxlError';
    this.status = status;
    this.body = body;
  }
}

// HTTP client
class HttpClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new CtxlError(
        (data as any).error || `Request failed with status ${response.status}`,
        response.status,
        data,
      );
    }

    return data as T;
  }

  get<T>(path: string) { return this.request<T>('GET', path); }
  post<T>(path: string, body?: unknown) { return this.request<T>('POST', path, body); }
  delete<T>(path: string) { return this.request<T>('DELETE', path); }
}

// Memory namespace
class MemoryClient {
  constructor(private http: HttpClient) {}

  /** Store a memory */
  async store(options: StoreOptions): Promise<StoreResult> {
    return this.http.post('/v1/memory/store', options);
  }

  /** Recall relevant memories */
  async recall(options: RecallOptions): Promise<RecallResponse> {
    return this.http.post('/v1/memory/recall', options);
  }

  /** Get a specific memory by ID */
  async get(id: string): Promise<MemoryItem> {
    return this.http.get(`/v1/memory/${id}`);
  }

  /** Delete a memory */
  async delete(id: string): Promise<{ deleted: boolean; id: string }> {
    return this.http.delete(`/v1/memory/${id}`);
  }

  /** List memories with optional filters */
  async list(options?: ListOptions): Promise<{ memories: MemoryItem[]; limit: number; offset: number }> {
    const params = new URLSearchParams();
    if (options?.scope) params.set('scope', options.scope);
    if (options?.scope_id) params.set('scope_id', options.scope_id);
    if (options?.kind) params.set('kind', options.kind);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    const qs = params.toString();
    return this.http.get(`/v1/memory${qs ? `?${qs}` : ''}`);
  }
}

// Sessions namespace
class SessionsClient {
  constructor(private http: HttpClient) {}

  /** Create a new session */
  async create(options?: SessionCreateOptions): Promise<{ id: string; external_id: string | null; created_at: string }> {
    return this.http.post('/v1/sessions', options || {});
  }

  /** Get session info */
  async get(id: string): Promise<SessionInfo> {
    return this.http.get(`/v1/sessions/${id}`);
  }

  /** Add a message to a session */
  async addMessage(sessionId: string, message: MessageOptions): Promise<{ id: string; session_id: string; token_estimate: number }> {
    return this.http.post(`/v1/sessions/${sessionId}/messages`, message);
  }

  /** Get session messages */
  async messages(sessionId: string, options?: { limit?: number; before?: string }): Promise<{ messages: any[]; count: number }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.before) params.set('before', options.before);
    const qs = params.toString();
    return this.http.get(`/v1/sessions/${sessionId}/messages${qs ? `?${qs}` : ''}`);
  }

  /** Get optimized context for a session */
  async context(sessionId: string, options?: ContextOptions): Promise<ContextResponse> {
    return this.http.post(`/v1/sessions/${sessionId}/context`, options || {});
  }

  /** Delete a session */
  async delete(id: string): Promise<{ deleted: boolean }> {
    return this.http.delete(`/v1/sessions/${id}`);
  }

  /** List sessions */
  async list(options?: { limit?: number; offset?: number }): Promise<{ sessions: SessionInfo[]; limit: number; offset: number }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    const qs = params.toString();
    return this.http.get(`/v1/sessions${qs ? `?${qs}` : ''}`);
  }
}

// Main client
export class Ctxl {
  readonly memory: MemoryClient;
  readonly sessions: SessionsClient;
  private http: HttpClient;

  constructor(apiKeyOrConfig: string | CtxlConfig) {
    const config = typeof apiKeyOrConfig === 'string'
      ? { apiKey: apiKeyOrConfig }
      : apiKeyOrConfig;

    if (!config.apiKey) {
      throw new Error('API key is required. Get one at https://ctxl.sh');
    }

    this.http = new HttpClient(config.apiKey, config.baseUrl || 'https://api.ctxl.sh');
    this.memory = new MemoryClient(this.http);
    this.sessions = new SessionsClient(this.http);
  }

  /** Get project info and usage */
  async project(): Promise<ProjectInfo> {
    return this.http.get('/v1/projects/me');
  }
}

export default Ctxl;
