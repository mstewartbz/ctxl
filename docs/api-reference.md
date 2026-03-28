# API Reference

Base URL: `https://api.ctxl.sh`

All authenticated endpoints require: `Authorization: Bearer ctxl_...`

---

## Projects

### Create a Project

```
POST /v1/projects
```

No authentication required. Creates a project and returns an API key.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | yes | Project name (min 2 chars) |
| email | string | no | Owner email |

**Response (201):**
```json
{
  "project": { "id": "uuid", "name": "My App", "plan": "free" },
  "api_key": "ctxl_...",
  "message": "Save your API key..."
}
```

### Get Project Info

```
GET /v1/projects/me
```

**Response:**
```json
{
  "id": "uuid",
  "name": "My App",
  "plan": "free",
  "usage": {
    "memories": 42,
    "sessions": 5,
    "api_calls_30d": 1234,
    "tokens_30d": 5678
  }
}
```

---

## Memory

### Store a Memory

```
POST /v1/memory/store
```

**Body:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| content | string | yes | — | Memory content (max 50K chars) |
| scope | string | no | "default" | Memory scope (user, session, agent, org, custom) |
| scope_id | string | no | "global" | Scope identifier |
| kind | string | no | "text" | text, fact, preference, conversation, document |
| metadata | object | no | {} | Arbitrary JSON metadata |
| importance | number | no | 0.5 | 0-1 importance score |
| expires_in | number | no | null | TTL in seconds |

**Response (201):**
```json
{
  "id": "uuid",
  "scope": "user",
  "scope_id": "user_123",
  "kind": "preference",
  "has_embedding": true,
  "created_at": "2026-03-28T..."
}
```

### Recall Memories

```
POST /v1/memory/recall
```

Smart retrieval with semantic search, recency scoring, and token budgeting.

**Body:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| query | string | yes | — | What to search for |
| scope | string | no | — | Filter by scope |
| scope_id | string | no | — | Filter by scope_id |
| kind | string | no | — | Filter by kind |
| limit | number | no | 10 | Max results (max 50) |
| min_score | number | no | 0.3 | Minimum relevance score |
| max_age | number | no | — | Max age in seconds |
| budget_tokens | number | no | — | Max total tokens across results |

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "content": "User prefers dark mode",
      "kind": "preference",
      "scope": "user",
      "scope_id": "user_123",
      "score": 0.87,
      "metadata": {},
      "created_at": "2026-03-28T..."
    }
  ],
  "count": 1,
  "query": "user preferences"
}
```

### Get a Memory

```
GET /v1/memory/:id
```

### Delete a Memory

```
DELETE /v1/memory/:id
```

### List Memories

```
GET /v1/memory?scope=user&scope_id=user_123&kind=preference&limit=20&offset=0
```

---

## Sessions

### Create a Session

```
POST /v1/sessions
```

**Body:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| external_id | string | no | — | Your own session identifier |
| scope | string | no | "default" | Session scope |
| scope_id | string | no | "global" | Scope identifier |
| metadata | object | no | {} | Arbitrary metadata |

### Add a Message

```
POST /v1/sessions/:id/messages
```

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| role | string | yes | user, assistant, system, tool |
| content | string | yes | Message content |
| metadata | object | no | Arbitrary metadata |

### Get Context

```
POST /v1/sessions/:id/context
```

Returns an optimized context window fitted to your token budget.

**Body:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| budget_tokens | number | no | 4000 | Max tokens for context |
| include_summary | boolean | no | true | Include session summary |
| include_memories | boolean | no | true | Include relevant memories |
| memory_query | string | no | — | Query for memory recall |
| memory_limit | number | no | 5 | Max memories to include |

**Response:**
```json
{
  "session_id": "uuid",
  "context": [
    { "type": "summary", "content": "...", "tokens": 50 },
    { "type": "messages", "content": "...", "tokens": 200 },
    { "type": "memories", "content": "...", "tokens": 100 }
  ],
  "total_tokens": 350,
  "budget_tokens": 4000,
  "budget_used_pct": 9
}
```

### Get Messages

```
GET /v1/sessions/:id/messages?limit=50&before=<datetime>
```

### Delete a Session

```
DELETE /v1/sessions/:id
```

### List Sessions

```
GET /v1/sessions?limit=20&offset=0
```

---

## Facts

### Extract Facts from Text

```
POST /v1/facts/extract
```

Automatically extracts structured subject-predicate-object facts from text.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| text | string | yes | Text to extract facts from |
| scope | string | no | Scope for stored facts |
| scope_id | string | no | Scope identifier |

**Response:**
```json
{
  "facts": [
    { "id": "uuid", "subject": "Max", "predicate": "is", "object": "an entrepreneur", "confidence": 0.7 }
  ],
  "count": 3
}
```

### List Facts

```
GET /v1/facts?scope=user&scope_id=user_123&subject=Max&limit=50
```

### Get Facts About a Subject

```
GET /v1/facts/about/:subject
```

### Delete a Fact

```
DELETE /v1/facts/:id
```

---

## Rate Limits

| Plan | Requests/min |
|------|-------------|
| Free | 60 |
| Indie | 200 |
| Pro | 600 |
| Scale | 2,000 |
| Enterprise | 10,000 |

Rate limit headers are included in every response:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

---

## Errors

All errors follow this format:

```json
{
  "error": "Error type",
  "message": "Human-readable description"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request (invalid params) |
| 401 | Invalid or missing API key |
| 403 | API key lacks required scope |
| 404 | Resource not found |
| 409 | Conflict (duplicate resource) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
