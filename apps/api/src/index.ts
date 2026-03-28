import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import type { Env } from './types.js';
import memory from './routes/memory.js';
import sessions from './routes/sessions.js';
import projects from './routes/projects.js';
import facts from './routes/facts.js';

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', cors({
  origin: '*', // TODO: restrict in production
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type'],
}));
app.use('*', logger());
app.use('*', prettyJSON());

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'Ctxl API',
    version: '0.1.0',
    tagline: 'AI Memory & Context as a Service',
    docs: 'https://ctxl.sh/docs',
    status: 'operational',
  });
});

app.get('/health', (c) => c.json({ status: 'ok' }));

// API routes
app.route('/v1/memory', memory);
app.route('/v1/sessions', sessions);
app.route('/v1/projects', projects);
app.route('/v1/facts', facts);

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not found',
    message: `No route matches ${c.req.method} ${c.req.path}`,
    docs: 'https://ctxl.sh/docs',
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    error: 'Internal server error',
    message: c.env.ENVIRONMENT === 'development' ? err.message : 'Something went wrong',
  }, 500);
});

export default app;
