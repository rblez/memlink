import { Router } from 'express';
import {
  loadConfig,
  saveConfig as saveConfigFile,
  createUniversalMemory,
  revokeUniversalMemory,
  readMemory,
  readMemoryEntry,
  upsertMemoryEntry,
  deleteMemoryEntry,
  searchMemory,
  syncMemory,
  getStats,
  getMemlinkDir,
  getMemoryById,
  exportMemoryFormats,
  saveBackup,
  restoreBackup,
  listBackups,
  deleteBackup as deleteBackupFile,
  cleanupOldBackups,
  bulkDeleteMemories,
  bulkDeleteMemoriesByTags,
  bulkDeleteMemoriesByPattern,
  renderMemoryAsMarkdown,
  renderMemoryAsText,
  renderMemoryAsHtml,
} from '../core/memory.ts';
import { MEMLINK_VERSION } from '../core/types.ts';

const router = Router();

function error(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : String(err);
  return { error: message, status };
}

// ─── Info / Overview ────────────────────────────────────────────────────────

router.get('/info', (_req, res) => {
  try {
    const config = loadConfig();
    const memories = config.universalMemories.map((m) => {
      try {
        const s = getStats(m.memoryId);
        return { ...m, entries: s.entries, size: s.size, tags: s.tags };
      } catch {
        return { ...m, entries: 0, size: 0, tags: [] };
      }
    });
    res.json({
      version: MEMLINK_VERSION,
      memlinkDir: getMemlinkDir(),
      serverHost: config.serverHost,
      serverPort: config.serverPort,
      memories,
      totalMemories: memories.length,
      totalEntries: memories.reduce((a, m) => a + m.entries, 0),
      totalSize: memories.reduce((a, m) => a + m.size, 0),
    });
  } catch (err) {
    res.status(500).json(error(err));
  }
});

// ─── Memories CRUD ──────────────────────────────────────────────────────────

router.get('/memories', (_req, res) => {
  try {
    const config = loadConfig();
    const list = config.universalMemories.map((m) => {
      try {
        const s = getStats(m.memoryId);
        return { ...m, entries: s.entries, size: s.size, tags: s.tags };
      } catch {
        return { ...m, entries: 0, size: 0, tags: [] };
      }
    });
    res.json(list);
  } catch (err) {
    res.status(500).json(error(err));
  }
});

router.post('/memories', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    const memory = createUniversalMemory(name);
    res.status(201).json(memory);
  } catch (err) {
    res.status(400).json(error(err, 400));
  }
});

router.get('/memories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const memory =
      getMemoryById(id) ||
      loadConfig().universalMemories.find(
        (m) => m.memoryId === id || m.memoryName.toLowerCase() === id.toLowerCase()
      );
    if (!memory) {
      res.status(404).json({ error: 'Memory not found' });
      return;
    }
    const stats = getStats(memory.memoryId);
    res.json({ ...memory, ...stats });
  } catch (err) {
    res.status(500).json(error(err));
  }
});

router.delete('/memories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const ok = revokeUniversalMemory(id);
    if (!ok) {
      res.status(404).json({ error: 'Memory not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json(error(err));
  }
});

// ─── Entries ────────────────────────────────────────────────────────────────

router.get('/memories/:id/entries', (req, res) => {
  try {
    const { id } = req.params;
    const entries = readMemory(id);
    res.json(entries);
  } catch (err) {
    res.status(500).json(error(err));
  }
});

router.get('/memories/:id/entries/:title', (req, res) => {
  try {
    const { id, title } = req.params;
    const entry = readMemoryEntry(id, decodeURIComponent(title));
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.json(entry);
  } catch (err) {
    res.status(500).json(error(err));
  }
});

router.post('/memories/:id/entries', (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, tags } = req.body;
    if (!title || typeof title !== 'string') {
      res.status(400).json({ error: 'Title is required' });
      return;
    }
    if (content === undefined) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }
    const entry = upsertMemoryEntry(id, title, content, tags);
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json(error(err));
  }
});

router.delete('/memories/:id/entries/:title', (req, res) => {
  try {
    const { id, title } = req.params;
    const ok = deleteMemoryEntry(id, decodeURIComponent(title));
    if (!ok) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json(error(err));
  }
});

// ─── Search ─────────────────────────────────────────────────────────────────

router.get('/memories/:id/search', (req, res) => {
  try {
    const { id } = req.params;
    const q = (req.query.q as string) || '';
    if (!q) {
      res.status(400).json({ error: 'Query parameter q is required' });
      return;
    }
    const results = searchMemory(id, q);
    res.json({ results, count: results.length });
  } catch (err) {
    res.status(500).json(error(err));
  }
});

// ─── Sync / Stats ───────────────────────────────────────────────────────────

router.post('/memories/:id/sync', (req, res) => {
  try {
    const { id } = req.params;
    const stats = syncMemory(id);
    res.json(stats);
  } catch (err) {
    res.status(500).json(error(err));
  }
});

router.get('/memories/:id/stats', (req, res) => {
  try {
    const { id } = req.params;
    const stats = getStats(id);
    res.json(stats);
  } catch (err) {
    res.status(500).json(error(err));
  }
});

// ─── Export ─────────────────────────────────────────────────────────────────

router.post('/memories/:id/export', (req, res) => {
  try {
    const { id } = req.params;
    const exported = exportMemoryFormats(id);
    const config = loadConfig();
    res.json({
      exported,
      formatsDir: getMemlinkDir() + '/formats',
      formats: config.exportFormats || ['md', 'txt', 'html', 'json'],
    });
  } catch (err) {
    res.status(500).json(error(err));
  }
});

router.get('/memories/:id/markdown', (req, res) => {
  try {
    const { id } = req.params;
    const markdown = renderMemoryAsMarkdown(id);
    res.json({ markdown });
  } catch (err) {
    res.status(500).json(error(err));
  }
});

router.get('/memories/:id/text', (req, res) => {
  try {
    const { id } = req.params;
    const text = renderMemoryAsText(id);
    res.json({ text });
  } catch (err) {
    res.status(500).json(error(err));
  }
});

router.get('/memories/:id/html', (req, res) => {
  try {
    const { id } = req.params;
    const html = renderMemoryAsHtml(id);
    res.json({ html });
  } catch (err) {
    res.status(500).json(error(err));
  }
});

// ─── Bulk Delete ────────────────────────────────────────────────────────────

router.post('/memories/:id/bulk-delete', (req, res) => {
  try {
    const { id } = req.params;
    const { method, value, use_regex, dry_run } = req.body;
    if (!method || !value) {
      res.status(400).json({ error: 'method and value are required' });
      return;
    }
    let result;
    if (method === 'titles') {
      const titles = value.split(',').map((t: string) => t.trim());
      if (dry_run) {
        const entries = readMemory(id);
        const titlesLower = titles.map((t: string) => t.toLowerCase());
        const toDelete = entries.filter((e) => titlesLower.includes(e.title.toLowerCase()));
        res.json({ dryRun: true, count: toDelete.length, entries: toDelete.map((e) => e.title) });
        return;
      }
      result = bulkDeleteMemories(id, titles);
    } else if (method === 'tags') {
      const tags = value.split(',').map((t: string) => t.trim());
      if (dry_run) {
        const entries = readMemory(id);
        const tagsLower = tags.map((t: string) => t.toLowerCase());
        const toDelete = entries.filter((e) =>
          e.tags?.some((tag) => tagsLower.includes(tag.toLowerCase()))
        );
        res.json({ dryRun: true, count: toDelete.length, entries: toDelete.map((e) => e.title) });
        return;
      }
      result = bulkDeleteMemoriesByTags(id, tags);
    } else if (method === 'pattern') {
      if (dry_run) {
        const entries = readMemory(id);
        const lower = value.toLowerCase();
        const toDelete = entries.filter(
          (e) => e.title.toLowerCase().includes(lower) || e.content.toLowerCase().includes(lower)
        );
        res.json({ dryRun: true, count: toDelete.length, entries: toDelete.map((e) => e.title) });
        return;
      }
      result = bulkDeleteMemoriesByPattern(id, value, use_regex || false);
    } else {
      res.status(400).json({ error: 'Invalid method. Use: titles, tags, or pattern' });
      return;
    }
    res.json(result);
  } catch (err) {
    res.status(500).json(error(err));
  }
});

// ─── Batch Create ───────────────────────────────────────────────────────────

router.post('/memories/:id/batch', (req, res) => {
  try {
    const { id } = req.params;
    const { entries } = req.body;
    if (!Array.isArray(entries)) {
      res.status(400).json({ error: 'entries array is required' });
      return;
    }
    const results: string[] = [];
    for (const entry of entries) {
      upsertMemoryEntry(id, entry.title, entry.content, entry.tags);
      results.push(entry.title);
    }
    res.json({ processed: results.length, entries: results });
  } catch (err) {
    res.status(500).json(error(err));
  }
});

// ─── Backups ────────────────────────────────────────────────────────────────

router.get('/memories/:id/backups', (req, res) => {
  try {
    const { id } = req.params;
    const backups = listBackups(id);
    res.json(backups);
  } catch (err) {
    res.status(500).json(error(err));
  }
});

router.post('/memories/:id/backups', (req, res) => {
  try {
    const { id } = req.params;
    const path = saveBackup(id);
    res.status(201).json({ path });
  } catch (err) {
    res.status(500).json(error(err));
  }
});

router.post('/memories/:id/backups/restore', (req, res) => {
  try {
    const { id } = req.params;
    const { backup_path, overwrite } = req.body;
    if (!backup_path) {
      res.status(400).json({ error: 'backup_path is required' });
      return;
    }
    const result = restoreBackup(backup_path, id, overwrite || false);
    res.json(result);
  } catch (err) {
    res.status(500).json(error(err));
  }
});

router.post('/memories/:id/backups/cleanup', (req, res) => {
  try {
    const { id } = req.params;
    const { keep_count } = req.body;
    const result = cleanupOldBackups(id, keep_count || 10);
    res.json(result);
  } catch (err) {
    res.status(500).json(error(err));
  }
});

// ─── Global backup operations ───────────────────────────────────────────────

router.delete('/backups', (req, res) => {
  try {
    const { path } = req.body;
    if (!path) {
      res.status(400).json({ error: 'path is required' });
      return;
    }
    const ok = deleteBackupFile(path);
    res.json({ ok });
  } catch (err) {
    res.status(500).json(error(err));
  }
});

// ─── Config ─────────────────────────────────────────────────────────────────

router.get('/config', (_req, res) => {
  try {
    const config = loadConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json(error(err));
  }
});

router.put('/config', (req, res) => {
  try {
    const config = loadConfig();
    const updates = req.body;
    if (updates.serverPort !== undefined) config.serverPort = updates.serverPort;
    if (updates.serverHost !== undefined) config.serverHost = updates.serverHost;
    if (updates.cors !== undefined) config.cors = updates.cors;
    if (updates.readOnly !== undefined) config.readOnly = updates.readOnly;
    if (updates.exportFormats !== undefined) config.exportFormats = updates.exportFormats;
    saveConfigFile(config);
    res.json(config);
  } catch (err) {
    res.status(500).json(error(err));
  }
});

export default router;
