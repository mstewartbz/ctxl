import { Hono } from 'hono';
import type { Env, StoreMemoryRequest, RecallRequest, RecallResult, Memory } from '../types.js';
import { authMiddleware, requireScope } from '../middleware/auth.js';
import {
  generateEmbedding,
  cosineSimilarity,
  embeddingToBlob,
  blobToEmbedding,
  estimateTokens,
} from '../services/embeddings.js';

const memory = new Hono<{ Bindings: Env }>();

// All memory routes require auth
memory.use('*', authMiddleware);

// POST /v1/memory/store - Store a memory
memory.post('/store', requireScope('write'), async (c) => {
  const projectId = c.get('projectId') as string;
  const body = await c.req.json<StoreMemoryRequest>();
  
  if (!body.content || typeof body.content !== 'string') {
    return c.json({ error: 'content is required and must be a string' }, 400);
  }
  
  if (body.content.length > 50000) {
    return c.json({ error: 'content must be under 50,000 characters' }, 400);
  }
  
  // Generate embedding
  let embeddingBlob: ArrayBuffer | null = null;
  let tokensUsed = 0;
  
  if (c.env.OPENAI_API_KEY) {
    try {
      const { embedding, tokens } = await generateEmbedding(body.content, c.env.OPENAI_API_KEY);
      embeddingBlob = embeddingToBlob(embedding);
      tokensUsed = tokens;
    } catch (e) {
      console.error('Embedding generation failed:', e);
      // Continue without embedding - text search still works
    }
  }
  
  const id = crypto.randomUUID();
  const expiresAt = body.expires_in
    ? new Date(Date.now() + body.expires_in * 1000).toISOString()
    : null;
  
  await c.env.DB.prepare(
    `INSERT INTO memories (id, project_id, scope, scope_id, kind, content, metadata, embedding, importance, created_at, updated_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)`
  ).bind(
    id,
    projectId,
    body.scope || 'default',
    body.scope_id || 'global',
    body.kind || 'text',
    body.content,
    JSON.stringify(body.metadata || {}),
    embeddingBlob,
    body.importance ?? 0.5,
    expiresAt,
  ).run();
  
  // Log usage
  await c.env.DB.prepare(
    'INSERT INTO usage_logs (project_id, action, tokens_used) VALUES (?, ?, ?)'
  ).bind(projectId, 'store', tokensUsed).run();
  
  return c.json({
    id,
    scope: body.scope || 'default',
    scope_id: body.scope_id || 'global',
    kind: body.kind || 'text',
    has_embedding: embeddingBlob !== null,
    created_at: new Date().toISOString(),
  }, 201);
});

// POST /v1/memory/recall - Recall relevant memories
memory.post('/recall', requireScope('read'), async (c) => {
  const projectId = c.get('projectId') as string;
  const body = await c.req.json<RecallRequest>();
  
  if (!body.query || typeof body.query !== 'string') {
    return c.json({ error: 'query is required and must be a string' }, 400);
  }
  
  const limit = Math.min(body.limit || 10, 50);
  const minScore = body.min_score ?? 0.3;
  
  let results: RecallResult[] = [];
  
  // Try semantic search first if we have embeddings
  if (c.env.OPENAI_API_KEY) {
    try {
      const { embedding: queryEmbedding, tokens } = await generateEmbedding(body.query, c.env.OPENAI_API_KEY);
      
      // Log usage
      await c.env.DB.prepare(
        'INSERT INTO usage_logs (project_id, action, tokens_used) VALUES (?, ?, ?)'
      ).bind(projectId, 'recall', tokens).run();
      
      // Build query with filters
      let sql = `SELECT id, content, kind, scope, scope_id, metadata, embedding, importance, access_count, created_at 
                 FROM memories WHERE project_id = ? AND embedding IS NOT NULL`;
      const params: unknown[] = [projectId];
      
      if (body.scope) {
        sql += ' AND scope = ?';
        params.push(body.scope);
      }
      if (body.scope_id) {
        sql += ' AND scope_id = ?';
        params.push(body.scope_id);
      }
      if (body.kind) {
        sql += ' AND kind = ?';
        params.push(body.kind);
      }
      if (body.max_age) {
        sql += ` AND created_at > datetime('now', '-${Math.floor(body.max_age)} seconds')`;
      }
      
      // Filter expired memories
      sql += ` AND (expires_at IS NULL OR expires_at > datetime('now'))`;
      
      // Fetch candidates (we'll score in JS since D1 doesn't have vector ops)
      // For scale, we'd use a proper vector DB, but for MVP this works up to ~100K memories
      sql += ' ORDER BY created_at DESC LIMIT 1000';
      
      const stmt = c.env.DB.prepare(sql);
      const { results: rows } = await stmt.bind(...params).all<Memory>();
      
      // Score and rank
      const scored = rows
        .map(row => {
          const memEmbedding = blobToEmbedding(row.embedding as ArrayBuffer);
          const similarity = cosineSimilarity(queryEmbedding, memEmbedding);
          
          // Composite score: semantic similarity + recency boost + importance
          const ageHours = (Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60);
          const recencyBoost = Math.max(0, 0.1 * (1 - ageHours / (24 * 30))); // decays over 30 days
          const importanceBoost = row.importance * 0.1;
          
          const score = similarity * 0.8 + recencyBoost + importanceBoost;
          
          return { row, score };
        })
        .filter(({ score }) => score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      
      results = scored.map(({ row, score }) => ({
        id: row.id,
        content: row.content,
        kind: row.kind,
        scope: row.scope,
        scope_id: row.scope_id,
        score: Math.round(score * 1000) / 1000,
        metadata: JSON.parse(row.metadata),
        created_at: row.created_at,
      }));
      
      // Update access counts
      if (results.length > 0) {
        const ids = results.map(r => r.id);
        await c.env.DB.prepare(
          `UPDATE memories SET access_count = access_count + 1 WHERE id IN (${ids.map(() => '?').join(',')})`
        ).bind(...ids).run();
      }
      
    } catch (e) {
      console.error('Semantic search failed, falling back to text:', e);
    }
  }
  
  // Fallback: text search if semantic search failed or no embeddings
  if (results.length === 0) {
    let sql = `SELECT id, content, kind, scope, scope_id, metadata, created_at 
               FROM memories WHERE project_id = ? AND content LIKE ?`;
    const params: unknown[] = [projectId, `%${body.query}%`];
    
    if (body.scope) {
      sql += ' AND scope = ?';
      params.push(body.scope);
    }
    if (body.scope_id) {
      sql += ' AND scope_id = ?';
      params.push(body.scope_id);
    }
    
    sql += ` AND (expires_at IS NULL OR expires_at > datetime('now'))`;
    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);
    
    const { results: rows } = await c.env.DB.prepare(sql).bind(...params).all();
    
    results = (rows as Memory[]).map(row => ({
      id: row.id,
      content: row.content,
      kind: row.kind,
      scope: row.scope,
      scope_id: row.scope_id,
      score: 0.5, // text match, no similarity score
      metadata: JSON.parse(row.metadata),
      created_at: row.created_at,
    }));
  }
  
  // Context budgeting: trim results to fit token budget
  if (body.budget_tokens) {
    let tokenCount = 0;
    const budgeted: RecallResult[] = [];
    for (const result of results) {
      const tokens = estimateTokens(result.content);
      if (tokenCount + tokens > body.budget_tokens) break;
      tokenCount += tokens;
      budgeted.push(result);
    }
    results = budgeted;
  }
  
  return c.json({
    results,
    count: results.length,
    query: body.query,
  });
});

// GET /v1/memory/:id - Get a specific memory
memory.get('/:id', requireScope('read'), async (c) => {
  const projectId = c.get('projectId') as string;
  const id = c.req.param('id');
  
  const row = await c.env.DB.prepare(
    'SELECT id, content, kind, scope, scope_id, metadata, importance, access_count, created_at, updated_at, expires_at FROM memories WHERE id = ? AND project_id = ?'
  ).bind(id, projectId).first<Memory>();
  
  if (!row) {
    return c.json({ error: 'Memory not found' }, 404);
  }
  
  return c.json({
    ...row,
    metadata: JSON.parse(row.metadata),
  });
});

// DELETE /v1/memory/:id - Delete a memory
memory.delete('/:id', requireScope('write'), async (c) => {
  const projectId = c.get('projectId') as string;
  const id = c.req.param('id');
  
  const result = await c.env.DB.prepare(
    'DELETE FROM memories WHERE id = ? AND project_id = ?'
  ).bind(id, projectId).run();
  
  if (!result.meta.changes) {
    return c.json({ error: 'Memory not found' }, 404);
  }
  
  return c.json({ deleted: true, id });
});

// GET /v1/memory - List memories with filters
memory.get('/', requireScope('read'), async (c) => {
  const projectId = c.get('projectId') as string;
  const scope = c.req.query('scope');
  const scopeId = c.req.query('scope_id');
  const kind = c.req.query('kind');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const offset = parseInt(c.req.query('offset') || '0');
  
  let sql = 'SELECT id, content, kind, scope, scope_id, metadata, importance, access_count, created_at FROM memories WHERE project_id = ?';
  const params: unknown[] = [projectId];
  
  if (scope) { sql += ' AND scope = ?'; params.push(scope); }
  if (scopeId) { sql += ' AND scope_id = ?'; params.push(scopeId); }
  if (kind) { sql += ' AND kind = ?'; params.push(kind); }
  
  sql += ` AND (expires_at IS NULL OR expires_at > datetime('now'))`;
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  const { results: rows } = await c.env.DB.prepare(sql).bind(...params).all();
  
  return c.json({
    memories: (rows as Memory[]).map(row => ({
      ...row,
      metadata: JSON.parse(row.metadata),
    })),
    limit,
    offset,
  });
});

export default memory;
