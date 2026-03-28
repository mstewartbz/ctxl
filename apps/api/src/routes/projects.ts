import { Hono } from 'hono';
import type { Env, Project } from '../types.js';
import { generateApiKey, hashKey } from '../middleware/auth.js';

const projects = new Hono<{ Bindings: Env }>();

// POST /v1/projects - Create a new project and get API key
// This is the signup endpoint - no auth required
projects.post('/', async (c) => {
  const body = await c.req.json<{ name: string; email?: string }>().catch(() => ({ name: '' }));
  
  if (!body.name || body.name.length < 2) {
    return c.json({ error: 'name is required (min 2 characters)' }, 400);
  }
  
  const projectId = crypto.randomUUID();
  const apiKey = generateApiKey();
  const keyHash = await hashKey(apiKey);
  const keyPrefix = apiKey.slice(0, 13); // "ctxl_" + first 8 hex chars
  
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO projects (id, name, owner_email, plan, created_at, settings)
       VALUES (?, ?, ?, 'free', datetime('now'), '{}')`
    ).bind(projectId, body.name, body.email || null),
    
    c.env.DB.prepare(
      `INSERT INTO api_keys (id, project_id, key_hash, key_prefix, name, scopes, created_at)
       VALUES (?, ?, ?, ?, 'Default', 'read,write,admin', datetime('now'))`
    ).bind(crypto.randomUUID(), projectId, keyHash, keyPrefix),
  ]);
  
  return c.json({
    project: {
      id: projectId,
      name: body.name,
      plan: 'free',
    },
    api_key: apiKey,
    message: 'Save your API key — it won\'t be shown again. Use it as: Authorization: Bearer ' + apiKey.slice(0, 13) + '...',
  }, 201);
});

// GET /v1/projects/me - Get current project info (requires auth)
// Inline auth check since we need the project
projects.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  const apiKey = authHeader.slice(7);
  const keyHash = await hashKey(apiKey);
  
  const key = await c.env.DB.prepare(
    'SELECT project_id FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL'
  ).bind(keyHash).first<{ project_id: string }>();
  
  if (!key) {
    return c.json({ error: 'Invalid API key' }, 401);
  }
  
  const project = await c.env.DB.prepare(
    'SELECT id, name, owner_email, plan, created_at FROM projects WHERE id = ?'
  ).bind(key.project_id).first<Project>();
  
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  
  // Get usage stats
  const memoryCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM memories WHERE project_id = ?'
  ).bind(key.project_id).first<{ count: number }>();
  
  const sessionCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM sessions WHERE project_id = ?'
  ).bind(key.project_id).first<{ count: number }>();
  
  const usageThisMonth = await c.env.DB.prepare(
    `SELECT COUNT(*) as api_calls, SUM(tokens_used) as tokens 
     FROM usage_logs WHERE project_id = ? AND created_at > datetime('now', '-30 days')`
  ).bind(key.project_id).first<{ api_calls: number; tokens: number }>();
  
  return c.json({
    ...project,
    usage: {
      memories: memoryCount?.count || 0,
      sessions: sessionCount?.count || 0,
      api_calls_30d: usageThisMonth?.api_calls || 0,
      tokens_30d: usageThisMonth?.tokens || 0,
    },
  });
});

export default projects;
