# Streamline

A minimal streaming AI chat app: create a conversation, send a message, watch
the reply stream back token by token, and come back to it later — everything
persisted in Postgres.

Built to demonstrate one thing done properly rather than many things done
loosely: SSE streaming, a real relational schema, and the failure states
(loading, empty, error, dropped connection) that portfolio projects usually
skip.

![Streamline demo](docs/demo.gif)
<!-- Replace with an actual screenshot/GIF before sharing this repo. -->

## What it does

- Create a conversation, send a message, and watch the assistant's reply
  stream in token by token.
- List past conversations in a sidebar, resume any of them, delete any of
  them.
- Every message is persisted to Postgres as it's typed/streamed — reload
  mid-stream and you still see what came through.
- If a stream is stopped or the connection drops, the partial reply is kept
  and visibly marked as incomplete, not silently discarded or shown as done.

**Out of scope, deliberately:** auth (single demo user), file uploads,
multi-model routing, message editing/branching, rate limiting. The goal was
depth on four things, not breadth across many.

## Stack

| Concern       | Choice                                                     |
| ------------- | -----------------------------------------                  |
| Framework     | Next.js 16 (App Router), TypeScript                        |
| API layer     | Server Actions (mutations) + a Route Handler (SSE stream)  |
| Database      | Postgres (Neon), Drizzle ORM                               |
| LLM           | Anthropic Messages API, streamed                           |
| Styling       | Tailwind CSS                                               |
| Tests         | Vitest (unit), Playwright (E2E)                            |
| Ops           | Dockerfile (standalone build), GitHub Actions CI           |

## Architecture decisions

**Why SSE instead of WebSockets.** The traffic is one-directional and
short-lived: the client sends one message, the server streams tokens back,
the exchange ends. WebSockets buy you bidirectional, long-lived connections —
useful for typing indicators or multi-user presence, neither of which this
app has. SSE rides on plain HTTP, so it survives proxies/load balancers
without special config, reconnects are just "make another request," and the
server side is a `ReadableStream` in a route handler — no separate socket
server or connection-state store to manage. The one wrinkle: `EventSource`
only does GET, and sending a message needs a POST body, so the client
consumes the stream with `fetch` + a manual reader instead of the
`EventSource` API. The wire format is still SSE (`data: {...}\n\n` frames);
see `src/lib/sse.ts` for the shared encode/parse logic and
`tests/unit/sse.test.ts` for the chunk-boundary edge cases (a `data:` frame
can arrive split across two TCP reads — the parser buffers a partial trailing
frame across calls).

**Why this schema.** Three tables: `users`, `conversations`, `messages`.
- `users` exists mainly so the schema isn't a lie about what a "real" version
  would look like — today the app seeds and reuses a single demo user rather
  than building auth.
- `conversations` holds a denormalized `updated_at`, bumped on every new
  message, so "list conversations by recency" (the sidebar's hot path) is a
  single indexed range scan (`conversations_user_id_updated_at_idx`) instead
  of a join + aggregate over `messages`.
- `messages` stores role, content, and `completed_at`. `completed_at` is the
  load-bearing column for the dropped-stream case below. Indexed on
  `(conversation_id, created_at)` since "load a conversation's transcript in
  order" is the other hot path.

**How a broken stream is handled.** The assistant's message row is inserted
*before* the model starts responding, with empty content and
`completed_at = null`. As tokens arrive, the row is updated periodically
(every ~40 characters, not every token — a middle ground between losing more
partial text on a drop and hammering the DB on every delta). `completed_at`
is only set once the stream finishes cleanly. If the client disconnects, the
user clicks Stop, or the Anthropic call throws mid-stream, the `catch`/abort
path persists whatever text had accumulated and leaves `completed_at` null.
On reload, any message with content but no `completed_at` renders with a
visible "connection dropped before this reply finished" note instead of
looking like a normal, complete answer — the UI treats "streaming," "done,"
and "dropped" as three distinct, explicit states (`ChatView.tsx`), not two.

**Why Server Actions for mutations, a Route Handler for the stream.**
Creating and deleting a conversation are simple, form-shaped mutations with
no need for a persistent connection — Server Actions keep those colocated
with the UI and give progressive-enhancement-friendly `<form action={...}>`
for free. Streaming needs a raw `Response` with a `ReadableStream` body and
custom headers (`Content-Type: text/event-stream`), which Server Actions
don't expose — hence a dedicated `POST /api/chat` route handler.

## Local setup

1. **Database.** Create a free [Neon](https://neon.tech) project and copy
   its connection string.
2. **LLM key.** Get an API key from the
   [Anthropic Console](https://console.anthropic.com).
3. **Env.**
   ```bash
   cp .env.example .env.local
   # fill in DATABASE_URL and ANTHROPIC_API_KEY
   ```
4. **Install & migrate.**
   ```bash
   pnpm install
   pnpm db:migrate
   ```
5. **Run.**
   ```bash
   pnpm dev
   ```
   Open http://localhost:3000.

### Tests

```bash
pnpm test:unit          # Vitest — pure logic (SSE framing), no network/DB
pnpm exec playwright install chromium   # one-time browser install
pnpm test:e2e            # Playwright — full stack, needs a real DB + API key
```

### Docker

```bash
docker build -t streamline .
docker run -p 3000:3000 --env-file .env.local streamline
```

### Schema changes

Edit `src/db/schema.ts`, then:

```bash
pnpm db:generate   # writes a new SQL migration under drizzle/
pnpm db:migrate    # applies pending migrations
```

## Project layout

```
src/
  app/
    api/chat/route.ts        # SSE streaming endpoint
    actions.ts                # create/delete conversation server actions
    conversations/[id]/       # conversation page
  components/
    ChatView.tsx               # streaming UI + loading/empty/error/dropped states
    Sidebar.tsx                 # conversation list
  db/
    schema.ts                   # Drizzle schema
    queries.ts                   # all DB access goes through here
  lib/
    sse.ts                        # SSE encode/parse, shared client+server
    anthropic.ts                   # Anthropic client + config
tests/
  unit/sse.test.ts                 # Vitest
  e2e/chat.spec.ts                  # Playwright
```
