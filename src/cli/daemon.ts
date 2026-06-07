import path from 'path';
import os from 'os';
import fs from 'fs';
import { spawn } from 'child_process';

export interface DaemonSpawnOptions {
  execPath: string;
  argv1: string | undefined;
  childArgs: string[];
  env: NodeJS.ProcessEnv;
  debug?: boolean;
}

export interface DaemonSpawnResult {
  child: ReturnType<typeof spawn>;
  vbsPath: string;
  isStandalone: boolean;
}

/**
 * Build a VBScript that launches the memlink grandchild process detached.
 *
 * The previous template used `"" & PATH & "" & PATH` which in VBScript
 * concatenates to `PATHPATH` (no space) because `& ""` is a no-op.
 * The fix uses `chr(34)` to quote each token and a literal `" "` between
 * tokens. Also skips argv[1] for standalone Bun --compile binaries
 * (where argv[1] is already the first user arg like "serve") to avoid
 * double-args.
 */
export function buildVbscript(execPath: string, argv1: string | undefined, args: string[]): string {
  const isStandalone = !argv1?.endsWith('.js');
  const tokens = isStandalone ? [execPath, ...args] : [execPath, argv1!, ...args];

  const vbsCmd = tokens
    .map((t) => {
      const esc = t.replace(/\\/g, '\\\\').replace(/"/g, '""');
      return `chr(34) & "${esc}" & chr(34)`;
    })
    .join(' & " " & ');

  return `Set WshShell = CreateObject("WScript.Shell")\nWshShell.Run ${vbsCmd}, 0, False\n`;
}

/**
 * Spawn the memlink daemon detached, cross-platform.
 * - Unix: child_process.spawn with detached:true + unref()
 * - Windows: writes a .vbs wrapper, spawns wscript.exe (hidden, no wait)
 */
export function spawnDetached(opts: DaemonSpawnOptions): DaemonSpawnResult {
  const { execPath, argv1, childArgs, env, debug = false } = opts;
  const allArgs = [...childArgs, '--daemon-child'];
  let child: ReturnType<typeof spawn>;
  let vbsPath = '';

  if (process.platform === 'win32') {
    vbsPath = path.join(os.tmpdir(), `memlink-daemon-${process.pid}.vbs`);
    const vbs = buildVbscript(execPath, argv1, allArgs);
    fs.writeFileSync(vbsPath, vbs, 'utf-8');

    if (debug) {
      console.error(`[memlink] VBScript at: ${vbsPath}\n${vbs}`);
    }

    child = spawn('wscript.exe', [vbsPath], {
      stdio: 'ignore',
      detached: true,
      env,
      windowsHide: true,
    });

    const cleanupMs = debug ? 60_000 : 5_000;
    setTimeout(() => {
      try {
        fs.unlinkSync(vbsPath);
      } catch {
        /* ignore */
      }
    }, cleanupMs);
  } else {
    child = spawn(execPath, [argv1!, ...allArgs], {
      stdio: 'ignore',
      detached: true,
      env,
    });
  }

  child.unref();
  const isStandalone = !argv1?.endsWith('.js');
  return { child, vbsPath, isStandalone };
}
