# MCP Tools Reference

Memlink exposes a set of MCP tools that agents can call to manage memory.

## Core Tools

### memory_read

Read all memory entries or a specific one by title. Always call at the start of a session to load context.

**Parameters:**
- `title` (string, optional) — Specific memory title to read. If omitted, returns all entries.

**Returns:** Formatted Markdown with all entries or a specific entry.

### memory_edit

Create or update a memory entry. Use whenever the user says "save X", "remember that", "store this".

**Parameters:**
- `title` (string, required) — Short, descriptive title. Use PascalCase or Title Case. Max 200 chars.
- `content` (string, required) — Full content for this memory block. Max 100K chars.
- `tags` (string[], optional) — Tags for categorization. Max 20 tags, each max 50 chars.

**Returns:** Confirmation with entry title and timestamp.

### memory_delete

Delete a memory entry by title. Use when the user says "forget X", "remove X".

**Parameters:**
- `title` (string, required) — Title of the memory entry to delete.

**Returns:** Confirmation or not-found message.

### memory_search

Search memory entries by query. Searches in title, content, and tags.

**Parameters:**
- `query` (string, required) — Search query to find matching entries.

**Returns:** Formatted search results with match count.

### memory_sync

Sync and validate memory integrity. Returns current stats.

**Parameters:** None.

**Returns:** Entry count, file size, last updated timestamp, status.

## Batch & Bulk Tools

### memory_batch

Create or update multiple memory entries at once.

**Parameters:**
- `entries` (array, required) — Array of `{title, content, tags?}` objects.

**Returns:** Summary of processed entries.

### bulk_delete

Delete multiple entries using titles, tags, or patterns.

**Parameters:**
- `method` (enum: `titles` | `tags` | `pattern`, required) — Deletion method.
- `value` (string, required) — Comma-separated titles/tags or search pattern.
- `use_regex` (boolean, optional) — Use pattern as regex.
- `dry_run` (boolean, optional) — Preview without deleting.

**Returns:** Summary of deleted entries, or dry-run preview.

## Backup Tools

### backup_create

Create a backup of the current memory.

**Parameters:**
- `include_deleted` (boolean, optional) — Include deleted entries.

**Returns:** Path to the backup file.

### backup_restore

Restore memory from a backup file.

**Parameters:**
- `backup_path` (string, required) — Path to backup file.
- `overwrite` (boolean, optional) — Overwrite existing entries.

**Returns:** Restore summary with entry count and memory ID.

### backup_list

List available backup files.

**Parameters:** None.

**Returns:** List of backups with entry count and size.

### backup_delete

Delete a backup file.

**Parameters:**
- `backup_path` (string, required) — Path to backup file.

**Returns:** Confirmation.

### backup_cleanup

Clean up old backups, keeping only the most recent ones.

**Parameters:**
- `keep_count` (number, optional) — Number of backups to keep (default: 10).

**Returns:** Summary of kept and deleted backups.
