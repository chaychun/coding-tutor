# Tauri Desktop App Migration Design

## Goal

Migrate the coding tutor from a Next.js web app to a Tauri v2 desktop application with local SQLite storage. The Claude Agent SDK must be preserved for subscription-based billing.

## Architecture

```
Tauri v2 (native window shell)
  ├── Rust core (minimal)
  │     ├── Window management
  │     ├── API key storage (Stronghold encrypted vault)
  │     ├── Sidecar lifecycle (spawn, restart, shutdown)
  │     └── Config injection (data dir, auth token, API key)
  │
  ├── Node.js sidecar (ALL backend logic)
  │     ├── Claude Agent SDK + MCP tutor tools
  │     ├── SQLite via better-sqlite3
  │     ├── HTTP server (Express/Fastify) for the React SPA
  │     └── SSE streaming for chat
  │
  └── React SPA (Vite build, loaded in Tauri webview)
        └── Talks to http://localhost:{PORT}
```

### Data Flow

```
React SPA ── HTTP ──> Node.js sidecar ──> SQLite (app data dir)
                           │
                           ├── Claude Agent SDK ──> Anthropic API
                           └── MCP tools ──> SQLite (direct access)
```

### What Rust Does (and nothing more)

1. Creates and manages the native window via Tauri webview
2. Stores the Anthropic API key in Stronghold (encrypted vault)
3. Spawns the Node.js sidecar on app launch, passing via env vars:
   - `DATABASE_PATH` — resolved from Tauri's `app_data_dir()`
   - `AUTH_TOKEN` — random token generated each launch
   - `ANTHROPIC_API_KEY` — read from Stronghold
   - `PORT` — random available port
4. Monitors the sidecar process (restart on crash, kill on app quit)
5. Exposes a few Tauri `invoke()` commands:
   - `get_sidecar_info` — returns `{ port, authToken }` for the frontend
   - `store_api_key` / `has_api_key` — manage the Stronghold vault
   - `get_sidecar_status` — health check

### What the Node.js Sidecar Does (everything else)

The sidecar is a standalone Bun-compiled binary that runs all backend logic:

- **HTTP server** serving the API endpoints (replaces Next.js API routes)
- **Claude Agent SDK** `query()` loop with MCP tools (same as current `/api/chat`)
- **MCP tutor tools** calling storage functions directly (no IPC — same process)
- **SQLite** via `better-sqlite3` for all data persistence

### What the React SPA Does (same as now, different transport)

- All existing components stay unchanged
- Hooks rewritten from `fetch('/api/...')` to `fetch('http://localhost:{PORT}/api/...')`
- On startup, calls `invoke('get_sidecar_info')` to get the sidecar's port and auth token
- Includes the auth token in all HTTP requests to the sidecar

## Security

### API Key

- User enters API key on first launch via a settings UI
- Frontend calls Tauri `invoke('store_api_key', { key })` — Rust stores in Stronghold
- Rust injects API key into sidecar's environment at spawn time
- Never written to disk unencrypted, never exposed to the frontend after storage

### Sidecar HTTP Server

- Binds to `127.0.0.1` only (not `0.0.0.0`)
- Random high port, not fixed
- Auth token required on every request (`Authorization: Bearer {token}`)
- Token generated fresh each launch by Rust, passed to sidecar via env var
- Frontend receives token via Tauri `invoke('get_sidecar_info')`

## Storage

### Location

SQLite database at Tauri's platform-specific app data directory:

- macOS: `~/Library/Application Support/com.coding-tutor.app/data.db`
- Windows: `%APPDATA%/com.coding-tutor.app/data.db`
- Linux: `~/.local/share/com.coding-tutor.app/data.db`

### SQLite Schema

```sql
-- Schema version tracking
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_session_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  topics TEXT DEFAULT '[]',           -- JSON array of strings
  active_exercise_id TEXT,
  wrap_up_summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_project_id ON sessions(project_id);
CREATE INDEX idx_sessions_updated_at ON sessions(updated_at);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  content_blocks TEXT,                -- JSON array (tool calls, text blocks)
  exercise_submission TEXT,           -- JSON object
  concept_question_answer TEXT,       -- JSON object
  timestamp TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);
CREATE INDEX idx_messages_session_sort ON messages(session_id, sort_order);

CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'write_code',
  title TEXT NOT NULL,
  language TEXT NOT NULL,
  instructions TEXT NOT NULL,
  starter_code TEXT NOT NULL,
  expected_behavior TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  hints TEXT DEFAULT '[]',            -- JSON array of strings
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_exercises_session_id ON exercises(session_id);

CREATE TABLE exercise_attempts (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  blank_values TEXT,                  -- JSON object (for fill-in-blank)
  status TEXT NOT NULL DEFAULT 'pending_review',
  feedback TEXT,
  submitted_at TEXT NOT NULL
);
CREATE INDEX idx_attempts_exercise_id ON exercise_attempts(exercise_id);

CREATE TABLE concept_questions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options TEXT NOT NULL,              -- JSON array of {text, correctness}
  selected_option_index INTEGER,
  status TEXT NOT NULL DEFAULT 'unanswered',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_concept_questions_session_id ON concept_questions(session_id);

CREATE TABLE progress (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  overall_level TEXT NOT NULL DEFAULT 'beginner',
  summary TEXT,
  mastered_concepts TEXT DEFAULT '[]',      -- JSON array of strings
  needs_reinforcement TEXT DEFAULT '[]',    -- JSON array of strings
  recent_sessions TEXT DEFAULT '[]',        -- JSON array of session note objects
  last_updated TEXT NOT NULL,
  UNIQUE(project_id, topic)
);
CREATE INDEX idx_progress_project_id ON progress(project_id);
```

### Migration from Existing JSON Data

On first launch, if JSON data exists at the legacy path (`~/coding-tutor-data`):

1. Read all project directories and session JSON files
2. Apply the same in-memory migrations the current `getSession()` does (exercises array → record, missing fields, etc.)
3. Insert into SQLite tables
4. Rename the old directory to `~/coding-tutor-data.backup`

## Frontend Migration: Next.js to Vite SPA

### What Changes

- **Build tool**: Next.js → Vite (Tauri v2 has first-class Vite support)
- **Routing**: Next.js App Router → `react-router` for client-side routing
- **Entry point**: `src/app/layout.tsx` + `src/app/page.tsx` → `index.html` + `src/main.tsx`
- **Hook transport**: `fetch('/api/...')` → `fetch('http://localhost:{PORT}/api/...')` with auth header

### What Stays the Same

- All component files (`Chat/`, `Exercise/`, `Sidebar/`, `ui/`)
- `globals.css`, Tailwind CSS, PostCSS config
- Types in `src/lib/types/index.ts`
- Monaco editor integration
- Motion/animation libraries

### Hook Rewrites

The hooks (`useProjects`, `useSessions`, `useChat`) change their transport from relative URL fetches to absolute localhost fetches with auth. The shape of the API responses stays identical — the sidecar's HTTP endpoints return the same JSON.

```typescript
// Before (Next.js)
const res = await fetch("/api/projects");

// After (Tauri + sidecar)
const res = await fetch(`http://localhost:${sidecarPort}/api/projects`, {
  headers: { Authorization: `Bearer ${authToken}` },
});
```

A thin wrapper handles the port/token injection so individual hooks barely change.

### Chat Streaming

SSE streaming works the same way — the sidecar exposes the same `/api/chat` endpoint with identical SSE format. The only change is the URL and auth header.

## Sidecar Details

### Backend HTTP Server

The sidecar runs a lightweight HTTP server (Express or Fastify) exposing:

```
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
PATCH  /api/projects/:projectId
DELETE /api/projects/:projectId

GET    /api/projects/:projectId/sessions
POST   /api/projects/:projectId/sessions
GET    /api/projects/:projectId/sessions/:sessionId
PATCH  /api/projects/:projectId/sessions/:sessionId

POST   /api/projects/:projectId/sessions/:sessionId/exercises/:exerciseId/attempts
POST   /api/projects/:projectId/sessions/:sessionId/exercises/:exerciseId/retry
POST   /api/projects/:projectId/sessions/:sessionId/exercises/:exerciseId/skip

POST   /api/projects/:projectId/sessions/:sessionId/concept-questions/:questionId/answer

POST   /api/chat
```

These map 1:1 to the current Next.js API routes.

### MCP Tool Changes

The MCP tools in `tutorServer.ts` currently import from `../storage` and call functions like `addExerciseToSession()`. These storage functions get rewritten from JSON file I/O to SQLite queries, but the MCP tool definitions stay the same.

The one notable fix: `update_exercise` currently fetches the session via HTTP to itself (`fetch(NEXT_PUBLIC_BASE_URL/api/...)`) to read exercise state before updating. This becomes a direct SQLite query in the same process — simpler and atomic.

### Compilation

The sidecar is compiled to a standalone binary via `bun build --compile`:

```bash
bun build ./src/sidecar/index.ts --compile --outfile coding-tutor-sidecar
```

This produces a ~90-100MB platform-specific binary that includes the Bun runtime, `better-sqlite3` native addon, and all TypeScript code.

Tauri's sidecar configuration in `tauri.conf.json` points to this binary.

## Implementation Phases

### Phase 1: Scaffold Tauri + Vite

1. Initialize Tauri v2 in the project
2. Set up Vite with React (replace Next.js)
3. Add `react-router` for client-side routing
4. Create `index.html` and `src/main.tsx`
5. Verify existing React components render in Vite dev server

### Phase 2: Sidecar Backend

6. Create the sidecar entry point (`src/sidecar/index.ts`)
7. Set up Express/Fastify HTTP server with auth middleware
8. Implement SQLite schema initialization + migrations via `better-sqlite3`
9. Rewrite storage functions from JSON file I/O to SQLite queries
10. Wire up all API route handlers (same logic as current Next.js routes)
11. Move Agent SDK chat endpoint to the sidecar server
12. Fix `update_exercise` MCP tool to use direct SQLite query instead of self-HTTP-fetch

### Phase 3: Rust Core

13. Implement Stronghold-based API key storage
14. Implement sidecar spawning with config injection
15. Add sidecar health monitoring + crash recovery
16. Expose `invoke()` commands: `get_sidecar_info`, `store_api_key`, `has_api_key`, `get_sidecar_status`
17. Add first-launch API key setup UI

### Phase 4: Frontend Rewrites

18. Create fetch wrapper that injects sidecar port + auth token
19. Update `useProjects.ts` to use the wrapper
20. Update `useSessions.ts` to use the wrapper
21. Update `useChat.ts` to use the wrapper (chat streaming URL + exercise/question mutations)
22. Add startup flow: wait for sidecar ready → load app

### Phase 5: Data Migration + Cleanup

23. Implement JSON-to-SQLite migration script for existing data
24. Remove Next.js: delete API routes, `next.config.ts`, `next` dependency
25. Remove old `src/lib/storage/` (JSON file I/O code)
26. Update `package.json` scripts for Vite + Tauri
27. Configure Tauri for production builds (app name, icon, bundle ID)

### Phase 6: Polish

28. App icon and branding
29. Loading/splash screen while sidecar boots
30. Graceful error states (no API key, sidecar crash, no internet)
31. Cross-platform testing (macOS first, then Windows/Linux)
