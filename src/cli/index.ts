#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { execSync } from 'child_process';
import { Command } from 'commander';
import { table } from 'table';
import {
  ok as okBadge,
  err,
  info,
  count,
  heading,
  subheading,
  dimLine,
  colors,
  printLogo,
  navHint,
  SKILL_MD,
  README_MD,
} from './output.ts';
import {
  loadConfig,
  createUniversalMemory,
  readMemory,
  getStats,
  renderEntryAsMarkdown,
} from '../core/memory.ts';
import { startServer } from '../server/index.ts';
import { MEMLINK_VERSION, DEFAULT_PORT, DEFAULT_HOST } from '../core/types.ts';

// ─── Branding ────────────────────────────────────────────────────────────────

const LOGO = `\n${printLogo()}\n${colors.dim('  Universal Memory for AI Agents')}\n${colors.dim('  Self-hosted · Fast · Organized')}\n`;

const LOGO_SMALL = colors.white('memlink') + colors.dim(' v' + MEMLINK_VERSION);

// ─── Nav hints ────────────────────────────────────────────────────────────────

function navFooter(hints: string[]): string {
  return `\n  ${colors.dim('─'.repeat(64))}\n  ${colors.dim(hints.join('  ' + colors.dim('·') + ' '))}\n`;
}

// ─── Interactive helpers ─────────────────────────────────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(colors.primary('❯') + ' ' + colors.white(question), (answer) => {
      resolve(answer.trim());
    });
  });
}

// ─── Clipboard helper ─────────────────────────────────────────────────────

function copyToClipboard(text: string): boolean {
  const tmpfile = os.tmpdir() + '/memlink-clipboard-' + Date.now() + '.txt';
  try {
    fs.writeFileSync(tmpfile, text, 'utf-8');
    const platform = process.platform;

    if (platform === 'darwin') {
      execSync(`cat '${tmpfile}' | pbcopy`, { stdio: 'ignore' });
    } else if (platform === 'win32') {
      execSync(`powershell -c "Set-Clipboard -Value (Get-Content '${tmpfile}' -Raw)"`, {
        stdio: 'ignore',
      });
    } else {
      // Linux / Android (Termux) / BSD
      // Try Termux first (termux-clipboard-set)
      try {
        execSync('which termux-clipboard-set', { stdio: 'ignore' });
        execSync(`cat '${tmpfile}' | termux-clipboard-set`, { stdio: 'ignore' });
        fs.unlinkSync(tmpfile);
        return true;
      } catch {
        // Not Termux, try Wayland/X11 clipboard tools
        for (const tool of ['wl-copy', 'xclip', 'xsel']) {
          try {
            execSync(`which ${tool}`, { stdio: 'ignore' });
            if (tool === 'wl-copy') {
              execSync(`cat '${tmpfile}' | ${tool}`, { stdio: 'ignore' });
            } else if (tool === 'xclip') {
              execSync(`cat '${tmpfile}' | ${tool} -selection clipboard`, { stdio: 'ignore' });
            } else {
              execSync(`cat '${tmpfile}' | ${tool} --clipboard --input`, { stdio: 'ignore' });
            }
            fs.unlinkSync(tmpfile);
            return true;
          } catch {
            continue;
          }
        }
      }
    }

    fs.unlinkSync(tmpfile);
    return true;
  } catch {
    try {
      fs.unlinkSync(tmpfile);
    } catch {
      /* ignore */
    }
    return false;
  }
}

// ─── Skill install ──────────────────────────────────────────────────────────

function installSkill(scope: 'global' | 'workspace'): string | null {
  const skillDir =
    scope === 'global'
      ? path.join(os.homedir(), '.agents', 'skills', 'memlink')
      : path.join(process.cwd(), '.agents', 'skills', 'memlink');

  try {
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), SKILL_MD, 'utf-8');
    fs.writeFileSync(path.join(skillDir, 'README.md'), README_MD, 'utf-8');

    if (scope === 'workspace') {
      const agentsMdPath = path.join(process.cwd(), 'AGENTS.md');
      const line = '@.agents/skills/memlink';
      let content = '';
      if (fs.existsSync(agentsMdPath)) {
        content = fs.readFileSync(agentsMdPath, 'utf-8');
        if (!content.includes(line)) {
          content += `\n${line}\n`;
        }
      } else {
        content = `${line}\n`;
      }
      fs.writeFileSync(agentsMdPath, content, 'utf-8');
    }

    return skillDir;
  } catch {
    return null;
  }
}

async function promptSkillInstall(): Promise<'global' | 'workspace' | 'skip'> {
  const choices = [
    { label: 'Workspace', desc: './AGENTS.md + ./.agents/skills/', value: 'workspace' as const },
    { label: 'Global', desc: '~/.agents/skills/', value: 'global' as const },
    { label: 'Skip', desc: '', value: 'skip' as const },
  ];

  // Fallback for non-TTY
  if (!process.stdin.isTTY) {
    console.log(heading('Install skill?'));
    console.log();
    choices.forEach((c, i) => {
      const prefix = i === 0 ? colors.primary('  ●') : colors.muted('  ○');
      const desc = c.desc ? colors.dim(`(${c.desc})`) : '';
      console.log(`  ${prefix}  ${i + 1}. ${colors.white(c.label)}  ${desc}`);
    });
    console.log();
    return new Promise((resolve) => {
      rl.question(colors.primary('❯') + ' ' + colors.white('Choice [1-3]: '), (answer) => {
        const c = answer.trim();
        if (c === '1') resolve('workspace');
        else if (c === '2') resolve('global');
        else resolve('skip');
      });
    });
  }

  return new Promise((resolve) => {
    let selected = 0;

    // heading() = 3 lines, choices = 3, footer = 3 (empty + navHint + empty) = 9 total
    const TOTAL_LINES = 9;

    const render = () => {
      process.stdout.write(`\x1B[${TOTAL_LINES}A\x1B[0J`);

      let out = '';
      out += heading('Install skill?') + '\n';
      choices.forEach((c, i) => {
        const prefix = i === selected ? colors.primary('  ●') : colors.muted('  ○');
        const labelColor = i === selected ? colors.white : colors.dim;
        const desc = c.desc ? colors.dim(`(${c.desc})`) : '';
        out += `  ${prefix}  ${i + 1}. ${labelColor(c.label)}  ${desc}\n`;
      });
      out += '\n';
      out += navHint(['↓↑ navigate', '↵ select']) + '\n';
      out += '\n';

      process.stdout.write(out);
    };

    // Print initial render
    let out = '';
    out += heading('Install skill?') + '\n';
    choices.forEach((c, i) => {
      const prefix = i === 0 ? colors.primary('  ●') : colors.muted('  ○');
      const labelColor = i === 0 ? colors.white : colors.dim;
      const desc = c.desc ? colors.dim(`(${c.desc})`) : '';
      out += `  ${prefix}  ${i + 1}. ${labelColor(c.label)}  ${desc}\n`;
    });
    out += '\n';
    out += navHint(['↓↑ navigate', '↵ select']) + '\n';
    out += '\n';

    process.stdout.write(out);

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (key) => {
      const buf = key as Buffer;

      if (buf[0] === 3) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve('skip');
        return;
      }

      if (buf[0] === 13) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve(choices[selected].value);
        return;
      }

      if ((buf[0] === 27 && buf[1] === 91 && buf[2] === 65) || buf[0] === 106) {
        selected = selected > 0 ? selected - 1 : choices.length - 1;
        render();
      }

      if ((buf[0] === 27 && buf[1] === 91 && buf[2] === 66) || buf[0] === 107) {
        selected = selected < choices.length - 1 ? selected + 1 : 0;
        render();
      }
    });
  });
}

// ─── Memory selector TUI ───────────────────────────────────────────────────

interface MemoryOption {
  id: string;
  name: string;
  entries: number;
  size: number;
}

async function showMemorySelector(): Promise<string | null> {
  const config = loadConfig();
  const options: MemoryOption[] = [];

  // Show loading indicator
  process.stdout.write(colors.dim('  loading memories...\n'));

  for (const mem of config.universalMemories) {
    try {
      const stats = getStats(mem.memoryId);
      options.push({
        id: mem.memoryId,
        name: mem.memoryName,
        entries: stats.entries,
        size: stats.size,
      });
    } catch {
      options.push({ id: mem.memoryId, name: mem.memoryName, entries: 0, size: 0 });
    }
  }

  // Clear loading line
  process.stdout.write('\x1B[1A\x1B[0J');

  if (options.length === 0) return null;
  if (options.length === 1) return options[0].id;

  // Fallback for non-TTY environments (piped input, CI, etc.)
  if (!process.stdin.isTTY) {
    console.log(heading('Select Memory'));
    console.log();
    options.forEach((opt, i) => {
      const prefix = i === 0 ? colors.primary('  ●') : colors.muted('  ○');
      const sizeStr = (opt.size / 1024).toFixed(1);
      console.log(
        `${prefix}  ${colors.white(opt.name)}  ${colors.dim(`[${opt.entries} entries · ${sizeStr} KB]`)}`
      );
    });
    console.log();
    return new Promise((resolve) => {
      rl.question(
        colors.primary('❯') + ' ' + colors.white(`Choose [1-${options.length}]: `),
        (answer) => {
          const idx = parseInt(answer.trim()) - 1;
          if (idx >= 0 && idx < options.length) resolve(options[idx].id);
          else resolve(options[0].id);
        }
      );
    });
  }

  return new Promise((resolve) => {
    let selected = 0;
    const PAGE_SIZE = 10;
    let scrollOffset = 0;

    // heading() produces 3 visual lines: \n + title line + divider line
    const HEADER_LINES = 3;
    const FOOTER_LINES = 3; // empty + navHint + empty
    const PAGINATION_LINES = options.length > PAGE_SIZE ? 1 : 0;
    const TOTAL_LINES = HEADER_LINES + PAGE_SIZE + PAGINATION_LINES + FOOTER_LINES;

    const render = () => {
      if (selected < scrollOffset) scrollOffset = selected;
      if (selected >= scrollOffset + PAGE_SIZE) scrollOffset = selected - PAGE_SIZE + 1;

      const visible = options.slice(scrollOffset, scrollOffset + PAGE_SIZE);

      // Move cursor up to top of selector, clear everything below
      process.stdout.write(`\x1B[${TOTAL_LINES}A\x1B[0J`);

      let out = '';
      out += heading('Select Memory') + '\n';

      visible.forEach((opt, vi) => {
        const realIdx = scrollOffset + vi;
        const prefix = realIdx === selected ? colors.primary('  ●') : colors.muted('  ○');
        const nameColor = realIdx === selected ? colors.white : colors.dim;
        const sizeStr = (opt.size / 1024).toFixed(1);
        out += `${prefix}  ${nameColor(opt.name)}  ${colors.dim(`[${opt.entries} entries · ${sizeStr} KB]`)}\n`;
      });

      if (options.length > PAGE_SIZE) {
        out +=
          colors.dim(
            `  ... ${scrollOffset + 1}-${Math.min(scrollOffset + PAGE_SIZE, options.length)} of ${options.length}`
          ) + '\n';
      }

      out += '\n';
      out += navHint(['↓↑ navigate', '↵ select']) + '\n';
      out += '\n';

      process.stdout.write(out);
    };

    // Print initial render
    let out = '';
    out += heading('Select Memory') + '\n';

    const initVisible = options.slice(0, PAGE_SIZE);
    initVisible.forEach((opt, vi) => {
      const prefix = vi === 0 ? colors.primary('  ●') : colors.muted('  ○');
      const nameColor = vi === 0 ? colors.white : colors.dim;
      const sizeStr = (opt.size / 1024).toFixed(1);
      out += `${prefix}  ${nameColor(opt.name)}  ${colors.dim(`[${opt.entries} entries · ${sizeStr} KB]`)}\n`;
    });

    if (options.length > PAGE_SIZE) {
      out += colors.dim(`  ... 1-${PAGE_SIZE} of ${options.length}`) + '\n';
    }

    out += '\n';
    out += navHint(['↓↑ navigate', '↵ select']) + '\n';
    out += '\n';

    process.stdout.write(out);

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (key) => {
      const buf = key as Buffer;

      if (buf[0] === 3) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve(null);
        return;
      }

      if (buf[0] === 13) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve(options[selected].id);
        return;
      }

      if ((buf[0] === 27 && buf[1] === 91 && buf[2] === 65) || buf[0] === 106) {
        selected = selected > 0 ? selected - 1 : options.length - 1;
        render();
      }

      if ((buf[0] === 27 && buf[1] === 91 && buf[2] === 66) || buf[0] === 107) {
        selected = selected < options.length - 1 ? selected + 1 : 0;
        render();
      }
    });
  });
}

interface EntryOption {
  title: string;
  tags?: string[];
  updatedAt: string;
}

async function promptEntrySelect(entries: EntryOption[]): Promise<string | null> {
  if (entries.length === 0) return null;
  if (entries.length === 1) return entries[0].title;

  // Fallback for non-TTY environments
  if (!process.stdin.isTTY) {
    console.log(heading('Select Entry'));
    console.log();
    entries.forEach((opt, i) => {
      const prefix = i === 0 ? colors.primary('  ●') : colors.muted('  ○');
      const tags = opt.tags?.length ? colors.dim(`[${opt.tags.join(', ')}]`) : '';
      console.log(`${prefix}  ${colors.white(opt.title)}  ${tags}`);
    });
    console.log();
    return new Promise((resolve) => {
      rl.question(
        colors.primary('❯') + ' ' + colors.white(`Choose [1-${entries.length}]: `),
        (answer) => {
          const idx = parseInt(answer.trim()) - 1;
          if (idx >= 0 && idx < entries.length) resolve(entries[idx].title);
          else resolve(entries[0].title);
        }
      );
    });
  }

  return new Promise((resolve) => {
    let selected = 0;
    const PAGE_SIZE = 10;
    let scrollOffset = 0;

    const HEADER_LINES = 3;
    const FOOTER_LINES = 3;
    const PAGINATION_LINES = entries.length > PAGE_SIZE ? 1 : 0;
    const TOTAL_LINES = HEADER_LINES + PAGE_SIZE + PAGINATION_LINES + FOOTER_LINES;

    const render = () => {
      if (selected < scrollOffset) scrollOffset = selected;
      if (selected >= scrollOffset + PAGE_SIZE) scrollOffset = selected - PAGE_SIZE + 1;

      const visible = entries.slice(scrollOffset, scrollOffset + PAGE_SIZE);

      process.stdout.write(`\x1B[${TOTAL_LINES}A\x1B[0J`);

      let out = '';
      out += heading('Select Entry') + '\n';

      visible.forEach((opt, vi) => {
        const realIdx = scrollOffset + vi;
        const prefix = realIdx === selected ? colors.primary('  ●') : colors.muted('  ○');
        const titleColor = realIdx === selected ? colors.white : colors.dim;
        const tags = opt.tags?.length ? colors.dim(`[${opt.tags.join(', ')}]`) : '';
        out += `${prefix}  ${titleColor(opt.title)}  ${tags}\n`;
      });

      if (entries.length > PAGE_SIZE) {
        out +=
          colors.dim(
            `  ... ${scrollOffset + 1}-${Math.min(scrollOffset + PAGE_SIZE, entries.length)} of ${entries.length}`
          ) + '\n';
      }

      out += '\n';
      out += navHint(['↓↑ navigate', '↵ select']) + '\n';
      out += '\n';

      process.stdout.write(out);
    };

    // Print initial render
    let out = '';
    out += heading('Select Entry') + '\n';

    const initVisible = entries.slice(0, PAGE_SIZE);
    initVisible.forEach((opt, vi) => {
      const prefix = vi === 0 ? colors.primary('  ●') : colors.muted('  ○');
      const titleColor = vi === 0 ? colors.white : colors.dim;
      const tags = opt.tags?.length ? colors.dim(`[${opt.tags.join(', ')}]`) : '';
      out += `${prefix}  ${titleColor(opt.title)}  ${tags}\n`;
    });

    if (entries.length > PAGE_SIZE) {
      out += colors.dim(`  ... 1-${PAGE_SIZE} of ${entries.length}`) + '\n';
    }

    out += '\n';
    out += navHint(['↓↑ navigate', '↵ select']) + '\n';
    out += '\n';

    process.stdout.write(out);

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (key) => {
      const buf = key as Buffer;

      if (buf[0] === 3) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve(null);
        return;
      }

      if (buf[0] === 13) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve(entries[selected].title);
        return;
      }

      if ((buf[0] === 27 && buf[1] === 91 && buf[2] === 65) || buf[0] === 106) {
        selected = selected > 0 ? selected - 1 : entries.length - 1;
        render();
      }

      if ((buf[0] === 27 && buf[1] === 91 && buf[2] === 66) || buf[0] === 107) {
        selected = selected < entries.length - 1 ? selected + 1 : 0;
        render();
      }
    });
  });
}

// ─── Program ──────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('memlink')
  .description('memlink — Universal memory for AI agents')
  .version(MEMLINK_VERSION, '-v, --version')
  .addHelpText('before', LOGO);

// ─── memlink serve ─────────────────────────────────────────────────────────────

program
  .command('serve')
  .description('Start the memlink MCP server')
  .option('-p, --port <port>', 'Port to listen on', String(DEFAULT_PORT))
  .option('-H, --host <host>', 'Host to bind to', DEFAULT_HOST)
  .action(async (opts) => {
    console.log(LOGO);

    const config = loadConfig();
    const port = parseInt(opts.port);
    const host = opts.host;

    console.log(okBadge('memlink running'));
    console.log();

    if (config.universalMemories.length > 0) {
      for (const mem of config.universalMemories) {
        console.log(info('URL', `http://${host}:${port}/mcp?id=${mem.memoryId}`));
      }
    } else {
      console.log(info('no memories', 'Create one with: memlink init'));
    }

    console.log();
    console.log(navFooter(['^c stop']));

    await startServer(port, host);
  });

// ─── memlink init ───────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialize memlink and create a memory')
  .action(async () => {
    console.log(LOGO);
    console.log(navFooter(['↵ confirm', '^c cancel']));

    const name = await askQuestion('Memory name: ');
    if (!name) {
      console.error(err('Memory name is required'));
      process.exit(1);
    }

    const memory = createUniversalMemory(name);
    console.log(okBadge('Memory created'));
    console.log();

    const config = loadConfig();
    const host = config.serverHost ?? DEFAULT_HOST;
    const port = config.serverPort ?? DEFAULT_PORT;
    const url = `http://${host}:${port}/mcp?id=${memory.memoryId}`;

    console.log(info('Name', memory.memoryName));
    console.log(info('ID', memory.memoryId));
    console.log(info('URL', url));
    console.log();

    const skillChoice = await promptSkillInstall();
    if (skillChoice !== 'skip') {
      const installed = installSkill(skillChoice);
      if (installed) {
        console.log(okBadge(`Skill installed: ${installed}`));
      } else {
        console.error(err('Failed to install skill'));
      }
    }
    console.log();

    const copied = copyToClipboard(url);
    if (copied) {
      console.log(okBadge('URL copied to clipboard'));
    }

    console.log();
    console.log(dimLine('Start server: memlink serve'));
    console.log();
    console.log(navFooter(['^c exit']));

    rl.close();
  });

// ─── memlink connect ─────────────────────────────────────────────────────

program
  .command('connect')
  .description('Select a memory and get its MCP connection details')
  .action(async () => {
    console.log('\n' + LOGO_SMALL + '\n');

    const config = loadConfig();
    if (config.universalMemories.length === 0) {
      console.log(info('no memories', 'No memories found.'));
      console.log(dimLine('Create one with: memlink init'));
      console.log();
      return;
    }

    const selectedId = await showMemorySelector();
    if (!selectedId) {
      console.log(dimLine('Cancelled.\n'));
      return;
    }

    // Clear terminal after selection
    process.stdout.write('\x1B[2J\x1B[H');

    const memory = config.universalMemories.find((m) => m.memoryId === selectedId);
    if (!memory) {
      console.error(err('Memory not found'));
      process.exit(1);
    }

    const host = config.serverHost ?? DEFAULT_HOST;
    const port = config.serverPort ?? DEFAULT_PORT;
    const url = `http://${host}:${port}/mcp?id=${memory.memoryId}`;

    console.log();
    console.log(info('Name', memory.memoryName));
    console.log(info('ID', memory.memoryId));
    console.log(info('URL', url));
    console.log();

    const mcpConfig = {
      mcpServers: {
        memlink: {
          url: url,
        },
      },
    };

    console.log(subheading('MCP JSON:'));
    const jsonStr = JSON.stringify(mcpConfig, null, 2);
    console.log(colors.muted('  ```json'));
    console.log(
      colors.muted(
        jsonStr
          .split('\n')
          .map((l) => '  ' + l)
          .join('\n')
      )
    );
    console.log(colors.muted('  ```'));
    console.log();

    const copied = copyToClipboard(url);
    if (copied) {
      console.log(okBadge('URL copied to clipboard'));
    }
    console.log();

    const skillChoice = await promptSkillInstall();
    if (skillChoice !== 'skip') {
      const installed = installSkill(skillChoice);
      if (installed) {
        console.log(okBadge(`Skill installed: ${installed}`));
      }
    }

    console.log();
    console.log(dimLine('Start server: memlink serve'));
    console.log();
    console.log(navFooter(['^c exit']));
  });

// ─── memlink status ───────────────────────────────────────────────────────────── ─────────────────────────────────────────────────────────────

program
  .command('status')
  .description('Show memlink system status')
  .action(() => {
    console.log('\n' + LOGO + '\n');

    const config = loadConfig();
    const host = config.serverHost ?? DEFAULT_HOST;
    const port = config.serverPort ?? DEFAULT_PORT;

    console.log(info('Server', `http://${host}:${port}/mcp`));
    console.log(count('memories', config.universalMemories.length));

    let totalSize = 0;
    let totalEntries = 0;
    for (const mem of config.universalMemories) {
      try {
        const stats = getStats(mem.memoryId);
        totalSize += stats.size;
        totalEntries += stats.entries;
      } catch {
        /* ignore */
      }
    }

    console.log(count('entries', totalEntries));
    console.log(count('size', `${(totalSize / 1024).toFixed(1)} KB`));
    console.log();
    console.log(navFooter(['^c exit']));
  });

// ─── memlink memory list ─────────────────────────────────────────────────────────

const memoryCmd = program.command('memory').description('Manage memories');

memoryCmd
  .command('list')
  .alias('ls')
  .description('List all memories')
  .action(() => {
    const config = loadConfig();

    if (config.universalMemories.length === 0) {
      console.log('\n' + LOGO_SMALL + '\n');
      console.log(info('no memories', 'No memories found.'));
      console.log(navFooter(['^c exit']));
      return;
    }

    console.log('\n' + LOGO_SMALL + '\n');

    const rows = [
      [colors.white('Name'), colors.white('ID'), colors.white('Size')],
      ...config.universalMemories.map((m) => {
        try {
          const stats = getStats(m.memoryId);
          return [
            colors.white(m.memoryName),
            colors.dim(m.memoryId),
            colors.dim(`${(stats.size / 1024).toFixed(1)} KB`),
          ];
        } catch {
          return [colors.white(m.memoryName), colors.dim(m.memoryId), colors.dim('error')];
        }
      }),
    ];

    console.log(table(rows));
    console.log(navFooter(['^c exit']));
  });

// ─── memlink memory show ─────────────────────────────────────────────────────────

memoryCmd
  .command('show [memoryId]')
  .description('Show memory contents')
  .option('-t, --title <title>', 'Show a specific entry')
  .action(async (memoryId: string | undefined, opts) => {
    if (!memoryId) {
      const selectedId = await showMemorySelector();
      if (!selectedId) {
        console.log(dimLine('Cancelled.\n'));
        return;
      }
      memoryId = selectedId;
    }

    const config = loadConfig();
    const memory = config.universalMemories.find((m) => m.memoryId === memoryId);

    if (!memory) {
      console.error(err(`Memory not found: ${memoryId}`));
      process.exit(1);
    }

    try {
      const entries = readMemory(memoryId);

      if (entries.length === 0) {
        console.log('\n' + LOGO_SMALL + '\n');
        console.log(info('empty', `Memory is empty for ${memory.memoryName}\n`));
        console.log(navFooter(['^c exit']));
        return;
      }

      if (opts.title) {
        const entry = entries.find((e) => e.title.toLowerCase() === opts.title.toLowerCase());
        if (!entry) {
          console.error(err(`Entry not found: ${opts.title}`));
          process.exit(1);
        }
        console.log('\n' + LOGO_SMALL + '\n');
        console.log(renderEntryAsMarkdown(entry));
        console.log();
        console.log(navFooter(['^c exit']));
        return;
      }

      // Clear terminal and show entry selector
      process.stdout.write('\x1B[2J\x1B[H');

      const entryOptions: EntryOption[] = entries.map((e) => ({
        title: e.title,
        tags: e.tags,
        updatedAt: e.updatedAt,
      }));

      const selectedTitle = await promptEntrySelect(entryOptions);
      if (!selectedTitle) {
        console.log(dimLine('Cancelled.\n'));
        return;
      }

      const entry = entries.find((e) => e.title.toLowerCase() === selectedTitle.toLowerCase());
      if (!entry) {
        console.error(err(`Entry not found: ${selectedTitle}`));
        process.exit(1);
      }

      // Clear terminal and show entry content
      process.stdout.write('\x1B[2J\x1B[H');
      console.log('\n' + LOGO_SMALL + '\n');
      console.log(renderEntryAsMarkdown(entry));
      console.log();
      console.log(navFooter(['^c exit']));
    } catch (e) {
      console.error(err('Failed to read memory', String(e)));
      process.exit(1);
    }
  });

// ─── memlink feedback ──────────────────────────────────────────────────────────

program
  .command('feedback')
  .description('Report a bug or send feedback (creates a GitHub issue)')
  .action(async () => {
    console.log('\n' + LOGO_SMALL + '\n');

    // Check if gh CLI is available
    try {
      execSync('which gh', { stdio: 'ignore' });
    } catch {
      console.error(err('GitHub CLI not found'));
      console.log(dimLine('Install gh: https://cli.github.com/'));
      console.log();
      return;
    }

    // Type selector
    const types = [
      { label: 'Bug Report', value: 'bug', emoji: '🐛' },
      { label: 'Feature Request', value: 'feature', emoji: '✨' },
      { label: 'Feedback', value: 'feedback', emoji: '💬' },
    ];

    let typeSelected = 0;

    if (process.stdin.isTTY) {
      typeSelected = await new Promise<number>((resolve) => {
        let sel = 0;
        const TOTAL = 6; // heading(3) + choices(3)

        const render = () => {
          process.stdout.write(`\x1B[${TOTAL}A\x1B[0J`);
          let out = '';
          out += heading('Feedback Type') + '\n';
          types.forEach((t, i) => {
            const prefix = i === sel ? colors.primary('  ●') : colors.muted('  ○');
            const labelColor = i === sel ? colors.white : colors.dim;
            out += `${prefix}  ${labelColor(t.label)}\n`;
          });
          process.stdout.write(out);
        };

        let out = '';
        out += heading('Feedback Type') + '\n';
        types.forEach((t, i) => {
          const prefix = i === 0 ? colors.primary('  ●') : colors.muted('  ○');
          const labelColor = i === 0 ? colors.white : colors.dim;
          out += `${prefix}  ${labelColor(t.label)}\n`;
        });
        process.stdout.write(out);

        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', (key) => {
          const buf = key as Buffer;
          if (buf[0] === 3) {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            resolve(-1);
            return;
          }
          if (buf[0] === 13) {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            resolve(sel);
            return;
          }
          if ((buf[0] === 27 && buf[1] === 91 && buf[2] === 65) || buf[0] === 106) {
            sel = sel > 0 ? sel - 1 : types.length - 1;
            render();
          }
          if ((buf[0] === 27 && buf[1] === 91 && buf[2] === 66) || buf[0] === 107) {
            sel = sel < types.length - 1 ? sel + 1 : 0;
            render();
          }
        });
      });

      if (typeSelected < 0) {
        console.log(dimLine('Cancelled.\n'));
        return;
      }
    }

    const selectedType = types[typeSelected];

    console.log();
    console.log(info('Type', selectedType.label));
    console.log();

    // Get title
    console.log(colors.primary('❯') + ' ' + colors.white('Title: '));
    const title = await askQuestion('');

    if (!title) {
      console.log(dimLine('Cancelled.\n'));
      return;
    }

    // Get description
    console.log(colors.primary('❯') + ' ' + colors.white('Description (Ctrl+D when done):'));
    console.log();

    const description = await new Promise<string>((resolve) => {
      const lines: string[] = [];
      process.stdin.setRawMode(false);
      process.stdin.resume();
      process.stdin.on('data', (chunk) => {
        const text = chunk.toString();
        if (text.charCodeAt(0) === 4) {
          // Ctrl+D
          process.stdin.pause();
          resolve(lines.join('\n').trim());
          return;
        }
        lines.push(text.replace(/\n$/, ''));
      });
    });

    if (!description) {
      console.log(dimLine('Cancelled.\n'));
      return;
    }

    // Create issue
    console.log();
    console.log(colors.dim('  creating issue...'));

    const body = `**Type:** ${selectedType.label}\n\n${description}`;

    try {
      const result = execSync(
        `gh issue create --repo rblez/memlink --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}"`,
        { encoding: 'utf-8' }
      );
      console.log();
      console.log(okBadge('Issue created!'));
      console.log(subheading(result.trim()));
      console.log();
      console.log(navFooter(['^c exit']));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(err('Failed to create issue', msg));
      process.exit(1);
    }
  });

// ─── Default: show help with banner ──────────────────────────────────────────

if (process.argv.length <= 2) {
  process.argv.push('--help');
}

program.parse(process.argv);
