# FAQ

## WSL / Windows networking

WSL2 has its own network interface — `localhost` in WSL is **not** `localhost` in Windows. Trying to connect an agent in WSL to memlink on Windows (or vice versa) does not work reliably.

**The real solution: run everything inside WSL.**

```bash
npm install -g @memlink/cli
memlink serve --daemon
```

All agents running in WSL (OpenCode, Devin, etc.) use `localhost:4444` with zero networking issues. No bridges, no IP detection, no magic. Just works.

---

## General

### What port does memlink use by default?

`4444`. Change it with `--port`, `MEMLINK_PORT`, or `serverPort` in `~/.memlink/settings.json`.

### Where is data stored?

`~/.memlink/` — each memory is a subdirectory with `index.json`, `meta.json`, `1.md`/`2.md`/..., and `.backups/`. The default memory is at `~/.memlink/default/`.

### How do I update memlink?

```bash
npm update -g @memlink/cli
```

Or re-run `npm update -g @memlink/cli`.

### How do I run memlink as a permanent service?

Memlink v1.2.1 does not include `memlink install`/`memlink uninstall` — the daemon is per-session by design. For a permanent setup, use your OS service manager:

- **Linux**: `systemd --user` unit
- **macOS**: `launchd` user agent
- **Windows**: NSSM, pm2, or Task Scheduler

See [installation.md](installation.md#running-the-server) for examples.

### What's the difference between the default memory and named memories?

- **Default memory** (`~/.memlink/default/`) is auto-created on first run, accessible at `http://localhost:4444/mcp` (no token needed)
- **Named memories** are created implicitly when you write to them: `memlink add "..." --memory my-project`. They get a unique token; connect at `http://localhost:4444/mcp?t=<token>`

### How are entries stored?

Markdown files with YAML frontmatter:

```markdown
---
id: 1
title: ProjectGoals
tags: [project, goals]
updatedAt: 2026-06-07T12:00:00.000Z
---

Build a universal memory layer for AI agents...
```

You can `cat`, `grep`, or version-control them with git.

### Can I share a memory across machines?

Not directly (the storage is local). Options for v1.2.1:
- Sync `~/.memlink/` via Dropbox / Syncthing / git (the format is plain files)
- Phase 2 (memlink.cloud) will provide cloud sync and cross-device routing

### How many entries can a memory hold?

Tested with 10K entries per memory. The index.json loads fully on each read, so for huge memories (>100K entries) consider splitting into named memories.

### Is memlink free?

Yes. Apache 2.0 license. The cloud service (memlink.cloud) will be a paid product, but the local CLI/MCP server is and will remain free.
