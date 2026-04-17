# trigger-exp

Experimental chat agent powered by [Trigger.dev](https://trigger.dev) and the [Vercel AI SDK](https://sdk.vercel.ai).

## Prerequisites

- [Bun](https://bun.sh) (v1.x)
- [Node.js](https://nodejs.org) (v20+)
- A [Trigger.dev](https://trigger.dev) account with a project
- An OpenAI API key

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment variables

Copy the example and fill in your keys:

```bash
cp packages/api/.env.example packages/api/.env
```

**Required variables:**

| Variable | Description |
|---|---|
| `TRIGGER_SECRET_KEY` | Trigger.dev secret key |
| `TRIGGER_API_URL` | Trigger.dev API URL |
| `TRIGGER_ACCESS_TOKEN` | Trigger.dev access token |
| `TRIGGER_PROJECT_REF` | Trigger.dev project reference |
| `OPENAI_API_KEY` | OpenAI API key (used by the agent) |

**Optional:**

| Variable | Description |
|---|---|
| `PORT` | API server port (default: `3001`) |
| `NODE_ENV` | Environment (default: `development`) |
| `DB_PATH` | Absolute path to SQLite database (default: `<cwd>/data/chat.db`) |

### 3. Run database migration

This creates the SQLite database and tables. Run from the project root:

```bash
bun db:migrate
```

> **Note:** The database is stored at `packages/api/data/chat.db` by default. Both the API server and the Trigger.dev worker resolve this path from `process.cwd()`, so always run commands from the correct directory (`packages/api` or project root).

## Running

### Option A: Two terminals (recommended)

```bash
# Terminal 1 — API server + Trigger.dev worker together
cd packages/api
bun run dev:both

# Terminal 2 — Web frontend (port 5173)
cd packages/web
bun run dev
```

### Option B: Three separate terminals

```bash
# Terminal 1 — API server (port 3001)
cd packages/api
bun run dev

# Terminal 2 — Trigger.dev dev worker
cd packages/api
bun run dev:worker
# or from root: bun trigger:dev

# Terminal 3 — Web frontend (port 5173)
cd packages/web
bun run dev
```

> **Important:** All three services must be running for the app to work.
> - **API server** — handles token creation, chat CRUD, and the backend (port 3001)
> - **Trigger.dev worker** — runs the agent-chat task that handles AI streaming
> - **Web frontend** — proxies `/api` requests to the API server (port 5173)

### Available scripts

| Script | Location | Description |
|---|---|---|
| `bun run dev` | `packages/api` | Start the API server (port 3001) |
| `bun run dev:worker` | `packages/api` | Start the Trigger.dev worker |
| `bun run dev:both` | `packages/api` | Start API + worker together (via concurrently) |
| `bun run dev` | `packages/web` | Start the Vite dev server (port 5173) |
| `bun db:migrate` | root | Create/migrate the SQLite database |
| `bun trigger:dev` | root | Shortcut for the Trigger.dev worker |

## Usage

1. Open http://localhost:5173
2. The home page lists all existing chats
3. Click **+ New Chat** to start a new conversation
4. The agent has access to these tools: weather lookup, deep research, and calculator
5. Click any chat to resume it — refreshing the page reconnects to running streams

## Project Structure

```
trigger-exp/
├── packages/
│   ├── api/                 # Hono API server (port 3001)
│   │   ├── src/
│   │   │   ├── db/          # SQLite schema, queries, migrations
│   │   │   ├── routes/      # HTTP routes (chat tokens, CRUD)
│   │   │   ├── trigger/     # Trigger.dev agent-chat definition
│   │   │   └── tools/       # Mock tools (weather, research, calc)
│   │   ├── .env             # Environment variables (not committed)
│   │   └── .env.example     # Example env file
│   └── web/                 # React + Vite frontend (port 5173)
│       └── src/
│           ├── components/  # ChatProvider, ChatView
│           ├── lib/chat/    # Chat class (AbstractChat), hooks, throttle
│           └── pages/       # Home (chat list), ChatPage (/chat/:id)
├── package.json             # Root Turborepo config + scripts
└── README.md
```

## Architecture

```
Browser (localhost:5173)
  │
  ├─ /              → Home page (lists chats from GET /api/chat/list)
  └─ /chat/:id      → Chat page
       │
       ├─ ChatProvider creates TriggerChatTransport
       │   ├─ fetchAccessToken  → GET  /api/chat/agent/token
       │   ├─ renewRunAccessToken → POST /api/chat/agent/renew-token
       │   ├─ preload (on page load for existing chats)
       │   └─ resumeStream (reconnects if chat status is "running")
       │
       └─ Chat class (extends AbstractChat from ai SDK)
            └─ useSyncExternalStore hooks for messages, status, error

API Server (localhost:3001)
  │
  ├─ GET  /api/chat/agent/token       → creates Trigger.dev access token
  ├─ POST /api/chat/agent/renew-token → renews token for existing run
  ├─ GET  /api/chat/list              → lists all chats
  ├─ GET  /api/chat/:chatId           → gets chat + messages
  └─ DELETE /api/chat/:chatId         → deletes a chat

Trigger.dev Worker
  │
  └─ agent-chat task
       ├─ onPreload        → init locals, update session metadata
       ├─ onValidateMessages → reject messages > 8000 chars
       ├─ hydrateMessages  → load DB messages, persist user message
       ├─ onTurnStart      → set status to "running"
       ├─ onTurnComplete   → persist assistant message, set "completed"
       ├─ prepareMessages  → filter empty text blocks
       └─ run              → streamText with GPT-4o + tools
```
