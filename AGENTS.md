# AI剧本杀 — Agent Guide

AI-driven murder mystery game. All roles are played by AI. Full game flow: background → intro → investigation → discussion → voting → reveal.

**Tech stack**: FastAPI (Python 3.13+) + Next.js 15 (TypeScript), PostgreSQL, WebSocket, OpenAI-compatible LLMs, TTS, image generation.

---

## Quick Start Commands

### Backend
```bash
cd backend
uv sync                   # install dependencies
uv run python main.py     # start dev server (port 8010)
uv run pytest             # run all tests
uv run pytest -m api      # run by marker (api / unit / integration / slow)
uv run pytest tests/test_script_api.py  # single file
```

### Frontend
```bash
cd frontend
npm run dev               # dev server (port 3001)
npm run build && npm run start  # production (port 8009)
npm run generate-api      # regenerate OpenAPI client from http://localhost:8010/openapi.json
```

> The frontend dev server is hot-reloading. Don't restart it if a port is already occupied.

---

## Backend Architecture

Entry: `backend/main.py` → app wiring in [`backend/src/core/server.py`](backend/src/core/server.py).

```
src/
├── api/routes/       # Route handlers (auth, scripts, game, character, evidence, location, tts, image, etc.)
├── core/             # App wiring, DI container, auth middleware, WebSocket server, game engine
├── db/
│   ├── models/       # SQLAlchemy ORM models
│   ├── repositories/ # Data access layer
│   ├── session.py    # Engine + session factory
│   └── migrations/   # Alembic migrations
├── schemas/          # Pydantic request/response models
└── services/         # Business logic (auth, LLM, TTS, image, script editor, game history, etc.)
```

### Dependency Injection

Custom DI container in [`backend/src/core/dependency_container.py`](backend/src/core/dependency_container.py). Three lifetimes: `singleton`, `scoped`, `transient`.

- **Singletons**: `DatabaseManager`, `LLMService`
- **Scoped** (per-request, auto DB commit/rollback): repositories, most services
- FastAPI integration via [`backend/src/core/container_integration.py`](backend/src/core/container_integration.py)

See [DEPENDENCY_INJECTION_MIGRATION.md](backend/docs/DEPENDENCY_INJECTION_MIGRATION.md) for migration details and [SERVICE_ARCHITECTURE.md](backend/docs/SERVICE_ARCHITECTURE.md) for service design.

### Authentication

Unified JWT middleware in [`backend/src/core/auth_middleware.py`](backend/src/core/auth_middleware.py):
- Path-regex policies: `NONE` / `OPTIONAL` / `REQUIRED` / `ADMIN`
- Injects `request.state.current_user` and `request.state.is_authenticated`
- Some routes still use `Depends(get_current_active_user)` from [`auth_dependencies.py`](backend/src/core/auth_dependencies.py) — both approaches coexist

See [AUTH_MIDDLEWARE_GUIDE.md](backend/docs/AUTH_MIDDLEWARE_GUIDE.md) for usage.

### Database

- ORM: SQLAlchemy (sync) declarative models
- Session: `sessionmaker` in [`backend/src/db/session.py`](backend/src/db/session.py)
- Migrations: Alembic in [`backend/src/db/migrations/`](backend/src/db/migrations/)
- **Note**: `init_database()` also calls `create_tables()` at startup — runtime auto-create coexists with Alembic

### WebSocket

- Endpoint: `GET /api/ws?token=...&script_id=...` in [`server.py`](backend/src/core/server.py)
- Core logic in [`backend/src/core/websocket_server.py`](backend/src/core/websocket_server.py)
- Message routing by `type` field to handler registry
- Sessions map: `session_id → GameSession`, `websocket → session_id`

---

## Frontend Architecture

Pages Router (`src/pages/`). See [frontend instructions](.github/instructions/frontend.instructions.md) for full conventions.

```
src/
├── client/           # Auto-generated OpenAPI client (DO NOT edit manually)
├── components/
│   ├── ui/           # shadcn/ui base components (kebab-case filenames)
│   └── *.tsx         # Business components (PascalCase filenames)
├── hooks/            # Custom React hooks
├── pages/            # Next.js pages
├── services/         # Hand-written API wrappers (authService, scriptService, etc.)
├── stores/           # Zustand stores
└── types/            # TypeScript types
```

### State Management (Zustand)

Key stores:
- [`authStore.ts`](frontend/src/stores/authStore.ts) — auth state + token
- [`websocketStore.ts`](frontend/src/stores/websocketStore.ts) — WebSocket connection + game runtime state
- [`configStore.ts`](frontend/src/stores/configStore.ts) — API base URL configuration

Store pattern: `useXxxStore`, file named `xxxStore.ts`, uses `persist` for durable state.

### API Calls

Prefer the **auto-generated client** (`src/client/`) for new endpoints. Run `npm run generate-api` after backend schema changes. Hand-written services in `src/services/` wrap the generated client or call `fetch` directly. Base URL comes from `configStore`.

### Design System

Dark theme. Primary gradient: `from-[#1a237e] via-[#311b92] to-[#4a148c]`. Use Tailwind + shadcn/ui. See [frontend instructions](.github/instructions/frontend.instructions.md) for color, spacing, and component conventions.

---

## Testing

Tests live in [`backend/tests/`](backend/tests/). Key files:

- [`conftest.py`](backend/tests/conftest.py) — fixtures: `test_client`, `mock_db_session` (autouse), `mock_current_user`
- [`factories.py`](backend/tests/factories.py) — reusable model factories
- Markers: `api`, `unit`, `integration`, `slow`

Mocking: `mock_db_session` patches `db_manager` globally; don't set up real DB in unit tests.

---

## Environment Variables

| Category | Key variables |
|----------|--------------|
| LLM | `LLM_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` |
| TTS | `TTS_PROVIDER`, `TTS_API_KEY`, `TTS_MODEL`, `MINIMAX_GROUP_ID`, `COSYVOICE_BASE_URL` |
| Database | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` |
| Storage | `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET_NAME` |
| Auth | `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES` |
| Server | `HOST`, `PORT`, `DEBUG` |

Config loaded in [`backend/src/core/config.py`](backend/src/core/config.py).

---

## Key Docs

| Doc | Topic |
|-----|-------|
| [AUTH_MIDDLEWARE_GUIDE.md](backend/docs/AUTH_MIDDLEWARE_GUIDE.md) | How to use the unified auth middleware |
| [DEPENDENCY_INJECTION_MIGRATION.md](backend/docs/DEPENDENCY_INJECTION_MIGRATION.md) | DI container migration and usage |
| [SERVICE_ARCHITECTURE.md](backend/docs/SERVICE_ARCHITECTURE.md) | Service layer design patterns |
| [MINIMAX_CLIENT_GUIDE.md](backend/docs/MINIMAX_CLIENT_GUIDE.md) | MiniMax TTS/image integration |
| [README_SCRIPT_MANAGER.md](backend/docs/README_SCRIPT_MANAGER.md) | Script management features |
| [migration_guide.md](backend/docs/migration_guide.md) | Data model migration notes |
