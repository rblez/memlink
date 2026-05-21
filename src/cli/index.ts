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
  renderMemoryAsMarkdown,
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
      execSync(
        `powershell -c "Set-Clipboard -Value (Get-Content '${tmpfile}' -Raw)"`,
        { stdio: 'ignore' }
      );
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
  console.log(heading('Install skill?'));
  console.log();
  console.log(
    `  ${colors.muted('○')}  ${colors.white('1.')} Workspace  ${colors.dim('(./AGENTS.md + ./.agents/skills/)')}`
  );
  console.log(
    `  ${colors.muted('○')}  ${colors.white('2.')} Global     ${colors.dim('(~/.agents/skills/)')}`
  );
  console.log(`  ${colors.muted('○')}  ${colors.white('3.')} Skip`);
  console.log();
  console.log(navHint(['↓↑ navigate', '↵ select']));
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

  if (options.length === 0) return null;
  if (options.length === 1) return options[0].id;

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
  console.log(navHint(['↓↑ navigate', '↵ select']));
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
  .option('-l, --logs', 'Enable request/response logging (Ctrl+L to toggle)')
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
    console.log(navFooter(['^c stop', '^l toggle logs']));

    await startServer(port, host, opts.logs);
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

    console.log(navFooter(['↵ select', '↓↑ navigate', '^c cancel']));
    console.log();

    const selectedId = await showMemorySelector();
    if (!selectedId) {
      console.log(dimLine('Cancelled.\n'));
      return;
    }

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
      console.log(navFooter(['↵ select', '↓↑ navigate', '^c cancel']));
      console.log();
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

      console.log('\n' + LOGO_SMALL + '\n');
      console.log(renderMemoryAsMarkdown(memoryId));
      console.log();
      console.log(navFooter(['^c exit']));
    } catch (e) {
      console.error(err('Failed to read memory', String(e)));
      process.exit(1);
    }
  });

// ─── Default: show help with banner ──────────────────────────────────────────

if (process.argv.length <= 2) {
  process.argv.push('--help');
}

program.parse(process.argv);
