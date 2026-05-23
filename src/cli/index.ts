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
  subheading,
  dimLine,
  colors,
  printLogo,
  SKILL_MD,
} from './output.ts';
import {
  loadConfig,
  createUniversalMemory,
  readMemory,
  getStats,
  renderMemoryAsMarkdown,
  revokeUniversalMemory,
} from '../core/memory.ts';
import { startServer } from '../server/index.ts';
import { MEMLINK_VERSION, DEFAULT_PORT, DEFAULT_HOST } from '../core/types.ts';

// ─── TTY detection ──────────────────────────────────────────────────────────

const isTTY = process.stdout.isTTY && process.stdin.isTTY;

// ─── Env helpers ────────────────────────────────────────────────────────────

function envHost(): string | undefined {
  return process.env.MEMLINK_HOST || process.env.HOST || undefined;
}

function envPort(): number | undefined {
  const s = process.env.MEMLINK_PORT || process.env.PORT;
  if (!s) return undefined;
  const n = parseInt(s, 10);
  return isNaN(n) ? undefined : n;
}

// ─── Branding ────────────────────────────────────────────────────────────────

function logo(): string {
  if (!isTTY) return '';
  return `\n${printLogo()}\n${colors.dim('  Universal Memory for AI Agents')}\n${colors.dim('  Self-hosted · Fast · Organized')}\n`;
}

function logoSmall(): string {
  if (!isTTY) return '';
  return colors.white('Memlink') + colors.dim(' v' + MEMLINK_VERSION);
}

// ─── Nav hints ────────────────────────────────────────────────────────────────

function navFooter(hints: string[]): string {
  return `\n  ${colors.dim('─'.repeat(64))}\n  ${colors.dim(hints.join('  ' + colors.dim('·') + ' '))}\n`;
}

// ─── Clipboard helper ─────────────────────────────────────────────────────

function copyToClipboard(text: string): boolean {
  if (!isTTY) return false;
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
      try {
        execSync('which termux-clipboard-set', { stdio: 'ignore' });
        execSync(`cat '${tmpfile}' | termux-clipboard-set`, { stdio: 'ignore' });
        fs.unlinkSync(tmpfile);
        return true;
      } catch {
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

// ─── Open URL helper ────────────────────────────────────────────────────────

function openUrl(url: string): boolean {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
  try {
    execSync(`${cmd} "${url}"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ─── ASCII width helper ─────────────────────────────────────────────────────

function memoryTableRow(name: string, id: string, sizeKb: string): string[] {
  return [colors.white(name), colors.dim(id), colors.dim(`${sizeKb} KB`)];
}

function serverUrl(host: string, port: number): string {
  return `http://${host}:${port}/mcp`;
}

// ─── Program ──────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('memlink')
  .description('Memlink — Universal memory for AI agents')
  .version(MEMLINK_VERSION, '--version')
  .addHelpText('before', logo());

// ─── Default: system overview ──────────────────────────────────────────────

program.action(() => {
  console.log(logo());

  const config = loadConfig();
  const host = envHost() || config.serverHost || DEFAULT_HOST;
  const port = envPort() || config.serverPort || DEFAULT_PORT;
  const url = serverUrl(host, port);

  console.log(info('Server', url));

  let totalSize = 0;
  let totalEntries = 0;

  if (config.universalMemories.length > 0) {
    for (const mem of config.universalMemories) {
      try {
        const stats = getStats(mem.memoryId);
        totalSize += stats.size;
        totalEntries += stats.entries;
        console.log(
          kv(
            `  ${colors.dim('  └')} ${mem.memoryName} (${mem.memoryId})`,
            `${stats.entries} entries · ${(stats.size / 1024).toFixed(1)} KB`
          )
        );
      } catch {
        console.log(kv(`  ${colors.dim('  └')} ${mem.memoryName} (${mem.memoryId})`, 'error'));
      }
    }
  }

  console.log(count('memories', config.universalMemories.length));
  console.log(count('entries', totalEntries));
  console.log(count('size', `${(totalSize / 1024).toFixed(1)} KB`));
  console.log();

  console.log(kv('Commands:', ''));
  console.log(kv('  serve', 'Start MCP server'));
  console.log(kv('  init <name>', 'Create a memory'));
  console.log(kv('  delete <id>', 'Delete a memory'));
  console.log(kv('  ls', 'List memories'));
  console.log(kv('  show <id>', 'Show memory content'));
  console.log(kv('  connect <id>', 'MCP connection details'));
  console.log(kv('  skill', 'Install Memlink agent skill (workspace)'));
  console.log(kv('  bug', 'Report issue'));
  console.log();
  console.log(dimLine('See Memlink --help for more'));
  console.log();
});

function kv(key: string, value: string): string {
  return `  ${colors.dim(key)}${value ? `  ${colors.white(value)}` : ''}`;
}

// ─── memlink serve (s) ────────────────────────────────────────────────────────

program
  .command('serve')
  .description('Start the Memlink MCP server')
  .option('--port <port>', 'Port to listen on', String(DEFAULT_PORT))
  .option('--host <host>', 'Host to bind to', DEFAULT_HOST)
  .action(async (opts) => {
    const config = loadConfig();
    const port = parseInt(opts.port);
    const host = opts.host;

    if (config.universalMemories.length > 0) {
      for (const mem of config.universalMemories) {
        console.log(info('URL', `http://${host}:${port}/mcp?id=${mem.memoryId}`));
      }
    } else {
      console.log(info('no memories', 'Create one with: Memlink init <name>'));
    }

    console.log(colors.dim('  ^c stop\n'));

    await startServer(port, host);
  });

// ─── memlink init <name> (i) / create <name> (c) ─────────────────────────

function initAction(name: string, opts: { serve?: boolean; port?: string }) {
  const memory = createUniversalMemory(name);
  console.log(logo());
  console.log(okBadge('Memory created'));
  console.log();

  const config = loadConfig();
  const host = envHost() || config.serverHost || DEFAULT_HOST;
  const port = envPort() || config.serverPort || DEFAULT_PORT;
  const url = serverUrl(host, port) + `?id=${memory.memoryId}`;

  console.log(info('Name', memory.memoryName));
  console.log(info('ID', memory.memoryId));
  console.log(info('URL', url));
  console.log();

  const copied = copyToClipboard(url);
  if (copied) {
    console.log(okBadge('URL copied to clipboard'));
  }

  console.log();
  console.log(dimLine('Connect: Memlink connect ' + memory.memoryId));
  console.log();

  if (opts.serve) {
    const servePort = opts.port ? parseInt(opts.port) : port;
    console.log(navFooter(['^c stop']));
    startServer(servePort, host);
  }
}

program
  .command('init <name>')
  .description('Create a new memory')
  .option('--serve', 'Auto-start the MCP server after creation')
  .option('--port <port>', 'Port for auto-start server')
  .action((name: string, opts) => {
    initAction(name, opts);
  });

program
  .command('create <name>')
  .description('Create a new memory (alias for init)')
  .option('--serve', 'Auto-start the MCP server after creation')
  .option('--port <port>', 'Port for auto-start server')
  .action((name: string, opts) => {
    initAction(name, opts);
  });

// ─── memlink delete <memoryId> ──────────────────────────────────────────

program
  .command('delete <memoryId>')
  .description('Delete a memory permanently')
  .action((memoryId: string) => {
    const config = loadConfig();
    const memory = config.universalMemories.find((m) => m.memoryId === memoryId);

    if (!memory) {
      console.error(err(`Memory not found: ${memoryId}`));
      console.log(dimLine('List memories: Memlink ls'));
      process.exit(1);
    }

    const ok = revokeUniversalMemory(memoryId);
    if (ok) {
      const small = logoSmall();
      if (small) console.log('\n' + small + '\n');
      console.log(okBadge(`Memory deleted: ${memory.memoryName} (${memoryId})`));
      console.log();
    } else {
      console.error(err(`Failed to delete memory: ${memoryId}`));
      process.exit(1);
    }
  });

// ─── memlink connect <memoryId> (con) ─────────────────────────────────────

program
  .command('connect <memoryId>')
  .description('Get MCP connection details for a memory')
  .action(async (memoryId: string) => {
    const config = loadConfig();
    const memory = config.universalMemories.find((m) => m.memoryId === memoryId);

    if (!memory) {
      console.error(err(`Memory not found: ${memoryId}`));
      console.log(dimLine('List memories: Memlink ls'));
      process.exit(1);
    }

    const host = envHost() || config.serverHost || DEFAULT_HOST;
    const port = envPort() || config.serverPort || DEFAULT_PORT;
    const url = serverUrl(host, port) + `?id=${memory.memoryId}`;

    const small = logoSmall();
    if (small) console.log('\n' + small + '\n');
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
    console.log(dimLine('Start server: Memlink serve'));
  });

// ─── memlink ls (list) ─────────────────────────────────────────────────────

program
  .command('ls')
  .description('List all memories')
  .action(() => {
    const config = loadConfig();

    if (config.universalMemories.length === 0) {
      const small = logoSmall();
      if (small) console.log('\n' + small + '\n');
      console.log(info('no memories', 'No memories found.'));
      console.log(dimLine('Create one: Memlink init <name>'));
      return;
    }

    const small = logoSmall();
    if (small) console.log('\n' + small + '\n');

    const rows = [
      [colors.white('Name'), colors.white('ID'), colors.white('Size')],
      ...config.universalMemories.map((m) => {
        try {
          const stats = getStats(m.memoryId);
          return memoryTableRow(m.memoryName, m.memoryId, (stats.size / 1024).toFixed(1));
        } catch {
          return memoryTableRow(m.memoryName, m.memoryId, 'error');
        }
      }),
    ];

    console.log(table(rows));
  });

// ─── memlink show <memoryId> (sh) ─────────────────────────────────────────

program
  .command('show <memoryId>')
  .description('Show memory contents as consolidated Markdown')
  .action(async (memoryId: string) => {
    const config = loadConfig();
    const memory = config.universalMemories.find((m) => m.memoryId === memoryId);

    if (!memory) {
      console.error(err(`Memory not found: ${memoryId}`));
      console.log(dimLine('List memories: Memlink ls'));
      process.exit(1);
    }

    try {
      const entries = readMemory(memoryId);

      if (entries.length === 0) {
        const small = logoSmall();
        if (small) console.log('\n' + small + '\n');
        console.log(info('empty', `Memory is empty for ${memory.memoryName}\n`));
        return;
      }

      console.log();
      console.log(renderMemoryAsMarkdown(memoryId));
      console.log();
    } catch (e) {
      console.error(err('Failed to read memory', String(e)));
      process.exit(1);
    }
  });

// ─── memlink skill ──────────────────────────────────────────────────────

program
  .command('skill')
  .description('Install Memlink agent skill for this workspace')
  .option('-g, --global', 'Install globally for all projects')
  .action((opts) => {
    const baseDir = opts.global
      ? path.join(os.homedir(), '.agents', 'skills', 'memlink')
      : path.join(process.cwd(), '.agents', 'skills', 'memlink');

    fs.mkdirSync(baseDir, { recursive: true });
    const skillPath = path.join(baseDir, 'SKILL.md');
    fs.writeFileSync(skillPath, SKILL_MD, 'utf-8');

    const small = logoSmall();
    if (small) console.log('\n' + small + '\n');
    console.log(okBadge(`Skill installed: ${skillPath}`));
    console.log();
  });

// ─── memlink bug (feedback) ────────────────────────────────────────────────

program
  .command('bug')
  .description('Open GitHub to report a bug or send feedback')
  .action(() => {
    const baseUrl = 'https://github.com/rblez/memlink/issues/new';
    const template = encodeURIComponent(
      [
        '**Type:** (Bug Report / Feature Request / Feedback)',
        '',
        '**Description:**',
        '(Write here)',
        '',
        '**Steps to reproduce (if bug):**',
        '1.',
        '2.',
        '',
        '**Expected behavior:**',
        '',
        '**Actual behavior:**',
        '',
      ].join('\n')
    );
    const url = `${baseUrl}?body=${template}`;

    const small = logoSmall();
    if (small) console.log('\n' + small + '\n');

    console.log(dimLine(`Report: ${url}`));
    console.log();

    if (isTTY) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question('  Press Enter to open in your browser… ', () => {
        rl.close();
        const opened = openUrl(url);
        if (opened) {
          console.log(okBadge('Opening GitHub issue form...'));
        } else {
          console.log(err('Could not open browser'));
          console.log(dimLine(`Open manually: ${url}`));
        }
        console.log();
      });
    } else {
      console.log(dimLine(`Copy and open: ${url}`));
      console.log();
    }
  });

// ─── Default: show help only if --help is not already handled ─────────────

program.parse(process.argv);
