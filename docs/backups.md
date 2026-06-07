# Backups

Memlink automatically creates backups on every entry mutation.

## Automatic backups

Every time an entry is created or updated, a timestamped backup is written to `~/.memlink/<memory>/.backups/`. Format matches the live entry (`.md` with YAML frontmatter).

Filename pattern: `<entry-id>-<ISO-timestamp>.md`

```
~/.memlink/default/.backups/
├── 1-2026-06-07T12:00:00.000Z.md
├── 1-2026-06-07T13:30:00.000Z.md    # updated twice
├── 2-2026-06-07T12:15:00.000Z.md
└── ...
```

No retention limit is enforced. Clean manually or with `rm` if the directory grows large.

## Manual backup

There is no `backup_create` MCP tool in v1.2.1. To snapshot a memory's full state, use the CLI export:

```bash
memlink export my-project    # writes ~/.memlink/exports/my-project.json
```

This is a flat JSON snapshot (id, title, content, tags, updatedAt for all entries).

## Restoring

There is no `backup_restore` MCP tool. To restore an entry from a `.backups/<id>-<timestamp>.md` file, copy it back to `<id>.md` in the memory directory:

```bash
cp ~/.memlink/default/.backups/1-2026-06-07T12:00:00.000Z.md \
   ~/.memlink/default/1.md
```

Stop the daemon first if it's running (to avoid lock contention), or use a `memlink add` to overwrite the live entry with the backup's content.

## Listing backups

```bash
ls -la ~/.memlink/default/.backups/
```

## Clean up old backups

```bash
# Keep only the most recent 5 of each entry
for f in ~/.memlink/default/.backups/*.md; do :; done
ls -t ~/.memlink/default/.backups/*.md | tail -n +6 | xargs rm

# Or just nuke everything (memory rebuilds from .md files)
rm -rf ~/.memlink/default/.backups/
```

Backups are convenience only — the live `.md` files are the source of truth.
