import { Context, Next } from 'hono';
import type { Env, ApiKey } from '../types.js';

// Hash an API key using Web Crypto (available in Workers)
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Generate a new API key
export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const key = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `ctxl_${key}`;
}

// Auth middleware - extracts project from API key
export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header. Use: Bearer ctxl_...' }, 401);
  }
  
  const apiKey = authHeader.slice(7);
  
  if (!apiKey.startsWith('ctxl_')) {
    return c.json({ error: 'Invalid API key format. Keys start with ctxl_' }, 401);
  }
  
  const keyHash = await hashKey(apiKey);
  
  const result = await c.env.DB.prepare(
    `SELECT ak.*, p.plan, p.name as project_name 
     FROM api_keys ak 
     JOIN projects p ON ak.project_id = p.id 
     WHERE ak.key_hash = ? AND ak.revoked_at IS NULL`
  ).bind(keyHash).first<ApiKey & { plan: string; project_name: string }>();
  
  if (!result) {
    return c.json({ error: 'Invalid or revoked API key' }, 401);
  }
  
  // Check expiry
  if (result.expires_at && new Date(result.expires_at) < new Date()) {
    return c.json({ error: 'API key has expired' }, 401);
  }
  
  // Update last used (fire and forget)
  c.env.DB.prepare('UPDATE api_keys SET last_used_at = datetime(\'now\') WHERE id = ?')
    .bind(result.id)
    .run();
  
  // Set project context
  c.set('projectId', result.project_id);
  c.set('plan', result.plan);
  c.set('apiKeyId', result.id);
  c.set('scopes', result.scopes.split(','));
  
  await next();
}

// Check if a scope is allowed
export function requireScope(scope: string) {
  return async (c: Context, next: Next) => {
    const scopes = c.get('scopes') as string[];
    if (!scopes.includes(scope) && !scopes.includes('admin')) {
      return c.json({ error: `API key missing required scope: ${scope}` }, 403);
    }
    await next();
  };
}

export { hashKey };
