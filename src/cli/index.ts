#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync, spawn } from 'child_process';
import { Command } from 'commander';
import { ok as okBadge, err, info, dimLine, colors, printLogo, SKILL_MD, kv } from './output.ts';
import {
  loadConfig,
  getStats,
  exportMemoryFormats,
  importFromFile,
  getExportsDir,
  saveConfig,
} from '../core/memory.ts';
import { startServer, startStdioServer } from '../server/index.ts';
import { MEMLINK_VERSION, DEFAULT_PORT, DEFAULT_HOST, getMemlinkDir } from '../core/types.ts';
import { addCommand } from './commands/add.ts';
import { entriesCommand } from './commands/entries.ts';
import { searchCommand } from './commands/search.ts';
import { urlCommand } from './commands/url.ts';
import { tokenGenerateCommand, tokenListCommand, tokenRevokeCommand } from './commands/token.ts';
import { pauseCommand, resumeCommand, stopMemoryCommand } from './commands/pause.ts';
import { connectCommand, disconnectCommand } from './commands/cloud.ts';
import { isDaemonAlive } from '../core/health.ts';
import { ensureDefaultMemory, readMeta, createMemoryMeta } from '../core/meta.ts';
import { registerMemoryRoute } from '../core/routing.ts';
import { ensureLocalToken } from '../core/auth.ts';
import * as admin from './admin.ts';

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

// ─── Rich version output ──────────────────────────────────────────────────────

function buildVersionString(): string {
  const dataDir = getMemlinkDir();
  const configPath = path.join(dataDir, 'settings.json');
  const parts = [
    '',
    `  ${colors.white('Memlink')} ${colors.primary(MEMLINK_VERSION)}`,
    '',
    `  ${colors.dim('Runtime:')}    ${colors.white(process.version)} ${colors.dim('·')} ${colors.white(process.platform)} (${colors.white(process.arch)})`,
    `  ${colors.dim('Data dir:')}   ${colors.white(dataDir)}`,
    `  ${colors.dim('Config:')}     ${colors.white(configPath)}`,
    '',
    `  ${colors.dim('Homepage:')}   ${colors.muted('https://github.com/memlinkdotdev/cli')}`,
    `  ${colors.dim('Issues:')}     ${colors.muted('https://github.com/memlinkdotdev/cli/issues')}`,
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
    '',
    `    ${colors.white('add')}           Write an entry to default memory`,
    `                   ${colors.dim('memlink add "My Title" "My content"')}`,
    '',
    `    ${colors.white('entries')}       List entries in default memory`,
    `                   ${colors.dim('memlink entries')}`,
    '',
    `    ${colors.white('search')}        Search entries in default memory`,
    `                   ${colors.dim('memlink search query')}`,
    '',
    `    ${colors.white('url')}           Show MCP URL for agents`,
    `                   ${colors.dim('memlink url')}`,
    '',
    `    ${colors.white('token')}         Generate or manage tokens`,
    `                   ${colors.dim('memlink token')}`,
    `                   ${colors.dim('memlink token list')}`,
    `                   ${colors.dim('memlink token revoke <label>')}`,
    '',
    `    ${colors.white('pause')}         Suspend a memory (data intact)`,
    `                   ${colors.dim('memlink pause --memory <name>')}`,
    '',
    `    ${colors.white('stop')}          Stop the daemon server`,
    `                   ${colors.dim('memlink stop')}`,
    '',
    `    ${colors.white('status')}        Check if daemon server is running`,
    `                   ${colors.dim('memlink status')}`,
    '',
    `    ${colors.white('info')}          Memory details (name, ID, URL, stats)`,
    `                   ${colors.dim('memlink info <name-or-id>')}`,
    '',
    `    ${colors.white('delete')}        Delete a memory permanently`,
    `                   ${colors.dim('memlink delete <name-or-id>')}`,
    '',
    `    ${colors.white('export')}        Export memory as JSON`,
    `                   ${colors.dim('memlink export <name-or-id>')}`,
    '',
    `    ${colors.white('import')}        Import entries from a JSON file`,
    `                   ${colors.dim('memlink import <name-or-id> ./backup.json')}`,
    '',
    `    ${colors.white('config')}        View or modify configuration`,
    `                   ${colors.dim('memlink config')}`,
    `                   ${colors.dim('memlink config get serverPort')}`,
    `                   ${colors.dim('memlink config set serverPort 4444')}`,
    '',
    `    ${colors.white('install')}       Install system daemon`,
    `                   ${colors.dim('memlink install')}`,
    '',
    `    ${colors.white('uninstall')}     Remove system daemon`,
    `                   ${colors.dim('memlink uninstall')}`,
    '',
    `    ${colors.white('skill')}         Install Memlink agent skill globally`,
    `                   ${colors.dim('memlink skill')}`,
    '',
    `    ${colors.white('connect')}       Link CLI with memlink.cloud (Phase 2)`,
    `                   ${colors.dim('memlink connect')}`,
    '',
    `    ${colors.white('disconnect')}    Unlink from memlink.cloud`,
    `                   ${colors.dim('memlink disconnect')}`,
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
    `      ${colors.dim('Override the data directory (default: ~/.memlink)')}`,
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
  return `\n  ${colors.dim('─'.repeat(64))}\n  ${colors.dim('Documentation:')} ${colors.muted('https://github.com/memlinkdotdev/cli')}\n`;
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

  const host = envHost() || DEFAULT_HOST;
  const port = envPort() || DEFAULT_PORT;
  const base = `http://${host}:${port}`;

  console.log(info('Server', base));

  try {
    const meta = ensureDefaultMemory();
    if (meta) {
      const stats = getStats(meta.id);
      if (stats) {
        console.log(kv('  entries', `${stats.entries}`));
        console.log(kv('  size', `${(stats.size / 1024).toFixed(1)} KB`));
      }
    }
  } catch {
    // ok
  }

  console.log();
  console.log(kv('Essentials', 'serve · add · entries · search · url · token'));
  console.log(kv('More', 'info · export · import · config · stop · status · skill'));
  console.log();
  console.log(dimLine('Use memlink --help for full docs'));
  console.log();
});

// ─── Daemon helpers ────────────────────────────────────────────────────────────

function daemonPidPath(): string {
  return path.join(getMemlinkDir(), '.serve.pid');
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
  .action(async (opts) => {
    const port = parseInt(opts.port);
    const host = opts.host;
    const transports = (opts.transport as string)
      .split(',')
      .map((t: string) => t.trim().toLowerCase());

    // Stdio mode: communicate over stdin/stdout (no HTTP server)
    if (transports.includes('stdio')) {
      if (!opts.memory) {
        console.log(err('--memory <name> is required for stdio transport'));
        console.log(dimLine('Example: memlink serve --transport stdio --memory default'));
        process.exit(1);
      }
      await startStdioServer(opts.memory);
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

      const childEnv = { ...process.env, MEMLINK_DAEMON_CHILD: '1' };
      let child: ReturnType<typeof spawn>;

      if (process.platform === 'win32') {
        // On Windows, fully detach via VBScript WshShell.Run (no console, no parent job)
        const vbsPath = path.join(os.tmpdir(), `memlink-daemon-${process.pid}.vbs`);
        const quotedArgs = childArgs
          .map((a) => `"${a.replace(/"/g, '""')}"`)
          .join(' ');
        const vbs = `Set WshShell = CreateObject("WScript.Shell")\nWshShell.Run "" & "${process.execPath}" & "" & "${process.argv[1].replace(/\\/g, '\\\\')}" & " " & "${quotedArgs.replace(/"/g, '""')}", 0, False\n`;
        fs.writeFileSync(vbsPath, vbs, 'utf-8');

        child = spawn('wscript.exe', [vbsPath], {
          stdio: 'ignore',
          detached: true,
          env: childEnv,
          windowsHide: true,
        });
        setTimeout(() => {
          try { fs.unlinkSync(vbsPath); } catch { /* ignore */ }
        }, 5000);
      } else {
        child = spawn(process.execPath, [process.argv[1], ...childArgs], {
          stdio: 'ignore',
          detached: true,
          env: childEnv,
        });
      }

      child.unref();

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

    // Serve a named memory: register with running daemon or create meta + start
    if (opts.memory) {
      const existing = readMeta(opts.memory);
      if (existing) {
        console.log(err(`Memory "${opts.memory}" already exists.`));
        process.exit(1);
      }

      ensureLocalToken();
      const token = await admin.registerMemory(opts.memory);

      if (token.ok) {
        const data = token.data as { token: string };
        console.log(logoSmall());
        console.log(okBadge(`Memory registered: ${opts.memory}`));
        console.log(info('Token', data.token));
        console.log(info('MCP URL', `http://${host}:${port}/mcp?t=${data.token}`));
        console.log();
        return;
      }

      // Daemon not running — create locally and start foreground (same process)
      const newToken = (await import('nanoid')).nanoid(32);
      createMemoryMeta(opts.memory, newToken);
      registerMemoryRoute(opts.memory, newToken);
      console.log(okBadge(`Memory created: ${opts.memory}`));
      console.log(info('Token', newToken));
      console.log(info('MCP URL', `http://${host}:${port}/mcp?t=${newToken}`));
      console.log(dimLine('Starting server (foreground)...'));
      console.log();

      await startServer(port, host, {
        cors: opts.cors,
        readOnly: opts.readOnly,
        logLevel: opts.logLevel,
        bearerToken: opts.bearerToken,
      });
      return;
    }

    // Foreground mode
    await startServer(port, host, {
      cors: opts.cors,
      readOnly: opts.readOnly,
      logLevel: opts.logLevel,
      bearerToken: opts.bearerToken,
    });
  });

// ─── memlink status ───────────────────────────────────────────────────────

program
  .command('status')
  .description('Check if the Memlink daemon server is running')
  .action(() => {
    const pid = readPid();
    const alive = isDaemonAlive();
    const small = logoSmall();
    if (small) console.log('\n' + small + '\n');

    if (pid && isProcessRunning(pid) && alive) {
      console.log(okBadge(`Server is running (PID ${pid})`));
      const host = envHost() || DEFAULT_HOST;
      const port = envPort() || DEFAULT_PORT;
      console.log(info('URL', `http://${host}:${port}/mcp`));
    } else {
      console.log(info('not running', 'No server running.'));
      console.log(dimLine('Start: memlink serve'));
    }
    console.log();
  });

// ─── memlink add <title> <content> ──────────────────────────────────────────

program
  .command('add <title> <content>')
  .description('Write an entry to default memory')
  .action((title: string, content: string) => {
    addCommand(title, content);
  });

// ─── memlink entries ───────────────────────────────────────────────────────

program
  .command('entries')
  .description('List entries in default memory')
  .action(() => {
    entriesCommand();
  });

// ─── memlink search <query> ────────────────────────────────────────────────

program
  .command('search <query>')
  .description('Search entries in default memory')
  .action((query: string) => {
    searchCommand(query);
  });

// ─── memlink url ──────────────────────────────────────────────────────────

program
  .command('url')
  .description('Show MCP URL for agents')
  .action(() => {
    urlCommand();
  });

// ─── memlink token ────────────────────────────────────────────────────────

const tokenCmd = program.command('token').description('Generate or manage tokens');

tokenCmd
  .command('generate', { isDefault: true })
  .description('Generate a new local token')
  .action(() => {
    tokenGenerateCommand();
  });

tokenCmd
  .command('list')
  .description('List active tokens')
  .action(() => {
    tokenListCommand();
  });

tokenCmd
  .command('revoke [label]')
  .description('Revoke a token')
  .action((label?: string) => {
    tokenRevokeCommand(label);
  });

// ─── memlink pause ────────────────────────────────────────────────────────

program
  .command('pause')
  .description('Suspend a memory (data intact)')
  .option('--memory <name>', 'Memory name to pause', 'default')
  .action(async (opts) => {
    await pauseCommand(opts.memory);
  });

// ─── memlink resume ────────────────────────────────────────────────────────

program
  .command('resume')
  .description('Resume a paused memory')
  .option('--memory <name>', 'Memory name to resume', 'default')
  .action(async (opts) => {
    await resumeCommand(opts.memory);
  });

// ─── memlink stop --memory <name> ─────────────────────────────────────────

program
  .command('stop')
  .description('Stop daemon server or a specific memory')
  .option('--memory <name>', 'Memory to stop (remove from routing)')
  .action(async (opts) => {
    if (opts.memory) {
      await stopMemoryCommand(opts.memory);
      return;
    }
    // Original stop behavior: stop the daemon
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

// ─── memlink delete <name-or-id> ──────────────────────────────────────────

program
  .command('delete <name>')
  .description('Delete a memory permanently')
  .action((name: string) => {
    const metaPath = path.join(getMemlinkDir(), name, 'meta.json');
    if (!fs.existsSync(metaPath)) {
      console.error(err(`Memory not found: ${name}`));
      process.exit(1);
    }
    const dir = path.join(getMemlinkDir(), name);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(logoSmall());
    console.log();
    console.log(okBadge(`Memory deleted: ${name}`));
    console.log();
  });

// ─── memlink info <name> ────────────────────────────────────────────

program
  .command('info <name>')
  .description('Show memory details (name, ID, URL, stats)')
  .action(async (name: string) => {
    const metaPath = path.join(getMemlinkDir(), name, 'meta.json');
    if (!fs.existsSync(metaPath)) {
      console.error(err(`Memory not found: ${name}`));
      console.log(dimLine('Memories: default, or create with memlink serve --memory <name>'));
      return;
    }
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    const config = loadConfig();
    const host = envHost() || config.serverHost || DEFAULT_HOST;
    const port = envPort() || config.serverPort || DEFAULT_PORT;
    const mcp = `http://${host}:${port}/mcp${meta.token ? '?t=' + meta.token : ''}`;

    let stats;
    try {
      stats = getStats(meta.id);
    } catch {
      /* ok */
    }

    const small = logoSmall();
    if (small) console.log('\n' + small + '\n');
    console.log(info('Name', name));
    console.log(info('ID', meta.id));
    console.log(info('MCP', mcp));
    console.log(info('Status', meta.status));
    if (meta.token) console.log(info('Token', meta.token));
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

// ─── memlink export <name> ───────────────────────────────────────────

program
  .command('export <name>')
  .description('Export memory as JSON')
  .action((name: string) => {
    const metaPath = path.join(getMemlinkDir(), name, 'meta.json');
    if (!fs.existsSync(metaPath)) {
      console.error(err(`Memory not found: ${name}`));
      console.log(dimLine('List memories with: memlink info <name>'));
      process.exit(1);
    }
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    const exported = exportMemoryFormats(meta.id);
    const shortFiles = exported.map((f) => path.relative(getMemlinkDir(), f));
    const small = logoSmall();
    if (small) console.log('\n' + small + '\n');
    console.log(okBadge(`Exported: ${shortFiles.join(', ')}`));
    console.log(dimLine(`Exports dir: ${getExportsDir()}`));
    console.log();
  });

// ─── memlink import <name> <file> ─────────────────────────────────────

program
  .command('import <name>')
  .argument('<file>', 'JSON file to import')
  .description('Import entries from a JSON file')
  .option('--overwrite', 'Overwrite existing entries with same title')
  .action((name: string, file: string, opts: { overwrite?: boolean }) => {
    const metaPath = path.join(getMemlinkDir(), name, 'meta.json');
    if (!fs.existsSync(metaPath)) {
      console.error(err(`Memory not found: ${name}`));
      console.log(dimLine('Memories: default, or create with memlink serve --memory <name>'));
      process.exit(1);
    }
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    try {
      const result = importFromFile(meta.id, file, { overwrite: opts.overwrite });
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

// ─── memlink connect / disconnect ─────────────────────────────────────────

program
  .command('connect')
  .description('Link CLI with memlink.cloud (Phase 2)')
  .action(() => {
    connectCommand();
  });

program
  .command('disconnect')
  .description('Unlink from memlink.cloud')
  .action(() => {
    disconnectCommand();
  });

// ─── memlink install / uninstall ──────────────────────────────────────────

program
  .command('install')
  .description('Install system daemon')
  .action(async () => {
    const { installCommand } = await import('./commands/install.ts');
    installCommand();
  });

program
  .command('uninstall')
  .description('Remove system daemon')
  .action(async () => {
    const { uninstallCommand } = await import('./commands/install.ts');
    uninstallCommand();
  });

// ─── memlink skill ──────────────────────────────────────────────────────

function ensureSkillTag(agentsDir: string, tag: string) {
  const agentsPath = path.join(agentsDir, 'AGENTS.md');
  if (fs.existsSync(agentsPath)) {
    const content = fs.readFileSync(agentsPath, 'utf-8');
    if (content.includes(tag)) return;
    fs.writeFileSync(agentsPath, content.trimEnd() + '\n\n' + tag + '\n', 'utf-8');
  } else {
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(agentsPath, tag + '\n', 'utf-8');
  }
}

program
  .command('skill')
  .description('Install Memlink agent skill globally')
  .action(() => {
    const skillDir = path.join(os.homedir(), '.agents', 'skills', 'memlink');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), SKILL_MD, 'utf-8');
    ensureSkillTag(path.join(os.homedir(), '.agents'), '@skills/memlink');
    const small = logoSmall();
    if (small) console.log('\n' + small + '\n');
    console.log(okBadge(`Skill installed: ~/.agents/skills/memlink/SKILL.md`));
    console.log(dimLine('The skill teaches agents how to use memlink as a memory layer.'));
    console.log(dimLine('Both CLI and Cloud are MCP servers — the skill applies to both.'));
    console.log();
  });

// ─── Parse ──────────────────────────────────────────────────────────────────

program.parse(process.argv);
