import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createApp } from '../src/server/index.ts';
import { initRouting } from '../src/core/routing.ts';
import { ensureDefaultMemory } from '../src/core/meta.ts';
import { createEntry, readAllEntries } from '../src/core/storage.ts';
import { existsSync, rmSync } from 'fs';
import { mkdirSync } from 'fs';
import { nanoid } from 'nanoid';
import path from 'path';
import os from 'os';
import type { Server } from 'http';

const TEST_DIR = path.join(os.tmpdir(), `memlink-server-test-${nanoid(6)}`);
const TEST_PORT = 4454;

describe('MCP Server', () => {
  let server: Server;

  beforeEach(async () => {
    process.env.MEMLINK_DIR = TEST_DIR;
    mkdirSync(TEST_DIR, { recursive: true });

    // Set up default memory
    ensureDefaultMemory();
    initRouting();

    const app = createApp();
    server = app.listen(TEST_PORT);
    await new Promise<void>((resolve) => server.on('listening', resolve));
  });

  afterEach(() => {
    delete process.env.MEMLINK_DIR;
    if (server) server.close();
    try {
      if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('Server Health', () => {
    it('should respond to health check', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/health`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('ok');
    });
  });

  describe('MCP Protocol', () => {
    it('should handle MCP initialize request', async () => {
      const mcpRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      };

      const response = await fetch(`http://localhost:${TEST_PORT}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify(mcpRequest),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toMatch(/text\/event-stream/);
      const body = await response.text();
      expect(body).toContain('"jsonrpc":"2.0"');
      expect(body).toContain('"id":1');
      expect(body).toContain('"protocolVersion":"2024-11-05"');
    });

    it('should reject requests with invalid token', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/mcp?t=invalid-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Invalid token');
    });

    it('should serve default memory without token', async () => {
      const mcpRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/list',
        params: {},
      };

      // First, add an entry to default via the API to verify it works
      const editRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'memory_edit',
          arguments: {
            title: 'TestEntry',
            content: 'Test content',
          },
        },
      };

      const response = await fetch(`http://localhost:${TEST_PORT}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify(editRequest),
      });

      expect(response.status).toBe(200);

      // Verify it was stored
      const entries = readAllEntries('default');
      expect(entries.length).toBe(1);
      expect(entries[0].title).toBe('TestEntry');
    });
  });
});
