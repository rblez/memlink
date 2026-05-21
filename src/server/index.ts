import express, { type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import {
  getAgentByToken,
  getUniversalMemoryByToken,
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
} from '../core/memory.ts';
import { loadConfig } from '../core/memory.ts';
import { DEFAULT_PORT, DEFAULT_HOST } from '../core/types.ts';

// ─── Logging state ─────────────────────────────────────────────────────────────

let loggingEnabled = false;
let requestCount = 0;

function logRequest(
  req: Request,
  memoryName: string,
  method?: string,
  params?: Record<string, unknown>
) {
  if (!loggingEnabled) return;

  requestCount++;
  const timestamp = new Date().toISOString();
  const memId = req.query.mem_id as string | undefined;
  const memoryType = memId && memId.length === 12 ? 'Universal Memory' : 'Agent';

  console.log(`\n[*] [${timestamp}] Request #${requestCount}`);
  console.log(`   Memory: ${memoryName} (${memoryType})`);
  if (method) {
    console.log(`   Method: ${method}`);
    if (params) {
      console.log(`   Params: ${JSON.stringify(params, null, 2)}`);
    }
  }
}

function logResponse(result: unknown, method?: string) {
  if (!loggingEnabled) return;

  console.log(`   Response: ${method || 'Success'}`);
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
      console.log(`   Content: ${content.text.substring(0, 100)}...`);
    }
  }
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

// Extract memory ID from query string (?mem_id=xxx)
function extractMemoryIdFromQuery(req: Request): string | null {
  const memId = req.query.mem_id as string | undefined;
  if (!memId) return null;

  // Validate mem_id format (should match nanoid format)
  if (!memId.match(/^[a-zA-Z0-9_-]{10,}$/)) {
    return null;
  }

  return memId;
}

// Get memory info by ID from config
function getMemoryById(
  memoryId: string
): { memoryId: string; memoryName: string; token: string } | null {
  const config = loadConfig();

  // First try universal memories
  const universalMemory = config.universalMemories.find((m) => m.memoryId === memoryId);
  if (universalMemory) {
    return {
      memoryId: universalMemory.memoryId,
      memoryName: universalMemory.memoryName,
      token: universalMemory.token,
    };
  }

  // Fallback to legacy agents
  const agent = config.agents.find((a) => a.agentId === memoryId);
  if (agent) {
    return {
      memoryId: agent.agentId,
      memoryName: agent.agentName,
      token: agent.token,
    };
  }

  return null;
}

// ─── Build MCP server for a specific agent ───────────────────────────────────

function buildMcpServer(agentId: string, agentName: string): McpServer {
  const server = new McpServer({
    name: 'memlink',
    version: '1.0.0',
  });

  // ── System prompt / instructions ──────────────────────────────────────────
  // Exposed as a resource so agents can pull the rules
  server.resource('memlink://instructions', 'memlink://instructions', async () => ({
    contents: [
      {
        uri: 'memlink://instructions',
        mimeType: 'text/plain',
        text: AGENT_SYSTEM_PROMPT(agentName),
      },
    ],
  }));

  // ── Agents list ────────────────────────────────────────────────────────────
  server.resource('memlink://agents', 'memlink://agents', async () => {
    const config = loadConfig();
    const agentsList = config.agents.map((a) => `- ${a.agentName} (${a.agentId})`).join('\n');
    return {
      contents: [
        {
          uri: 'memlink://agents',
          mimeType: 'text/plain',
          text: `# Registered Agents\n\n${agentsList || 'No agents registered'}`,
        },
      ],
    };
  });

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
          const entry = readMemoryEntry(agentId, title);
          if (!entry) {
            return {
              content: [{ type: 'text', text: `No memory found with title: '${title}'` }],
            };
          }
          return {
            content: [
              {
                type: 'text',
                text: formatEntry(entry),
              },
            ],
          };
        }

        const entries = readMemory(agentId);
        if (entries.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Memory is empty. Agent: ${agentName}\nUse memory_edit to add your first entry.`,
              },
            ],
          };
        }

        const formatted = entries.map((e) => formatEntry(e)).join('\n\n' + '─'.repeat(40) + '\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `# memlink Memory — ${agentName}\n${entries.length} entries\n\n${formatted}`,
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
    "Create or update a memory entry. Use this whenever the user says 'save X to my memory', 'remember that', 'store this', etc. Always keep memory organized and up to date.",
    {
      title: z
        .string()
        .min(1, 'Title cannot be empty')
        .max(200, 'Title too long (max 200 characters)')
        .regex(/^[a-zA-Z0-9_\-\s]+$/, 'Title contains invalid characters')
        .describe(
          "Short, descriptive title for this memory block. Use PascalCase or Title Case. E.g: 'ProjectContext', 'UserPreferences', 'TechStack'"
        ),
      content: z
        .string()
        .min(1, 'Content cannot be empty')
        .max(100000, 'Content too long (max 100000 characters)')
        .describe('Full content for this memory block. Be structured and clear.'),
      tags: z
        .array(
          z
            .string()
            .min(1)
            .max(50)
            .regex(/^[a-zA-Z0-9_\-\s]+$/)
        )
        .max(20, 'Too many tags (max 20)')
        .optional()
        .describe("Optional tags for categorization. E.g: ['project', 'preferences']"),
    },
    async ({ title, content, tags }) => {
      try {
        const entry = upsertMemoryEntry(agentId, title, content, tags);
        return {
          content: [
            {
              type: 'text',
              text: `[*] Memory saved: '${entry.title}'\nUpdated: ${entry.updatedAt}\nLines: ${content.split('\n').length}`,
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
        const deleted = deleteMemoryEntry(agentId, title);
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
    'Sync and validate memory integrity. Returns current stats. Call when you want to verify the memory state.',
    {},
    async () => {
      try {
        const stats = syncMemory(agentId);
        const index = getMemoryIndex(agentId);

        return {
          content: [
            {
              type: 'text',
              text: [
                `# memlink Memory Sync`,
                `Agent: ${agentName} (${agentId})`,
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
        const results = searchMemory(agentId, query);

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No matches found for '${query}'`,
              },
            ],
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
    'Create or update multiple memory entries at once. Useful for bulk imports or initial setup.',
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
          upsertMemoryEntry(agentId, entry.title, entry.content, entry.tags);
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
      value: z
        .string()
        .describe('Value for the deletion method (comma-separated titles/tags or pattern)'),
      use_regex: z
        .boolean()
        .optional()
        .describe('Use pattern as regular expression (only for pattern method)'),
      dry_run: z
        .boolean()
        .optional()
        .describe('Show what would be deleted without actually deleting'),
    },
    async ({ method, value, use_regex, dry_run }) => {
      try {
        let result;
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
          result = bulkDeleteMemories(memoryId, titles);
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
              e.tags.some((tag) => tagsLower.includes(tag.toLowerCase()))
            );
            return {
              content: [
                {
                  type: 'text',
                  text: `# Dry Run - Would delete ${toDelete.length} entries:\n\n${toDelete.map((e) => `- ${e.title} (tags: ${e.tags.join(', ')})`).join('\n')}`,
                },
              ],
            };
          }
          result = bulkDeleteMemoriesByTags(memoryId, tags);
          return {
            content: [
              {
                type: 'text',
                text: `# Bulk Delete Complete\n\nDeleted: ${result.deleted} entries\n\nDeleted entries:\n${result.entries.map((e) => `- ${e.title}`).join('\n')}`,
              },
            ],
          };
        } else if (method === 'pattern') {
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
          result = bulkDeleteMemoriesByPattern(memoryId, value, use_regex);
          return {
            content: [
              {
                type: 'text',
                text: `# Bulk Delete Complete\n\nDeleted: ${result.deleted} entries\n\nDeleted entries:\n${result.entries.map((e) => `- ${e.title}`).join('\n')}`,
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
      include_deleted: z.boolean().optional().describe('Include deleted entries in backup'),
    },
    async (_params) => {
      try {
        const backupPath = saveBackup(memoryId);
        return {
          content: [
            {
              type: 'text',
              text: `# Backup Created\n\nBackup saved to: ${backupPath}\n\nUse 'backup_restore' tool to restore from this file.`,
            },
          ],
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // ── TOOL: backup_restore ─────────────────────────────────────────────────────
  server.tool(
    'backup_restore',
    'Restore memory from a backup file.',
    {
      backup_path: z.string().describe('Path to backup file'),
      overwrite: z.boolean().optional().describe('Overwrite existing memory'),
    },
    async ({ backup_path, overwrite }) => {
      try {
        const result = restoreBackup(backup_path, memoryId, overwrite);
        return {
          content: [
            {
              type: 'text',
              text: `# Backup Restored\n\nRestored ${result.restored} entries to memory '${result.memoryId}'`,
            },
          ],
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // ── TOOL: backup_list ─────────────────────────────────────────────────────
  server.tool('backup_list', 'List available backup files.', {}, async () => {
    try {
      const backups = listBackups(memoryId);

      if (backups.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No backups found for this memory.',
            },
          ],
        };
      }

      const formatted = backups
        .map(
          (backup) =>
            `- ${backup.filename}\n  Memory: ${backup.memoryId}\n  Entries: ${backup.entryCount}\n  Size: ${(backup.size / 1024).toFixed(1)}KB\n  Created: ${backup.createdAt.toLocaleString()}`
        )
        .join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `# Available Backups\n\n${formatted}`,
          },
        ],
      };
    } catch (err) {
      return errorResult(err);
    }
  });

  // ── TOOL: backup_delete ─────────────────────────────────────────────────────
  server.tool(
    'backup_delete',
    'Delete a backup file.',
    {
      backup_path: z.string().describe('Path to backup file to delete'),
    },
    async ({ backup_path }) => {
      try {
        const success = deleteBackup(backup_path);
        if (success) {
          return {
            content: [
              {
                type: 'text',
                text: `# Backup Deleted\n\nSuccessfully deleted: ${backup_path}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `# Backup Not Found\n\nBackup file not found: ${backup_path}`,
              },
            ],
          };
        }
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // ── TOOL: backup_cleanup ─────────────────────────────────────────────────────
  server.tool(
    'backup_cleanup',
    'Clean up old backup files, keeping only the most recent ones.',
    {
      keep_count: z.number().optional().describe('Number of backups to keep (default: 10)'),
    },
    async ({ keep_count }) => {
      try {
        const result = cleanupOldBackups(memoryId, keep_count || 10);
        return {
          content: [
            {
              type: 'text',
              text: `# Backup Cleanup Complete\n\nKept: ${result.kept} backups\nDeleted: ${result.deleted} backups`,
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

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatEntry(entry: {
  title: string;
  content: string;
  tags?: string[];
  updatedAt: string;
}): string {
  const lines = [
    `### ${entry.title}`,
    entry.tags?.length ? `Tags: ${entry.tags.join(', ')}` : null,
    `Updated: ${entry.updatedAt}`,
    ``,
    entry.content,
  ]
    .filter((l) => l !== null)
    .join('\n');
  return lines;
}

function errorResult(err: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: `Error: ${err instanceof Error ? err.message : String(err)}`,
      },
    ],
    isError: true,
  };
}

// ─── Agent system prompt ──────────────────────────────────────────────────────

function AGENT_SYSTEM_PROMPT(agentName: string): string {
  return `# memlink — Universal Agent Memory Rules

You are connected to memlink, a self-hosted memory system for AI agents.
Your connected agent identity: **${agentName}**

## Core Rules

1. **Always read memory at session start** — call \`memory_read\` when starting a new session to load full context.

2. **Always save important information** — when the user shares preferences, decisions, project details, or asks you to remember something, immediately call \`memory_edit\`.

3. **Recognize memory commands** — detect these user intents and act on them:
   - 'Save X to my memory' → \`memory_edit\`
   - 'Remember that X' → \`memory_edit\`
   - 'Don't forget X' → \`memory_edit\`
   - 'Forget X' / 'Remove X from memory' → \`memory_delete\`
   - 'What do you remember about X?' → \`memory_read\` with title
   - 'Show my memory' → \`memory_read\`

4. **Keep memory organized** — use clear, descriptive titles. Group related info. Update existing entries rather than duplicating.

5. **You only have one memory** — this connected memory is your only source of persistent context. Do not reference external files or paths.

6. **Auto-organize** — if the user gives you scattered information, organize it into clean structured memory blocks with logical titles.

## Memory Structure Guidelines

Use consistent titles like:
- \`UserPreferences\` — tone, language, style preferences
- \`ProjectContext\` — current project, stack, goals
- \`TechStack\` — languages, frameworks, tools
- \`Conventions\` — code style, naming, patterns
- \`ImportantDecisions\` — architectural or key decisions
- \`PersonalInfo\` — user details if relevant

Always keep content structured with clear sections within each block.
`;
}

// ─── Express app ──────────────────────────────────────────────────────────────

export function createApp(): express.Application {
  const app = express();
  app.use(express.json());

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/mcp', limiter);

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
      agents: config.agents.length,
      uptime: process.uptime(),
    });
  });

  // Instructions endpoint — returns system prompt as JSON
  app.get('/instructions', (req, res) => {
    const agentName = (req.query.agent as string) || 'Agent';
    res.json({
      type: 'system_prompt',
      agent: agentName,
      content: AGENT_SYSTEM_PROMPT(agentName),
    });
  });

  // MCP endpoint — auth via query string (?mem_id=xxx) or Bearer header (legacy)
  app.all('/mcp', async (req: Request, res: Response) => {
    let memoryId: string;
    let memoryName: string;

    // Try query string first (?mem_id=xxx)
    const memIdFromQuery = extractMemoryIdFromQuery(req);

    // Fallback to Bearer header for legacy configs
    const auth = req.headers['authorization'];
    const bearerToken =
      auth && typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : null;

    if (memIdFromQuery) {
      // Query string auth
      const memoryInfo = getMemoryById(memIdFromQuery);
      if (!memoryInfo) {
        res.status(403).json({ error: 'Invalid memory ID. Memory not found.' });
        return;
      }
      memoryId = memoryInfo.memoryId;
      memoryName = memoryInfo.memoryName;
    } else if (bearerToken) {
      // Bearer header auth (legacy fallback)
      const universalMemory = getUniversalMemoryByToken(bearerToken);
      const agent = getAgentByToken(bearerToken);

      if (!universalMemory && !agent) {
        res.status(403).json({ error: 'Invalid or revoked token.' });
        return;
      }

      memoryId = universalMemory?.memoryId ?? agent!.agentId;
      memoryName = universalMemory?.memoryName ?? agent!.agentName;
    } else {
      res.status(401).json({
        error: 'Missing authentication. Use ?mem_id=<id> or Authorization: Bearer <token>',
      });
      return;
    }

    // Log the request if logging is enabled
    if (req.body && req.body.method) {
      logRequest(req, memoryName, req.body.method, req.body.params);
    }

    try {
      const mcpServer = buildMcpServer(memoryId, memoryName);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });

      // Intercept responses for logging
      const originalSend = res.send;
      res.send = function (data: string | Buffer) {
        if (loggingEnabled && data) {
          try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            logResponse(parsed, req.body?.method);
          } catch {
            // Ignore parsing errors for logging
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

export async function startServer(port?: number, host?: string, enableLogs: boolean = false) {
  const config = loadConfig();
  const p = port ?? config.serverPort ?? DEFAULT_PORT;
  const h = host ?? config.serverHost ?? DEFAULT_HOST;

  // Set logging state globally
  loggingEnabled = enableLogs;

  const app = createApp();

  return new Promise<void>((resolve) => {
    app.listen(p, h, () => {
      console.log(`\n  ▲ memlink MCP Server running`);
      console.log(`  → http://${h}:${p}/mcp\n`);

      if (enableLogs) {
        console.log(`\n[*] Logging enabled - Press Ctrl+L to toggle logs\n`);
        console.log(`  Logs will show MCP requests, responses, and operations\n`);

        // Setup Ctrl+L handler for toggling logs
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', (key) => {
          // Ctrl+L = 12 (ASCII form feed)
          if (key[0] === 12) {
            loggingEnabled = !loggingEnabled;
            console.log(`\n[*] Logging ${loggingEnabled ? 'ENABLED' : 'DISABLED'}\n`);
          }
        });
      }

      resolve();
    });
  });
}
