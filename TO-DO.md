# Memlink — TO-DO

## ✅ Fase 1 — CLI local (Completado)

### Storage
- [x] `meta.json` — id, token, status, createdAt, lastServedAt
- [x] `auth.json` — tokens local + cloud
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
- [x] Health ticker cada 30s
- [x] Session tracking en cada request MCP

### CLI — Comandos nuevos
- [x] `memlink add "<title>" "<content>"` — escribe entry en default
- [x] `memlink entries` — lista entries de default
- [x] `memlink search <query>` — busca en default
- [x] `memlink url` — muestra URL MCP + JSON config
- [x] `memlink token [list|revoke]` — gestiona tokens
- [x] `memlink pause --memory <name>` — suspende memoria
- [x] `memlink install` — daemon systemd user / launchd
- [x] `memlink uninstall` — remueve daemon
- [x] `memlink connect` — stub cloud (Phase 2)
- [x] `memlink disconnect` — stub cloud (Phase 2)
- [x] `memlink install` en Windows — solo documenta `--daemon` (no auto-start nativo)

### CLI — Comandos eliminados
- [x] `init`, `create` → se crean implícitamente
- [x] `ls` → `memlink info <name>`
- [x] `show` → `memlink entries` + `memlink search`
- [x] `connect` (old) → `memlink url`
- [x] `bug`, `changelog`, `doctor`

### CLI — Mantenidos
- [x] `memlink serve` (daemon + foreground + stdio)
- [x] `memlink stop`
- [x] `memlink status` (usa `.health` como fuente de verdad)
- [x] `memlink delete`
- [x] `memlink export`
- [x] `memlink import`
- [x] `memlink info`
- [x] `memlink config`
- [x] `memlink skill` (SKILL.md mejor documentado)

### Devops
- [x] Repo migrado: `rblez/memlink` → `aiustantt/memlink` → `rblez/memlink` (final)
- [x] Remote actualizado
- [x] Version bump: 1.0.12 → 1.0.15
- [x] Tag `v1.0.15` + GitHub Release
- [x] PR #1 mergeado a `main`
- [x] Branch `new/v1.0.15-beta` eliminado
- [x] Default branch corregido a `main`
- [x] Tests: 43 pass, 0 fail

---

## ⬜ Fase 1 — Pendiente

### CLI
- [ ] `memlink serve --memory <name>` — generar token y registrar en daemon runtime
- [ ] Comunicación runtime daemon ↔ CLI para registro de memorias sin reinicio

### wslink (repo: `pyrofast/wslink`)
- [ ] Binario Go `wslink` Linux
- [ ] `wslink forward 4444` — proxy WSL:4444 → Windows:4444
- [ ] CI cross-compile Go + C#

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
- [ ] `auth.json` cloud — userId, accessToken, refreshToken

---

## ⬜ Fase 3 — SDK

- [ ] `npm install @memlink/sdk`
- [ ] `MemlinkAdapter` — Anthropic, OpenAI, DeepSeek, Anomalyco
- [ ] `await memory.save(messages)`
- [ ] `await memory.recall(query)`

## ⬜ Distribución

- [x] npm — `npm install -g @memlink/cli` (v1.0.12, necesita bump a 1.1.1)
- [x] install.sh — Linux/macOS standalone
- [x] install.ps1 — Windows standalone
- [x] GitHub Releases — binarios cross-compile con Bun
- [ ] Docker — `docker run rblez/memlink` (próximamente)
