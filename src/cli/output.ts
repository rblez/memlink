import chalk, { type ChalkInstance } from 'chalk';

// ─── Color palette (hardcoded hex) ────────────────────────────────────────────

export const colors = {
  primary: chalk.hex('#00E5A0'),
  accent: chalk.hex('#CC00CC'),
  muted: chalk.hex('#66B8A0'),
  white: chalk.hex('#e8e8e8'),
  dim: chalk.hex('#444'),
};

// ─── Symbols ──────────────────────────────────────────────────────────────────

const SYM = {
  ok: '●',
  error: '●',
  confirm: '❯',
  info: '○',
  count: '*',
  prompt: '❯',
  header: '❭',
  divider: '─',
  list: '○',
  active: '*',
  navDown: '↓',
  navEnter: '↵',
};

// ─── Badge helpers ─────────────────────────────────────────────────────────────

export function ok(message: string): string {
  return `  ${colors.primary(SYM.ok)}  ${colors.white(message)}`;
}

export function err(message: string, hint?: string): string {
  const base = `  ${colors.accent(SYM.error)}  ${colors.white(message)}`;
  return hint ? `${base}\n  ${colors.dim(hint)}` : base;
}

export function info(label: string, value?: string): string {
  if (value === undefined) {
    return `  ${colors.muted(SYM.info)}  ${colors.primary(label)}`;
  }
  return `  ${colors.muted(SYM.info)}  ${colors.primary(label)}  ${colors.white(value)}`;
}

export function count(label: string, value: number | string): string {
  return `  ${colors.muted(`${SYM.count} ${value} ${label}`)}`;
}

export function confirm(message: string): string {
  return `  ${colors.accent(SYM.confirm)}  ${colors.white(message)}`;
}

export function kv(key: string, value: string): string {
  return `  ${colors.muted(key)}  ${colors.white(value)}`;
}

export function list(label: string, id: string, detail?: string): string {
  const base = `  ${colors.muted(SYM.list)}  ${colors.white(label)}  ${colors.dim(id)}`;
  return detail ? `${base}  ${colors.muted(detail)}` : base;
}

export function heading(text: string): string {
  return `\n  ${colors.accent(SYM.header)}  ${colors.white(text)}\n  ${colors.dim(SYM.divider.repeat(64))}`;
}

export function subheading(text: string): string {
  return colors.muted(`  ${text}`);
}

export function prompt(text: string): string {
  return `${colors.primary(SYM.prompt)}  ${colors.white(text)}`;
}

export function dimLine(text: string): string {
  return colors.dim(`  ${text}`);
}

export function divider(): string {
  return colors.dim(SYM.divider.repeat(64));
}

export function printLogo(): string {
  const art = [
    '⠀⠀⠀⠀⠀⠀⣿⣿⠀⠀⠀⠀⠀⠀',
    '⠀⠀⠸⠿⣀⣀⠿⠿⣀⣀⠿⠇⠀⠀',
    '⢠⣤⣤⣤⠿⠿⠀⠀⠿⠿⣤⣤⣤⡄',
    '⠘⠛⠛⠛⣶⣶⠀⠀⣶⣶⠛⠛⠛⠃',
    '⠀⠀⣿⣿⠉⠉⣿⣿⠉⠉⣿⣿⠀⠀',
    '⠀⠀⠀⠀⠀⠀⣿⣿⠀⠀⠀⠀⠀⠀',
  ];

  const stops = [
    { p: 0, r: 0x00, g: 0xe5, b: 0xa0 },
    { p: 7, r: 0xff, g: 0xff, b: 0xff },
    { p: 13, r: 0xcc, g: 0x00, b: 0xcc },
  ];

  function getColorAt(pos: number, maxPos: number, maxNorm = 27): ChalkInstance {
    const norm = (pos / maxPos) * maxNorm;
    let left = stops[0];
    let right = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (norm >= stops[i].p && norm <= stops[i + 1].p) {
        left = stops[i];
        right = stops[i + 1];
        break;
      }
    }
    const range = right.p - left.p;
    const t = range === 0 ? 0 : (norm - left.p) / range;
    const r = Math.round(left.r + (right.r - left.r) * t);
    const g = Math.round(left.g + (right.g - left.g) * t);
    const b = Math.round(left.b + (right.b - left.b) * t);
    return chalk.hex(
      `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    );
  }

  const artLines = art.map((line) => {
    const colored = [...line].map((ch, i) => getColorAt(i, 27)(ch)).join('');
    return `  ${colored}`;
  });

  const tagline1 = 'Universal Memory for AI Agents';
  const tagline2 = 'Self-hosted · Fast · Organized';
  const inner = Math.max(tagline1.length, tagline2.length) + 4;
  const white = colors.white;
  const green = chalk.hex('#00E5A0');
  const magenta = chalk.hex('#CC00CC');

  function gradientLine(left: string, dash: string, right: string): string {
    const chars = [left, ...dash.repeat(inner), right];
    return chars
      .map((ch, i) => {
        if (i === 0) return green(ch);
        if (i === inner + 1) return magenta(ch);
        return getColorAt(i - 1, inner - 1, 13)(ch);
      })
      .join('');
  }

  function sideLine(): string {
    return green('│') + white(' '.repeat(inner)) + magenta('│');
  }

  function textLine(text: string): string {
    return green('│') + white('  ' + text.padEnd(tagline1.length) + '  ') + magenta('│');
  }

  const boxLines = [
    gradientLine('┌', '─', '┐'),
    sideLine(),
    textLine(tagline1),
    textLine(tagline2),
    sideLine(),
    gradientLine('└', '─', '┘'),
  ];

  return artLines.map((line, i) => line + '  ' + boxLines[i]).join('\n');
}

export function navHint(hints: string[]): string {
  return colors.dim(`  ${hints.join('  ·  ')}`);
}

// ─── Skill file templates ─────────────────────────────────────────────────────

export const SKILL_MD = `# Memlink — Universal Memory for AI Agents

Memlink is an MCP server (Model Context Protocol) that gives AI agents persistent, organized memory across sessions. It runs in two modes:

- **Local CLI** (\`memlink serve\`) — self-hosted on your machine
- **Cloud** (\`mcp.memlink.cloud\`) — managed SaaS (coming in Phase 2)

Both are MCP servers. The tools are identical. This skill applies to both.

## Mandatory: Use MCP at every session start

1. Connect to the memlink MCP server in your agent's MCP settings
2. Call \`memory_read\` immediately to load all stored context
3. During the session, call \`memory_edit\` whenever the user asks to save/remember something
4. Search with \`memory_search\` before creating new entries to avoid duplicates

## Connection (Local CLI)

The local server runs at:

\`\`\`
Default memory:  http://localhost:4444/mcp
Isolated memory: http://localhost:4444/mcp?t=YOUR_TOKEN
\`\`\`

### MCP config JSON

Add this to your agent's MCP settings (\`claude_desktop_config.json\`, \`.cursor/mcp.json\`, etc.):

\`\`\`json
{
  "mcpServers": {
    "memlink": {
      "type": "http",
      "url": "http://localhost:4444/mcp"
    }
  }
}
\`\`\`

For stdio transport (CLI agents like Claude Code, Aider):

\`\`\`json
{
  "mcpServers": {
    "memlink": {
      "type": "stdio",
      "command": "memlink",
      "args": ["serve", "--transport", "stdio", "--memory", "default"]
    }
  }
}
\`\`\`

Run \`memlink url\` from the terminal to see the URL. Run \`memlink info <name>\` for memory details.

## MCP Tools

| Tool | Description |
|------|-------------|
| \`memory_read\` | Read all entries or a specific one by title or id. Always call at session start. |
| \`memory_edit\` | Create or update an entry. Params: \`title\` (PascalCase), \`content\` (plain text only, no markdown/HTML), \`tags\` (optional array). |
| \`memory_search\` | Search across title, content, and tags. |
| \`memory_sync\` | Memory stats (entries, size, last updated). |

## Best Practices

- **Start with memory_read**: Always read memory at the start of every session to restore context
- **Titles**: Use short, descriptive PascalCase or Title Case. E.g., \`DatabaseConfig\`, \`UserPreferences\`, \`ProjectTimeline\`
- **Content**: Store as plain text only — no markdown, no HTML. Keep focused on one topic. Max 100K chars.
- **Tags**: Add categorical tags like \`project\`, \`config\`, \`preference\`, \`note\` for easy filtering
- **Search before create**: Use \`memory_search\` with a keyword to check if something already exists before writing a new entry
- **No duplication**: If a topic already exists, update it with \`memory_edit\` rather than creating a new entry

## WSL Bridge

If running inside WSL, agents on Windows can connect via \`wslink\`:

\`\`\`bash
# In WSL:
wslink forward 4444
# Now Windows agents can use http://localhost:4444/mcp
\`\`\`
`;
