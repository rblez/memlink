import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createUniversalMemory, getMemoryPath } from '../src/core/memory.ts';
import { createApp } from '../src/server/index.ts';
import { unlinkSync, existsSync, mkdirSync } from 'fs';
import { nanoid } from 'nanoid';
import path from 'path';
import os from 'os';
import type { Server } from 'http';

const TEST_DIR = path.join(os.tmpdir(), `memlink-server-test-${nanoid(6)}`);
const TEST_PORT = 4454;

describe('MCP Server', () => {
  let server: Server;
  let memoryId: string;
  let memoryName: string;

  beforeEach(async () => {
    process.env.MEMLINK_DIR = TEST_DIR;
    mkdirSync(TEST_DIR, { recursive: true });

    memoryName = `test-server-${Date.now()}`;
    const memory = createUniversalMemory(memoryName);
    memoryId = memory.memoryId;

    const app = createApp();
    server = app.listen(TEST_PORT);
    await new Promise<void>((resolve) => server.on('listening', resolve));
  });

  afterEach(() => {
    delete process.env.MEMLINK_DIR;
    if (server) server.close();

    try {
      const memoryPath = getMemoryPath(memoryId);
      if (existsSync(memoryPath)) unlinkSync(memoryPath);
    } catch {
      // Ignore cleanup errors
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

      const response = await fetch(`http://localhost:${TEST_PORT}/mcp?id=${memoryId}`, {
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

    it('should reject requests without memory ID', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Missing authentication');
    });

    it('should reject requests with invalid memory ID', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/mcp?id=invalid123`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(403);
    });
  });
});
