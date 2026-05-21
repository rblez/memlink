#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { execSync } from 'child_process';
import { Command } from 'commander';
import chalk from 'chalk';
import { table } from 'table';
import {
  ok as okBadge,
  err,
  info,
  count,
  confirm as confirmBadge,
  kv,
  list,
  heading,
  subheading,
  prompt,
  dimLine,
  colors,
} from './output.ts';
import {
  loadConfig,
  saveConfig,
  importMemory,
  exportMemory,
  MemoryExport,
  getStats,
  getDetailedStats,
  getAllMemoriesStats,
  readMemory,
  syncMemory,
  getMemlinkDir,
  bulkDeleteMemories,
  bulkDeleteMemoriesByTags,
  bulkDeleteMemoriesByPattern,
  saveBackup,
  restoreBackup,
  listBackups,
  deleteBackup,
  cleanupOldBackups,
  createUniversalMemory,
  searchMemory,
  DetailedMemoryStats,
  renderMemoryAsMarkdown,
  renderEntryAsMarkdown,
} from '../core/memory.ts';
import { checkForUpdates, performUpdate } from '../update/index.ts';
import {
  type SyncTarget,
  type SyncResult,
  type NativeMemory,
  detectNativeMemoryTargets,
  convertMemlinkToNative,
  convertNativeToMemlink,
} from '../core/sync.ts';
import { startServer } from '../server/index.ts';
import { KNOWN_AGENTS, MEMLINK_VERSION, DEFAULT_PORT, DEFAULT_HOST } from '../core/types.ts';
import {
  SUPPORTED_AGENTS,
  scaffoldMcpConfig,
  scaffoldSkill,
  scaffoldAgentsMd,
  getAgentConfig,
} from '../core/scaffold.ts';

// ─── Branding ────────────────────────────────────────────────────────────────

const LOGO = `\n${colors.white('  memlink')}\n${colors.dim('  Universal Memory for AI Agents')}\n${colors.dim('  Self-hosted · Fast · Organized')}\n`;

const LOGO_SMALL = colors.white('memlink') + colors.dim(' v' + MEMLINK_VERSION);

// ─── Color compatibility (maps old API to new palette) ────────────────────────

const c = {
  text: colors.white,
  bold: chalk.bold,
  dim: colors.dim,
  success: colors.primary,
  error: colors.accent,
  warning: colors.muted,
  info: colors.muted,
  green: colors.primary,
  cyan: chalk.cyan,
  yellow: colors.muted,
  blue: colors.muted,
  red: colors.accent,
};

// ─── Global options ──────────────────────────────────────────────────────────

let jsonOutput = false;
let verboseMode = false;

// Helper for JSON output
function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

// Helper for verbose logging
function verboseLog(...args: unknown[]): void {
  if (verboseMode) {
    console.log(colors.dim('  [verbose]'), ...args);
  }
}

// ─── Interactive Input Helpers ───────────────────────────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function askYesNo(question: string, defaultYes = false): Promise<boolean> {
  return new Promise((resolve) => {
    const defaultStr = defaultYes ? 'Y/n' : 'y/N';
    rl.question(`${question} [${defaultStr}]: `, (answer) => {
      if (!answer.trim()) {
        resolve(defaultYes);
      } else {
        resolve(answer.trim().toLowerCase() === 'y');
      }
    });
  });
}

// ─── IDE detection ─────────────────────────────────────────────────────

function detectIDE(): string {
  const home = os.homedir();
  if (fs.existsSync(path.join(home, '.codeium/windsurf/mcp_config.json'))) return 'windsurf';
  if (fs.existsSync(path.join(home, '.cursor/mcp.json'))) return 'cursor';
  if (fs.existsSync(path.join(home, '.claude/settings.json'))) return 'claude';
  if (fs.existsSync(path.join(process.cwd(), '.cursor/mcp.json'))) return 'cursor';
  if (fs.existsSync(path.join(process.cwd(), '.windsurf/mcp_config.json'))) return 'windsurf';
  return 'cursor';
}

function getMcpConfigPath(ide: string, universal: boolean = false): string {
  const home = os.homedir();
  const cwd = process.cwd();
  if (universal) return path.join(cwd, '.memlink/mcp.json');
  switch (ide) {
    case 'windsurf':
      return path.join(home, '.codeium/windsurf/mcp_config.json');
    case 'claude':
      return path.join(home, '.claude/mcp.json');
    default:
      return path.join(home, '.cursor/mcp.json');
  }
}

// ─── Clipboard helper ─────────────────────────────────────────────────────

function copyToClipboard(text: string): boolean {
  const platform = process.platform;
  const tmpfile = os.tmpdir() + '/memlink-clipboard-' + Date.now() + '.txt';

  try {
    fs.writeFileSync(tmpfile, text, 'utf-8');
    let copied = false;

    if (platform === 'darwin') {
      execSync(`cat '${tmpfile}' | pbcopy`, { stdio: 'ignore' });
      copied = true;
    } else if (platform === 'linux') {
      const tools = ['wl-copy', 'xclip', 'xsel'];
      for (const tool of tools) {
        try {
          execSync(`which ${tool}`, { stdio: 'ignore' });
          if (tool === 'wl-copy') execSync(`cat '${tmpfile}' | ${tool}`, { stdio: 'ignore' });
          else execSync(`cat '${tmpfile}' | ${tool} -selection clipboard`, { stdio: 'ignore' });
          copied = true;
          break;
        } catch {
          continue;
        }
      }
    } else {
      execSync(`powershell -c 'Get-Content '${tmpfile}' | Set-Clipboard'`, { stdio: 'ignore' });
      copied = true;
    }

    fs.unlinkSync(tmpfile);
    return copied;
  } catch {
    try {
      fs.unlinkSync(tmpfile);
    } catch {
      /* ignore */
    }
    return false;
  }
}

// ─── Interactive prompts ─────────────────────────────────────────────────

interface ArrowOption {
  id: string;
  label: string;
  desc?: string;
}

async function promptArrow(options: ArrowOption[], title: string): Promise<string | null> {
  if (options.length === 0) return null;
  if (options.length === 1) return options[0].id;

  console.log(colors.white(`  ${title}\n`));
  for (let i = 0; i < options.length; i++) {
    console.log(
      `  ${colors.muted(String(i + 1) + '.')} ${options[i].label}${options[i].desc ? colors.dim(' - ' + options[i].desc) : ''}`
    );
  }
  console.log();

  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(colors.white('  Choose [1-' + options.length + ']: '), (answer) => {
      rl.close();
      const a = answer.trim();
      const idx = parseInt(a) - 1;
      if (idx >= 0 && idx < options.length) {
        resolve(options[idx].id);
      } else {
        resolve(options[0].id);
      }
    });
  });
}

async function promptYesNo(question: string, defaultYes: boolean = false): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const def = defaultYes ? '[Y/n]' : '[y/N]';
  const yep = defaultYes ? 'Y' : 'y';

  return new Promise((resolve) => {
    rl.question(colors.white(`  ${question} ${def}: `), (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      if (a === '') resolve(defaultYes);
      else resolve(a === yep || a === 'yes');
    });
  });
}

// ─── Program ──────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('memlink')
  .description('memlink — Universal memory for AI agents')
  .version(MEMLINK_VERSION)
  .option('--json', 'Output in JSON format')
  .option('-v, --verbose', 'Show detailed output')
  .hook('preAction', (thisCommand) => {
    jsonOutput = thisCommand.opts().json ?? false;
    verboseMode = thisCommand.opts().verbose ?? false;
  })
  .addHelpText('beforeAll', LOGO);

// ─── memlink serve ─────────────────────────────────────────────────────────────

program
  .command('serve')
  .description('Start the memlink MCP server')
  .option('-p, --port <port>', 'Port to listen on', String(DEFAULT_PORT))
  .option('-H, --host <host>', 'Host to bind to', DEFAULT_HOST)
  .option('-l, --logs', 'Enable request/response logging (Ctrl+L to toggle)')
  .action(async (opts) => {
    console.log(LOGO);
    console.log(dimLine('Starting MCP server...\n'));

    const config = loadConfig();
    const port = parseInt(opts.port);
    const host = opts.host;

    console.log(kv('MCP URL', `http://${host}:${port}/mcp`));
    console.log(kv('Health', `http://${host}:${port}/health`));
    console.log(kv('Prompt', `http://${host}:${port}/instructions`));
    console.log(count('agents', config.agents.length) + '\n');

    if (config.agents.length > 0) {
      console.log(subheading('Connected agents:'));
      for (const agent of config.agents) {
        const last = agent.lastSeen
          ? colors.dim(new Date(agent.lastSeen).toLocaleString())
          : colors.dim('never');
        console.log(list(agent.agentName, '(' + agent.agentId + ')', 'last seen: ' + last));
      }
      console.log();
    }

    console.log(dimLine('Press Ctrl+C to stop\n'));
    await startServer(port, host, opts.logs);
  });

// ─── memlink agent list ─────────────────────────────────────────────────────────

const agentCmd = program
  .command('memory')
  .description('Manage universal memories and their tokens');

// Memory commands are now handled by the memory inspection section below

agentCmd
  .command('list')
  .alias('ls')
  .description('List all memory files and their stats')
  .action(() => {
    const config = loadConfig();

    // Get universal memories with linked agents
    const universalMemories = config.universalMemories.map((memory) => {
      try {
        const stats = getStats(memory.memoryId);
        const linkedAgentNames = (memory.linkedAgents || []).map((agentId) => {
          const agent = SUPPORTED_AGENTS.find((a) => a.id === agentId);
          return agent ? agent.name : agentId;
        });
        return {
          id: memory.memoryId,
          name: memory.memoryName,
          type: 'Memory',
          entries: stats.entries,
          size: stats.size,
          lastUpdated: stats.newestEntry,
          linkedAgents: linkedAgentNames,
          error: false,
        };
      } catch {
        return {
          id: memory.memoryId,
          name: memory.memoryName,
          type: 'Memory',
          entries: 0,
          size: 0,
          lastUpdated: null,
          linkedAgents: memory.linkedAgents || [],
          error: true,
        };
      }
    });

    if (universalMemories.length === 0) {
      if (jsonOutput) {
        outputJson([]);
        return;
      }
      console.log('\n' + LOGO_SMALL + '\n');
      console.log(info('no memories', 'No memories registered.\n'));
      return;
    }

    if (jsonOutput) {
      outputJson(universalMemories);
      return;
    }

    console.log('\n' + LOGO_SMALL + '\n');
    verboseLog(`Processing ${universalMemories.length} memories`);

    const rows = [
      [c.bold('Name'), c.bold('Entries'), c.bold('Size'), c.bold('Agentes Vinculados')],
      ...universalMemories.map((d) => [
        colors.white(d.name),
        d.error ? colors.accent('error') : colors.white(String(d.entries)),
        d.error ? colors.accent('?') : colors.dim(`${(d.size / 1024).toFixed(1)} KB`),
        d.linkedAgents.length > 0
          ? colors.primary(d.linkedAgents.join(', '))
          : colors.dim('ninguno'),
      ]),
    ];

    console.log(table(rows));
  });

// ─── memlink memory revoke ───────────────────────────────────────────────────────

agentCmd
  .command('revoke <memoryId>')
  .description('Revoke a universal memory and delete its data')
  .action((memoryId: string) => {
    const config = loadConfig();
    const memory = config.universalMemories.find((m) => m.memoryId === memoryId);

    if (!memory) {
      if (jsonOutput) {
        outputJson({ error: `Universal memory not found: ${memoryId}` });
        process.exit(1);
      }
      console.error(
        err(
          `Universal memory not found: ${memoryId}`,
          'Run memlink memory list to see available memories.'
        )
      );
      process.exit(1);
    }

    console.log(
      confirmBadge(`Revoke universal memory "${memory.memoryName}" and delete its data?`)
    );
    const result = revokeUniversalMemory(memoryId);
    if (result) {
      console.log(okBadge(`Universal memory "${memory.memoryName}" revoked and memory deleted.`));
    } else {
      console.error(err('Failed to revoke universal memory'));
      process.exit(1);
    }
  });

// ─── memlink memory detach ───────────────────────────────────────────────────────

agentCmd
  .command('detach <memoryId> [agentId]')
  .description('Detach agents from a memory. If no agent specified, detaches all.')
  .action((memoryId: string, agentId?: string) => {
    const config = loadConfig();
    const memory = config.universalMemories.find((m) => m.memoryId === memoryId);

    if (!memory) {
      console.error(err(`Memory not found: ${memoryId}`));
      process.exit(1);
    }

    const currentAgents = memory.linkedAgents || [];
    if (currentAgents.length === 0) {
      console.log(info('no agents', `No agents linked to ${memory.memoryName}\n`));
      return;
    }

    let agentsToDetach: string[];
    if (agentId) {
      const validAgents = SUPPORTED_AGENTS.map((a) => a.id);
      if (!validAgents.includes(agentId)) {
        console.error(
          err(`Invalid agent ID: ${agentId}`, `Valid agents: ${validAgents.join(', ')}`)
        );
        process.exit(1);
      }
      agentsToDetach = [agentId];
    } else {
      agentsToDetach = currentAgents;
    }

    for (const aId of agentsToDetach) {
      const agent = getAgentConfig(aId);
      if (!agent) continue;

      const skillPath = agent.skillGlobal;
      if (skillPath) {
        const skillDir = path.join(
          skillPath,
          `memlink-${memory.memoryName.toLowerCase().replace(/\s+/g, '-')}`
        );
        try {
          if (fs.existsSync(skillDir)) {
            fs.rmSync(skillDir, { recursive: true });
          }
        } catch {
          /* ignore */
        }
      }

      console.log(dimLine(`Removed: ${agent.name}`));
    }

    config.universalMemories = config.universalMemories.map((m) => {
      if (m.memoryId === memoryId) {
        return {
          ...m,
          linkedAgents: m.linkedAgents?.filter((a) => !agentsToDetach.includes(a)) || [],
        };
      }
      return m;
    });
    saveConfig(config);

    console.log(okBadge(`${agentsToDetach.length} agent(s) detached from ${memory.memoryName}\n`));
  });

// ─── memlink memory link ─────────────────────────────────────────────────────────

agentCmd
  .command('link <memoryId> <agentId>')
  .description('Link a memory to an additional agent')
  .option('-s, --scope <scope>', 'Scope: global or workspace')
  .action((memoryId: string, agentId: string, opts: { scope?: string }) => {
    const config = loadConfig();
    const memory = config.universalMemories.find((m) => m.memoryId === memoryId);

    if (!memory) {
      console.error(err(`Memory not found: ${memoryId}`));
      process.exit(1);
    }

    const agent = getAgentConfig(agentId);
    if (!agent) {
      console.error(
        err(
          `Invalid agent ID: ${agentId}`,
          `Valid agents: ${SUPPORTED_AGENTS.map((a) => a.id).join(', ')}`
        )
      );
      process.exit(1);
    }

    const currentAgents = memory.linkedAgents || [];
    if (currentAgents.includes(agentId)) {
      console.log(
        info('already linked', `${agent.name} is already linked to ${memory.memoryName}\n`)
      );
      return;
    }

    const scope: 'global' | 'workspace' = (opts.scope as 'global' | 'workspace') || 'global';
    const host = config.serverHost ?? DEFAULT_HOST;
    const port = config.serverPort ?? DEFAULT_PORT;

    scaffoldMcpConfig(agent, scope, memory.memoryId, host, port);

    if (agent.hasSkill) {
      scaffoldSkill(agent, scope, memory.memoryId, memory.memoryName, '');
    }

    config.universalMemories = config.universalMemories.map((m) => {
      if (m.memoryId === memoryId) {
        return {
          ...m,
          linkedAgents: [...(m.linkedAgents || []), agentId],
        };
      }
      return m;
    });
    saveConfig(config);

    console.log(okBadge(`Linked ${agent.name} to ${memory.memoryName}\n`));
  });

// ─── memlink memory unlink ─────────────────────────────────────────────────────

agentCmd
  .command('unlink <memoryId> <agentId>')
  .description('Unlink a specific agent from a memory (alias for detach)')
  .action((memoryId: string, agentId: string) => {
    const config = loadConfig();
    const memory = config.universalMemories.find((m) => m.memoryId === memoryId);

    if (!memory) {
      console.error(err(`Memory not found: ${memoryId}`));
      process.exit(1);
    }

    const agent = getAgentConfig(agentId);
    if (!agent) {
      console.error(err(`Invalid agent ID: ${agentId}`));
      process.exit(1);
    }

    const currentAgents = memory.linkedAgents || [];
    if (!currentAgents.includes(agentId)) {
      console.log(info('not linked', `${agent.name} is not linked to ${memory.memoryName}\n`));
      return;
    }

    const skillPath = agent.skillGlobal;
    if (skillPath) {
      const skillDir = path.join(
        skillPath,
        `memlink-${memory.memoryName.toLowerCase().replace(/\s+/g, '-')}`
      );
      try {
        if (fs.existsSync(skillDir)) {
          fs.rmSync(skillDir, { recursive: true });
        }
      } catch {
        /* ignore */
      }
    }

    config.universalMemories = config.universalMemories.map((m) => {
      if (m.memoryId === memoryId) {
        return {
          ...m,
          linkedAgents: m.linkedAgents?.filter((a) => a !== agentId) || [],
        };
      }
      return m;
    });
    saveConfig(config);

    console.log(okBadge(`Unlinked ${agent.name} from ${memory.memoryName}\n`));
  });

// ─── memlink memory create ──────────────────────────────────────────────────────

agentCmd
  .command('create [name]')
  .description('Create a universal memory (interactive)')
  .option('-d, --description <desc>', 'Description for the memory')
  .option('-s, --scope <scope>', 'Scope: global or workspace')
  .option('--skill', 'Create skill for agents')
  .option('--agents <agents>', 'Comma-separated agent IDs')
  .action(
    async (
      nameArg?: string,
      opts: {
        description?: string;
        scope?: string;
        skill?: boolean;
        agents?: string;
      }
    ) => {
      console.clear();
      console.log(heading('Crear Nueva Memoria'));

      let name = nameArg;
      let description = opts.description || '';
      let scope: 'global' | 'workspace' = (opts.scope as 'global' | 'workspace') || 'global';

      if (!name) {
        name = await askQuestion(prompt('Nombre de la memoria: '));
        if (!name) {
          console.error(err('El nombre es obligatorio'));
          process.exit(1);
        }
      }

      if (!opts.description) {
        description = await askQuestion(prompt('Descripcion (opcional): '));
      }

      if (!opts.scope) {
        console.log();
        console.log(subheading('Alcance:'));
        console.log(dimLine('(g) Global    - disponible en todos los proyectos'));
        console.log(dimLine('(w) Workspace - solo en el proyecto actual'));
        const scopeAnswer = await askQuestion(prompt('[g/w]: '));
        scope =
          scopeAnswer.toLowerCase() === 'w' || scopeAnswer.toLowerCase() === 'workspace'
            ? 'workspace'
            : 'global';
      }

      let finalSelectedAgents: string[] = [];

      if (opts.agents) {
        finalSelectedAgents = opts.agents.split(',').map((a) => a.trim());
      } else {
        console.log();
        const configureAgents = await askYesNo('Configurar agentes ahora?');

        if (configureAgents) {
          console.log();
          console.log(subheading('Selecciona agentes (Enter para confirmar):'));
          console.log();

          const agents = SUPPORTED_AGENTS.filter((a) => a.supportsAgents);
          const agentSelections: boolean[] = new Array(agents.length).fill(false);

          for (let i = 0; i < agents.length; i++) {
            const answer = await askYesNo(`  ${agents[i].name}?`, true);
            agentSelections[i] = answer;
          }

          finalSelectedAgents = agents.filter((_, i) => agentSelections[i]).map((a) => a.id);
        }
      }

      const wantsSkill =
        finalSelectedAgents.length > 0 ? await askYesNo('Generar skill para los agentes?') : false;

      console.clear();
      console.log(heading('Resumen'));
      console.log(kv('Nombre', name));
      console.log(kv('Descripcion', description || '(sin descripcion)'));
      console.log(kv('Alcance', scope));
      if (finalSelectedAgents.length > 0) {
        console.log(kv('Agentes', finalSelectedAgents.join(', ')));
        console.log(kv('Skill', wantsSkill ? 'Si' : 'No'));
      } else {
        console.log(dimLine('Agentes: (ninguno)'));
      }
      console.log();

      const createConfirm = await askYesNo('Crear memoria?', true);
      if (!createConfirm) {
        console.log(dimLine('Cancelado.\n'));
        return;
      }

      try {
        const memory = createUniversalMemory(name);
        console.log(okBadge('Memoria creada\n'));

        const config = loadConfig();
        const host = config.serverHost ?? DEFAULT_HOST;
        const port = config.serverPort ?? DEFAULT_PORT;

        console.log(info('Nombre', memory.memoryName));
        console.log(info('ID', memory.memoryId));
        console.log(info('MCP URL', `http://${host}:${port}/mcp?mem_id=${memory.memoryId}`));
        console.log();

        if (finalSelectedAgents.length > 0) {
          console.log(subheading('Configurando agentes...\n'));

          for (const agentId of finalSelectedAgents) {
            const agent = getAgentConfig(agentId.trim());
            if (!agent) continue;

            const mcpOk = scaffoldMcpConfig(agent, scope, memory.memoryId, host, port);
            console.log(dimLine(`${agent.name} MCP: ${mcpOk ? 'ok' : 'failed'}`));

            if (wantsSkill && agent.hasSkill) {
              const skillOk = scaffoldSkill(
                agent,
                scope,
                memory.memoryId,
                memory.memoryName,
                description
              );
              console.log(dimLine(`${agent.name} Skill: ${skillOk ? 'ok' : 'failed'}`));
            }
            console.log();
          }

          const agentsMdOk = scaffoldAgentsMd(
            scope,
            memory.memoryId,
            memory.memoryName,
            host,
            port
          );
          if (agentsMdOk) {
            console.log(okBadge('AGENTS.md configured'));
          }
        }

        config.universalMemories = config.universalMemories.map((m) => {
          if (m.memoryId === memory.memoryId) {
            return { ...m, linkedAgents: finalSelectedAgents };
          }
          return m;
        });
        saveConfig(config);

        console.log(heading('Siguientes pasos'));
        console.log(dimLine('1. Iniciar servidor: memlink serve'));
        console.log(dimLine('2. Ver memorias:     memlink memory list'));
        console.log(dimLine(`3. Ver contenido:    memlink memory show ${memory.memoryId}\n`));
      } catch (err) {
        console.error(err('Error al crear la memoria', String(err)));
        process.exit(1);
      }

      rl.close();
    }
  );

agentCmd
  .command('show [memoryId]')
  .description('Show memory (interactivo si no se especifica ID)')
  .option('-t, --title <title>', 'Show only a specific entry')
  .action(async (memoryId: string | undefined, opts) => {
    if (!memoryId) {
      await showMemorySelector();
      return;
    }

    const config = loadConfig();

    const agent = config.agents.find((a) => a.agentId === memoryId);
    const universalMemory = config.universalMemories.find((m) => m.memoryId === memoryId);

    const memory = agent || universalMemory;
    const memoryType = agent ? 'agent' : 'universal';
    const memoryName = agent?.agentName || universalMemory?.memoryName;

    if (!memory) {
      if (jsonOutput) {
        outputJson({ error: `Memory not found: ${memoryId}` });
        process.exit(1);
      }
      console.error(err(`Memory not found: ${memoryId}`));
      process.exit(1);
    }

    try {
      const entries = readMemory(memoryId);

      if (entries.length === 0) {
        if (jsonOutput) {
          outputJson({ type: memoryType, name: memoryName, entries: [] });
          return;
        }
        console.log('\n' + LOGO_SMALL + '\n');
        console.log(info('empty', `Memory is empty for ${memoryName}\n`));
        return;
      }

      if (opts.title) {
        const entry = entries.find((e) => e.title.toLowerCase() === opts.title.toLowerCase());
        if (!entry) {
          if (jsonOutput) {
            outputJson({ error: `Entry not found: ${opts.title}` });
            process.exit(1);
          }
          console.error(err(`Entry not found: ${opts.title}`));
          process.exit(1);
        }

        if (jsonOutput) {
          outputJson({ type: memoryType, name: memoryName, entry });
          return;
        }
        console.log('\n' + LOGO_SMALL + '\n');
        console.log(renderEntryAsMarkdown(entry));
        console.log();
        return;
      }

      if (jsonOutput) {
        outputJson({ type: memoryType, name: memoryName, entries });
        return;
      }

      console.log('\n' + LOGO_SMALL + '\n');
      console.log(renderMemoryAsMarkdown(memoryId));
      console.log();
    } catch (err) {
      if (jsonOutput) {
        outputJson({ error: String(err) });
        process.exit(1);
      }
      console.error(err('Failed to read memory', String(err)));
      process.exit(1);
    }
  });

// ─── memlink memory search ─────────────────────────────────────────────────────

agentCmd
  .command('search <memoryId> <query>')
  .description('Search memory entries by title, content, or tags')
  .action((memoryId: string, query: string) => {
    console.log('\n' + LOGO_SMALL + '\n');
    const config = loadConfig();
    const universalMemory = config.universalMemories.find((m) => m.memoryId === memoryId);

    if (!universalMemory) {
      console.error(err(`Memory not found: ${memoryId}`));
      process.exit(1);
    }

    try {
      const results = searchMemory(memoryId, query);

      if (results.length === 0) {
        console.log(info('no matches', `No matches found for '${query}'\n`));
        return;
      }

      console.log(
        heading(`${universalMemory.memoryName} - ${results.length} matches for '${query}'`)
      );

      for (const entry of results) {
        console.log(list(entry.title, `(${entry.updatedAt})`));
        const preview = entry.content.slice(0, 100) + (entry.content.length > 100 ? '...' : '');
        console.log(dimLine(preview));
        console.log();
      }
    } catch (err) {
      console.error(err('Search failed', String(err)));
      process.exit(1);
    }
  });

// ─── memlink memory export ─────────────────────────────────────────────────────

agentCmd
  .command('export <memoryId>')
  .description('Export memory to JSON file')
  .option('-o, --output <file>', 'Output file path', '-')
  .action((memoryId: string, opts) => {
    console.log('\n' + LOGO_SMALL + '\n');

    try {
      const data = exportMemory(memoryId);
      const json = JSON.stringify(data, null, 2);

      if (opts.output === '-') {
        console.log(okBadge('Memory exported'));
        console.log(json);
      } else {
        fs.writeFileSync(opts.output, json, 'utf-8');
        console.log(okBadge(`Memory exported to ${opts.output}\n`));
      }
    } catch (err) {
      console.error(err('Export failed', String(err)));
      process.exit(1);
    }
  });

// ─── memlink memory import ─────────────────────────────────────────────────────

agentCmd
  .command('import <memoryId> <file>')
  .description('Import memory from JSON file')
  .action((memoryId: string, file: string) => {
    console.log('\n' + LOGO_SMALL + '\n');

    try {
      const json = fs.readFileSync(file, 'utf-8');
      const data = JSON.parse(json) as MemoryExport;
      const count = importMemory(memoryId, data);
      console.log(okBadge(`Imported ${count} entries\n`));
    } catch (err) {
      console.error(err('Import failed', String(err)));
      process.exit(1);
    }
  });

// ─── memlink memory stats ──────────────────────────────────────────────────────

agentCmd
  .command('stats <memoryId>')
  .description('Show detailed memory statistics')
  .action((memoryId: string) => {
    try {
      const stats = getStats(memoryId);

      if (jsonOutput) {
        outputJson(stats);
        return;
      }

      console.log('\n' + LOGO_SMALL + '\n');
      console.log(kv('Memory', stats.memoryName || 'Unnamed'));
      console.log(kv('ID', stats.memoryId));
      console.log(kv('Entries', String(stats.entries)));
      console.log(kv('Size', `${(stats.size / 1024).toFixed(2)} KB`));
      console.log(kv('Created', stats.createdAt));
      console.log(kv('Last seen', stats.lastSeen ?? 'never'));
      console.log(kv('Oldest', stats.oldestEntry ?? 'N/A'));
      console.log(kv('Newest', stats.newestEntry ?? 'N/A'));
      if (stats.tags.length > 0) {
        console.log(kv('Tags', stats.tags.join(', ')));
      }
      console.log();
    } catch (err) {
      if (jsonOutput) {
        outputJson({ error: String(err) });
        process.exit(1);
      }
      console.error(err('Stats failed', String(err)));
      process.exit(1);
    }
  });

// ─── memlink agent rotate ──────────────────────────────────────────────────────

agentCmd
  .command('rotate <agentId>')
  .description('Rotate agent token (generate new token)')
  .action((agentId: string) => {
    console.log('\n' + LOGO_SMALL + '\n');

    try {
      const newToken = rotateToken(agentId);
      console.log(okBadge('Token rotated'));
      console.log(kv('New token', newToken));
      console.log(dimLine('Update your MCP config with the new token.\n'));
    } catch (err) {
      console.error(err('Rotation failed', String(err)));
      process.exit(1);
    }
  });

// ─── memlink config ─────────────────────────────────────────────────────────────

program
  .command('config')
  .description('Configure memlink settings')
  .option('-p, --port <port>', 'Server port')
  .option('-H, --host <host>', 'Server host')
  .action((opts) => {
    console.log('\n' + LOGO_SMALL + '\n');

    const config = loadConfig();
    let changed = false;

    if (opts.port) {
      config.serverPort = parseInt(opts.port);
      changed = true;
      console.log(okBadge(`Port set to ${opts.port}`));
    }

    if (opts.host) {
      config.serverHost = opts.host;
      changed = true;
      console.log(okBadge(`Host set to ${opts.host}`));
    }

    if (changed) {
      saveConfig(config);
      console.log(okBadge('Configuration saved.\n'));
    } else {
      console.log(heading('Current configuration'));
      console.log(kv('Port', String(config.serverPort ?? DEFAULT_PORT)));
      console.log(kv('Host', config.serverHost ?? DEFAULT_HOST));
      console.log(kv('Agents', String(config.agents.length)));
      console.log();
    }
  });

// ─── memlink status ─────────────────────────────────────────────────────────────

program
  .command('status')
  .description('Show memlink system status')
  .action(() => {
    console.log('\n' + LOGO + '\n');
    const config = loadConfig();

    console.log(kv('Version', MEMLINK_VERSION));
    console.log(kv('Memory dir', getMemlinkDir()));
    console.log(
      kv(
        'Server',
        `http://${config.serverHost ?? DEFAULT_HOST}:${config.serverPort ?? DEFAULT_PORT}/mcp`
      )
    );
    console.log(count('agents', config.agents.length) + '\n');

    if (config.agents.length > 0) {
      console.log(heading('Registered Agents'));
      for (const agent of config.agents) {
        const memInfo: string = (() => {
          try {
            const stats = syncMemory(agent.agentId);
            return `${stats.entries} entries · ${(stats.size / 1024).toFixed(1)} KB`;
          } catch {
            return 'memory error';
          }
        })();
        console.log(list(agent.agentName, '(' + agent.agentId + ')', memInfo));
        console.log(dimLine(`Token: ${agent.token.slice(0, 20)}...`));
        console.log();
      }
    }

    console.log(
      dimLine(
        `Known agents: ${Object.entries(KNOWN_AGENTS)
          .map(([, v]) => v.name)
          .join(', ')}\n`
      )
    );
  });

// ─── Skill scaffold ────────────────────────────────────────────────────────────

const MEMLINK_SKILL = `---
name: memlink
description: Use memlink MCP for persistent memory across sessions
---
# memlink Memory Skill

Use this skill when working with the memlink MCP server for persistent memory.

## When to Use

- User says 'save X to memory', 'remember that', 'store this'
- User says 'forget X', 'remove from memory', 'delete X'
- User asks 'what do you remember?', 'show my memory'
- Starting a new session to load previous context
- User shares preferences, decisions, or project details worth persisting
- User wants to clean up old or outdated memory entries
- User needs to backup or restore memory data
- User wants to bulk delete multiple entries

## Available MCP Tools

### memory_read
Read all memory entries or a specific one by title.
- Call at session start to load context
- Use with title parameter to search specific entries
- Returns structured memory blocks with timestamps

### memory_edit
Create or update a memory entry.
- Use clear PascalCase titles: UserPreferences, ProjectContext, TechStack
- Content should be structured and comprehensive
- Tags help categorize: ['project', 'preferences']

### memory_delete
Delete a memory entry by title.
- Use when user wants to forget something
- Title must match exactly (case-insensitive)

### memory_search
Search memory entries by query.
- Use to find specific information across all entries
- Returns matching entries with context

### memory_batch
Create or update multiple memory entries at once.
- Use for bulk imports or initial setup
- Pass array of entries with title, content, and optional tags

### bulk_delete
Delete multiple memory entries at once using various methods.
- **method**: 'titles', 'tags', or 'pattern'
- **value**: comma-separated titles/tags or search pattern
- **use_regex**: true for regex pattern matching
- **dry_run**: true to preview without deleting

Examples:
\`\`\`json
{'method': 'titles', 'value': 'Old Entry,Test Data', 'dry_run': true}
{'method': 'tags', 'value': 'deprecated,old,temp'}
{'method': 'pattern', 'value': 'test.*', 'use_regex': true}
\`\`\`

### backup_create
Create a backup of the current memory.
- **include_deleted**: true to include deleted entries
- Returns backup file path

### backup_restore
Restore memory from a backup file.
- **backup_path**: path to backup file
- **overwrite**: true to overwrite existing memory

### backup_list
List available backup files.
- Shows filename, memory ID, entry count, size, creation date

### backup_delete
Delete a specific backup file.
- **backup_path**: path to backup file to delete

### backup_cleanup
Clean up old backup files, keeping only the most recent ones.
- **keep_count**: number of backups to keep (default: 10)

### memory_stats
Get memory statistics and analytics.
- Returns entry count, file size, oldest/newest entries, tags

### memory_sync
Validate memory integrity and get stats.
- Returns entry count, file size, last updated
- Use to verify memory state

## Memory Organization

Recommended title structure:
- UserPreferences: Tone, language, style preferences
- ProjectContext: Current project, stack, goals
- TechStack: Languages, frameworks, tools
- Conventions: Code style, naming, patterns
- ImportantDecisions: Architectural or key decisions
- PersonalInfo: User details if relevant
- SessionNotes: Temporary session-specific information
- ArchivedData: Old but potentially useful information

## Workflow

### Basic Workflow
1. **Session Start**: Always call memory_read to load context
2. **User Shares Info**: Call memory_edit to persist
3. **User Requests Forget**: Call memory_delete
4. **Verify State**: Call memory_sync

### Advanced Workflow
1. **Session Start**: Call memory_read to load context
2. **Regular Cleanup**: Use bulk_delete with dry_run to clean old entries
3. **Before Major Changes**: Call backup_create
4. **Bulk Operations**: Use memory_batch for multiple entries
5. **Search & Filter**: Use memory_search to find specific information
6. **Maintenance**: Use backup_cleanup regularly

## Bulk Operations Guide

### Safe Bulk Deletion
Always use dry_run first:
\`\`\`json
{'tool': 'bulk_delete', 'arguments': {'method': 'tags', 'value': 'old,test', 'dry_run': true}}
\`\`\`

Then execute if correct:
\`\`\`json
{'tool': 'bulk_delete', 'arguments': {'method': 'tags', 'value': 'old,test'}}
\`\`\`

### Backup Management
Create backup before bulk operations:
\`\`\`json
{'tool': 'backup_create', 'arguments': {}}
\`\`\`

List available backups:
\`\`\`json
{'tool': 'backup_list', 'arguments': {}}
\`\`\`

Restore if needed:
\`\`\`json
{'tool': 'backup_restore', 'arguments': {'backup_path': '/path/to/backup.json'}}
\`\`\`

## Best Practices

1. **Always backup before bulk operations**
2. **Use dry_run for bulk delete to verify**
3. **Organize entries with consistent tags**
4. **Regular cleanup of outdated entries**
5. **Use search instead of reading all entries for large memories**
6. **Maintain regular backup schedule**

## Common Use Cases

### Project Management
- Store project context, decisions, and progress
- Archive completed phases with tags
- Search for specific decisions or information

### Personal Assistant
- Remember user preferences and habits
- Store important dates and information
- Clean up outdated personal data

### Research & Learning
- Store research findings and sources
- Tag by topic and relevance
- Bulk delete outdated research

### Development
- Remember code conventions and patterns
- Store debugging solutions
- Archive old implementation approaches
`;

type SkillLocation = 'global' | 'workspace' | 'none';

/**
 * Get skill paths for a specific agent type.
 *
 * Cross-platform paths using Node.js:
 * - os.homedir() returns:
 *   - Linux:   /home/username
 *   - macOS:   /Users/username
 *   - Windows: C:\Users\username
 * - path.join() uses correct separator for each OS
 *
 * @see https://agentskills.io/specification
 */
function getSkillPaths(agentType: string): { global: string; workspace: string } {
  const known = KNOWN_AGENTS[agentType as keyof typeof KNOWN_AGENTS];
  if (known) {
    return {
      global: path.join(os.homedir(), known.skillPaths.global, 'memlink', 'SKILL.md'),
      workspace: path.join(process.cwd(), known.skillPaths.projectLocal, 'memlink', 'SKILL.md'),
    };
  }
  // Default to custom agent paths
  return {
    global: path.join(os.homedir(), '.agents', 'skills', 'memlink', 'SKILL.md'),
    workspace: path.join(process.cwd(), '.agents', 'skills', 'memlink', 'SKILL.md'),
  };
}

function writeSkillScaffold(location: SkillLocation, agentType: string): string | null {
  if (location === 'none') return null;

  const paths = getSkillPaths(agentType);
  const skillPath = location === 'global' ? paths.global : paths.workspace;
  const skillDir = path.dirname(skillPath);

  try {
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }
    fs.writeFileSync(skillPath, MEMLINK_SKILL, 'utf-8');
    return skillPath;
  } catch {
    return null;
  }
}

async function promptSkillLocation(agentType: string): Promise<SkillLocation> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const paths = getSkillPaths(agentType);
  const globalDisplay = paths.global.replace(os.homedir(), '~');
  const workspaceDisplay = paths.workspace.replace(process.cwd(), '.');

  console.log();
  console.log(colors.white('  Where do you want to install the memlink skill?'));
  console.log();
  console.log(`  ${colors.white('1.')} Global     ${colors.dim(`(${globalDisplay})`)}`);
  console.log(`  ${colors.white('2.')} Workspace   ${colors.dim(`(${workspaceDisplay})`)}`);
  console.log(`  ${colors.white('3.')} Skip        ${colors.dim("(don't install skill)")}`);
  console.log();

  return new Promise((resolve) => {
    rl.question(colors.white('  Choice [1-3]: '), (answer) => {
      rl.close();
      const choice = answer.trim();
      if (choice === '1' || choice === '') resolve('global');
      else if (choice === '2') resolve('workspace');
      else resolve('none');
    });
  });
}

// ─── memlink connect ─────────────────────────────────────────────────────

program
  .command('connect')
  .description('Interactive: select agent/memory and copy MCP config to clipboard')
  .action(async () => {
    console.log('\n' + LOGO_SMALL + '\n');

    const config = loadConfig();
    const allOptions: ArrowOption[] = [
      ...config.agents.map((a) => ({ id: a.agentId, label: a.agentName, desc: 'Agent' })),
      ...config.universalMemories.map((m) => ({
        id: m.memoryId,
        label: m.memoryName,
        desc: 'Universal',
      })),
    ];

    if (allOptions.length === 0) {
      console.log(info('no agents', 'No agents or memories found.'));
      console.log(dimLine('Run: memlink memory create MyProject'));
      console.log();
      return;
    }

    const selectedId = await promptArrow(allOptions, 'Select agent or memory:');
    if (!selectedId) {
      console.log(dimLine('Cancelled.\n'));
      return;
    }

    const agent = config.agents.find((a) => a.agentId === selectedId);
    const memory = config.universalMemories.find((m) => m.memoryId === selectedId);
    const isAgent = !!agent;
    const name = isAgent ? agent!.agentName : memory!.memoryName;
    const token = isAgent ? agent!.token : memory!.token;

    const host = config.serverHost ?? DEFAULT_HOST;
    const port = config.serverPort ?? DEFAULT_PORT;
    const ide = detectIDE();
    const mcpConfigPath = getMcpConfigPath(ide);
    const mcpConfig = {
      mcpServers: {
        memlink: {
          url: `http://${host}:${port}/mcp`,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    };

    const jsonStr = JSON.stringify(mcpConfig, null, 2);
    const copied = copyToClipboard(jsonStr);

    console.log();
    console.log(info(name));
    console.log(kv('MCP URL', `http://${host}:${port}/mcp`));
    console.log(kv('Token', token?.substring(0, 20) + '...'));
    console.log(kv('IDE', ide));
    console.log(kv('Config', mcpConfigPath.replace(os.homedir(), '~')));
    console.log();
    console.log(subheading('MCP JSON:'));
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
    if (copied) {
      console.log(dimLine('Copied to clipboard'));
    }
    console.log();
    console.log(dimLine('Start server: memlink serve'));
    console.log();
  });

// ─── memlink init ───────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialize memlink in the current system')
  .action(async () => {
    console.log('\n' + LOGO);
    const config = loadConfig();
    console.log(okBadge('memlink initialized\n'));

    const createNow = await promptYesNo('Create an agent now?', true);
    console.log();

    if (createNow) {
      const agentOptions = Object.entries(KNOWN_AGENTS).map(([key, v]) => ({
        id: key,
        label: v.name,
        desc: v.description,
      }));

      const selectedType = await promptArrow(agentOptions, 'Select agent type:');
      if (!selectedType) {
        console.log(dimLine('Cancelled.\n'));
        return;
      }

      const customName =
        selectedType === 'custom'
          ? await new Promise<string>((resolve) => {
              const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
              rl.question(prompt('Agent name: '), (ans) => {
                rl.close();
                resolve(ans.trim() || 'Custom');
              });
            })
          : undefined;

      try {
        const agent = createAgent(selectedType, customName);
        console.log(okBadge('Agent created\n'));

        const location = await promptSkillLocation(selectedType);
        writeSkillScaffold(location, selectedType);

        const host = config.serverHost ?? DEFAULT_HOST;
        const port = config.serverPort ?? DEFAULT_PORT;
        const mcpConfig = {
          mcpServers: {
            memlink: {
              url: `http://${host}:${port}/mcp`,
              headers: { Authorization: `Bearer ${agent.token}` },
            },
          },
        };
        const jsonStr = JSON.stringify(mcpConfig, null, 2);
        const copied = copyToClipboard(jsonStr);

        console.log(kv('Agent', agent.agentName));
        console.log(kv('ID', agent.agentId));
        console.log(kv('Token', agent.token));
        console.log();
        console.log(subheading('MCP JSON:'));
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
        if (copied) {
          console.log(dimLine('Automatically copied to clipboard'));
        }
        console.log();
        console.log(dimLine('Start server: memlink serve'));
        console.log();
        return;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(err('Failed', message));
        return;
      }
    }

    const skillLocation = await promptSkillLocation('custom');
    writeSkillScaffold(skillLocation, 'custom');

    console.log(kv('Directory', getMemlinkDir()));
    console.log();
    console.log(subheading('Next steps:'));
    console.log(dimLine(`1. Create an agent:  memlink agent create windsurf`));
    console.log(dimLine(`2. Start the server: memlink serve`));
    console.log(dimLine(`3. Connect: memlink connect\n`));
  });

// ─── Sync Commands ─────────────────────────────────────────────────────────────

program
  .command('sync')
  .description('Manage native memory synchronization')
  .option('--target <target>', 'Sync target (windsurf, cursor)')
  .option(
    '--direction <direction>',
    'Sync direction (memlink-to-native, native-to-memlink, bidirectional)'
  )
  .option('--enable', 'Enable sync for target')
  .option('--disable', 'Disable sync for target')
  .option('--status', 'Show sync status')
  .action(async (options) => {
    const targets = detectNativeMemoryTargets();

    if (options.status || (!options.target && !options.enable && !options.disable)) {
      console.log(heading('Native Memory Sync Status'));

      const rows = [
        [
          c.bold('Target'),
          c.bold('Available'),
          c.bold('Enabled'),
          c.bold('Direction'),
          c.bold('Path'),
        ],
        ...targets.map((target) => [
          target.name,
          target.available ? colors.primary('Yes') : colors.accent('No'),
          target.config.enabled ? colors.primary('Yes') : colors.dim('No'),
          target.config.direction,
          target.config.nativePath,
        ]),
      ];

      console.log(table(rows));
      console.log();

      if (!targets.some((t) => t.available)) {
        console.log(info('no targets', 'Install Windsurf or Cursor to enable sync.'));
        console.log();
      }

      return;
    }

    if (options.target) {
      const target = targets.find((t) => t.name === options.target);
      if (!target) {
        console.error(
          err(
            `Unknown target: ${options.target}`,
            `Available targets: ${targets.map((t) => t.name).join(', ')}`
          )
        );
        process.exit(1);
      }

      if (!target.available) {
        console.error(err(`${target.name} is not available on this system.`));
        process.exit(1);
      }

      if (options.enable) {
        if (!validateNativeMemoryPath(target.config.nativePath)) {
          console.error(
            err(`Cannot access ${target.name} memory directory:`, `  ${target.config.nativePath}`)
          );
          process.exit(1);
        }

        target.config.enabled = true;
        if (options.direction) {
          target.config.direction = options.direction;
        }

        console.log(okBadge(`Sync enabled for ${target.name}`));
        console.log(dimLine(`Direction: ${target.config.direction}`));
        console.log(dimLine(`Path: ${target.config.nativePath}`));
        console.log();
        console.log(dimLine(`Run 'memlink sync --target ${target.name}' to sync now.`));
      } else if (options.disable) {
        console.log(okBadge(`Sync disabled for ${target.name}`));
      } else {
        console.log(info('syncing', `Syncing with ${target.name}...`));

        try {
          const result = await performSync(target);

          if (result.success) {
            console.log(okBadge(`Sync completed - ${result.synced} entries`));
            if (result.conflicts > 0) {
              console.log(info('conflicts', String(result.conflicts)));
            }
          } else {
            console.error(err('Sync failed'));
            result.errors.forEach((error) => {
              console.log(dimLine(`  ${error}`));
            });
          }
        } catch (error) {
          console.error(err('Sync failed', String(error)));
        }
      }
    }
  });

// ─── Sync Implementation ─────────────────────────────────────────────────────

async function performSync(target: SyncTarget): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    synced: 0,
    conflicts: 0,
    errors: [],
  };

  try {
    const config = loadConfig();
    const universalMemories = config.universalMemories;

    if (universalMemories.length === 0) {
      result.errors.push('No universal memories found');
      return result;
    }

    // For now, sync the first universal memory
    const memory = universalMemories[0];
    const memlinkEntries = readMemory(memory.memoryId);

    if (
      target.config.direction === 'memlink-to-native' ||
      target.config.direction === 'bidirectional'
    ) {
      // Convert Memlink to native format
      const nativeMemories = convertMemlinkToNative(memlinkEntries);

      // Write to native format
      if (target.name === 'windsurf') {
        writeWindsurfFormat(nativeMemories, target.config.nativePath);
      } else if (target.name === 'cursor') {
        writeCursorFormat(nativeMemories, target.config.nativePath);
      }

      result.synced = nativeMemories.length;
    }

    if (
      target.config.direction === 'native-to-memlink' ||
      target.config.direction === 'bidirectional'
    ) {
      // Read native memories
      let nativeMemories: NativeMemory[] = [];

      if (target.name === 'windsurf') {
        nativeMemories = readWindsurfFormat(target.config.nativePath);
      } else if (target.name === 'cursor') {
        nativeMemories = readCursorFormat(target.config.nativePath);
      }

      // Convert to Memlink format and import
      if (nativeMemories.length > 0) {
        const memlinkFormat = convertNativeToMemlink(nativeMemories);

        for (const entry of memlinkFormat) {
          upsertMemoryEntry(memory.memoryId, entry.title, entry.content, entry.tags);
        }

        result.synced += nativeMemories.length;
      }
    }

    result.success = true;

    // Update last sync time
    target.config.lastSync = new Date().toISOString();
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

// ─── Bulk Delete Commands ───────────────────────────────────────────────────────

program
  .command('bulk-delete')
  .description('Delete multiple memory entries at once')
  .argument('<memory-id>', 'Memory ID')
  .option('--titles <titles>', 'Comma-separated list of titles to delete')
  .option('--tags <tags>', 'Delete entries with these tags (comma-separated)')
  .option('--pattern <pattern>', 'Delete entries matching pattern in title or content')
  .option('--regex', 'Use pattern as regular expression')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .action(async (memoryId, options) => {
    try {
      if (!options.titles && !options.tags && !options.pattern) {
        console.error(err('Must specify one of --titles, --tags, or --pattern'));
        process.exit(1);
      }

      let result;
      const isDryRun = options.dryRun;

      if (options.titles) {
        const titles = options.titles.split(',').map((t) => t.trim());
        if (isDryRun) {
          const memory = readMemory(memoryId);
          const titlesLower = titles.map((t) => t.toLowerCase());
          const toDelete = memory.entries.filter((e) =>
            titlesLower.includes(e.title.toLowerCase())
          );
          console.log(info('dry run', `Would delete ${toDelete.length} entries:`));
          toDelete.forEach((e) => console.log(dimLine(`- ${e.title}`)));
          return;
        }
        result = bulkDeleteMemories(memoryId, titles);
        console.log(okBadge(`Deleted ${result.deleted} entries`));
        if (result.notFound.length > 0) {
          console.log(info('not found', result.notFound.join(', ')));
        }
      } else if (options.tags) {
        const tags = options.tags.split(',').map((t) => t.trim());
        if (isDryRun) {
          const memory = readMemory(memoryId);
          const tagsLower = tags.map((t) => t.toLowerCase());
          const toDelete = memory.entries.filter((e) =>
            e.tags.some((tag) => tagsLower.includes(tag.toLowerCase()))
          );
          console.log(info('dry run', `Would delete ${toDelete.length} entries:`));
          toDelete.forEach((e) =>
            console.log(dimLine(`- ${e.title} (tags: ${e.tags.join(', ')})`))
          );
          return;
        }
        result = bulkDeleteMemoriesByTags(memoryId, tags);
        console.log(okBadge(`Deleted ${result.deleted} entries`));
        result.entries.forEach((e) => console.log(dimLine(`- ${e.title}`)));
      } else if (options.pattern) {
        if (isDryRun) {
          const memory = readMemory(memoryId);
          let toDelete;
          if (options.regex) {
            try {
              const sanitizedPattern = options.pattern
                .replace(/[+*()[\]{}|.^$?\\]/g, '\\$&')
                .replace(/\\+/g, '+')
                .replace(/\\\*/g, '*')
                .replace(/\\\?/g, '?');
              const regex = new RegExp(sanitizedPattern, 'i');
              toDelete = memory.entries.filter((e) => regex.test(e.title) || regex.test(e.content));
            } catch (error) {
              console.error(err('Invalid regex', String(error)));
              process.exit(1);
            }
          } else {
            const patternLower = options.pattern.toLowerCase();
            toDelete = memory.entries.filter(
              (e) =>
                e.title.toLowerCase().includes(patternLower) ||
                e.content.toLowerCase().includes(patternLower)
            );
          }
          console.log(info('dry run', `Would delete ${toDelete.length} entries:`));
          toDelete.forEach((e) => console.log(dimLine(`- ${e.title}`)));
          return;
        }
        result = bulkDeleteMemoriesByPattern(memoryId, options.pattern, options.regex);
        console.log(okBadge(`Deleted ${result.deleted} entries`));
        result.entries.forEach((e) => console.log(dimLine(`- ${e.title}`)));
      }
    } catch (error) {
      console.error(
        err('Bulk delete failed', error instanceof Error ? error.message : String(error))
      );
      process.exit(1);
    }
  });

// ─── Backup Commands ─────────────────────────────────────────────────────────────

program
  .command('backup')
  .description('Create and manage memory backups')
  .argument('[memory-id]', 'Memory ID (optional, defaults to all memories)')
  .option('--output <path>', 'Output path for backup file')
  .option('--include-deleted', 'Include deleted entries in backup')
  .action(async (memoryId, options) => {
    try {
      if (memoryId) {
        const backupPath = saveBackup(memoryId, options.output);
        console.log(okBadge(`Backup created: ${backupPath}`));
      } else {
        const config = loadConfig();
        for (const memory of config.universalMemories) {
          const backupPath = saveBackup(memory.memoryId, options.output);
          console.log(okBadge(`Backup created: ${backupPath}`));
        }
      }
    } catch (error) {
      console.error(err('Backup failed', error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('restore')
  .description('Restore memory from backup')
  .argument('<backup-path>', 'Path to backup file')
  .option('--memory-id <id>', "Target memory ID (optional, uses backup's memory ID)")
  .option('--overwrite', 'Overwrite existing memory')
  .action(async (backupPath, options) => {
    try {
      const result = restoreBackup(backupPath, options.memoryId, options.overwrite);
      console.log(okBadge(`Restored ${result.restored} entries to memory '${result.memoryId}'`));
    } catch (error) {
      console.error(err('Restore failed', error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('backups')
  .description('List available backups')
  .argument('[memory-id]', 'Filter by memory ID (optional)')
  .action(async (memoryId) => {
    try {
      const backups = listBackups(memoryId);

      if (backups.length === 0) {
        console.log(dimLine('No backups found'));
        return;
      }

      const rows = [
        [
          c.bold('Filename'),
          c.bold('Memory ID'),
          c.bold('Entries'),
          c.bold('Size'),
          c.bold('Created'),
        ],
        ...backups.map((backup) => [
          backup.filename,
          backup.memoryId,
          backup.entryCount.toString(),
          `${(backup.size / 1024).toFixed(1)}KB`,
          backup.createdAt.toLocaleString(),
        ]),
      ];

      console.log(table(rows));
    } catch (error) {
      console.error(
        err('Failed to list backups', error instanceof Error ? error.message : String(error))
      );
      process.exit(1);
    }
  });

program
  .command('delete-backup')
  .description('Delete a backup file')
  .argument('<backup-path>', 'Path to backup file')
  .action(async (backupPath) => {
    try {
      const success = deleteBackup(backupPath);
      if (success) {
        console.log(okBadge(`Backup deleted: ${backupPath}`));
      } else {
        console.error(err(`Backup not found: ${backupPath}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(
        err('Delete backup failed', error instanceof Error ? error.message : String(error))
      );
      process.exit(1);
    }
  });

program
  .command('cleanup')
  .description('Clean up old backups')
  .argument('[memory-id]', 'Memory ID (optional, defaults to all)')
  .option('--keep <count>', 'Number of backups to keep', '10')
  .action(async (memoryId, options) => {
    try {
      const keepCount = parseInt(options.keep);
      const result = cleanupOldBackups(memoryId, keepCount);

      console.log(okBadge('Cleanup completed'));
      console.log(dimLine(`Kept: ${result.kept} backups`));
      console.log(dimLine(`Deleted: ${result.deleted} backups`));
    } catch (error) {
      console.error(err('Cleanup failed', error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show detailed memory statistics with charts')
  .argument('[memory-id]', 'Memory ID (optional, shows all memories)')
  .option('--chart', 'Show ASCII charts')
  .option('--json', 'Output in JSON format')
  .action(async (memoryId, options) => {
    try {
      if (memoryId) {
        const stats = getDetailedStats(memoryId);
        displayMemoryStats(stats, options.chart, options.json);
      } else {
        const allStats = getAllMemoriesStats();
        if (allStats.length === 0) {
          console.log(dimLine('No memories found'));
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(allStats, null, 2));
          return;
        }

        console.log(heading('Memory Statistics Overview'));

        const summaryRows = [
          [
            c.bold('Memory'),
            c.bold('Entries'),
            c.bold('Size'),
            c.bold('Avg Size'),
            c.bold('Efficiency'),
            c.bold('Growth/Day'),
          ],
          ...allStats.map((stats) => [
            stats.memoryName || stats.memoryId,
            stats.entries.toString(),
            `${(stats.size / 1024).toFixed(1)}KB`,
            `${(stats.averageEntrySize / 1024).toFixed(1)}KB`,
            `${(stats.memoryEfficiency * 100).toFixed(1)}%`,
            stats.growthRate.toFixed(1),
          ]),
        ];

        console.log(table(summaryRows));
        console.log();

        const totalEntries = allStats.reduce((sum, s) => sum + s.entries, 0);
        const totalSize = allStats.reduce((sum, s) => sum + s.size, 0);
        const avgEfficiency =
          allStats.reduce((sum, s) => sum + s.memoryEfficiency, 0) / allStats.length;

        console.log(info('Total', `Across all memories`));
        console.log(dimLine(`Entries: ${totalEntries}`));
        console.log(dimLine(`Size: ${(totalSize / 1024).toFixed(1)}KB`));
        console.log(dimLine(`Avg Efficiency: ${(avgEfficiency * 100).toFixed(1)}%`));

        if (options.chart && allStats.length > 0) {
          console.log();
          console.log(subheading('Size Distribution Chart:'));
          displaySizeChart(allStats);
        }
      }
    } catch (error) {
      console.error(err('Stats failed', error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ─── Stats Display Functions ─────────────────────────────────────────────────────

function displayMemoryStats(
  stats: DetailedMemoryStats,
  showChart: boolean = false,
  asJson: boolean = false
): void {
  if (asJson) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log(heading(`Memory Statistics: ${stats.memoryName || stats.memoryId}`));

  console.log(subheading('Basic Information:'));
  console.log(kv('Entries', String(stats.entries)));
  console.log(kv('Size', `${(stats.size / 1024).toFixed(1)}KB`));
  console.log(kv('Average Entry Size', `${(stats.averageEntrySize / 1024).toFixed(1)}KB`));
  console.log(kv('Memory Efficiency', `${(stats.memoryEfficiency * 100).toFixed(1)}%`));
  console.log(kv('Growth Rate', `${stats.growthRate.toFixed(1)} entries/day`));
  console.log(kv('Created', new Date(stats.createdAt).toLocaleDateString()));
  if (stats.oldestestEntry) {
    console.log(kv('Oldest Entry', new Date(stats.oldestestEntry).toLocaleDateString()));
  }
  if (stats.newestEntry) {
    console.log(kv('Newest Entry', new Date(stats.newestEntry).toLocaleDateString()));
  }
  console.log();

  if (stats.tagDistribution.length > 0) {
    console.log(subheading('Tag Distribution:'));
    const tagRows = [
      [c.bold('Tag'), c.bold('Count'), c.bold('Size')],
      ...stats.tagDistribution
        .slice(0, 10)
        .map((tag) => [tag.tag, tag.count.toString(), `${(tag.size / 1024).toFixed(1)}KB`]),
    ];
    console.log(table(tagRows));
    console.log();
  }

  console.log(subheading('Entry Size Distribution:'));
  const sizeRows = [
    [c.bold('Size Range'), c.bold('Count'), c.bold('Percentage')],
    ...stats.entrySizeDistribution.map((range) => {
      const percentage =
        stats.entries > 0 ? ((range.count / stats.entries) * 100).toFixed(1) : '0.0';
      return [range.range, range.count.toString(), `${percentage}%`];
    }),
  ];
  console.log(table(sizeRows));
  console.log();

  if (stats.largestEntries.length > 0) {
    console.log(subheading('Largest Entries (Top 10):'));
    const largestRows = [
      [c.bold('Title'), c.bold('Size'), c.bold('Tags')],
      ...stats.largestEntries.map((entry) => [
        entry.title.length > 30 ? entry.title.substring(0, 27) + '...' : entry.title,
        `${(entry.size / 1024).toFixed(1)}KB`,
        entry.tags.join(', ') || 'none',
      ]),
    ];
    console.log(table(largestRows));
    console.log();
  }

  if (stats.activityTimeline.length > 0) {
    console.log(subheading('Recent Activity (Last 30 Days):'));
    const activityRows = [
      [c.bold('Date'), c.bold('Entries')],
      ...stats.activityTimeline.slice(-10).map((day) => [day.date, day.entries.toString()]),
    ];
    console.log(table(activityRows));
    console.log();
  }

  if (showChart) {
    console.log(subheading('Visual Charts:'));

    if (stats.tagDistribution.length > 0) {
      console.log(dimLine('\nTag Distribution:'));
      displayBarChart(
        stats.tagDistribution.slice(0, 8).map((t) => ({ label: t.tag, value: t.count }))
      );
    }

    console.log(dimLine('\nSize Distribution:'));
    displayBarChart(stats.entrySizeDistribution.map((d) => ({ label: d.range, value: d.count })));

    if (stats.activityTimeline.length > 0) {
      console.log(dimLine('\nActivity Timeline:'));
      displayActivityChart(stats.activityTimeline.slice(-14));
    }
  }
}

function displayBarChart(data: Array<{ label: string; value: number }>): void {
  const maxValue = Math.max(...data.map((d) => d.value));
  const barWidth = 30;

  data.forEach((item) => {
    const barLength = Math.round((item.value / maxValue) * barWidth);
    const bar = '█'.repeat(barLength) + '░'.repeat(barWidth - barLength);
    console.log(colors.dim(`${item.label.padEnd(12)} |${colors.primary(bar)} ${item.value}`));
  });
}

function displayActivityChart(timeline: Array<{ date: string; entries: number }>): void {
  const maxValue = Math.max(...timeline.map((d) => d.entries));
  const barWidth = 20;

  timeline.forEach((day) => {
    const barLength = Math.round((day.entries / maxValue) * barWidth);
    const bar = '█'.repeat(barLength) + '░'.repeat(barWidth - barLength);
    const shortDate = new Date(day.date).toLocaleDateString('en', {
      month: 'short',
      day: 'numeric',
    });
    console.log(colors.dim(`${shortDate.padEnd(6)} |${colors.primary(bar)} ${day.entries}`));
  });
}

function displaySizeChart(allStats: DetailedMemoryStats[]): void {
  const maxSize = Math.max(...allStats.map((s) => s.size));
  const barWidth = 25;

  allStats.forEach((stats) => {
    const barLength = Math.round((stats.size / maxSize) * barWidth);
    const bar = '█'.repeat(barLength) + '░'.repeat(barWidth - barLength);
    const name = (stats.memoryName || stats.memoryId).substring(0, 12);
    console.log(
      colors.dim(`${name.padEnd(12)} |${colors.muted(bar)} ${(stats.size / 1024).toFixed(1)}KB`)
    );
  });
}

program
  .command('update')
  .description('Update memlink to the latest version')
  .option('--check', 'Check for updates without installing')
  .action(async (options) => {
    console.log(info('checking', 'Checking for updates...'));

    const { updateAvailable, currentVersion, latestVersion } = await checkForUpdates();

    if (!updateAvailable) {
      console.log(okBadge('memlink is up to date'));
      console.log(dimLine(`Current version: ${currentVersion}`));
      return;
    }

    console.log(info('update available', `${currentVersion} → ${latestVersion}`));

    if (options.check) {
      console.log(dimLine("Run 'memlink update' to install the update."));
      return;
    }

    console.log(info('installing', 'Downloading and installing update...'));

    try {
      await performUpdate();
      console.log(okBadge('Update installed successfully'));
      console.log(colors.primary(`Updated to version ${latestVersion}`));
      console.log(dimLine('Please restart memlink to use the new version.'));
    } catch (error) {
      console.error(err('Update failed', error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

// ─── Memory Selector TUI ─────────────────────────────────────────────────────────

interface MemoryOption {
  id: string;
  name: string;
  type: 'memory' | 'agent';
  entries: number;
  updatedAt: string;
}

async function showMemorySelector(): Promise<void> {
  const config = loadConfig();

  // Build list of all memories and agents
  const options: MemoryOption[] = [];

  // Add universal memories
  for (const mem of config.universalMemories) {
    try {
      const entries = readMemory(mem.memoryId);
      options.push({
        id: mem.memoryId,
        name: mem.memoryName,
        type: 'memory',
        entries: entries.length,
        updatedAt: mem.lastSeen || mem.createdAt,
      });
    } catch {
      options.push({
        id: mem.memoryId,
        name: mem.memoryName,
        type: 'memory',
        entries: 0,
        updatedAt: mem.createdAt,
      });
    }
  }

  // Add agents
  for (const agent of config.agents) {
    try {
      const entries = readMemory(agent.agentId);
      options.push({
        id: agent.agentId,
        name: agent.agentName,
        type: 'agent',
        entries: entries.length,
        updatedAt: agent.lastSeen || agent.createdAt,
      });
    } catch {
      options.push({
        id: agent.agentId,
        name: agent.agentName,
        type: 'agent',
        entries: 0,
        updatedAt: agent.createdAt,
      });
    }
  }

  if (options.length === 0) {
    console.log('\n' + LOGO_SMALL + '\n');
    console.log(info('no memories', 'No memories found.'));
    console.log(dimLine('Create one with: memlink memory create'));
    console.log();
    return;
  }

  // Interactive selection
  let selectedIndex = 0;
  let searchQuery = '';

  console.clear();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Enable raw mode for arrow key handling
  process.stdin.setRawMode(true);

  const filteredOptions = () => {
    if (!searchQuery) return options;
    const q = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.name.toLowerCase().includes(q) ||
        opt.id.toLowerCase().includes(q) ||
        opt.type.toLowerCase().includes(q)
    );
  };

  const render = () => {
    const opts = filteredOptions();
    const displayOpts = opts.slice(0, 10);

    console.clear();
    console.log(heading('Seleccionar Memoria'));
    console.log(
      dimLine('Escribe para buscar, flechas para navegar, Enter para seleccionar, q para salir')
    );
    console.log();
    console.log(kv('Busqueda', searchQuery || '(todas)'));
    console.log();

    displayOpts.forEach((opt) => {
      const isSelected = opts[selectedIndex]?.id === opt.id;
      const prefix = isSelected ? colors.primary('  ▶ ') : colors.dim('    ');
      const typeLabel = opt.type === 'memory' ? colors.muted('Memoria') : colors.muted('Agente');
      const entryLabel = opt.entries === 1 ? 'entrada' : 'entradas';

      console.log(
        `${prefix}${colors.white(opt.name)} ${colors.dim(`[${typeLabel} · ${opt.entries} ${entryLabel}]`)}`
      );
      console.log(dimLine(`ID: ${opt.id}`));
      console.log();
    });

    if (opts.length > 10) {
      console.log(dimLine(`... y ${opts.length - 10} más`));
    }
  };

  render();

  const keyHandler = (chunk: Buffer) => {
    const key = chunk.toString();

    if (key === '\u0003') {
      // Ctrl+C
      process.exit(0);
    }

    if (key === 'q') {
      process.stdin.setRawMode(false);
      rl.close();
      console.clear();
      return;
    }

    if (key === '\r') {
      // Enter
      const opts = filteredOptions();
      if (opts[selectedIndex]) {
        process.stdin.setRawMode(false);
        rl.close();
        showMemoryContent(opts[selectedIndex].id, opts[selectedIndex].name);
        return;
      }
    }

    if (key === '\u001b[A') {
      // Arrow up
      selectedIndex = Math.max(0, selectedIndex - 1);
    } else if (key === '\u001b[B') {
      // Arrow down
      const opts = filteredOptions();
      selectedIndex = Math.min(opts.length - 1, selectedIndex + 1);
    } else if (key === '\u007f') {
      // Backspace
      searchQuery = searchQuery.slice(0, -1);
      selectedIndex = 0;
    } else if (key.length === 1) {
      searchQuery += key;
      selectedIndex = 0;
    }

    render();
  };

  process.stdin.on('data', keyHandler);
}

function showMemoryContent(memoryId: string, memoryName: string): void {
  console.clear();
  console.log(heading(memoryName));
  console.log(kv('ID', memoryId));
  console.log();

  try {
    const entries = readMemory(memoryId);

    if (entries.length === 0) {
      console.log(info('empty', 'Esta memoria está vacía.'));
      console.log();
      return;
    }

    console.log(subheading('Entradas:'));
    console.log();

    entries.forEach((entry, i) => {
      console.log(dimLine(`${i + 1}. `) + colors.white(entry.title));
      console.log(dimLine(`    Tags: ${entry.tags?.join(', ') || 'sin tags'}`));
      const preview = entry.content.substring(0, 80).replace(/\n/g, ' ');
      console.log(dimLine(`    ${preview}${entry.content.length > 80 ? '...' : ''}`));
      console.log();
    });

    console.log(dimLine('Presiona cualquier tecla para salir...'));

    process.stdin.setRawMode(true);
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
    });
  } catch (err) {
    console.error(err('Error al leer memoria', String(err)));
  }
}

program.parse(process.argv);
