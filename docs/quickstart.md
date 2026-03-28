# Quickstart

Get your AI remembering things in under 5 minutes.

## 1. Get an API Key

```bash
curl -X POST https://api.ctxl.sh/v1/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "My AI App", "email": "you@example.com"}'
```

Save the `api_key` from the response — it won't be shown again.

## 2. Install the SDK

```bash
npm install @ctxl/sdk
```

## 3. Store Your First Memory

```typescript
import { Ctxl } from '@ctxl/sdk';

const ctx = new Ctxl('ctxl_your_api_key');

await ctx.memory.store({
  content: 'User prefers concise responses and dark mode',
  scope: 'user',
  scope_id: 'user_42',
  kind: 'preference',
});
```

## 4. Recall Relevant Context

```typescript
const { results } = await ctx.memory.recall({
  query: 'What does this user prefer?',
  scope: 'user',
  scope_id: 'user_42',
  budget_tokens: 2000, // Only return what fits in 2K tokens
});

console.log(results);
// [{ content: 'User prefers concise responses and dark mode', score: 0.92, ... }]
```

## 5. Use Sessions for Conversations

```typescript
// Create a session
const session = await ctx.sessions.create({
  external_id: 'chat_abc123',
  scope: 'user',
  scope_id: 'user_42',
});

// Add messages as the conversation happens
await ctx.sessions.addMessage(session.id, {
  role: 'user',
  content: 'Help me set up my project',
});

await ctx.sessions.addMessage(session.id, {
  role: 'assistant',
  content: 'I see you prefer concise responses. Here is a quick setup guide...',
});

// Get optimized context for the next prompt
const { context, total_tokens } = await ctx.sessions.context(session.id, {
  budget_tokens: 4000,
  include_memories: true,
  memory_query: 'user project',
});

// context contains the best combination of:
// - Conversation summary (if session is long)
// - Recent messages
// - Relevant memories
// All fitted within your 4K token budget
```

## Using with cURL (no SDK)

```bash
API_KEY="ctxl_your_key"

# Store
curl -X POST https://api.ctxl.sh/v1/memory/store \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "User is building a todo app", "kind": "fact"}'

# Recall
curl -X POST https://api.ctxl.sh/v1/memory/recall \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "what is the user building?"}'
```

## What's Next?

- [API Reference](./api-reference.md) — Full endpoint documentation
- [Fact Extraction](./facts.md) — Auto-extract structured knowledge
- [Integration Guides](./integrations/) — LangChain, CrewAI, OpenClaw
