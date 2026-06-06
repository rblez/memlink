import { getLocalToken } from '../core/auth.ts';
import { loadConfig } from '../core/memory.ts';
import { DEFAULT_PORT, DEFAULT_HOST } from '../core/types.ts';

function daemonBaseUrl(): string | null {
  const config = loadConfig();
  const host = process.env.MEMLINK_HOST || process.env.HOST || config.serverHost || DEFAULT_HOST;
  const port = process.env.MEMLINK_PORT || process.env.PORT || config.serverPort || DEFAULT_PORT;
  return `http://${host}:${port}`;
}

function daemonHeaders(): Record<string, string> {
  const token = getLocalToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

interface AdminResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

async function adminPost(path: string, body: unknown): Promise<AdminResult> {
  const base = daemonBaseUrl();
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: daemonHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: (data as { error?: string }).error || `HTTP ${res.status}` };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function registerMemory(name: string): Promise<AdminResult> {
  return adminPost('/admin/register', { name });
}

export async function pauseMemory(name: string): Promise<AdminResult> {
  return adminPost('/admin/pause', { name });
}

export async function resumeMemory(name: string): Promise<AdminResult> {
  return adminPost('/admin/resume', { name });
}

export async function stopMemory(name: string): Promise<AdminResult> {
  return adminPost('/admin/stop', { name });
}
