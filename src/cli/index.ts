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
  README_MD,
} from './output.ts';
import {
  loadConfig,
  createUniversalMemory,
  readMemory,
  getStats,
  renderEntryAsMarkdown,
  renderMemoryAsMarkdown,
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

// ─── Skill install ──────────────────────────────────────────────────────────

function installSkillGlobal(): string | null {
  const skillDir = path.join(os.homedir(), '.agents', 'skills', 'memlink');

  try {
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), SKILL_MD, 'utf-8');
    fs.writeFileSync(path.join(skillDir, 'README.md'), README_MD, 'utf-8');
    return skillDir;
  } catch {
    return null;
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

// ─── memlink init / create ───────────────────────────────────────────────────

function initAction(name: string | undefined) {
  return async () => {
    console.log(LOGO);
    console.log(navFooter(['↵ confirm', '^c cancel']));

    const memoryName = name || (await askQuestion('Memory name: '));
    if (!memoryName) {
      console.error(err('Memory name is required'));
      process.exit(1);
    }

    const memory = createUniversalMemory(memoryName);
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

    const installed = installSkillGlobal();
    if (installed) {
      console.log(okBadge(`Skill installed: ${installed}`));
    } else {
      console.error(err('Failed to install skill'));
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
  };
}

program
  .command('init [name]')
  .description('Initialize memlink and create a memory')
  .action(initAction(undefined));

program
  .command('create [name]')
  .description('Alias for init — create a new memory')
  .action(initAction(undefined));

// ─── memlink connect ─────────────────────────────────────────────────────

program
  .command('connect <memoryId>')
  .description('Get MCP connection details for a memory')
  .action(async (memoryId: string) => {
    const config = loadConfig();
    const memory = config.universalMemories.find((m) => m.memoryId === memoryId);

    if (!memory) {
      console.error(err(`Memory not found: ${memoryId}`));
      console.log(dimLine('List memories: memlink memory list'));
      process.exit(1);
    }

    const host = config.serverHost ?? DEFAULT_HOST;
    const port = config.serverPort ?? DEFAULT_PORT;
    const url = `http://${host}:${port}/mcp?id=${memory.memoryId}`;

    console.log('\n' + LOGO_SMALL + '\n');
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

    const installed = installSkillGlobal();
    if (installed) {
      console.log(okBadge(`Skill installed: ${installed}`));
      console.log();
    }

    const copied = copyToClipboard(url);
    if (copied) {
      console.log(okBadge('URL copied to clipboard'));
    }
    console.log();
    console.log(dimLine('Start server: memlink serve'));
  });

// ─── memlink status ──────────────────────────────────────────────────────────

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

// ─── memlink memory list ─────────────────────────────────────────────────────

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
      console.log(dimLine('Create one: memlink init <name>'));
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
  });

// ─── memlink memory show ─────────────────────────────────────────────────────

memoryCmd
  .command('show <memoryId>')
  .description('Show memory contents')
  .option('-e, --entries', 'List all entries')
  .option('-t, --title <title>', 'Show a specific entry')
  .action(async (memoryId: string, opts) => {
    const config = loadConfig();
    const memory = config.universalMemories.find((m) => m.memoryId === memoryId);

    if (!memory) {
      console.error(err(`Memory not found: ${memoryId}`));
      console.log(dimLine('List memories: memlink memory list'));
      process.exit(1);
    }

    try {
      const entries = readMemory(memoryId);

      if (entries.length === 0) {
        console.log('\n' + LOGO_SMALL + '\n');
        console.log(info('empty', `Memory is empty for ${memory.memoryName}\n`));
        return;
      }

      if (opts.entries) {
        console.log('\n' + LOGO_SMALL + '\n');
        console.log(info('Memory', memory.memoryName));
        console.log();
        entries.forEach((e, i) => {
          const tags = e.tags?.length ? colors.dim(`[${e.tags.join(', ')}]`) : '';
          console.log(`  ${colors.dim(`${i + 1}.`)} ${colors.white(e.title)} ${tags}`);
        });
        console.log();
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
        return;
      }

      // Default: show full content
      console.log('\n' + LOGO_SMALL + '\n');
      console.log(renderMemoryAsMarkdown(memoryId));
      console.log();
    } catch (e) {
      console.error(err('Failed to read memory', String(e)));
      process.exit(1);
    }
  });

// ─── memlink bug ────────────────────────────────────────────────────────────

program
  .command('bug')
  .alias('feedback')
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

    console.log('\n' + LOGO_SMALL + '\n');

    const opened = openUrl(url);
    if (opened) {
      console.log(okBadge('Opening GitHub issue form...'));
    } else {
      console.log(err('Could not open browser'));
    }
    console.log();
    console.log(dimLine(`If browser didn't open:`));
    console.log(colors.dim(`  ${url}`));
    console.log();
  });

// ─── Default: show help with banner ─────────────────────────────────────────

if (process.argv.length <= 2) {
  process.argv.push('--help');
}

program.parse(process.argv);
