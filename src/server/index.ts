import express, { type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import {
  readMemory,
  readMemoryEntry,
  upsertMemoryEntry,
  deleteMemoryEntry,
  syncMemory,
  getMemoryIndex,
  searchMemory,
  bulkDeleteMemories,
  bulkDeleteMemoriesByTags,
  bulkDeleteMemoriesByPattern,
  saveBackup,
  restoreBackup,
  listBackups,
  cleanupOldBackups,
  getMemoryById,
  updateUniversalMemoryLastSeen,
} from '../core/memory.ts';
import { loadConfig } from '../core/memory.ts';
import { DEFAULT_PORT, DEFAULT_HOST } from '../core/types.ts';

// ─── Logging state ─────────────────────────────────────────────────────────────

let loggingEnabled = false;

function logRequest(
  _req: Request,
  memoryName: string,
  method?: string,
  _params?: Record<string, unknown>
) {
  if (!loggingEnabled) return;

  const timestamp = new Date().toISOString();
  console.log(`  [${timestamp}] [ req ] ${memoryName}`);
  if (method) {
    const startTime = Date.now();
    console.log(`  [ req ] ${method} · 200 · ${Date.now() - startTime}ms`);
  }
}

function logResponse(result: unknown, method?: string) {
  if (!loggingEnabled) return;

  console.log(`  [ res ] ${method || 'Success'}`);
  if (
    result &&
    typeof result === 'object' &&
    'content' in result &&
    Array.isArray(result.content)
  ) {
    const content = result.content[0];
    if (
      content &&
      typeof content === 'object' &&
      'text' in content &&
      typeof content.text === 'string'
    ) {
      console.log(`  [ res ] ${content.text.substring(0, 80)}...`);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEntry(entry: {
  title: string;
  content: string;
  tags?: string[];
  updatedAt: string;
}): string {
  const lines = [`## ${entry.title}`];
  if (entry.tags && entry.tags.length > 0) {
    lines.push(`_Tags: ${entry.tags.join(', ')}_`);
  }
  lines.push('');
  lines.push(entry.content);
  lines.push(`_Updated: ${entry.updatedAt}_`);
  return lines.join('\n');
}

function errorResult(err: unknown) {
  return {
    content: [
      {
        type: 'text',
        text: `Error: ${err instanceof Error ? err.message : String(err)}`,
      },
    ],
    isError: true,
  };
}

function AGENT_SYSTEM_PROMPT(name: string): string {
  return `You are connected to memlink — persistent memory for ${name}.

Use the MCP tools to read, write, search, and manage memory.
Always call memory_read at the start of a session to load context.
Store important information with memory_edit.
Search with memory_search when looking for specific entries.
Delete with memory_delete when the user wants to forget something.`;
}

// ─── Build MCP server for a specific memory ───────────────────────────────────

function buildMcpServer(memoryId: string, memoryName: string): McpServer {
  const server = new McpServer({
    name: 'memlink',
    version: '1.0.0',
  });

  server.resource('memlink://instructions', 'memlink://instructions', async () => ({
    contents: [
      {
        uri: 'memlink://instructions',
        mimeType: 'text/plain',
        text: AGENT_SYSTEM_PROMPT(memoryName),
      },
    ],
  }));

  // ── TOOL: memory_read ─────────────────────────────────────────────────────
  server.tool(
    'memory_read',
    'Read all memory entries or a specific one by title. Always call this at the start of a session to load context.',
    {
      title: z
        .string()
        .optional()
        .describe('Specific memory title to read. If omitted, returns all entries.'),
    },
    async ({ title }) => {
      try {
        if (title) {
          const entry = readMemoryEntry(memoryId, title);
          if (!entry) {
            return {
              content: [{ type: 'text', text: `No memory found with title: '${title}'` }],
            };
          }
          return {
            content: [{ type: 'text', text: formatEntry(entry) }],
          };
        }

        const entries = readMemory(memoryId);
        if (entries.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Memory is empty.\nUse memory_edit to add your first entry.`,
              },
            ],
          };
        }

        const formatted = entries.map((e) => formatEntry(e)).join('\n\n' + '─'.repeat(40) + '\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `# memlink Memory — ${memoryName}\n${entries.length} entries\n\n${formatted}`,
            },
          ],
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // ── TOOL: memory_edit ─────────────────────────────────────────────────────
  server.tool(
    'memory_edit',
    "Create or update a memory entry. Use this whenever the user says 'save X to my memory', 'remember that', 'store this', etc.",
    {
      title: z
        .string()
        .min(1, 'Title cannot be empty')
        .max(200, 'Title too long (max 200 characters)')
        .describe('Short, descriptive title. Use PascalCase or Title Case.'),
      content: z
        .string()
        .min(1, 'Content cannot be empty')
        .max(100000, 'Content too long (max 100000 characters)')
        .describe('Full content for this memory block.'),
      tags: z
        .array(z.string().min(1).max(50))
        .max(20, 'Too many tags (max 20)')
        .optional()
        .describe("Optional tags for categorization. E.g: ['project', 'preferences']"),
    },
    async ({ title, content, tags }) => {
      try {
        const entry = upsertMemoryEntry(memoryId, title, content, tags);
        return {
          content: [
            {
              type: 'text',
              text: `[*] Memory saved: '${entry.title}'\nUpdated: ${entry.updatedAt}`,
            },
          ],
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // ── TOOL: memory_delete ───────────────────────────────────────────────────
  server.tool(
    'memory_delete',
    "Delete a memory entry by title. Use when the user says 'forget X', 'remove X from memory', 'delete X'.",
    {
      title: z.string().describe('Title of the memory entry to delete.'),
    },
    async ({ title }) => {
      try {
        const deleted = deleteMemoryEntry(memoryId, title);
        if (!deleted) {
          return {
            content: [{ type: 'text', text: `No memory found with title: '${title}'` }],
          };
        }
        return {
          content: [{ type: 'text', text: `[*] Memory deleted: '${title}'` }],
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // ── TOOL: memory_sync ─────────────────────────────────────────────────────
  server.tool(
    'memory_sync',
    'Sync and validate memory integrity. Returns current stats.',
    {},
    async () => {
      try {
        const stats = syncMemory(memoryId);
        const index = getMemoryIndex(memoryId);

        return {
          content: [
            {
              type: 'text',
              text: [
                `# memlink Memory Sync`,
                `Memory: ${memoryName}`,
                `Entries: ${stats.entries}`,
                `File size: ${(stats.size / 1024).toFixed(2)} KB`,
                `Last updated: ${index.updatedAt}`,
                `Status: [*] OK`,
              ].join('\n'),
            },
          ],
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // ── TOOL: memory_search ─────────────────────────────────────────────────────
  server.tool(
    'memory_search',
    'Search memory entries by query. Searches in title, content, and tags.',
    {
      query: z.string().describe('Search query to find matching entries'),
    },
    async ({ query }) => {
      try {
        const results = searchMemory(memoryId, query);

        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: `No matches found for '${query}'` }],
          };
        }

        const formatted = results.map((e) => formatEntry(e)).join('\n\n' + '─'.repeat(40) + '\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `# Search Results for '${query}'\n${results.length} matches\n\n${formatted}`,
            },
          ],
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // ── TOOL: memory_batch ─────────────────────────────────────────────────────
  server.tool(
    'memory_batch',
    'Create or update multiple memory entries at once.',
    {
      entries: z
        .array(
          z.object({
            title: z.string().describe('Entry title'),
            content: z.string().describe('Entry content'),
            tags: z.array(z.string()).optional().describe('Optional tags'),
          })
        )
        .describe('Array of entries to create/update'),
    },
    async ({ entries }) => {
      try {
        const results: string[] = [];
        for (const entry of entries) {
          upsertMemoryEntry(memoryId, entry.title, entry.content, entry.tags);
          results.push(`[*] ${entry.title}`);
        }
        return {
          content: [
            {
              type: 'text',
              text: `# Batch Operation Complete\n\n${entries.length} entries processed:\n\n${results.join('\n')}`,
            },
          ],
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // ── TOOL: bulk_delete ─────────────────────────────────────────────────────
  server.tool(
    'bulk_delete',
    'Delete multiple memory entries at once using titles, tags, or patterns.',
    {
      method: z.enum(['titles', 'tags', 'pattern']).describe('Deletion method'),
      value: z.string().describe('Comma-separated titles/tags or search pattern'),
      use_regex: z.boolean().optional().describe('Use pattern as regex'),
      dry_run: z.boolean().optional().describe('Preview without deleting'),
    },
    async ({ method, value, use_regex, dry_run }) => {
      try {
        const isDryRun = dry_run || false;

        if (method === 'titles') {
          const titles = value.split(',').map((t) => t.trim());
          if (isDryRun) {
            const memory = readMemory(memoryId);
            const titlesLower = titles.map((t) => t.toLowerCase());
            const toDelete = memory.entries.filter((e) =>
              titlesLower.includes(e.title.toLowerCase())
            );
            return {
              content: [
                {
                  type: 'text',
                  text: `# Dry Run - Would delete ${toDelete.length} entries:\n\n${toDelete.map((e) => `- ${e.title}`).join('\n')}`,
                },
              ],
            };
          }
          const result = bulkDeleteMemories(memoryId, titles);
          return {
            content: [
              {
                type: 'text',
                text: `# Bulk Delete Complete\n\nDeleted: ${result.deleted} entries${result.notFound.length > 0 ? `\nNot found: ${result.notFound.join(', ')}` : ''}`,
              },
            ],
          };
        } else if (method === 'tags') {
          const tags = value.split(',').map((t) => t.trim());
          if (isDryRun) {
            const memory = readMemory(memoryId);
            const tagsLower = tags.map((t) => t.toLowerCase());
            const toDelete = memory.entries.filter((e) =>
              e.tags?.some((tag) => tagsLower.includes(tag.toLowerCase()))
            );
            return {
              content: [
                {
                  type: 'text',
                  text: `# Dry Run - Would delete ${toDelete.length} entries:\n\n${toDelete.map((e) => `- ${e.title} (tags: ${e.tags?.join(', ')})`).join('\n')}`,
                },
              ],
            };
          }
          const result = bulkDeleteMemoriesByTags(memoryId, tags);
          return {
            content: [
              {
                type: 'text',
                text: `# Bulk Delete Complete\n\nDeleted: ${result.deleted} entries`,
              },
            ],
          };
        } else {
          if (isDryRun) {
            const memory = readMemory(memoryId);
            let toDelete;
            if (use_regex) {
              try {
                const regex = new RegExp(value, 'i');
                toDelete = memory.entries.filter(
                  (e) => regex.test(e.title) || regex.test(e.content)
                );
              } catch (error) {
                return errorResult(`Invalid regex: ${error}`);
              }
            } else {
              const patternLower = value.toLowerCase();
              toDelete = memory.entries.filter(
                (e) =>
                  e.title.toLowerCase().includes(patternLower) ||
                  e.content.toLowerCase().includes(patternLower)
              );
            }
            return {
              content: [
                {
                  type: 'text',
                  text: `# Dry Run - Would delete ${toDelete.length} entries:\n\n${toDelete.map((e) => `- ${e.title}`).join('\n')}`,
                },
              ],
            };
          }
          const result = bulkDeleteMemoriesByPattern(memoryId, value, use_regex);
          return {
            content: [
              {
                type: 'text',
                text: `# Bulk Delete Complete\n\nDeleted: ${result.deleted} entries`,
              },
            ],
          };
        }
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // ── TOOL: backup_create ─────────────────────────────────────────────────────
  server.tool(
    'backup_create',
    'Create a backup of the current memory.',
    {
      include_deleted: z.boolean().optional().describe('Include deleted entries'),
    },
    async ({ include_deleted: _include_deleted }) => {
      try {
        const path = saveBackup(memoryId);
        return {
          content: [{ type: 'text', text: `# Backup Created\n\nPath: ${path}` }],
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // ── TOOL: backup_restore ────────────────────────────────────────────────────
  server.tool(
    'backup_restore',
    'Restore memory from a backup file.',
    {
      backup_path: z.string().describe('Path to backup file'),
      overwrite: z.boolean().optional().describe('Overwrite existing memory'),
    },
    async ({ backup_path, overwrite }) => {
      try {
        const result = restoreBackup(backup_path, undefined, overwrite || false);
        return {
          content: [
            {
              type: 'text',
              text: `# Backup Restored\n\nRestored: ${result.restored} entries\nMemory: ${result.memoryId}`,
            },
          ],
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // ── TOOL: backup_list ───────────────────────────────────────────────────────
  server.tool('backup_list', 'List available backup files.', {}, async () => {
    try {
      const backups = listBackups(memoryId);
      if (backups.length === 0) {
        return { content: [{ type: 'text', text: 'No backups found.' }] };
      }
      const lines = backups.map(
        (b) => `- ${b.filename} (${b.entryCount} entries, ${(b.size / 1024).toFixed(1)} KB)`
      );
      return {
        content: [{ type: 'text', text: `# Available Backups\n\n${lines.join('\n')}` }],
      };
    } catch (err) {
      return errorResult(err);
    }
  });

  // ── TOOL: backup_delete ─────────────────────────────────────────────────────
  server.tool(
    'backup_delete',
    'Delete a backup file.',
    { backup_path: z.string().describe('Path to backup file') },
    async ({ backup_path }) => {
      try {
        const ok = deleteBackup(backup_path);
        return {
          content: [{ type: 'text', text: ok ? 'Backup deleted.' : 'Backup not found.' }],
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // ── TOOL: backup_cleanup ────────────────────────────────────────────────────
  server.tool(
    'backup_cleanup',
    'Clean up old backups, keeping only the most recent ones.',
    { keep_count: z.number().optional().describe('Number of backups to keep (default: 10)') },
    async ({ keep_count }) => {
      try {
        const result = cleanupOldBackups(memoryId, keep_count || 10);
        return {
          content: [
            {
              type: 'text',
              text: `# Cleanup Complete\n\nKept: ${result.kept}\nDeleted: ${result.deleted}`,
            },
          ],
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}

// ─── SSE session store ─────────────────────────────────────────────────────────

const sseSessions = new Map<
  string,
  { transport: SSEServerTransport; memoryId: string; mcpServer: McpServer }
>();

// ─── Create Express app ────────────────────────────────────────────────────────

export function createApp(): express.Express {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 1000,
      message: { error: 'Too many requests. Try again later.' },
    })
  );

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  });

  // Health check
  app.get('/health', (_req, res) => {
    const config = loadConfig();
    res.json({
      status: 'ok',
      version: '1.0.0',
      memories: config.universalMemories.length,
      uptime: process.uptime(),
    });
  });

  // Instructions endpoint
  app.get('/instructions', (req, res) => {
    const memoryId = (req.query.id as string) || '';
    const memory = memoryId ? getMemoryById(memoryId) : undefined;
    const name = memory?.memoryName || 'Agent';
    res.json({
      type: 'system_prompt',
      memory: name,
      content: AGENT_SYSTEM_PROMPT(name),
    });
  });

  // SSE endpoint (for SSE-based MCP clients)
  app.get('/sse', async (req: Request, res: Response) => {
    const memId = (req.query.id as string) || (req.query.mem_id as string);
    if (!memId) {
      res.status(401).json({ error: 'Missing memory ID. Use ?id=<memory_id>' });
      return;
    }
    const memoryInfo = getMemoryById(memId);
    if (!memoryInfo) {
      res.status(403).json({ error: 'Invalid memory ID.' });
      return;
    }
    const memoryId = memoryInfo.memoryId;
    const memoryName = memoryInfo.memoryName;
    updateUniversalMemoryLastSeen(memoryId);

    const mcpServer = buildMcpServer(memoryId, memoryName);
    const transport = new SSEServerTransport('/messages', res);
    sseSessions.set(transport.sessionId, { transport, memoryId, mcpServer });

    res.on('close', () => {
      sseSessions.delete(transport.sessionId);
      mcpServer.close();
    });

    try {
      await mcpServer.connect(transport);
    } catch {
      sseSessions.delete(transport.sessionId);
      mcpServer.close();
      return;
    }

    // Keep handler alive — Express closes the connection otherwise
    await new Promise<void>((resolve) => {
      res.on('close', () => resolve());
    });
  });

  // SSE message endpoint
  app.post('/messages', async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId || !sseSessions.has(sessionId)) {
      res.status(404).json({ error: 'SSE session not found' });
      return;
    }
    const { transport } = sseSessions.get(sessionId)!;
    try {
      await transport.handlePostMessage(req, res, req.body);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: String(err) });
      }
    }
  });

  // MCP endpoint — auth via query string (?id=MEMORY_ID)
  app.all('/mcp', async (req: Request, res: Response) => {
    const memId = (req.query.id as string) || (req.query.mem_id as string);

    if (!memId) {
      res.status(401).json({
        error: 'Missing authentication. Use ?id=<memory_id>',
      });
      return;
    }

    const memoryInfo = getMemoryById(memId);
    if (!memoryInfo) {
      res.status(403).json({ error: 'Invalid memory ID. Memory not found.' });
      return;
    }

    const memoryId = memoryInfo.memoryId;
    const memoryName = memoryInfo.memoryName;

    updateUniversalMemoryLastSeen(memoryId);

    if (req.body && req.body.method) {
      logRequest(req, memoryName, req.body.method, req.body.params);
    }

    try {
      const mcpServer = buildMcpServer(memoryId, memoryName);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      const originalSend = res.send;
      res.send = function (data: string | Buffer) {
        if (loggingEnabled && data) {
          try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            logResponse(parsed, req.body?.method);
          } catch {
            /* ignore */
          }
        }
        return originalSend.call(this, data);
      };

      res.on('close', () => {
        transport.close();
        mcpServer.close();
      });

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: String(err) });
      }
    }
  });

  return app;
}

// ─── Start server ─────────────────────────────────────────────────────────────

export async function startServer(port?: number, host?: string) {
  const config = loadConfig();

  let envPort: number | undefined;
  const envPortStr = process.env.MEMLINK_PORT || process.env.PORT;
  if (envPortStr) {
    const n = parseInt(envPortStr, 10);
    if (!isNaN(n)) envPort = n;
  }

  const p = port || envPort || config.serverPort || DEFAULT_PORT;
  const envHost = process.env.MEMLINK_HOST || process.env.HOST;
  const h = host || envHost || config.serverHost || DEFAULT_HOST;

  loggingEnabled = true;

  const app = createApp();

  return new Promise<void>((resolve) => {
    app.listen(p, h, () => {
      console.log(`  → http://${h}:${p}/mcp\n`);

      resolve();
    });
  });
}
