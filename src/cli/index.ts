#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { execSync, spawn } from 'child_process';
import { Command } from 'commander';
import { table } from 'table';
import {
  ok as okBadge,
  err,
  info,
  count,
  dimLine,
  colors,
  printLogo,
  SKILL_MD,
  kv,
} from './output.ts';
import {
  loadConfig,
  createUniversalMemory,
  readMemory,
  getStats,
  renderMemoryAsMarkdown,
  exportMemoryFormats,
  importFromFile,
  getFormatsDir,
  saveConfig,
  revokeUniversalMemory,
  getMemlinkDir,
} from '../core/memory.ts';
import { startServer, startStdioServer } from '../server/index.ts';
import {
  MEMLINK_VERSION,
  DEFAULT_PORT,
  DEFAULT_HOST,
  CONFIG_DIR,
  CONFIG_FILE,
  type UniversalMemory,
} from '../core/types.ts';

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
  return `\n${printLogo()}\n`;
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

function findMemory(
  idOrName: string
): { memory: UniversalMemory; matchedBy: 'id' | 'name' } | null {
  const config = loadConfig();
  const byId = config.universalMemories.find((m) => m.memoryId === idOrName);
  if (byId) return { memory: byId, matchedBy: 'id' };
  const lower = idOrName.toLowerCase();
  const byName = config.universalMemories.find((m) => m.memoryName.toLowerCase() === lower);
  if (byName) return { memory: byName, matchedBy: 'name' };
  return null;
}

// ─── Rich version output ──────────────────────────────────────────────────────

function buildVersionString(): string {
  const config = loadConfig();
  const memCount = config.universalMemories.length;
  let totalEntries = 0;
  for (const m of config.universalMemories) {
    try {
      totalEntries += getStats(m.memoryId).entries;
    } catch {
      /* skip */
    }
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
    `  ${colors.primary('Commands')}`,
    '',
    `    ${colors.white('serve')}         Start the MCP server (HTTP, SSE, Stdio)`,
    `                   ${colors.dim('memlink serve')}`,
    `                   ${colors.dim('memlink serve --port 4444 --cors *')}`,
    `                   ${colors.dim('memlink serve --daemon')}`,
    `                   ${colors.dim('memlink serve --watch')}`,
    `                   ${colors.dim('memlink serve --transport stdio --memory my-mem')}`,
    '',
    `    ${colors.white('init')}          Create a new memory (alias: create)`,
    `                   ${colors.dim('memlink init project-alpha')}`,
    `                   ${colors.dim('memlink init my-memory --serve')}`,
    '',
    `    ${colors.white('ls')}            List all memories`,
    `                   ${colors.dim('memlink ls')}`,
    '',
    `    ${colors.white('show')}          Show memory content as Markdown`,
    `                   ${colors.dim('memlink show my-memory')}`,
    `                   ${colors.dim('memlink show <memory-id>')}`,
    '',
    `    ${colors.white('info')}          Memory details (name, ID, URL, stats)`,
    `                   ${colors.dim('memlink info my-memory')}`,
    '',
    `    ${colors.white('export')}        Export memory to configured formats (md/txt/html/json)`,
    `                   ${colors.dim('memlink export my-memory')}`,
    '',
    `    ${colors.white('import')}        Import entries from a JSON file`,
    `                   ${colors.dim('memlink import my-memory ./backup.json')}`,
    `                   ${colors.dim('memlink import my-memory ./backup.json --overwrite')}`,
    '',
    `    ${colors.white('connect')}       Show MCP config JSON + agent setup instructions`,
    `                   ${colors.dim('memlink connect my-memory')}`,
    `                   ${colors.dim('memlink connect my-memory --all')}`,
    '',
    `    ${colors.white('delete')}        Delete a memory permanently`,
    `                   ${colors.dim('memlink delete my-memory')}`,
    `                   ${colors.dim('memlink delete <memory-id>')}`,
    '',
    `    ${colors.white('config')}        View or modify configuration`,
    `                   ${colors.dim('memlink config')}`,
    `                   ${colors.dim('memlink config get exportFormats')}`,
    `                   ${colors.dim('memlink config set exportFormats \'["md","html"]\'')}`,
    '',
    `    ${colors.white('stop')}          Stop the daemon server`,
    `                   ${colors.dim('memlink stop')}`,
    '',
    `    ${colors.white('status')}        Check if daemon server is running`,
    `                   ${colors.dim('memlink status')}`,
    '',
    `    ${colors.white('skill')}         Install Memlink agent skill`,
    `                   ${colors.dim('memlink skill')}         (workspace)`,
    `                   ${colors.dim('memlink skill --global')}  (global)`,
    '',
    `    ${colors.white('bug')}           Report a bug or request a feature`,
    `                   ${colors.dim('memlink bug')}`,
    '',
    `    ${colors.white('changelog')}     Open the changelog in your browser`,
    `                   ${colors.dim('memlink changelog')}`,
    '',
    `    ${colors.dim('Use -v, --version to show system overview')}`,
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
  .description('Universal memory for AI agents — self-hosted MCP server')
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

  console.log(kv('Essentials', 'serve · init · ls · show · connect · delete'));
  console.log(kv('More', 'info · export · config · stop · status · skill · bug · changelog'));
  console.log();
  console.log(dimLine('Use memlink --help for full docs'));
  console.log();
});

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
  .option(
    '--transport <transports>',
    'Transport(s): auto, http, sse, stdio (comma-separated for multiple)',
    'auto'
  )
  .option('--memory <name-or-id>', 'Memory to serve (required for stdio)')
  .option('--port <port>', 'Port to listen on', String(DEFAULT_PORT))
  .option('--host <host>', 'Host to bind to', DEFAULT_HOST)
  .option('--cors <origins>', 'CORS allowed origins (comma-separated or *)')
  .option('--read-only', 'Disable write operations')
  .option('--log-level <level>', 'Log level: none, basic, verbose')
  .option('--bearer-token <token>', 'Require Authorization: Bearer <token> for MCP endpoints')
  .option('--daemon', 'Run server in background as a daemon')
  .option('--watch', 'Watch memory files and auto-export on change')
  .action(async (opts) => {
    const port = parseInt(opts.port);
    const host = opts.host;
    const transports = (opts.transport as string)
      .split(',')
      .map((t: string) => t.trim().toLowerCase());

    // Stdio mode: communicate over stdin/stdout (no HTTP server)
    if (transports.includes('stdio')) {
      if (!opts.memory) {
        console.log(err('--memory <name-or-id> is required for stdio transport'));
        console.log(dimLine('Example: memlink serve --transport stdio --memory my-memory'));
        process.exit(1);
      }
      const found = findMemory(opts.memory);
      if (!found) {
        console.error(err(`Memory not found: ${opts.memory}`));
        process.exit(1);
      }
      await startStdioServer(found.memory.memoryId);
      return;
    }

    // Internal: child of daemon spawn — write PID and start server
    if (process.env.MEMLINK_DAEMON_CHILD) {
      writePid(process.pid);
      await startServer(port, host, {
        cors: opts.cors,
        readOnly: opts.readOnly,
        logLevel: opts.logLevel,
        bearerToken: opts.bearerToken,
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
      if (opts.bearerToken) childArgs.push('--bearer-token', opts.bearerToken);
      if (opts.transport) childArgs.push('--transport', opts.transport);
      if (opts.memory) childArgs.push('--memory', opts.memory);
      if (opts.watch) childArgs.push('--watch');

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

      if (child.pid) writePid(child.pid);
      const small = logoSmall();
      if (small) console.log('\n' + small + '\n');
      console.log(okBadge(`Server started (PID ${child.pid})`));
      const url = transports.includes('stdio') ? 'stdio' : `http://${host}:${port}/mcp`;
      console.log(info('Transport', transports.join(', ')));
      console.log(info('URL', url));
      console.log();
      console.log(dimLine('Stop: memlink stop'));
      console.log(dimLine('Status: memlink status'));
      console.log();
      return;
    }

    // Foreground mode: start server directly (HTTP transports)
    const httpTransports = transports.filter((t: string) => t !== 'stdio');
    if (httpTransports.length === 0 && transports.includes('stdio')) {
      // Already handled above; this path won't be reached
      return;
    }

    await startServer(port, host, {
      cors: opts.cors,
      readOnly: opts.readOnly,
      logLevel: opts.logLevel,
      watch: opts.watch,
      bearerToken: opts.bearerToken,
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
      try {
        fs.unlinkSync(daemonPidPath());
      } catch {
        /* ignore */
      }
      console.log();
      return;
    }

    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGINT');
      } catch {
        /* ignore */
      }
    }

    // Wait for process to exit (poll up to 3s)
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      if (!isProcessRunning(pid)) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    try {
      fs.unlinkSync(daemonPidPath());
    } catch {
      /* ignore */
    }

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
  let memory: UniversalMemory;
  try {
    memory = createUniversalMemory(name);
  } catch (e) {
    console.error(err(String(e)));
    process.exit(1);
  }
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
  console.log(
    dimLine(
      'Connect: memlink connect ' +
        memory.memoryName +
        '  ·  Info: memlink info ' +
        memory.memoryName
    )
  );
  console.log();

  if (opts.serve) {
    const servePort = opts.port ? parseInt(opts.port) : port;
    console.log(navFooter(['^c stop']));
    startServer(servePort, host);
  }
}

program
  .command('init <name>')
  .alias('create')
  .description('Create a new memory')
  .option('--serve', 'Auto-start the MCP server after creation')
  .option('--port <port>', 'Port for auto-start server')
  .action((name: string, opts) => {
    initAction(name, opts);
  });

// ─── memlink delete <memoryId> ──────────────────────────────────────────

program
  .command('delete <name-or-id>')
  .description('Delete a memory permanently (by name or ID)')
  .action((idOrName: string) => {
    const found = findMemory(idOrName);
    if (!found) {
      console.error(err(`Memory not found: ${idOrName}`));
      console.log(dimLine('List memories: memlink ls'));
      process.exit(1);
    }
    const { memory, matchedBy } = found;
    const memoryId = memory.memoryId;

    const ok = revokeUniversalMemory(memoryId);
    if (ok) {
      const small = logoSmall();
      if (small) console.log('\n' + small + '\n');
      const by = matchedBy === 'name' ? ` (${memoryId})` : '';
      console.log(okBadge(`Memory deleted: ${memory.memoryName}${by}`));
      console.log();
    } else {
      console.error(err(`Failed to delete memory: ${memoryId}`));
      process.exit(1);
    }
  });

// ─── memlink info <name-or-id> ────────────────────────────────────────────

program
  .command('info <name-or-id>')
  .description('Show memory details (name, ID, URL, stats)')
  .action(async (idOrName: string) => {
    const found = findMemory(idOrName);
    if (!found) {
      console.error(err(`Memory not found: ${idOrName}`));
      console.log(dimLine('List memories: memlink ls'));
      return;
    }
    const { memory } = found;
    const config = loadConfig();
    const host = envHost() || config.serverHost || DEFAULT_HOST;
    const port = envPort() || config.serverPort || DEFAULT_PORT;
    const mcp = mcpUrl(host, port, memory.memoryId);

    let stats;
    try {
      stats = getStats(memory.memoryId);
    } catch {
      /* ok */
    }

    const small = logoSmall();
    if (small) console.log('\n' + small + '\n');
    console.log(info('Name', memory.memoryName));
    console.log(info('ID', memory.memoryId));
    console.log(info('MCP', mcp));
    if (stats) {
      console.log(info('Entries', String(stats.entries)));
      console.log(info('Size', `${(stats.size / 1024).toFixed(1)} KB`));
      if (stats.tags.length > 0) console.log(info('Tags', stats.tags.join(', ')));
      console.log(info('Created', stats.createdAt));
      if (stats.lastSeen) console.log(info('Last seen', stats.lastSeen));
    }
    console.log();

    const copied = copyToClipboard(mcp);
    if (copied) {
      console.log(okBadge('URL copied to clipboard'));
    }
    console.log();
  });

// ─── memlink connect <name-or-id> ────────────────────────────────────────

// ─── Agent definitions ─────────────────────────────────────────────────────

interface AgentDef {
  id: string;
  name: string;
  platform: string;
  file: string;
  note: string;
  config: 'streamableHttp' | 'sse' | 'stdio' | null;
  detect(): boolean;
}

const AGENT_DEFS: AgentDef[] = [
  {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    platform: 'Windows / macOS',
    file: 'claude_desktop_config.json',
    note: 'Add the JSON inside the "mcpServers" object',
    config: 'streamableHttp',
    detect() {
      if (process.platform === 'win32') {
        return fs.existsSync(
          path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json')
        );
      }
      if (process.platform === 'darwin') {
        return fs.existsSync(
          path.join(
            os.homedir(),
            'Library',
            'Application Support',
            'Claude',
            'claude_desktop_config.json'
          )
        );
      }
      return false;
    },
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    platform: 'CLI (cross-platform)',
    file: '~/.claude/settings.json',
    note: 'Add inside existing JSON, under "mcpServers"',
    config: 'stdio',
    detect() {
      return fs.existsSync(path.join(os.homedir(), '.claude', 'settings.json'));
    },
  },
  {
    id: 'cursor',
    name: 'Cursor',
    platform: 'Cross-platform',
    file: '.cursor/mcp.json (project)',
    note: 'Create in the project root directory',
    config: 'streamableHttp',
    detect() {
      return fs.existsSync(path.join(process.cwd(), '.cursor', 'mcp.json'));
    },
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    platform: 'Cross-platform',
    file: '.windsurf/mcp.json (project)',
    note: 'Create in the project root directory',
    config: 'streamableHttp',
    detect() {
      return fs.existsSync(path.join(process.cwd(), '.windsurf', 'mcp.json'));
    },
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    platform: 'Cross-platform',
    file: '.opencode.json (project) o ~/.config/opencode/opencode.json',
    note: 'Add inside "mcpServers" in the JSON config',
    config: 'stdio',
    detect() {
      return (
        fs.existsSync(path.join(process.cwd(), '.opencode.json')) ||
        fs.existsSync(path.join(process.cwd(), '.opencode.jsonc')) ||
        fs.existsSync(path.join(os.homedir(), '.config', 'opencode', 'opencode.json'))
      );
    },
  },
  {
    id: 'cline',
    name: 'Cline (VS Code)',
    platform: 'Cross-platform',
    file: '~/.vscode/globalStorage/.../cline_mcp_settings.json',
    note: 'Or configure from the Cline UI in VS Code',
    config: 'streamableHttp',
    detect() {
      try {
        const vscodePath =
          process.platform === 'win32'
            ? path.join(process.env.APPDATA || '', 'Code')
            : process.platform === 'darwin'
              ? path.join(os.homedir(), 'Library', 'Application Support', 'Code')
              : path.join(os.homedir(), '.vscode');
        const storage = path.join(vscodePath, 'User', 'globalStorage');
        if (!fs.existsSync(storage)) return false;
        return fs.readdirSync(storage).some((d) => d.startsWith('saoudrizwan.claude'));
      } catch {
        return false;
      }
    },
  },
  {
    id: 'continue',
    name: 'Continue.dev',
    platform: 'Cross-platform',
    file: '~/.continue/config.json',
    note: 'Add inside "experimental.mcpServers"',
    config: 'sse',
    detect() {
      return fs.existsSync(path.join(os.homedir(), '.continue', 'config.json'));
    },
  },
  {
    id: 'aider',
    name: 'Aider',
    platform: 'CLI (cross-platform)',
    file: '~/.aider.conf.yml',
    note: 'Run: aider --mcp-servers "memlink=URL"  or  use stdio config in .aider.conf.yml',
    config: 'stdio',
    detect() {
      return (
        fs.existsSync(path.join(os.homedir(), '.aider.conf.yml')) ||
        fs.existsSync(path.join(os.homedir(), '.aider.conf.json'))
      );
    },
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    platform: 'VS Code / JetBrains / CLI',
    file: '~/.config/github-copilot/mcp.json',
    note: 'Configure from VS Code: Settings > GitHub Copilot > MCP',
    config: 'streamableHttp',
    detect() {
      const p = path.join(os.homedir(), '.config', 'github-copilot');
      return fs.existsSync(p) && fs.readdirSync(p).some((f) => f.includes('mcp'));
    },
  },
  {
    id: 'cody',
    name: 'Cody (Sourcegraph)',
    platform: 'VS Code / JetBrains',
    file: '.vscode/mcp.json (project)',
    note: 'Experimental MCP support',
    config: 'streamableHttp',
    detect() {
      return fs.existsSync(path.join(process.cwd(), '.vscode', 'mcp.json'));
    },
  },
  {
    id: 'amazon-q',
    name: 'Amazon Q Developer',
    platform: 'VS Code / JetBrains / CLI',
    file: '~/.aws/q/mcp.json',
    note: 'Configure from AWS Toolkit settings',
    config: 'streamableHttp',
    detect() {
      return fs.existsSync(path.join(os.homedir(), '.aws', 'q', 'mcp.json'));
    },
  },
  {
    id: 'tabby',
    name: 'Tabby',
    platform: 'Self-hosted / CLI',
    file: '~/.tabby/mcp.json',
    note: 'Self-hosted MCP server',
    config: 'sse',
    detect() {
      return fs.existsSync(path.join(os.homedir(), '.tabby'));
    },
  },
  {
    id: 'pearai',
    name: 'PearAI',
    platform: 'VS Code fork',
    file: '.pearai/mcp.json (project)',
    note: 'Compatible with Cursor/Windsurf configs',
    config: 'streamableHttp',
    detect() {
      return fs.existsSync(path.join(process.cwd(), '.pearai'));
    },
  },
  {
    id: 'codegpt',
    name: 'CodeGPT',
    platform: 'VS Code',
    file: '.codegpt/mcp.json (project)',
    note: 'Configure from extension settings or JSON file',
    config: 'streamableHttp',
    detect() {
      return fs.existsSync(path.join(process.cwd(), '.codegpt'));
    },
  },
  {
    id: 'mcp-inspector',
    name: 'MCP Inspector',
    platform: 'CLI / Browser',
    file: 'npx',
    note: 'npx @modelcontextprotocol/inspector URL',
    config: null,
    detect() {
      return true; // always available if Node is installed
    },
  },
];

function detectAgents(): AgentDef[] {
  return AGENT_DEFS.filter((a) => a.detect());
}

function agentConfigs(mcpUrl: string, showAll: boolean, memoryName: string): string {
  const configJSON = (type: 'streamableHttp' | 'sse' | 'stdio'): string => {
    if (type === 'streamableHttp') {
      return JSON.stringify({ mcpServers: { memlink: { type: 'http', url: mcpUrl } } }, null, 2);
    }
    if (type === 'sse') {
      return JSON.stringify(
        {
          mcpServers: {
            memlink: {
              type: 'remote',
              url: mcpUrl.replace('/mcp?', '/sse?'),
              enabled: true,
            },
          },
        },
        null,
        2
      );
    }
    return JSON.stringify(
      {
        mcpServers: {
          memlink: {
            type: 'stdio',
            command: 'memlink',
            args: ['serve', '--transport', 'stdio', '--memory', memoryName],
          },
        },
      },
      null,
      2
    );
  };

  const cfgHttp = configJSON('streamableHttp');
  const cfgSse = configJSON('sse');
  const cfgStdio = configJSON('stdio');

  const agents = showAll ? AGENT_DEFS : detectAgents();

  const lines: string[] = [];
  lines.push('');
  lines.push(`  ${colors.primary('MCP Configuration')}`);
  lines.push('');
  lines.push(`  ${colors.dim('Streamable HTTP (modern — preferred):')}`);
  lines.push('');
  cfgHttp.split('\n').forEach((l) => lines.push(`    ${l}`));
  lines.push('');
  lines.push(`  ${colors.dim('SSE (legacy):')}`);
  lines.push('');
  cfgSse.split('\n').forEach((l) => lines.push(`    ${l}`));
  lines.push('');
  lines.push(`  ${colors.dim('Stdio (subprocess — for CLI agents):')}`);
  lines.push('');
  cfgStdio.split('\n').forEach((l) => lines.push(`    ${l}`));
  lines.push('');
  lines.push(`  ${colors.dim('─'.repeat(56))}`);
  lines.push(`  ${colors.primary('Agent Setup')}`);
  lines.push(`  ${colors.dim(`${agents.length} of ${AGENT_DEFS.length} agents detected`)}`);
  if (!showAll && agents.length < AGENT_DEFS.length) {
    lines.push(`  ${colors.dim('Use --all to show all available agents')}`);
  }
  lines.push('');

  for (const agent of agents) {
    const cfg =
      agent.config === 'streamableHttp'
        ? cfgHttp
        : agent.config === 'sse'
          ? cfgSse
          : agent.config === 'stdio'
            ? cfgStdio
            : null;
    lines.push(`  ${colors.white(agent.name)}`);
    lines.push(`    ${colors.dim('Platform:')}  ${colors.white(agent.platform)}`);
    lines.push(`    ${colors.dim('Config:')}    ${colors.white(agent.file)}`);
    if (agent.note) lines.push(`    ${colors.dim('Note:')}      ${colors.dim(agent.note)}`);
    if (cfg) {
      lines.push(`    ${colors.dim('JSON:')}`);
      cfg.split('\n').forEach((l) => lines.push(`      ${l}`));
    }
    lines.push('');
  }

  lines.push(`  ${colors.dim('─'.repeat(56))}`);
  return lines.join('\n');
}

program
  .command('connect <name-or-id>')
  .description('Show MCP config JSON and agent setup (auto-detects installed agents)')
  .option('--all', 'Show all known agents, not just detected ones')
  .action(async (idOrName: string, opts: { all?: boolean }) => {
    const found = findMemory(idOrName);
    if (!found) {
      console.error(err(`Memory not found: ${idOrName}`));
      console.log(dimLine('List memories: memlink ls'));
      return;
    }
    const { memory } = found;
    const config = loadConfig();
    const host = envHost() || config.serverHost || DEFAULT_HOST;
    const port = envPort() || config.serverPort || DEFAULT_PORT;
    const mcp = mcpUrl(host, port, memory.memoryId);

    const small = logoSmall();
    if (small) console.log('\n' + small + '\n');
    console.log(info('Memory', `${memory.memoryName} (${memory.memoryId})`));
    console.log(info('Server', `http://${host}:${port}`));
    console.log();

    console.log(agentConfigs(mcp, opts.all ?? false, memory.memoryName));

    const copied = copyToClipboard(
      JSON.stringify(
        {
          mcpServers: {
            memlink: {
              type: 'http',
              url: mcp,
            },
          },
        },
        null,
        2
      )
    );
    if (copied) {
      console.log();
      console.log(okBadge('MCP config JSON copied to clipboard'));
    }
    console.log();
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
  .command('show <name-or-id>')
  .description('Show memory contents as consolidated Markdown')
  .action(async (idOrName: string) => {
    const found = findMemory(idOrName);
    if (!found) {
      console.error(err(`Memory not found: ${idOrName}`));
      console.log(dimLine('List memories: memlink ls'));
      process.exit(1);
    }
    const memory = found.memory;
    const memoryId = memory.memoryId;

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
      const exported = exportMemoryFormats(memoryId);
      const shortFiles = exported.map((f) => path.relative(getMemlinkDir(), f));
      console.log(okBadge(`Exported: ${shortFiles.join(', ')}`));
      console.log();
    } catch (e) {
      console.error(err('Failed to read memory', String(e)));
      process.exit(1);
    }
  });

// ─── memlink export <name-or-id> ───────────────────────────────────────────

program
  .command('export <name-or-id>')
  .description('Export memory to configured formats (md, txt, html, json)')
  .action((idOrName: string) => {
    const found = findMemory(idOrName);
    if (!found) {
      console.error(err(`Memory not found: ${idOrName}`));
      console.log(dimLine('List memories: memlink ls'));
      process.exit(1);
    }
    const memory = found.memory;
    const exported = exportMemoryFormats(memory.memoryId);
    const shortFiles = exported.map((f) => path.relative(getMemlinkDir(), f));
    const small = logoSmall();
    if (small) console.log('\n' + small + '\n');
    console.log(okBadge(`Exported: ${shortFiles.join(', ')}`));
    console.log(dimLine(`Formats dir: ${getFormatsDir()}`));
    console.log();
  });

// ─── memlink import <name-or-id> <file> ─────────────────────────────────────

program
  .command('import <name-or-id>')
  .argument('<file>', 'JSON file to import')
  .description('Import entries from a JSON file')
  .option('--overwrite', 'Overwrite existing entries with same title')
  .action((idOrName: string, file: string, opts: { overwrite?: boolean }) => {
    const found = findMemory(idOrName);
    if (!found) {
      console.error(err(`Memory not found: ${idOrName}`));
      console.log(dimLine('List memories: memlink ls'));
      process.exit(1);
    }
    const memory = found.memory;
    try {
      const result = importFromFile(memory.memoryId, file, { overwrite: opts.overwrite });
      const small = logoSmall();
      if (small) console.log('\n' + small + '\n');
      console.log(okBadge(`Imported ${result.imported} entries (${result.skipped} skipped)`));
      console.log();
    } catch (e) {
      console.error(err(String(e)));
      process.exit(1);
    }
  });

// ─── memlink config ────────────────────────────────────────────────────────

const configCmd = program.command('config').description('View or modify configuration');

configCmd
  .command('get [key]', { isDefault: true })
  .description('Get config value (or all if no key)')
  .action((key?: string) => {
    const config = loadConfig();
    const small = logoSmall();
    if (small) console.log('\n' + small + '\n');
    if (key) {
      const val = (config as unknown as Record<string, unknown>)[key];
      if (val === undefined) {
        console.error(err(`Config key not found: ${key}`));
        process.exit(1);
      }
      console.log(info(key, JSON.stringify(val, null, 2)));
    } else {
      console.log(JSON.stringify(config, null, 2));
    }
    console.log();
  });

configCmd
  .command('set <key> <value>')
  .description('Set a config value (JSON-encoded)')
  .action((key: string, value: string) => {
    const config = loadConfig();
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value;
    }
    (config as unknown as Record<string, unknown>)[key] = parsed;
    saveConfig(config);
    const small = logoSmall();
    if (small) console.log('\n' + small + '\n');
    console.log(okBadge(`Config updated: ${key} = ${JSON.stringify(parsed)}`));
    console.log();
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

// ─── memlink changelog ───────────────────────────────────────────────────────

program
  .command('changelog')
  .description('Open the changelog in your browser')
  .action(() => {
    const config = loadConfig();
    const host = envHost() || config.serverHost || DEFAULT_HOST;
    const port = envPort() || config.serverPort || DEFAULT_PORT;
    const url = `http://${host}:${port}/changelogs`;

    const small = logoSmall();
    if (small) console.log('\n' + small + '\n');

    console.log(dimLine(`Changelog: ${url}`));
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
          console.log(okBadge('Opening changelog...'));
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
