# MCP Tools Reference

Memlink exposes 4 MCP tools per memory. Each MCP server instance is bound to a single memory (via `?t=<token>` or the default memory).

## memory_read

Read memory entries. Always call at the start of a session to load context.

**Parameters:**
- `id` (number, optional) — Read a specific entry by ID
- `title` (string, optional) — Read a specific entry by exact title
- `full` (boolean, optional) — When reading all, include full content (default: index only)

**Returns:** Formatted Markdown. Index view shows id, title, tags, updatedAt. `full: true` adds content.

**Examples:**
```json
{ "tool": "memory_read", "args": {} }
{ "tool": "memory_read", "args": { "title": "ProjectGoals" } }
{ "tool": "memory_read", "args": { "id": 7 } }
{ "tool": "memory_read", "args": { "full": true } }
```

## memory_edit

Create or update an entry. Use whenever the user says "save X", "remember that", "store this".

**Parameters:**
- `title` (string, required) — Short descriptive title, 1-200 chars. PascalCase or Title Case recommended
- `content` (string, required) — Full content, plain text, 1-100K chars
- `tags` (string[], optional) — Categorical tags, max 20 tags, each max 50 chars

**Behavior:** Creates if no entry with that title exists; updates if one does. Atomic write, auto-backup created.

**Returns:** Confirmation with title and timestamp.

**Examples:**
```json
{ "tool": "memory_edit", "args": { "title": "ProjectGoals", "content": "Build X, Y, Z by Q3", "tags": ["project", "goals"] } }
```

## memory_search

Search entries by query. Matches in title, content, and tags (case-insensitive substring).

**Parameters:**
- `query` (string, required) — Search query

**Returns:** Formatted Markdown with all matching entries and match count.

**Examples:**
```json
{ "tool": "memory_search", "args": { "query": "typescript" } }
```

## memory_sync

Validate memory integrity and return stats.

**Parameters:** None.

**Returns:** Entry count, file size, last updated timestamp, status.

**Examples:**
```json
{ "tool": "memory_sync", "args": {} }
```

## Deleting entries

There is no `memory_delete` MCP tool in v1.2.1. To delete entries, use the CLI directly:

```bash
memlink delete-entry --memory my-project "ProjectGoals"
```

Or delete the entire memory:

```bash
memlink delete my-project
```

## Tool count

Each memory registered with the daemon exposes exactly these 4 tools. The tools are bound to a single memory, so an agent connected via `?t=token123` only sees tools that operate on that memory.
