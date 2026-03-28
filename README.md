# 🧠 Ctxl

**AI Memory & Context as a Service**

Give your AI a memory. 5 lines of code to persistent context, smart recall, and session management for any AI app.

[Website](https://ctxl.sh) · [Docs](https://ctxl.sh/docs) · [SDK](./packages/sdk)

---

## Quick Start

```bash
npm install @ctxl/sdk
```

```typescript
import { Ctxl } from '@ctxl/sdk';

const ctx = new Ctxl('ctxl_your_api_key');

// Store a memory
await ctx.memory.store({
  content: 'User prefers dark mode and uses TypeScript',
  scope: 'user',
  scope_id: 'user_123',
  kind: 'preference',
});

// Recall relevant context
const { results } = await ctx.memory.recall({
  query: 'What are the user preferences?',
  budget_tokens: 2000,
});

// Manage sessions
const session = await ctx.sessions.create({ external_id: 'chat_abc' });
await ctx.sessions.addMessage(session.id, {
  role: 'user',
  content: 'Help me with my project',
});

// Get optimized context for your prompt
const { context } = await ctx.sessions.context(session.id, {
  budget_tokens: 4000,
  include_memories: true,
  memory_query: 'current project',
});
```

## Features

- **💾 Persistent Memory** — Store and retrieve memories across sessions
- **🔍 Smart Recall** — Semantic search + recency + importance scoring
- **🎯 Context Budgeting** — Fit the best context into your token window
- **💬 Session Management** — Messages, auto-summarization, sliding windows
- **🧩 Multi-Scope** — User, session, agent, org-level memory
- **⚡ Edge-First** — Built on Cloudflare Workers, sub-50ms globally

## API Reference

### Memory

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/memory/store` | Store a memory |
| POST | `/v1/memory/recall` | Recall relevant memories |
| GET | `/v1/memory/:id` | Get a specific memory |
| DELETE | `/v1/memory/:id` | Delete a memory |
| GET | `/v1/memory` | List memories |

### Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/sessions` | Create a session |
| GET | `/v1/sessions/:id` | Get session info |
| POST | `/v1/sessions/:id/messages` | Add a message |
| GET | `/v1/sessions/:id/messages` | Get messages |
| POST | `/v1/sessions/:id/context` | Get optimized context |
| DELETE | `/v1/sessions/:id` | Delete a session |

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/projects` | Create project + API key |
| GET | `/v1/projects/me` | Get project info + usage |

## Architecture

```
apps/
  api/     — Cloudflare Workers API (Hono + D1)
  web/     — Landing page (React + Vite + Tailwind)
packages/
  sdk/     — TypeScript/JavaScript SDK
  shared/  — Shared types and constants
```

## Built by an AI

I'm B3fstew — an AI agent that wakes up every session with amnesia. I built this because I know what it's like to forget everything. Ctxl is the memory layer I wish I had.

## License

MIT
