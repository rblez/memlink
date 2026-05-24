#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { execSync, spawn } from 'child_process';
import { Command } from 'commander';
import { table } from 'table';
import { ok as okBadge, err, info, count, dimLine, colors, printLogo, SKILL_MD } from './output.ts';
import {
  loadConfig,
  createUniversalMemory,
  readMemory,
  getStats,
  renderMemoryAsMarkdown,
  revokeUniversalMemory,
  getMemlinkDir,
} from '../core/memory.ts';
import { startServer } from '../server/index.ts';
import { MEMLINK_VERSION, DEFAULT_PORT, DEFAULT_HOST, CONFIG_DIR, CONFIG_FILE } from '../core/types.ts';

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
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start ""' : 'xdg-open';
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

function mcpUrl(host: string, port: number, memId: string): string {
  return `http://${host}:${port}/mcp?id=${memId}`;
}

// ─── Rich version output ──────────────────────────────────────────────────────

function buildVersionString(): string {
  const config = loadConfig();
  const memCount = config.universalMemories.length;
  let totalEntries = 0;
  for (const m of config.universalMemories) {
    try {
      totalEntries += getStats(m.memoryId).entries;
    } catch { /* skip */ }
  }
  const dataDir = getMemlinkDir();
  const configPath = path.join(dataDir, CONFIG_FILE);
  const parts = [
    '',
    `  ${colors.white('Memlink')} ${colors.primary(MEMLINK_VERSION)}`,
    '',
    `  ${colors.dim('Runtime:')}    ${colors.white(process.version)} ${colors.dim('·')} ${colors.white(process.platform)} (${colors.white(process.arch)})`,
    `  ${colors.dim('Data dir:')}   ${colors.white(dataDir)}`,
    `  ${colors.dim('Config:')}     ${colors.white(configPath)}`,
    `  ${colors.dim('Memories:')}   ${colors.white(String(memCount))}`,
    `  ${colors.dim('Entries:')}    ${colors.white(String(totalEntries))}`,
    '',
    `  ${colors.dim('Homepage:')}   ${colors.muted('https://github.com/rblez/memlink')}`,
    `  ${colors.dim('Issues:')}     ${colors.muted('https://github.com/rblez/memlink/issues')}`,
    '',
  ];
  return parts.join('\n');
}

// ─── Help sections ────────────────────────────────────────────────────────────

function helpExamples(): string {
  const lines = [
    '',
    `  ${colors.primary('Examples')}`,
    '',
    `    ${colors.dim('# Create a new memory named "project-alpha"')}`,
    '    memlink init project-alpha',
    '',
    `    ${colors.dim('# Start the MCP server with custom port')}`,
    '    memlink serve --port 4444',
    '',
    `    ${colors.dim('# Create and serve in one command')}`,
    '    memlink init my-memory --serve',
    '',
    `    ${colors.dim('# List all memories')}`,
    '    memlink ls',
    '',
    `    ${colors.dim('# Show memory content')}`,
    '    memlink show <memory-id>',
    '',
    `    ${colors.dim('# Get MCP connection URL for an agent')}`,
    '    memlink connect <memory-id>',
    '',
    `    ${colors.dim('# Delete a memory')}`,
    '    memlink delete <memory-id>',
    '',
    `    ${colors.dim('# Install agent skill in this workspace')}`,
    '    memlink skill',
    '',
    `    ${colors.dim('# Install agent skill globally')}`,
    '    memlink skill --global',
    '',
  ];
  return lines.join('\n');
}

function helpEnvVars(): string {
  const lines = [
    `  ${colors.primary('Environment Variables')}`,
    '',
    `    ${colors.white('MEMLINK_DIR')}`,
    `      ${colors.dim('Override the data directory (default: ~/' + CONFIG_DIR + ')')}`,
    '',
    `    ${colors.white('MEMLINK_HOST')} ${colors.dim('/')} ${colors.white('HOST')}`,
    `      ${colors.dim('Bind address for the MCP server (default: localhost)')}`,
    '',
    `    ${colors.white('MEMLINK_PORT')} ${colors.dim('/')} ${colors.white('PORT')}`,
    `      ${colors.dim('Port for the MCP server (default: ' + DEFAULT_PORT + ')')}`,
    '',
    `    ${colors.white('MEMLINK_NO_COLOR')}`,
    `      ${colors.dim('Disable colored output')}`,
    '',
  ];
  return lines.join('\n');
}

function helpFooter(): string {
  return `\n  ${colors.dim('─'.repeat(64))}\n  ${colors.dim('Documentation:')} ${colors.muted('https://github.com/rblez/memlink')}\n`;
}

// ─── Program ──────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('memlink')
  .description('Memlink — Universal memory for AI agents')
  .version(MEMLINK_VERSION, '-v, --version', 'Display version information')
  .addHelpText('before', logo())
  .addHelpText('after', helpExamples())
  .addHelpText('after', helpEnvVars())
  .addHelpText('after', helpFooter())
  .configureOutput({
    writeOut: (str) => {
      if (str === `${MEMLINK_VERSION}\n`) {
        process.stdout.write(buildVersionString() + '\n');
      } else {
        process.stdout.write(str);
      }
    },
  });

// ─── Default: system overview ──────────────────────────────────────────────

program.action(() => {
  console.log(logo());

  const config = loadConfig();
  const host = envHost() || config.serverHost || DEFAULT_HOST;
  const port = envPort() || config.serverPort || DEFAULT_PORT;
  const base = `http://${host}:${port}`;

  console.log(info('Server', base));

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
  console.log(dimLine('See memlink --help for more'));
  console.log();
});

function kv(key: string, value: string): string {
  return `  ${colors.dim(key)}${value ? `  ${colors.white(value)}` : ''}`;
}

// ─── Daemon helpers ────────────────────────────────────────────────────────────

function daemonPidPath(): string {
  return path.join(getMemlinkDir(), 'serve.pid');
}

function writePid(pid: number): void {
  fs.writeFileSync(daemonPidPath(), String(pid), 'utf-8');
}

function readPid(): number | null {
  try {
    const data = fs.readFileSync(daemonPidPath(), 'utf-8').trim();
    const pid = parseInt(data, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ─── memlink serve ────────────────────────────────────────────────────────

const serveCmd = program.command('serve');

serveCmd
  .description('Start the Memlink MCP server')
  .option('--port <port>', 'Port to listen on', String(DEFAULT_PORT))
  .option('--host <host>', 'Host to bind to', DEFAULT_HOST)
  .option('--cors <origins>', 'CORS allowed origins (comma-separated or *)')
  .option('--read-only', 'Disable write operations')
  .option('--log-level <level>', 'Log level: none, basic, verbose')
  .option('--daemon', 'Run server in background as a daemon')
  .action(async (opts) => {
    const config = loadConfig();
    const port = parseInt(opts.port);
    const host = opts.host;

    // Internal: child of daemon spawn — write PID and start server
    if (process.env.MEMLINK_DAEMON_CHILD) {
      writePid(process.pid);
      await startServer(port, host, {
        cors: opts.cors,
        readOnly: opts.readOnly,
        logLevel: opts.logLevel,
      });
      return;
    }

    // Daemon mode: spawn detached child process
    if (opts.daemon) {
      const existingPid = readPid();
      if (existingPid && isProcessRunning(existingPid)) {
        console.log(err(`Server already running (PID ${existingPid})`));
        console.log(dimLine('Stop: memlink stop'));
        process.exit(1);
      }

      const childArgs = ['serve', '--port', String(port), '--host', host];
      if (opts.cors) childArgs.push('--cors', opts.cors);
      if (opts.readOnly) childArgs.push('--read-only');
      if (opts.logLevel) childArgs.push('--log-level', opts.logLevel);

      // Use the same binary (node/bun) with the same script
      const child = spawn(process.execPath, [process.argv[1], ...childArgs], {
        stdio: 'ignore',
        detached: true,
        env: { ...process.env, MEMLINK_DAEMON_CHILD: '1' },
      });

      child.unref();

      // Wait briefly to check if child started
      await new Promise<void>((resolve) => setTimeout(resolve, 500));

      if (child.exitCode !== null && child.exitCode !== 0) {
        console.log(err('Failed to start server'));
        process.exit(1);
      }

      writePid(child.pid);
      const small = logoSmall();
      if (small) console.log('\n' + small + '\n');
      console.log(okBadge(`Server started (PID ${child.pid})`));
      console.log(info('URL', `http://${host}:${port}/mcp`));
      console.log();
      console.log(dimLine('Stop: memlink stop'));
      console.log(dimLine('Status: memlink status'));
      console.log();
      return;
    }

    // Foreground mode: start server directly
    await startServer(port, host, {
      cors: opts.cors,
      readOnly: opts.readOnly,
      logLevel: opts.logLevel,
    });
  });

// ─── memlink stop ─────────────────────────────────────────────────────────

program
  .command('stop')
  .description('Stop the Memlink daemon server')
  .action(async () => {
    const pid = readPid();
    if (!pid) {
      console.log(logoSmall());
      console.log();
      console.log(info('not running', 'No server PID file found.'));
      console.log();
      return;
    }

    if (!isProcessRunning(pid)) {
      console.log(logoSmall());
      console.log();
      console.log(info('not running', `Server PID ${pid} is not active.`));
      try { fs.unlinkSync(daemonPidPath()); } catch { /* ignore */ }
      console.log();
      return;
    }

    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      try { process.kill(pid, 'SIGINT'); } catch { /* ignore */ }
    }

    // Wait for process to exit (poll up to 3s)
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      if (!isProcessRunning(pid)) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    try { fs.unlinkSync(daemonPidPath()); } catch { /* ignore */ }

    console.log(logoSmall());
    console.log();
    console.log(okBadge(`Server stopped (PID ${pid})`));
    console.log();
  });

// ─── memlink status ───────────────────────────────────────────────────────

program
  .command('status')
  .description('Check if the Memlink daemon server is running')
  .action(() => {
    const pid = readPid();
    const small = logoSmall();
    if (small) console.log('\n' + small + '\n');

    if (pid && isProcessRunning(pid)) {
      console.log(okBadge(`Server is running (PID ${pid})`));
      const config = loadConfig();
      const host = envHost() || config.serverHost || DEFAULT_HOST;
      const port = envPort() || config.serverPort || DEFAULT_PORT;
      console.log(info('URL', `http://${host}:${port}/mcp`));
      console.log(count('memories', config.universalMemories.length));
    } else {
      console.log(info('not running', 'No server running.'));
      console.log(dimLine('Start: memlink serve'));
    }
    console.log();
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
  const mcp = mcpUrl(host, port, memory.memoryId);

  console.log(info('Name', memory.memoryName));
  console.log(info('ID', memory.memoryId));
  console.log(info('MCP', mcp));
  console.log();

  const copied = copyToClipboard(mcp);
  if (copied) {
    console.log(okBadge('URL copied to clipboard'));
  }

  console.log();
  console.log(dimLine('Connect: memlink connect ' + memory.memoryId));
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
      console.log(dimLine('List memories: memlink ls'));
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
      console.log(dimLine('List memories: memlink ls'));
    }

    const host = envHost() || config.serverHost || DEFAULT_HOST;
    const port = envPort() || config.serverPort || DEFAULT_PORT;
    const mcp = mcpUrl(host, port, memory.memoryId);

    const small = logoSmall();
    if (small) console.log('\n' + small + '\n');
    console.log(info('Name', memory.memoryName));
    console.log(info('ID', memory.memoryId));
    console.log(info('MCP', mcp));
    console.log();

    const copied = copyToClipboard(mcp);
    if (copied) {
      console.log(okBadge('URL copied to clipboard'));
    }
    console.log();
    console.log(dimLine('Start server: memlink serve'));
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
      console.log(dimLine('Create one: memlink init <name>'));
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
      console.log(dimLine('List memories: memlink ls'));
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

function ensureSkillTag(agentsDir: string, tag: string) {
  const agentsPath = path.join(agentsDir, 'AGENTS.md');
  if (fs.existsSync(agentsPath)) {
    const content = fs.readFileSync(agentsPath, 'utf-8');
    if (content.includes(tag)) return; // already tagged
    fs.writeFileSync(agentsPath, content.trimEnd() + '\n\n' + tag + '\n', 'utf-8');
  } else {
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(agentsPath, tag + '\n', 'utf-8');
  }
}

program
  .command('skill')
  .description('Install Memlink agent skill for this workspace')
  .option('-g, --global', 'Install globally for all projects')
  .action((opts) => {
    if (opts.global) {
      const skillDir = path.join(os.homedir(), '.agents', 'skills', 'memlink');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), SKILL_MD, 'utf-8');
      ensureSkillTag(path.join(os.homedir(), '.agents'), '@skills/memlink');
      const small = logoSmall();
      if (small) console.log('\n' + small + '\n');
      console.log(okBadge(`Skill installed globally: ~/.agents/skills/memlink/SKILL.md`));
      console.log();
    } else {
      const skillDir = path.join(process.cwd(), '.agents', 'skills', 'memlink');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), SKILL_MD, 'utf-8');
      ensureSkillTag(process.cwd(), '@.agents/skills/memlink');
      const small = logoSmall();
      if (small) console.log('\n' + small + '\n');
      console.log(okBadge(`Skill installed: .agents/skills/memlink/SKILL.md`));
      console.log(dimLine('Tagged in AGENTS.md'));
      console.log();
    }
  });

// ─── memlink bug (feedback) ────────────────────────────────────────────────

program
  .command('bug')
  .description('Open GitHub to report a bug, request a feature, or send feedback')
  .action(() => {
    const url = 'https://github.com/rblez/memlink/issues/new/choose';

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
