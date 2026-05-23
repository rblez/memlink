# FAQ

## WSL / Windows networking

### OpenCode in WSL, memlink on Windows — won't connect

**Problem:** WSL2 has its own network interface. `localhost` in WSL ≠ `localhost` in Windows. If the memlink server runs on Windows and OpenCode runs in WSL, the connection fails.

**Solutions:**

**A. Everything in WSL (recommended)**
Install and run memlink inside WSL. Both the server and OpenCode use `localhost` without issues.

```bash
npm install -g @memlink/cli
memlink serve
```

**B. Bind to `0.0.0.0` and use Windows IP**
On Windows, start memlink on all interfaces:

```bash
memlink serve --host 0.0.0.0
```

From WSL, get the Windows host IP:

```bash
# Windows host IP as seen from WSL
ip route show default | awk '{print $3}'
# typically 172.x.x.1
```

Use that IP in the MCP URL:

```json
{
  "mcpServers": {
    "memlink": {
      "type": "http",
      "url": "http://172.x.x.1:4444/mcp?id=YOUR_MEMORY_ID"
    }
  }
}
```

**C. Desktop agents (Claude, Cursor, Windsurf)**
If the agent runs on native Windows but memlink is in WSL, use the WSL2 IP:

```powershell
# From PowerShell/CMD
wsl hostname -I
# e.g. 172.x.x.x
```

Configure the agent with `http://172.x.x.x:4444/mcp?id=...`.

---

### Why doesn't SSE work across WSL and Windows?

SSE connections are long-lived HTTP connections (keep-alive). When crossing the WSL/Windows boundary, WSL2 IP changes and Docker/WSL network restarts can cut them. Streamable HTTP (`/mcp`) uses short request/response cycles and is much more stable in this scenario.

---

### Does OpenCode support SSE?

OpenCode supports **Streamable HTTP** (`type: "http"`) natively. It does not need SSE. The correct URL is:

```
http://localhost:4444/mcp?id=YOUR_MEMORY_ID
```

SSE is a legacy transport for clients that don't support Streamable HTTP. Memlink keeps it for compatibility, but it is not recommended for new deployments.

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
