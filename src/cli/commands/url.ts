import { loadConfig } from '../../core/memory.ts';
import { DEFAULT_PORT, DEFAULT_HOST } from '../../core/types.ts';
import { info, ok, dimLine } from '../output.ts';
import * as os from 'os';
import { execSync } from 'child_process';
import fs from 'fs';

function envHost(): string | undefined {
  return process.env.MEMLINK_HOST || process.env.HOST || undefined;
}

function envPort(): number | undefined {
  const s = process.env.MEMLINK_PORT || process.env.PORT;
  if (!s) return undefined;
  const n = parseInt(s, 10);
  return isNaN(n) ? undefined : n;
}

function copyToClipboard(text: string): boolean {
  if (!process.stdout.isTTY) return false;
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
      for (const tool of ['wl-copy', 'xclip', 'xsel']) {
        try {
          execSync(`which ${tool}`, { stdio: 'ignore' });
          if (tool === 'wl-copy') execSync(`cat '${tmpfile}' | ${tool}`, { stdio: 'ignore' });
          else if (tool === 'xclip')
            execSync(`cat '${tmpfile}' | ${tool} -selection clipboard`, { stdio: 'ignore' });
          else execSync(`cat '${tmpfile}' | ${tool} --clipboard --input`, { stdio: 'ignore' });
          return true;
        } catch {
          continue;
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

export function urlCommand(): void {
  const config = loadConfig();
  const host = envHost() || config.serverHost || DEFAULT_HOST;
  const port = envPort() || config.serverPort || DEFAULT_PORT;
  const defaultUrl = `http://${host}:${port}/mcp`;
  const tokenUrl = `http://${host}:${port}/mcp?t=<token>`;

  console.log(info('Default', defaultUrl));
  console.log(info('Isolated', tokenUrl));
  console.log();
  console.log(dimLine('MCP config JSON for default memory:'));
  console.log(
    `  ${JSON.stringify({ mcpServers: { memlink: { type: 'http', url: defaultUrl } } }, null, 2)}`
  );
  console.log();

  const copied = copyToClipboard(defaultUrl);
  if (copied) console.log(ok('URL copied to clipboard'));
}
