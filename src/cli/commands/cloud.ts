import { ok, info, err, dimLine, kv } from '../output.ts';
import { loadConfig, saveConfig } from '../../core/memory.ts';
import { readAllEntries, readIndex, createEntry, updateEntry } from '../../core/storage.ts';
import { ensureDefaultMemory, readMeta } from '../../core/meta.ts';
import type { StorageEntry } from '../../core/types.ts';

const CLOUD_URL = process.env.MEMLINK_CLOUD_URL || 'https://memlink.up.railway.app';

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

// ── Sync ──────────────────────────────────────────────────────────────────────

type SyncDirection = 'push' | 'pull' | 'both';

async function syncPush(memoryName: string, memoryId: string): Promise<number> {
  const entries = readAllEntries(memoryName);
  const res = await apiPost('/api/sync/push', {
    memory: memoryName,
    memoryId,
    entries,
  });
  if (!res.ok) throw new Error(`Push failed: HTTP ${res.status}`);
  const data = (await res.json()) as { received?: number };
  return data.received ?? entries.length;
}

async function syncPull(
  memoryName: string,
  memoryId: string
): Promise<{ applied: number; skipped: number }> {
  const res = await apiGet(`/api/sync/pull?memory=${encodeURIComponent(memoryName)}`);
  if (!res.ok) throw new Error(`Pull failed: HTTP ${res.status}`);
  const data = (await res.json()) as { entries?: StorageEntry[] };
  const remote = data.entries ?? [];

  if (remote.length === 0) return { applied: 0, skipped: 0 };

  const localEntries = readAllEntries(memoryName);
  const localByTitle = new Map(localEntries.map((e) => [e.title.toLowerCase(), e]));

  let applied = 0;
  let skipped = 0;

  for (const remote_entry of remote) {
    const local = localByTitle.get(remote_entry.title.toLowerCase());

    if (!local) {
      // New entry — create locally
      createEntry(memoryName, memoryId, remote_entry.title, remote_entry.content, remote_entry.tags);
      applied++;
    } else {
      // Existing — apply only if remote is newer
      const remoteTs = new Date(remote_entry.updatedAt).getTime();
      const localTs = new Date(local.updatedAt).getTime();
      if (remoteTs > localTs) {
        updateEntry(memoryName, local.id, {
          content: remote_entry.content,
          tags: remote_entry.tags,
        });
        applied++;
      } else {
        skipped++;
      }
    }
  }

  return { applied, skipped };
}

export async function syncCommand(opts: {
  memory?: string;
  push?: boolean;
  pull?: boolean;
}): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.cloud?.token) {
    console.log(err('Not connected to memlink.cloud'));
    console.log(dimLine('Run memlink connect to link your account'));
    process.exit(1);
  }

  const memoryName = opts.memory || 'default';
  let memoryId: string;

  if (memoryName === 'default') {
    const meta = ensureDefaultMemory();
    if (!meta) {
      console.log(err('Default memory not found'));
      process.exit(1);
    }
    memoryId = meta.id;
  } else {
    const meta = readMeta(memoryName);
    if (!meta) {
      console.log(err(`Memory "${memoryName}" not found`));
      process.exit(1);
    }
    memoryId = meta.id;
  }

  const direction: SyncDirection = opts.push ? 'push' : opts.pull ? 'pull' : 'both';

  console.log(info('sync', `${memoryName} → memlink.cloud`));
  console.log(kv('Direction', direction));
  console.log();

  try {
    if (direction === 'pull' || direction === 'both') {
      process.stdout.write('  Pulling from cloud…');
      const { applied, skipped } = await syncPull(memoryName, memoryId);
      process.stdout.write(`\r  ${ok(`Pull complete — ${applied} applied, ${skipped} already up-to-date`)}\n`);
    }

    if (direction === 'push' || direction === 'both') {
      process.stdout.write('  Pushing to cloud…');
      const received = await syncPush(memoryName, memoryId);
      process.stdout.write(`\r  ${ok(`Push complete — ${received} entries sent`)}\n`);
    }
  } catch (e) {
    console.log();
    console.log(err(String(e)));
    console.log(dimLine('Check your connection: memlink cloud'));
    process.exit(1);
  }

  console.log();
  console.log(ok('Sync done'));
  console.log();
}

export async function cloudStatusCommand(): Promise<void> {
  const cfg = loadConfig();
  const connected = !!cfg.cloud?.token;

  console.log(kv('Cloud URL', CLOUD_URL));
  console.log(kv('Linked', connected ? 'yes' : 'no'));
  if (!connected) {
    console.log(dimLine('Run memlink connect to link with memlink.cloud'));
  }
  console.log();

  const start = Date.now();
  try {
    const res = await fetch(`${CLOUD_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
    const latency = Date.now() - start;
    if (res.ok) {
      console.log(ok(`Cloud reachable — ${latency}ms`));
    } else {
      console.log(err(`Cloud responded with HTTP ${res.status} — ${latency}ms`));
    }
  } catch (e) {
    const latency = Date.now() - start;
    console.log(err(`Cloud unreachable after ${latency}ms`));
    console.log(dimLine(String(e)));
  }
  console.log();
}
