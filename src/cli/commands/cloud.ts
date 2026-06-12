import { ok, info, err, dimLine, kv } from '../output.ts';
import { loadConfig, saveConfig } from '../../core/memory.ts';

const CLOUD_URL = process.env.MEMLINK_CLOUD_URL || 'https://memlink.vercel.app';

async function apiPost(path: string, body?: Record<string, unknown>): Promise<Response> {
  const cfg = loadConfig();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.cloud?.token) headers['Authorization'] = `Bearer ${cfg.cloud.token}`;
  return fetch(`${CLOUD_URL}${path}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function apiGet(path: string): Promise<Response> {
  const cfg = loadConfig();
  const headers: Record<string, string> = {};
  if (cfg.cloud?.token) headers['Authorization'] = `Bearer ${cfg.cloud.token}`;
  return fetch(`${CLOUD_URL}${path}`, { headers });
}

export async function connectCommand(): Promise<void> {
  // Check if already connected
  const cfg = loadConfig();
  if (cfg.cloud?.token) {
    console.log(ok('Already connected to memlink.cloud'));
    console.log(dimLine(`Run 'memlink disconnect' to unlink.`));
    return;
  }

  // 1. Get device code from cloud
  let res: Response;
  try {
    res = await apiPost('/api/device/code');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.log(err(`Could not reach ${CLOUD_URL}`));
    console.log(dimLine(String(e)));
    process.exit(1);
  }

  const { device_code, user_code, verification_uri, expires_in, interval } = await res.json();

  // 2. Show instructions
  console.log(info('connect', 'Link your CLI with memlink.cloud'));
  console.log('');
  console.log(`  ${kv('Code', user_code)}`);
  console.log(`  ${kv('URL', verification_uri)}`);
  console.log('');
  console.log(dimLine(`Open the URL in your browser and enter the code above.`));
  console.log(dimLine(`The code expires in ${expires_in / 60} minutes.`));
  console.log('');

  // 3. Poll for activation
  const deadline = Date.now() + expires_in * 1000;
  let activated = false;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, (interval || 5) * 1000));

    try {
      const poll = await apiGet(`/api/device/token?code=${encodeURIComponent(device_code)}`);
      if (!poll.ok) continue;
      const data = await poll.json();

      if (data.status === 'activated') {
        // 4. Save token
        cfg.cloud = { token: data.access_token };
        saveConfig(cfg);
        activated = true;
        break;
      }
    } catch {
      // retry
    }
  }

  if (!activated) {
    console.log(err('Timed out waiting for authorization.'));
    process.exit(1);
  }

  console.log(ok('CLI linked with memlink.cloud'));
  console.log(dimLine('Your memories can now sync to the cloud.'));
}

export function disconnectCommand(): void {
  const cfg = loadConfig();
  if (!cfg.cloud) {
    console.log(info('cloud', 'Not connected to memlink.cloud'));
    return;
  }
  delete cfg.cloud;
  saveConfig(cfg);
  console.log(ok('Disconnected from memlink.cloud'));
}
