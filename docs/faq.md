# FAQ

## WSL / Windows networking

WSL2 has its own network interface — `localhost` in WSL is **not** `localhost` in Windows. Trying to connect an agent in WSL to memlink on Windows (or vice versa) does not work reliably.

**The real solution: run everything inside WSL.**

```bash
npm install -g @memlink/cli
memlink serve
```

All agents running in WSL (OpenCode, Devin, etc.) use `localhost:4444` with zero networking issues. No bridges, no IP detection, no magic. Just works.

The `memlink wsl-connect` command has been removed because the cross-environment approach was inherently unreliable.

---

## General

### What port does memlink use by default?

`4444`. Change it with `--port`, `MEMLINK_PORT`, or `serverPort` in `~/.memlink/config.json`.

### Where is data stored?

`~/.memlink/` — each memory is a `<memoryId>.memory.md` file in book format.

### How do I update memlink?

```bash
npm update -g @memlink/cli
```
