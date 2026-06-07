# Memlink — TO-DO

## ✅ Fase 1 — CLI local (v1.2.1)

### Storage
- [x] `meta.json` — memoryId, token, status, createdAt, lastServedAt
- [x] `.session` — última conexión, reads, writes
- [x] `.health` — heartbeat del daemon cada 30s
- [x] Entries `.json` → `.md` con frontmatter YAML
- [x] `index.json` se mantiene igual (índice ligero)
- [x] Backups pasan a `.md`

### Server (daemon)
- [x] Routing por `?t=token` (reemplaza `?id=`)
- [x] `default` se sirve sin token
- [x] Token inválido → 401
- [x] Tabla en memoria `Map<token, MemoryRoute>` — sin IPC
- [x] Health ticker cada 30s → `.health`
- [x] Session tracking en cada request MCP
- [x] Admin API `/admin/{register,pause,resume,stop}` protegida por token local
- [x] CLI `memlink pause/resume/stop --memory <name>` (runtime, sin restart)
- [x] `--daemon-child` flag (Windows VBScript reliability)
- [x] PID file `.serve.pid` escrito por el grandchild (Windows fix v1.2.1)

### CLI — Comandos nuevos (v1.1+)
- [x] `memlink add "<title>" "<content>"` — escribe entry en default
- [x] `memlink entries` — lista entries de default
- [x] `memlink search <query>` — busca en default
- [x] `memlink url` — muestra URL MCP + JSON config
- [x] `memlink token [list|revoke]` — gestiona tokens
- [x] `memlink pause --memory <name>` — suspende memoria
- [x] `memlink resume --memory <name>` — reactiva
- [x] `memlink connect` / `memlink disconnect` — stub cloud (Phase 2)

### CLI — Comandos removidos (v1.2.0 BREAKING)
- [x] `memlink install` — era daemon systemd/launchd; ahora se usa `memlink serve --daemon`
- [x] `memlink uninstall` — sin servicio que remover

### CLI — Comandos eliminados
- [x] `init`, `create` → memorias se crean implícitamente en primer write
- [x] `ls` → `memlink info <name>`
- [x] `show` → `memlink entries` + `memlink search`
- [x] `connect` (old) → `memlink url`
- [x] `bug`, `changelog`, `doctor`

### CLI — Mantenidos
- [x] `memlink serve` (daemon + foreground + stdio)
- [x] `memlink stop`
- [x] `memlink status` (usa `.health` + `.serve.pid`)
- [x] `memlink delete`
- [x] `memlink export`
- [x] `memlink import`
- [x] `memlink info`
- [x] `memlink config`
- [x] `memlink skill` (SKILL.md bien documentado)

### MCP Tools (4)
- [x] `memory_read` — index o entry específico (`id?`, `title?`, `full?`)
- [x] `memory_edit` — create/update (`title`, `content`, `tags?`)
- [x] `memory_search` — por query
- [x] `memory_sync` — stats

### Distribución
- [x] npm — `@memlink/cli@1.2.1`
- [x] install.sh — Linux/macOS standalone
- [x] install.ps1 — Windows standalone
- [x] GitHub Releases — binarios cross-compile con Bun (5 OS/arch desde ubuntu-latest)
- [x] v1.0.x y v1.1.1 deprecados en npm
- [x] License corregido a Apache 2.0 en todos lados
- [ ] Docker — `docker run rblez/memlink` (próximamente)

### Repo
- [x] Final home: `rblez/memlink` (force-push desde `aiustantt/memlink`)
- [x] wslink queda en `pyrofast/wslink` (no se migra)
- [x] Default branch `main`
- [x] Tests: 43 pass, 0 fail
- [x] TypeScript strict: clean
- [x] Prettier: clean

---

## ⬜ Fase 1 — Pendiente

### Bug fixes v1.2.1
- [ ] Verificar fix de PID file en Windows (test manual del usuario)
- [ ] Verificar que `MEMLINK_DAEMON_CHILD` env var ya no es necesaria (--daemon-child es suficiente)

---

## ⬜ Fase 2 — Cloud (repo: `rblez/memlink-cloud`)

### Stack
- [ ] Vercel → `memlink.cloud` + `mcp.memlink.cloud`
- [ ] Supabase — auth + datos
- [ ] Next.js — web + API routes

### Supabase schema
- [ ] `users` — id, email, provider, createdAt
- [ ] `devices` — id, userId, code, expiresAt, ip, browser, os
- [ ] `tokens` — id, userId, label, token, lastUsedAt, revokedAt
- [ ] `entries` — id, userId, memoryId, title, content, tags, updatedAt

### Pages
- [ ] `memlink.cloud` — landing + docs + install
- [ ] `memlink.cloud/cli` — device flow
- [ ] `memlink.cloud/cli/success`
- [ ] `memlink.cloud/auth` — register + login

### API routes
- [ ] `POST /api/device/code`
- [ ] `GET /api/device/token?code=`
- [ ] `POST /api/device/activate`
- [ ] `POST /api/memory/entries`
- [ ] `GET /api/memory/entries`
- [ ] `POST /api/tokens`
- [ ] `GET /api/tokens`
- [ ] `DELETE /api/tokens/:id`

### mcp.memlink.cloud
- [ ] `/mcp?t=xxx` — valida token → lee Supabase → responde MCP
- [ ] `/health` — healthcheck Vercel

### CLI cloud integration
- [ ] `memlink connect` — device flow real
- [ ] `memlink disconnect` — desvincula
- [ ] `auth.json` cloud — userId, accessToken, refreshToken (o mover a `settings.json.auth.cloud`)

---

## ⬜ Fase 3 — SDK

- [ ] `npm install @memlink/sdk`
- [ ] `MemlinkAdapter` — Anthropic, OpenAI, DeepSeek, Anomalyco
- [ ] `await memory.save(messages)`
- [ ] `await memory.recall(query)`

---

## ⬜ Distribución futura

- [ ] Docker — `docker run rblez/memlink`
- [ ] Homebrew tap — `brew install rblez/tap/memlink`
- [ ] Scoop bucket (Windows) — `scoop install memlink`
