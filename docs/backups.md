# Backups

Memlink automatically creates backups on every mutation, keeping the last 3 backups by default.

## Automatic backups

Every time an entry is created, updated, or deleted, a backup is saved to `~/.memlink/backups/`. No manual action needed.

## Manual backup

```bash
memlink serve  # Backups are managed via MCP tools
```

### Creating a backup

Use the `backup_create` MCP tool to create a manual backup at any time.

### Listing backups

Use the `backup_list` MCP tool to see all available backups with entry count and size.

### Restoring a backup

Use the `backup_restore` MCP tool with a backup file path to restore.

### Deleting a backup

Use the `backup_delete` MCP tool to remove a specific backup.

### Cleaning old backups

Use the `backup_cleanup` MCP tool to remove old backups, keeping only the N most recent (default: 10).

```json
{
  "keep_count": 5
}
```
