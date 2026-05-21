import chalk from 'chalk';

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
    '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
    '⠀⠀⠀⠀⢠⣤⣤⣤⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⢠⣤⣤⣤⠀⠀⠀⠀',
    '⠀⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⠀',
    '⠀⠀⠀⠀⠘⠛⠛⠛⣶⣶⣶⡞⠛⠛⠛⣶⣶⣶⡞⠛⠛⠛⠀⠀⠀⠀',
    '⢠⣤⣤⣤⣤⣤⣤⣤⣿⣿⣿⡇⠀⠀⠀⣿⣿⣿⣧⣤⣤⣤⣤⣤⣤⣤',
    '⢸⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿',
    '⠘⠛⠛⠛⠛⠛⠛⠛⣿⣿⣿⡇⠀⠀⠀⣿⣿⣿⡟⠛⠛⠛⠛⠛⠛⠛',
    '⠀⠀⠀⠀⢠⣤⣤⣤⣿⣿⣿⣧⣤⣤⣤⣿⣿⣿⣧⣤⣤⣤⠀⠀⠀⠀',
    '⠀⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⠀',
    '⠀⠀⠀⠀⠘⠛⠛⠛⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⠘⠛⠛⠛⠀⠀⠀⠀',
    '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  ];

  const colorStops = [
    { pos: 0, r: 0x00, g: 0xe5, b: 0xa0 },
    { pos: 13, r: 0xff, g: 0xff, b: 0xff },
    { pos: 25, r: 0xcc, g: 0x00, b: 0xcc },
  ];

  function getColorAt(pos: number): string {
    let left = colorStops[0];
    let right = colorStops[colorStops.length - 1];
    for (let i = 0; i < colorStops.length - 1; i++) {
      if (pos >= colorStops[i].pos && pos <= colorStops[i + 1].pos) {
        left = colorStops[i];
        right = colorStops[i + 1];
        break;
      }
    }
    const range = right.pos - left.pos;
    const t = range === 0 ? 0 : (pos - left.pos) / range;
    const r = Math.round(left.r + (right.r - left.r) * t);
    const g = Math.round(left.g + (right.g - left.g) * t);
    const b = Math.round(left.b + (right.b - left.b) * t);
    return chalk.hex(
      `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    );
  }

  return art
    .map((line) => {
      const colored = [...line].map((ch, i) => getColorAt(i)(ch)).join('');
      return `  ${colored}`;
    })
    .join('\n');
}

export function navHint(hints: string[]): string {
  return colors.dim(`  ${hints.join('  ·  ')}`);
}

// ─── Skill file templates ─────────────────────────────────────────────────────

export const SKILL_MD = `# memlink skill

Use the memlink MCP tools to read and write memory:

- memory_read: retrieve stored context
- memory_edit: store new context
- memory_search: find relevant entries
- memory_delete: forget something
- memory_sync: verify memory state

Always read memory at the start of each session.
`;

export const README_MD = `# memlink

Universal memory for AI agents via MCP.

Connect any agent using: http://localhost:4444/mcp?id=YOUR_ID
`;
