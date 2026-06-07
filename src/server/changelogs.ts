import { MEMLINK_VERSION } from '../core/types.ts';

interface Release {
  version: string;
  date: string;
  title: string;
  changes: string[];
  isCurrent?: boolean;
}

const releases: Release[] = [
  {
    version: '1.0.9',
    date: '2026-05-29',
    title: 'Connect Agents · Export · Daemon Mode',
    isCurrent: true,
    changes: [
      'Connect agents menu — auto-detect installed AI agents and show MCP config',
      'Export memories to Markdown, plain text, and HTML',
      'Import memories from JSON files',
      'Config commands: `memlink config get/set` for runtime preferences',
      'HTML renderer for memory display (`memlink show` and export)',
      'Stdio MCP transport for pipeline/embed usage',
      'Daemon mode: `memlink serve --daemon` for background operation',
      'Log levels: none, basic, verbose',
      'Optional bearer token authentication for MCP endpoints',
      'Landing page with bento grid and CLI feature screenshots',
      'Name-or-ID lookup for all commands',
      'JSON-only storage per memory directory',
      'Multiple entries support in `memory_read`',
    ],
  },
  {
    version: '1.0.8',
    date: '2026-05-20',
    title: 'CORS · Read-only Mode · WSL Connect',
    changes: [
      'CORS support for cross-origin MCP connections',
      'Read-only mode to prevent accidental writes',
      'Graceful server shutdown on SIGTERM/SIGINT',
      'WSL bridge for Windows users',
      'Performance improvements in memory search',
    ],
  },
  {
    version: '1.0.7',
    date: '2026-05-18',
    title: 'Single MCP URL · FAQ · Slim Config',
    changes: [
      'Single MCP connection URL per memory (no more JSON config blocks)',
      'FAQ section in `memlink --help`',
      'Removed legacy JSON config templates',
      'Improved `memlink connect` output with copy-to-clipboard',
    ],
  },
  {
    version: '1.0.5',
    date: '2026-05-15',
    title: 'SSE Stability',
    changes: [
      'Fixed SSE double-start causing session 404 errors',
      'Improved error messages in server startup',
    ],
  },
  {
    version: '1.0.4',
    date: '2026-05-14',
    title: 'SSE Fixes',
    changes: [
      'Fixed SSE session cleanup on disconnect',
      'Added connection timeout handling for SSE',
      'Better error propagation to clients',
    ],
  },
  {
    version: '1.0.3',
    date: '2026-05-13',
    title: 'SSE Transport · Dual URLs',
    changes: [
      'Server-Sent Events (SSE) transport for MCP',
      'Dual URL output: HTTP + SSE endpoints',
      'Windows openUrl fix for `memlink bug`',
      'GitHub issue templates',
    ],
  },
  {
    version: '1.0.2',
    date: '2026-05-12',
    title: 'CI & Trusted Publishing',
    changes: [
      'Trusted Publisher workflow for npm publishing',
      'Automated CI pipeline: test → typecheck → format → lint → build',
      'Removed binaries from repo',
    ],
  },
  {
    version: '1.0.1',
    date: '2026-05-11',
    title: 'Initial Release · Skill Auto-Install',
    changes: [
      'First npm release: `npm install -g @memlink/cli`',
      'Skill auto-tagging in AGENTS.md for AI assistants',
      'Global skill installation to `~/.agents/skills/memlink/`',
      'Core MCP tools: memory_read, memory_edit, memory_delete, memory_search, memory_sync',
      'Backup system: create, restore, list, delete, cleanup',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-05-08',
    title: 'Server Polish & Landing Page',
    changes: [
      'CORS middleware with configurable origins',
      'Read-only mode flag',
      'Graceful shutdown handlers',
      'WSL connectivity support',
      'Landing page with bento grid layout',
      'CLI feature SVGs for documentation',
      'ASCII art banner with gradient colors',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-05-05',
    title: 'MCP Server Foundation',
    changes: [
      'Express + @modelcontextprotocol/sdk integration',
      'Streamable HTTP MCP transport',
      'Per-memory MCP tool registration',
      'Health check endpoint at `/health`',
      'System instructions resource at `/instructions`',
      'Atomic file writes with `.tmp` + rename pattern',
      'Config persistence in `~/.memlink/config.json`',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-05-01',
    title: 'Prototype',
    changes: [
      'Core memory CRUD: create, read, update, delete',
      'File-based storage as `.memory.json` arrays',
      'Search across title, content, and tags',
      'Bulk operations and batch edits',
      'CLI scaffold with Commander.js',
      'Universal memory listing and stats',
    ],
  },
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ICON_X =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#e6edf3"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';

const ICON_GH =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#e6edf3"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>';

export function renderChangelog(): string {
  const items = releases
    .map((r) => {
      const badge = r.isCurrent ? `<span class="badge current">current</span>` : '';
      const changes = r.changes.map((c) => `            <li>${escapeHtml(c)}</li>`).join('\n');

      return `          <div class="release">
            <div class="release-header">
              <div class="version-column">
                <span class="version-tag">v${r.version}</span>
                ${badge}
              </div>
              <div class="meta-column">
                <span class="date">${r.date}</span>
                <span class="dot">·</span>
                <span class="title">${escapeHtml(r.title)}</span>
              </div>
            </div>
            <ul class="changes">
${changes}
            </ul>
          </div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Memlink Changelog</title>
  <style>
    @font-face {
      font-family: 'Geist Pixel';
      src: url('/public/GeistPixel-Square.woff2') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Geist Pixel', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #000;
      color: #e6edf3;
      -webkit-font-smoothing: antialiased;
      line-height: 1.6;
    }
    .container { max-width: 720px; margin: 0 auto; padding: 3rem 2rem; }

    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3rem; }
    h1 { font-size: 2rem; font-weight: 600; margin-bottom: 0.25rem; }
    .subtitle { color: #666; font-size: 0.9rem; }
    .subtitle a { color: #00e5a0; text-decoration: none; }
    .subtitle a:hover { text-decoration: underline; }
    .social { display: flex; gap: 0.5rem; }
    .social a {
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 6px;
      background: #0a0a0a; border: 1px solid #1a1a1a;
      transition: border-color 0.2s;
    }
    .social a:hover { border-color: #333; }
    .social svg { opacity: 0.6; transition: opacity 0.2s; }
    .social a:hover svg { opacity: 1; }

    .release {
      margin-bottom: 2.5rem; padding: 1.25rem 1.5rem;
      background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 8px;
    }
    .release:last-child { margin-bottom: 0; }
    .release-header {
      display: flex; align-items: baseline; gap: 1rem;
      flex-wrap: wrap; margin-bottom: 1rem;
    }
    .version-column { display: flex; align-items: center; gap: 0.5rem; }
    .version-tag {
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
      font-size: 1rem; font-weight: 600; color: #00e5a0;
    }
    .badge {
      font-size: 0.65rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.05em; padding: 0.15rem 0.5rem; border-radius: 4px;
      background: rgba(0, 229, 160, 0.08); color: #00e5a0;
      border: 1px solid rgba(0, 229, 160, 0.15);
    }
    .meta-column {
      display: flex; align-items: baseline; gap: 0.4rem;
      color: #666; font-size: 0.85rem;
    }
    .meta-column .title { color: #888; }
    .meta-column .dot { color: #444; }

    .changes { list-style: none; padding: 0; }
    .changes li {
      position: relative; padding-left: 1.2rem; margin-bottom: 0.35rem;
      color: #888; font-size: 0.875rem;
    }
    .changes li::before {
      content: ''; position: absolute; left: 0; top: 0.55rem;
      width: 5px; height: 5px; border-radius: 50%; background: #444;
    }
    .changes li:last-child { margin-bottom: 0; }

    hr { border: none; border-top: 1px solid #1a1a1a; margin: 3rem 0 2rem; }
    .footer { color: #555; font-size: 0.8rem; text-align: center; }

    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
    }

    @media (prefers-reduced-motion: reduce) {
      .social a, .social svg { transition: none; }
    }

    @media (max-width: 600px) {
      .container { padding: 2rem 1rem; }
      h1 { font-size: 1.5rem; }
      .release-header { flex-direction: column; gap: 0.25rem; }
    }

    @media print {
      body { background: #fff; color: #000; }
      .release { border-color: #ccc; background: #fff; }
      .social { display: none; }
    }
  </style>
</head>
<body>
  <a href="#content" class="sr-only">Skip to content</a>
  <div class="container">
    <header class="header">
      <div>
        <h1>Changelog</h1>
        <p class="subtitle">Memlink · <a href="https://github.com/rblez/memlink/issues">Report a bug</a></p>
      </div>
      <div class="social">
        <a href="https://x.com/aiustantt" target="_blank" rel="noopener" aria-label="X (formerly Twitter)">${ICON_X}</a>
        <a href="https://github.com/rblez/memlink" target="_blank" rel="noopener" aria-label="GitHub">${ICON_GH}</a>
      </div>
    </header>

    <main id="content">
${items}
    </main>

    <hr>
    <footer class="footer">Memlink v${MEMLINK_VERSION}</footer>
  </div>
</body>
</html>`;
}
