import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  createUniversalMemory,
  upsertMemoryEntry,
  readMemory,
  searchMemory,
  deleteMemoryEntry,
  getMemoryPath,
} from '../src/core/memory.ts';
import { unlinkSync, existsSync, mkdirSync } from 'fs';
import { nanoid } from 'nanoid';
import path from 'path';
import os from 'os';

const TEST_DIR = path.join(os.tmpdir(), `memlink-unit-test-${nanoid(6)}`);

describe('Unit Tests - Core Functions', () => {
  beforeEach(() => {
    process.env.MEMLINK_DIR = TEST_DIR;
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    delete process.env.MEMLINK_DIR;
  });

  describe('createUniversalMemory', () => {
    it('should create a memory with required properties', () => {
      const memoryName = `test-${nanoid(8)}`;
      const memory = createUniversalMemory(memoryName);

      expect(memory).toHaveProperty('memoryId');
      expect(memory).toHaveProperty('memoryName', memoryName);
      expect(memory.memoryId).toMatch(/^[a-zA-Z0-9_-]{12}$/);
    });

    it('should generate unique memory IDs', () => {
      const memory1 = createUniversalMemory('test1');
      const memory2 = createUniversalMemory('test2');

      expect(memory1.memoryId).not.toBe(memory2.memoryId);
    });
  });

  describe('Memory Operations', () => {
    let memoryId: string;
    let memoryName: string;

    beforeEach(() => {
      memoryName = `test-${nanoid(8)}`;
      const memory = createUniversalMemory(memoryName);
      memoryId = memory.memoryId;
    });

    afterEach(() => {
      try {
        const memoryPath = getMemoryPath(memoryId);
        if (existsSync(memoryPath)) {
          unlinkSync(memoryPath);
        }
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should create and read memory entries', () => {
      const title = 'ProjectContext';
      const content = 'Building a React app with TypeScript';
      const tags = ['react', 'typescript'];

      upsertMemoryEntry(memoryId, title, content, tags);
      const entries = readMemory(memoryId);

      expect(entries).toHaveLength(1);
      expect(entries[0].title).toBe(title);
      expect(entries[0].content).toBe(content);
      expect(entries[0].tags).toEqual(tags);
    });

    it('should update existing entries', () => {
      const title = 'Config';
      const initialContent = 'Database config';
      const updatedContent = 'Updated database config';

      upsertMemoryEntry(memoryId, title, initialContent);
      upsertMemoryEntry(memoryId, title, updatedContent);

      const entries = readMemory(memoryId);
      expect(entries).toHaveLength(1);
      expect(entries[0].content).toBe(updatedContent);
    });

    it('should search entries by content', () => {
      upsertMemoryEntry(memoryId, 'Project', 'Building a React app');
      upsertMemoryEntry(memoryId, 'Config', 'Database configuration');

      const results = searchMemory(memoryId, 'React');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Project');
    });

    it('should search entries by title', () => {
      upsertMemoryEntry(memoryId, 'Project', 'Building a React app');
      upsertMemoryEntry(memoryId, 'Config', 'Database configuration');

      const results = searchMemory(memoryId, 'Config');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Config');
    });

    it('should delete entries', () => {
      const title = 'ToDelete';
      upsertMemoryEntry(memoryId, title, 'Content to delete');

      let entries = readMemory(memoryId);
      expect(entries).toHaveLength(1);

      const deleted = deleteMemoryEntry(memoryId, title);
      expect(deleted).toBe(true);

      entries = readMemory(memoryId);
      expect(entries).toHaveLength(0);
    });

    it('should handle case-insensitive search', () => {
      upsertMemoryEntry(memoryId, 'React', 'React components');

      const results = searchMemory(memoryId, 'react');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('React');
    });
  });

  describe('Edge Cases', () => {
    let memoryId: string;

    beforeEach(() => {
      const memory = createUniversalMemory('edge-case-test');
      memoryId = memory.memoryId;
    });

    afterEach(() => {
      try {
        const memoryPath = getMemoryPath(memoryId);
        if (existsSync(memoryPath)) {
          unlinkSync(memoryPath);
        }
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should handle empty content', () => {
      upsertMemoryEntry(memoryId, 'Empty', '');
      const entries = readMemory(memoryId);
      expect(entries).toHaveLength(1);
      expect(entries[0].content).toBe('');
    });

    it('should handle multiline content', () => {
      const content = 'Line 1\nLine 2\nLine 3';
      upsertMemoryEntry(memoryId, 'Multiline', content);

      const entries = readMemory(memoryId);
      expect(entries[0].content).toBe(content);
    });

    it('should handle special characters in content', () => {
      const content = "Special chars: !@#$%^&*()_+-=[]{}|;':,./<>?";
      upsertMemoryEntry(memoryId, 'Special', content);

      const entries = readMemory(memoryId);
      expect(entries[0].content).toBe(content);
    });

    it('should return empty array for new memory', () => {
      const entries = readMemory(memoryId);
      expect(entries).toHaveLength(0);
    });

    it('should return empty array for non-existent search', () => {
      upsertMemoryEntry(memoryId, 'Test', 'Content');
      const results = searchMemory(memoryId, 'nonexistent');
      expect(results).toHaveLength(0);
    });
  });
});
