import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  createUniversalMemory,
  validateMemoryName,
  upsertMemoryEntry,
  readMemory,
  searchMemory,
  deleteMemoryEntry,
  revokeUniversalMemory,
  exportMemoryFormats,
  renderMemoryAsMarkdown,
  renderMemoryAsText,
  renderMemoryAsHtml,
  getExportsDir,
  loadConfig,
  importFromFile,
  getMemoryPath,
} from '../src/core/memory.ts';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
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
        revokeUniversalMemory(memoryId);
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
        revokeUniversalMemory(memoryId);
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

  describe('validateMemoryName', () => {
    it('should reject names with invalid characters', () => {
      const config = loadConfig();
      expect(() => validateMemoryName('test@name', config)).toThrow();
      expect(() => validateMemoryName('name with spaces', config)).toThrow();
      expect(() => validateMemoryName('name!', config)).toThrow();
    });

    it('should accept valid names', () => {
      const config = loadConfig();
      const result = validateMemoryName('my-memory', config);
      expect(result).toBe('my-memory');
    });

    it('should accept dots, dashes and underscores', () => {
      const config = loadConfig();
      const result = validateMemoryName('my.memory-v1_alpha', config);
      expect(result).toBe('my.memory-v1_alpha');
    });

    it('should reject duplicate names case-insensitively', () => {
      const config = loadConfig();
      createUniversalMemory('UniqueName');
      expect(() => validateMemoryName('uniquename', loadConfig())).toThrow();
      expect(() => validateMemoryName('UNIQUENAME', loadConfig())).toThrow();
    });
  });

  describe('exportMemoryFormats', () => {
    let memoryId: string;
    let memoryName: string;

    beforeEach(() => {
      memoryName = `export-test-${nanoid(8)}`;
      const memory = createUniversalMemory(memoryName);
      memoryId = memory.memoryId;
      upsertMemoryEntry(memoryId, 'Entry1', 'Content 1', ['tag1']);
    });

    afterEach(() => {
      try {
        revokeUniversalMemory(memoryId);
      } catch {
        /* ignore */
      }
    });

    it('should export json file with entry data', () => {
      const written = exportMemoryFormats(memoryId);
      const jsonFile = written.find((f) => f.endsWith('.json'));
      expect(jsonFile).toBeDefined();
      const content = readFileSync(jsonFile!, 'utf-8');
      expect(content).toContain('Entry1');
      expect(content).toContain('Content 1');
    });

    it('should write files inside formats directory', () => {
      const written = exportMemoryFormats(memoryId);
      const exportsDir = getExportsDir();
      for (const f of written) {
        expect(f.startsWith(exportsDir)).toBe(true);
      }
    });
  });

  describe('renderMemoryAsMarkdown', () => {
    let memoryId: string;

    beforeEach(() => {
      const memory = createUniversalMemory(`render-md-${nanoid(8)}`);
      memoryId = memory.memoryId;
      upsertMemoryEntry(memoryId, 'TestTitle', 'Test content body', ['tag-a']);
    });

    afterEach(() => {
      try {
        revokeUniversalMemory(memoryId);
      } catch {
        /* ignore */
      }
    });

    it('should produce markdown with title and content', () => {
      const md = renderMemoryAsMarkdown(memoryId);
      expect(md).toContain('## Index');
      expect(md).toContain('**TestTitle**');
      expect(md).toContain('Test content body');
    });
  });

  describe('renderMemoryAsText', () => {
    let memoryId: string;

    beforeEach(() => {
      const memory = createUniversalMemory(`render-txt-${nanoid(8)}`);
      memoryId = memory.memoryId;
      upsertMemoryEntry(memoryId, 'TestTitle', 'Test content body', ['tag-a']);
    });

    afterEach(() => {
      try {
        revokeUniversalMemory(memoryId);
      } catch {
        /* ignore */
      }
    });

    it('should produce plain text with title and content', () => {
      const txt = renderMemoryAsText(memoryId);
      expect(txt).toContain('[1] TestTitle');
      expect(txt).toContain('Test content body');
    });
  });

  describe('renderMemoryAsHtml', () => {
    let memoryId: string;

    beforeEach(() => {
      const memory = createUniversalMemory(`render-html-${nanoid(8)}`);
      memoryId = memory.memoryId;
      upsertMemoryEntry(memoryId, 'TestTitle', 'Test content body', ['tag-a']);
    });

    afterEach(() => {
      try {
        revokeUniversalMemory(memoryId);
      } catch {
        /* ignore */
      }
    });

    it('should produce valid HTML with title and content', () => {
      const html = renderMemoryAsHtml(memoryId);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('TestTitle');
      expect(html).toContain('Test content body');
    });
  });

  describe('search by tags', () => {
    let memoryId: string;

    beforeEach(() => {
      const memory = createUniversalMemory(`search-tags-${nanoid(8)}`);
      memoryId = memory.memoryId;
      upsertMemoryEntry(memoryId, 'React', 'React components', ['frontend', 'ui']);
      upsertMemoryEntry(memoryId, 'Config', 'Server config', ['backend']);
    });

    afterEach(() => {
      try {
        revokeUniversalMemory(memoryId);
      } catch {
        /* ignore */
      }
    });

    it('should find entries by tag', () => {
      const results = searchMemory(memoryId, 'frontend');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('React');
    });

    it('should find entries by partial tag match', () => {
      const results = searchMemory(memoryId, 'back');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Config');
    });

    it('should return empty for non-matching tag', () => {
      const results = searchMemory(memoryId, 'nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('importFromFile', () => {
    let memoryId: string;

    beforeEach(() => {
      const memory = createUniversalMemory(`import-test-${nanoid(8)}`);
      memoryId = memory.memoryId;
    });

    afterEach(() => {
      try {
        revokeUniversalMemory(memoryId);
      } catch {
        /* ignore */
      }
    });

    it('should import entries from JSON array file', () => {
      const filePath = path.join(TEST_DIR, 'import.json');
      const entries = [
        { title: 'Imported1', content: 'Content 1', tags: ['test'] },
        { title: 'Imported2', content: 'Content 2' },
      ];
      writeFileSync(filePath, JSON.stringify(entries));

      const result = importFromFile(memoryId, filePath);
      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);

      const memory = readMemory(memoryId);
      expect(memory).toHaveLength(2);
    });

    it('should reject non-existent file', () => {
      expect(() => importFromFile(memoryId, '/nonexistent/file.json')).toThrow();
    });
  });
});
