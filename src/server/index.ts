import express, { type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { renderChangelog } from './changelogs.ts';
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
  deleteBackup,
  listBackups,
  cleanupOldBackups,
  getMemoryById,
  updateUniversalMemoryLastSeen,
  getStats,
  exportMemoryFormats,
  loadConfig,
} from '../core/memory.ts';
import { MEMLINK_VERSION, DEFAULT_PORT, DEFAULT_HOST, getMemlinkDir } from '../core/types.ts';

// ─── Server state ──────────────────────────────────────────────────────────────

let logLevel: 'none' | 'basic' | 'verbose' = 'basic';
let corsOrigins: string | null = null;
let readOnly = false;
let bearerToken: string | null = null;

function timestamp(): string {
  return new Date().toISOString().split('T')[1].split('.')[0];
}

function log(level: 'basic' | 'verbose', prefix: string, msg: string, detail?: string) {
  if (logLevel === 'none') return;
  if (level === 'verbose' && logLevel !== 'verbose') return;
  const line = `  ${prefix} ${msg}`;
  if (detail && logLevel === 'verbose') {
    console.log(`${line}  ${detail}`);
  } else {
    console.log(line);
  }
}

function logRequestStart(memoryName: string, method: string) {
  log('basic', `[${timestamp()}]`, `${memoryName}  ${method}`);
}

function logRequestEnd(method: string, durationMs: number) {
  log('verbose', `[${timestamp()}]`, `${' '.repeat(20)}  ${method}`, `${durationMs}ms`);
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
    content: [{ type: 'text' as const, text: `Error: ${err}` }],
    isError: true,
  };
}

function readOnlyGuard() {
  if (readOnly) {
    return {
      content: [
        { type: 'text' as const, text: 'Server is in read-only mode. Writes are disabled.' },
      ],
      isError: true,
    };
  }
  return null;
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
    version: MEMLINK_VERSION,
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
        const guard = readOnlyGuard();
        if (guard) return guard;
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
        const guard = readOnlyGuard();
        if (guard) return guard;
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
        const guard = readOnlyGuard();
        if (guard) return guard;
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
        const guard = readOnlyGuard();
        if (guard) return guard;
        const isDryRun = dry_run || false;

        if (method === 'titles') {
          const titles = value.split(',').map((t) => t.trim());
          if (isDryRun) {
            const memory = readMemory(memoryId);
            const titlesLower = titles.map((t) => t.toLowerCase());
            const toDelete = memory.filter((e) => titlesLower.includes(e.title.toLowerCase()));
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
            const toDelete = memory.filter((e) =>
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
                toDelete = memory.filter((e) => regex.test(e.title) || regex.test(e.content));
              } catch (error) {
                return errorResult(`Invalid regex: ${error}`);
              }
            } else {
              const patternLower = value.toLowerCase();
              toDelete = memory.filter(
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
        const guard = readOnlyGuard();
        if (guard) return guard;
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
        const guard = readOnlyGuard();
        if (guard) return guard;
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
        const guard = readOnlyGuard();
        if (guard) return guard;
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
        const guard = readOnlyGuard();
        if (guard) return guard;
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

  // Static assets (fonts, images)
  app.use(
    '/public',
    express.static(path.join(path.dirname(new URL(import.meta.url).pathname), '../../public'))
  );

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 1000,
      message: { error: 'Too many requests. Try again later.' },
    })
  );

  // CORS
  if (corsOrigins) {
    const origins = corsOrigins;
    app.use((req, res, next) => {
      const origin = req.headers.origin || '*';
      if (
        origins === '*' ||
        origins
          .split(',')
          .map((s) => s.trim())
          .includes(origin)
      ) {
        res.setHeader('Access-Control-Allow-Origin', origins === '*' ? '*' : origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '86400');
      }
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      next();
    });
  }

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

  // Optional Bearer token auth (protect MCP transport endpoints only)
  app.use((req, res, next) => {
    if (!bearerToken) return next();

    const p = req.path || '';
    const protectedPaths = p === '/mcp' || p === '/sse' || p === '/messages';
    if (!protectedPaths) return next();

    const header = req.header('Authorization') || '';
    const prefix = 'Bearer ';
    const token = header.startsWith(prefix) ? header.slice(prefix.length) : '';

    if (!token || token !== bearerToken) {
      res.status(401).json({ error: 'Unauthorized. Missing or invalid Bearer token.' });
      return;
    }

    next();
  });

  // Health check
  app.get('/health', (_req, res) => {
    const config = loadConfig();
    res.json({
      status: 'ok',
      version: MEMLINK_VERSION,
      memories: config.universalMemories.length,
      uptime: process.uptime(),
    });
  });

  // Changelog
  app.get('/changelogs', (_req, res) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self' 'unsafe-inline'"
    );
    res.type('html').send(renderChangelog());
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

    const method = req.body?.method as string | undefined;
    const startTime = Date.now();
    if (method) logRequestStart(memoryName, method);

    try {
      const mcpServer = buildMcpServer(memoryId, memoryName);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      res.on('close', () => {
        if (method) logRequestEnd(method, Date.now() - startTime);
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

// ─── Stdio server ────────────────────────────────────────────────────────────

export async function startStdioServer(memoryId: string): Promise<void> {
  const memoryInfo = getMemoryById(memoryId);
  if (!memoryInfo) {
    console.error(`Memory not found: ${memoryId}`);
    process.exit(1);
  }

  logLevel = 'none'; // stdio must not write to stdout
  const mcpServer = buildMcpServer(memoryInfo.memoryId, memoryInfo.memoryName);
  const transport = new StdioServerTransport();

  await mcpServer.connect(transport);
  // Process will stay alive until stdin closes
}

// ─── Start server ─────────────────────────────────────────────────────────────

async function watchMemlinkDir(): Promise<fs.FSWatcher> {
  const dir = getMemlinkDir();
  const memDir = path.dirname(dir);
  const watcher = fs.watch(memDir, (eventType, filename) => {
    if (!filename) return;
    const fullPath = path.join(memDir, filename);
    if (!fullPath.startsWith(dir)) return;
    if (!filename.endsWith('.memory.json')) return;
    if (eventType !== 'change') return;
    const memoryId = filename.replace('.memory.json', '');
    try {
      exportMemoryFormats(memoryId);
      if (logLevel === 'verbose') {
        console.log(`  [watch] re-exported: ${memoryId}`);
      }
    } catch {
      // ignore
    }
  });
  if (logLevel !== 'none') {
    console.log(`  Watching  ${dir}/*.memory.json`);
  }
  return watcher;
}

export async function startServer(
  port?: number,
  host?: string,
  options?: {
    cors?: string;
    readOnly?: boolean;
    logLevel?: 'none' | 'basic' | 'verbose';
    watch?: boolean;
    bearerToken?: string;
  }
): Promise<void> {
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

  corsOrigins = options?.cors || config.cors || null;
  readOnly = options?.readOnly ?? config.readOnly ?? false;
  logLevel = options?.logLevel || (process.stdout.isTTY ? 'basic' : 'none');
  bearerToken = options?.bearerToken ?? process.env.MEMLINK_BEARER_TOKEN ?? null;

  const app = createApp();

  // Build memory list for startup output
  const memories = config.universalMemories.map((m) => {
    try {
      const s = getStats(m.memoryId);
      return { ...m, entries: s.entries, size: (s.size / 1024).toFixed(1) };
    } catch {
      return { ...m, entries: 0, size: '0.0' };
    }
  });

  return new Promise<void>((resolve) => {
    const server = app.listen(p, h, () => {
      console.log('');
      console.log(`  Memlink  ${MEMLINK_VERSION}`);
      console.log(`  ${'─'.repeat(48)}`);
      console.log(`  Server   http://${h}:${p}`);
      if (memories.length > 0) {
        console.log('');
        for (const m of memories) {
          const url = `http://${h}:${p}/mcp?id=${m.memoryId}`;
          console.log(`  ${m.memoryName}`);
          console.log(`    MCP:     ${url}`);
          console.log(`    Entries: ${m.entries}  ·  Size: ${m.size} KB`);
          console.log('');
        }
      } else {
        console.log(`  No memories. Create one: memlink init <name>`);
        console.log('');
      }
      if (readOnly) console.log(`  Mode: read-only`);
      if (logLevel === 'verbose') console.log(`  Log level: verbose`);
      if (options?.watch) {
        watchMemlinkDir().then((watcher) => {
          watchers.push(watcher);
        });
      }
      console.log(`  ${'─'.repeat(48)}`);
      console.log(`  ^C to stop\n`);
    });

    const watchers: fs.FSWatcher[] = [];
    let shuttingDown = false;

    function shutdown() {
      if (shuttingDown) return;
      shuttingDown = true;
      for (const w of watchers) {
        try {
          w.close();
        } catch {
          /* ignore */
        }
      }

      logLevel = 'none';

      // Close SSE sessions
      const sessions = [...sseSessions.entries()];
      for (const [, session] of sessions) {
        session.mcpServer.close();
      }

      server.close(() => {
        console.log('\n  Server stopped.\n');
        resolve();
      });

      // Force exit after 5s
      setTimeout(() => {
        process.exit(0);
      }, 5000).unref();
    }

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  });
}
