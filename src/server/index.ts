import express, { type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import path from 'path';
import { renderChangelog } from './changelogs.ts';
import { loadConfig } from '../core/memory.ts';
import { MEMLINK_VERSION, DEFAULT_PORT, DEFAULT_HOST } from '../core/types.ts';
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
import {
  initRouting,
  getRoute,
  registerMemoryRoute,
  pauseMemory,
  resumeMemory,
  stopMemory,
} from '../core/routing.ts';
import { recordConnection, recordRead, recordWrite } from '../core/session.ts';
import { startHealthTicker, stopHealthTicker } from '../core/health.ts';
import { readMeta, createMemoryMeta, updateMetaStatus } from '../core/meta.ts';
import { getLocalToken } from '../core/auth.ts';

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
        recordRead(memoryName);

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
        recordWrite(memoryName);
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

// ─── Auth helper ────────────────────────────────────────────────────────────────

function resolveMemory(token?: string): { memoryId: string; memoryName: string } | null {
  const route = getRoute(token);
  if (!route) return null;
  return { memoryId: route.memoryId, memoryName: route.memoryName };
}

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
    res.json({
      status: 'ok',
      version: MEMLINK_VERSION,
      uptime: process.uptime(),
    });
  });

  // ─── Admin endpoints (local token auth) ───────────────────────────────────

  function adminAuth(req: Request, res: Response): boolean {
    const localToken = getLocalToken();
    if (!localToken) {
      res.status(401).json({ error: 'No local token configured.' });
      return false;
    }
    const header = req.header('Authorization') || '';
    const prefix = 'Bearer ';
    const token = header.startsWith(prefix) ? header.slice(prefix.length) : '';
    if (!token || token !== localToken) {
      res.status(401).json({ error: 'Invalid admin token.' });
      return false;
    }
    return true;
  }

  app.post('/admin/register', express.json(), (req, res) => {
    if (!adminAuth(req, res)) return;
    const { name } = req.body as { name?: string };
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "name" in request body.' });
      return;
    }
    const existing = readMeta(name);
    if (existing) {
      res.status(409).json({ error: `Memory "${name}" already exists.` });
      return;
    }
    const token = nanoid(32);
    const meta = createMemoryMeta(name, token);
    registerMemoryRoute(name, token);
    log('basic', `[admin]`, `Registered memory: ${name}`);
    res.json({ name, memoryId: meta.id, token, status: meta.status });
  });

  app.post('/admin/pause', express.json(), (req, res) => {
    if (!adminAuth(req, res)) return;
    const { name } = req.body as { name?: string };
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "name" in request body.' });
      return;
    }
    pauseMemory(name);
    updateMetaStatus(name, 'paused');
    log('basic', `[admin]`, `Paused memory: ${name}`);
    res.json({ name, status: 'paused' });
  });

  app.post('/admin/resume', express.json(), (req, res) => {
    if (!adminAuth(req, res)) return;
    const { name } = req.body as { name?: string };
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "name" in request body.' });
      return;
    }
    resumeMemory(name);
    updateMetaStatus(name, 'active');
    log('basic', `[admin]`, `Resumed memory: ${name}`);
    res.json({ name, status: 'active' });
  });

  app.post('/admin/stop', express.json(), (req, res) => {
    if (!adminAuth(req, res)) return;
    const { name } = req.body as { name?: string };
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "name" in request body.' });
      return;
    }
    stopMemory(name);
    updateMetaStatus(name, 'stopped');
    log('basic', `[admin]`, `Stopped memory: ${name}`);
    res.json({ name, status: 'stopped' });
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
    const token = req.query.t as string | undefined;
    const memory = resolveMemory(token);
    const name = memory?.memoryName || 'default';
    res.json({
      type: 'system_prompt',
      memory: name,
      content: AGENT_SYSTEM_PROMPT(name),
    });
  });

  // SSE endpoint (for SSE-based MCP clients)
  app.get('/sse', async (req: Request, res: Response) => {
    const token = req.query.t as string | undefined;
    const memory = resolveMemory(token);

    if (!memory) {
      res.status(401).json({ error: 'Invalid or missing token. Use ?t=<token>' });
      return;
    }

    const { memoryId, memoryName } = memory;
    recordConnection(memoryName);

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

  // MCP endpoint — auth via query string (?t=token or no token = default)
  app.all('/mcp', async (req: Request, res: Response) => {
    const token = req.query.t as string | undefined;
    const memory = resolveMemory(token);

    if (!memory) {
      res.status(401).json({
        error: token
          ? 'Invalid token. Use a valid ?t=<token>'
          : 'Default memory is not available. Use ?t=<token>',
      });
      return;
    }

    const { memoryId, memoryName } = memory;
    recordConnection(memoryName);

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

export async function startStdioServer(memoryName: string): Promise<void> {
  const route = getRoute(undefined);
  if (!route) {
    console.error(`Default memory not found`);
    process.exit(1);
  }

  logLevel = 'none'; // stdio must not write to stdout
  const mcpServer = buildMcpServer(route.memoryId, memoryName);
  const transport = new StdioServerTransport();

  await mcpServer.connect(transport);
  // Process will stay alive until stdin closes
}

// ─── Start server ─────────────────────────────────────────────────────────────

export async function startServer(
  port?: number,
  host?: string,
  options?: {
    cors?: string;
    readOnly?: boolean;
    logLevel?: 'none' | 'basic' | 'verbose';
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

  // Initialize routing table
  initRouting();

  // Start health ticker
  startHealthTicker();

  // Record memory stats for startup output
  const defaultMeta = readMeta('default');
  let entryCount = 0;
  let sizeStr = '0.0';
  if (defaultMeta) {
    try {
      const stats = getStorageStats('default');
      if (stats) {
        entryCount = stats.entries;
        sizeStr = (stats.size / 1024).toFixed(1);
      }
    } catch {
      // fall through
    }
  }

  const app = createApp();

  return new Promise<void>((resolve) => {
    const server = app.listen(p, h, () => {
      console.log('');
      console.log(`  Memlink  ${MEMLINK_VERSION}`);
      console.log(`  ${'─'.repeat(48)}`);
      console.log(`  Server   http://${h}:${p}`);
      console.log('');
      console.log(`  default`);
      console.log(`    MCP:     http://${h}:${p}/mcp`);
      console.log(`    Entries: ${entryCount}  ·  Size: ${sizeStr} KB`);
      console.log('');
      if (readOnly) console.log(`  Mode: read-only`);
      if (logLevel === 'verbose') console.log(`  Log level: verbose`);
      console.log(`  ${'─'.repeat(48)}`);
      console.log(`  ^C to stop\n`);
    });

    let shuttingDown = false;

    function shutdown() {
      if (shuttingDown) return;
      shuttingDown = true;

      logLevel = 'none';
      stopHealthTicker();

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
