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
  getMemoryById,
  updateUniversalMemoryLastSeen,
  getStats,
  exportMemoryFormats,
  loadConfig,
} from '../core/memory.ts';
import { MEMLINK_VERSION, DEFAULT_PORT, DEFAULT_HOST, getMemlinkDir } from '../core/types.ts';
import type { StorageEntry } from '../core/types.ts';
import {
  readIndex,
  readEntry,
  findEntryByTitle,
  createEntry,
  readAllEntries,
  searchEntries,
  getStorageStats,
} from '../core/storage.ts';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatStorageEntry(e: StorageEntry): string {
  const tags = e.tags?.length ? `Tags: ${e.tags.join(', ')}` : '';
  return `# ${e.title}\n${e.content}\n${tags ? tags + '\n' : ''}Updated: ${e.updatedAt}`;
}

function AGENT_SYSTEM_PROMPT(name: string): string {
  return `You are connected to memlink — persistent memory for ${name}.

Use the MCP tools to read, write, search, and manage memory.
Always call memory_read at the start of a session to load context.
Store important information with memory_edit. Use plain text only, no markdown or HTML.
Search with memory_search when looking for specific entries.`;
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
    'Read all memory entries or a specific one by title or id. Always call this at the start of a session to load context.',
    {
      id: z.number().optional().describe('Entry ID to read'),
      title: z.string().optional().describe('Specific memory title to read.'),
      full: z.boolean().optional().describe('Read all entries with full content'),
    },
    async ({ id, title, full }) => {
      try {
        if (id !== undefined) {
          const entry = readEntry(memoryName, id);
          if (!entry) {
            return { content: [{ type: 'text', text: `No memory found with id: ${id}` }] };
          }
          return { content: [{ type: 'text', text: formatStorageEntry(entry) }] };
        }

        if (title) {
          const entry = findEntryByTitle(memoryName, title);
          if (!entry) {
            return {
              content: [{ type: 'text', text: `No memory found with title: '${title}'` }],
            };
          }
          return { content: [{ type: 'text', text: formatStorageEntry(entry) }] };
        }

        if (full) {
          const entries = readAllEntries(memoryName);
          if (entries.length === 0) {
            return {
              content: [
                { type: 'text', text: 'Memory is empty. Use memory_edit to add your first entry.' },
              ],
            };
          }
          const formatted = entries
            .map((e) => formatStorageEntry(e))
            .join('\n\n' + '─'.repeat(40) + '\n\n');
          return {
            content: [
              {
                type: 'text',
                text: `# memlink Memory — ${memoryName}\n${entries.length} entries\n\n${formatted}`,
              },
            ],
          };
        }

        // Default: show index
        const index = readIndex(memoryName);
        if (!index || index.entries.length === 0) {
          return {
            content: [
              { type: 'text', text: 'Memory is empty. Use memory_edit to add your first entry.' },
            ],
          };
        }

        const lines = index.entries.map((e, i) => {
          const titlePadded = e.title.padEnd(20);
          const tagsStr = e.tags?.length ? `[${e.tags.join(', ')}]`.padEnd(20) : ''.padEnd(20);
          const date = e.updatedAt.slice(0, 10);
          return `${i + 1}. ${titlePadded} ${tagsStr} ${date}`;
        });

        return {
          content: [
            {
              type: 'text',
              text: [
                `memlink — ${memoryName} (${index.entries.length} entries)`,
                '',
                'Call memory_read(id: N) for a specific entry, or memory_read(full: true) for all entries.',
                '',
                ...lines,
              ].join('\n'),
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
        .describe('Full content as plain text (no markdown, no HTML).'),
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
        createEntry(memoryName, memoryId, title, content, tags);
        const now = new Date().toISOString();
        return {
          content: [
            {
              type: 'text',
              text: `[*] Memory saved: '${title}'\nUpdated: ${now}`,
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
        const results = searchEntries(memoryName, query);

        if (results.length === 0) {
          return { content: [{ type: 'text', text: `No matches found for '${query}'` }] };
        }

        const formatted = results
          .map((e) => formatStorageEntry(e))
          .join('\n\n' + '─'.repeat(40) + '\n\n');

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

  // ── TOOL: memory_sync ─────────────────────────────────────────────────────
  server.tool(
    'memory_sync',
    'Sync and validate memory integrity. Returns current stats.',
    {},
    async () => {
      try {
        const stats = getStorageStats(memoryName);
        if (!stats) {
          return { content: [{ type: 'text', text: 'No memory found.' }] };
        }

        return {
          content: [
            {
              type: 'text',
              text: [
                `# memlink Memory Sync`,
                `Memory: ${memoryName}`,
                `Entries: ${stats.entries}`,
                `File size: ${(stats.size / 1024).toFixed(2)} KB`,
                `Last updated: ${stats.lastUpdated ?? 'N/A'}`,
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
