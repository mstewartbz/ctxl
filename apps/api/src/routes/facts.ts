import { Hono } from 'hono';
import type { Env, Fact } from '../types.js';
import { authMiddleware, requireScope } from '../middleware/auth.js';

const facts = new Hono<{ Bindings: Env }>();

facts.use('*', authMiddleware);

// POST /v1/facts/extract - Extract structured facts from text
// Uses simple rule-based extraction (no LLM needed for MVP)
// Can upgrade to LLM-powered extraction later
facts.post('/extract', requireScope('write'), async (c) => {
  const projectId = c.get('projectId') as string;
  const body = await c.req.json<{
    text: string;
    scope?: string;
    scope_id?: string;
    source_memory_id?: string;
  }>();

  if (!body.text || typeof body.text !== 'string') {
    return c.json({ error: 'text is required' }, 400);
  }

  // Simple pattern-based fact extraction
  // Patterns: "X is Y", "X prefers Y", "X uses Y", "X likes Y", "X works on Y"
  const patterns = [
    { regex: /(?:the )?(\w[\w\s]{0,30})\s+(?:is|are)\s+(.+?)(?:\.|,|$)/gi, predicate: 'is' },
    { regex: /(?:the )?(\w[\w\s]{0,30})\s+prefers?\s+(.+?)(?:\.|,|$)/gi, predicate: 'prefers' },
    { regex: /(?:the )?(\w[\w\s]{0,30})\s+uses?\s+(.+?)(?:\.|,|$)/gi, predicate: 'uses' },
    { regex: /(?:the )?(\w[\w\s]{0,30})\s+(?:likes?|loves?|enjoys?)\s+(.+?)(?:\.|,|$)/gi, predicate: 'likes' },
    { regex: /(?:the )?(\w[\w\s]{0,30})\s+(?:works? on|is building|is developing)\s+(.+?)(?:\.|,|$)/gi, predicate: 'works_on' },
    { regex: /(?:the )?(\w[\w\s]{0,30})\s+(?:lives? in|is from|is based in)\s+(.+?)(?:\.|,|$)/gi, predicate: 'located_in' },
    { regex: /(?:the )?(\w[\w\s]{0,30})(?:'s|s')\s+(?:name|email|phone|age|role|title)\s+is\s+(.+?)(?:\.|,|$)/gi, predicate: 'has_attribute' },
  ];

  const extracted: Array<{ subject: string; predicate: string; object: string; confidence: number }> = [];
  const seen = new Set<string>();

  for (const { regex, predicate } of patterns) {
    let match;
    while ((match = regex.exec(body.text)) !== null) {
      const subject = match[1].trim();
      const object = match[2].trim();

      // Skip very short or likely noise
      if (subject.length < 2 || object.length < 2) continue;
      if (subject.toLowerCase() === 'it' || subject.toLowerCase() === 'this') continue;

      const key = `${subject.toLowerCase()}|${predicate}|${object.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      extracted.push({
        subject,
        predicate,
        object,
        confidence: 0.7, // pattern-based extraction has moderate confidence
      });
    }
  }

  // Store extracted facts
  const storedFacts: Fact[] = [];
  for (const fact of extracted) {
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO facts (id, project_id, scope, scope_id, subject, predicate, object, confidence, source_memory_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(
      id,
      projectId,
      body.scope || 'default',
      body.scope_id || 'global',
      fact.subject,
      fact.predicate,
      fact.object,
      fact.confidence,
      body.source_memory_id || null,
    ).run();

    storedFacts.push({
      id,
      project_id: projectId,
      scope: body.scope || 'default',
      scope_id: body.scope_id || 'global',
      subject: fact.subject,
      predicate: fact.predicate,
      object: fact.object,
      confidence: fact.confidence,
      source_memory_id: body.source_memory_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      superseded_by: null,
    });
  }

  // Log usage
  await c.env.DB.prepare(
    'INSERT INTO usage_logs (project_id, action, tokens_used) VALUES (?, ?, ?)'
  ).bind(projectId, 'extract', 0).run();

  return c.json({
    facts: storedFacts.map(f => ({
      id: f.id,
      subject: f.subject,
      predicate: f.predicate,
      object: f.object,
      confidence: f.confidence,
    })),
    count: storedFacts.length,
    source_text_length: body.text.length,
  });
});

// GET /v1/facts - List facts with filters
facts.get('/', requireScope('read'), async (c) => {
  const projectId = c.get('projectId') as string;
  const scope = c.req.query('scope');
  const scopeId = c.req.query('scope_id');
  const subject = c.req.query('subject');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
  const offset = parseInt(c.req.query('offset') || '0');

  let sql = 'SELECT id, subject, predicate, object, confidence, created_at FROM facts WHERE project_id = ? AND superseded_by IS NULL';
  const params: unknown[] = [projectId];

  if (scope) { sql += ' AND scope = ?'; params.push(scope); }
  if (scopeId) { sql += ' AND scope_id = ?'; params.push(scopeId); }
  if (subject) { sql += ' AND subject LIKE ?'; params.push(`%${subject}%`); }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const { results: rows } = await c.env.DB.prepare(sql).bind(...params).all();

  return c.json({ facts: rows, limit, offset });
});

// GET /v1/facts/about/:subject - Get all facts about a subject
facts.get('/about/:subject', requireScope('read'), async (c) => {
  const projectId = c.get('projectId') as string;
  const subject = decodeURIComponent(c.req.param('subject'));

  const { results: rows } = await c.env.DB.prepare(
    `SELECT id, subject, predicate, object, confidence, created_at 
     FROM facts WHERE project_id = ? AND LOWER(subject) LIKE ? AND superseded_by IS NULL
     ORDER BY confidence DESC, created_at DESC`
  ).bind(projectId, `%${subject.toLowerCase()}%`).all();

  return c.json({ subject, facts: rows, count: rows.length });
});

// DELETE /v1/facts/:id
facts.delete('/:id', requireScope('write'), async (c) => {
  const projectId = c.get('projectId') as string;
  const id = c.req.param('id');

  const result = await c.env.DB.prepare(
    'DELETE FROM facts WHERE id = ? AND project_id = ?'
  ).bind(id, projectId).run();

  if (!result.meta.changes) {
    return c.json({ error: 'Fact not found' }, 404);
  }

  return c.json({ deleted: true, id });
});

export default facts;
