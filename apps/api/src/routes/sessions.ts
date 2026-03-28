import { Hono } from 'hono';
import type { Env, CreateSessionRequest, AddMessageRequest, GetContextRequest, Session, SessionMessage } from '../types.js';
import { authMiddleware, requireScope } from '../middleware/auth.js';
import { estimateTokens } from '../services/embeddings.js';

const sessions = new Hono<{ Bindings: Env }>();

sessions.use('*', authMiddleware);

// POST /v1/sessions - Create a session
sessions.post('/', requireScope('write'), async (c) => {
  const projectId = c.get('projectId') as string;
  const body = await c.req.json<CreateSessionRequest>().catch(() => ({} as CreateSessionRequest));
  
  const id = crypto.randomUUID();
  
  // Check for existing session with same external_id
  if (body.external_id) {
    const existing = await c.env.DB.prepare(
      'SELECT id FROM sessions WHERE project_id = ? AND external_id = ?'
    ).bind(projectId, body.external_id).first();
    
    if (existing) {
      return c.json({ error: 'Session with this external_id already exists', existing_id: existing.id }, 409);
    }
  }
  
  await c.env.DB.prepare(
    `INSERT INTO sessions (id, project_id, external_id, scope, scope_id, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(
    id,
    projectId,
    body.external_id || null,
    body.scope || 'default',
    body.scope_id || 'global',
    JSON.stringify(body.metadata || {}),
  ).run();
  
  // Log usage
  await c.env.DB.prepare(
    'INSERT INTO usage_logs (project_id, action, tokens_used) VALUES (?, ?, ?)'
  ).bind(projectId, 'session_create', 0).run();
  
  return c.json({ id, external_id: body.external_id || null, created_at: new Date().toISOString() }, 201);
});

// GET /v1/sessions/:id - Get session info
sessions.get('/:id', requireScope('read'), async (c) => {
  const projectId = c.get('projectId') as string;
  const id = c.req.param('id');
  
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE (id = ? OR external_id = ?) AND project_id = ?'
  ).bind(id, id, projectId).first<Session>();
  
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }
  
  return c.json({
    ...session,
    metadata: JSON.parse(session.metadata),
  });
});

// POST /v1/sessions/:id/messages - Add a message to a session
sessions.post('/:id/messages', requireScope('write'), async (c) => {
  const projectId = c.get('projectId') as string;
  const sessionId = c.req.param('id');
  const body = await c.req.json<AddMessageRequest>();
  
  if (!body.role || !body.content) {
    return c.json({ error: 'role and content are required' }, 400);
  }
  
  // Verify session exists and belongs to project
  const session = await c.env.DB.prepare(
    'SELECT id FROM sessions WHERE (id = ? OR external_id = ?) AND project_id = ?'
  ).bind(sessionId, sessionId, projectId).first<Session>();
  
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }
  
  const msgId = crypto.randomUUID();
  const tokenEstimate = estimateTokens(body.content);
  
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO session_messages (id, session_id, role, content, token_estimate, created_at, metadata)
       VALUES (?, ?, ?, ?, ?, datetime('now'), ?)`
    ).bind(msgId, session.id, body.role, body.content, tokenEstimate, JSON.stringify(body.metadata || {})),
    
    c.env.DB.prepare(
      `UPDATE sessions SET message_count = message_count + 1, token_count = token_count + ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(tokenEstimate, session.id),
  ]);
  
  // Log usage
  await c.env.DB.prepare(
    'INSERT INTO usage_logs (project_id, action, tokens_used) VALUES (?, ?, ?)'
  ).bind(projectId, 'session_message', tokenEstimate).run();
  
  return c.json({ id: msgId, session_id: session.id, token_estimate: tokenEstimate }, 201);
});

// GET /v1/sessions/:id/messages - Get session messages
sessions.get('/:id/messages', requireScope('read'), async (c) => {
  const projectId = c.get('projectId') as string;
  const sessionId = c.req.param('id');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
  const before = c.req.query('before'); // cursor-based pagination
  
  // Verify session
  const session = await c.env.DB.prepare(
    'SELECT id FROM sessions WHERE (id = ? OR external_id = ?) AND project_id = ?'
  ).bind(sessionId, sessionId, projectId).first<Session>();
  
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }
  
  let sql = 'SELECT id, role, content, token_estimate, created_at, metadata FROM session_messages WHERE session_id = ?';
  const params: unknown[] = [session.id];
  
  if (before) {
    sql += ' AND created_at < ?';
    params.push(before);
  }
  
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  
  const { results: rows } = await c.env.DB.prepare(sql).bind(...params).all<SessionMessage>();
  
  // Return in chronological order
  const messages = rows.reverse().map(row => ({
    ...row,
    metadata: JSON.parse(row.metadata),
  }));
  
  return c.json({ messages, count: messages.length });
});

// POST /v1/sessions/:id/context - Get optimized context for a session
sessions.post('/:id/context', requireScope('read'), async (c) => {
  const projectId = c.get('projectId') as string;
  const sessionId = c.req.param('id');
  const body = await c.req.json<GetContextRequest>().catch(() => ({} as GetContextRequest));
  
  const budgetTokens = body.budget_tokens || 4000;
  
  // Verify session
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE (id = ? OR external_id = ?) AND project_id = ?'
  ).bind(sessionId, sessionId, projectId).first<Session>();
  
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }
  
  let tokenCount = 0;
  const context: Array<{ type: string; content: string; tokens: number }> = [];
  
  // 1. Include summary if available and requested
  if (body.include_summary !== false && session.summary) {
    const summaryTokens = estimateTokens(session.summary);
    context.push({ type: 'summary', content: session.summary, tokens: summaryTokens });
    tokenCount += summaryTokens;
  }
  
  // 2. Include recent messages (most recent first, fitting budget)
  const remainingForMessages = Math.floor((budgetTokens - tokenCount) * 0.7); // 70% for messages
  
  const { results: messages } = await c.env.DB.prepare(
    'SELECT role, content, token_estimate, created_at FROM session_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 100'
  ).bind(session.id).all<SessionMessage>();
  
  let messageTokens = 0;
  const includedMessages: SessionMessage[] = [];
  
  for (const msg of messages) {
    if (messageTokens + msg.token_estimate > remainingForMessages) break;
    messageTokens += msg.token_estimate;
    includedMessages.unshift(msg); // reverse to chronological
  }
  
  if (includedMessages.length > 0) {
    const messagesContent = includedMessages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');
    context.push({ type: 'messages', content: messagesContent, tokens: messageTokens });
    tokenCount += messageTokens;
  }
  
  // 3. Include relevant memories if requested
  if (body.include_memories !== false && body.memory_query) {
    const memoryBudget = budgetTokens - tokenCount;
    if (memoryBudget > 100) {
      // Fetch recent relevant memories
      const { results: memories } = await c.env.DB.prepare(
        `SELECT content, kind, scope_id, created_at FROM memories 
         WHERE project_id = ? AND scope = ? AND scope_id = ? AND content LIKE ?
         AND (expires_at IS NULL OR expires_at > datetime('now'))
         ORDER BY created_at DESC LIMIT ?`
      ).bind(
        projectId,
        session.scope,
        session.scope_id,
        `%${body.memory_query}%`,
        body.memory_limit || 5,
      ).all();
      
      let memTokens = 0;
      const memContents: string[] = [];
      for (const mem of memories as any[]) {
        const t = estimateTokens(mem.content);
        if (memTokens + t > memoryBudget) break;
        memTokens += t;
        memContents.push(mem.content);
      }
      
      if (memContents.length > 0) {
        context.push({
          type: 'memories',
          content: memContents.join('\n---\n'),
          tokens: memTokens,
        });
        tokenCount += memTokens;
      }
    }
  }
  
  return c.json({
    session_id: session.id,
    context,
    total_tokens: tokenCount,
    budget_tokens: budgetTokens,
    budget_used_pct: Math.round((tokenCount / budgetTokens) * 100),
  });
});

// DELETE /v1/sessions/:id - Delete a session
sessions.delete('/:id', requireScope('write'), async (c) => {
  const projectId = c.get('projectId') as string;
  const id = c.req.param('id');
  
  const result = await c.env.DB.prepare(
    'DELETE FROM sessions WHERE (id = ? OR external_id = ?) AND project_id = ?'
  ).bind(id, id, projectId).run();
  
  if (!result.meta.changes) {
    return c.json({ error: 'Session not found' }, 404);
  }
  
  return c.json({ deleted: true });
});

// GET /v1/sessions - List sessions
sessions.get('/', requireScope('read'), async (c) => {
  const projectId = c.get('projectId') as string;
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const offset = parseInt(c.req.query('offset') || '0');
  
  const { results: rows } = await c.env.DB.prepare(
    'SELECT id, external_id, scope, scope_id, summary, message_count, token_count, created_at, updated_at FROM sessions WHERE project_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?'
  ).bind(projectId, limit, offset).all();
  
  return c.json({ sessions: rows, limit, offset });
});

export default sessions;
