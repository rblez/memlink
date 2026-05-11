import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { 
  upsertMemoryEntry, 
  readMemory, 
  searchMemory, 
  deleteMemoryEntry,
  createUniversalMemory,
  initMemoryFile,
  getMemoryPath
} from "../src/core/memory.ts";
import { unlinkSync, existsSync } from "fs";
import { nanoid } from "nanoid";

describe("Memory Core Functions", () => {
  let memoryId: string;
  let memoryName: string;

  beforeEach(() => {
    // Create a unique memory for each test
    memoryName = `test-memory-${nanoid(10)}`;
    const memory = createUniversalMemory(memoryName);
    memoryId = memory.memoryId;
  });

  afterEach(() => {
    // Clean up test memory files
    try {
      const memoryPath = getMemoryPath(memoryId);
      if (existsSync(memoryPath)) {
        unlinkSync(memoryPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("upsertMemoryEntry", () => {
it("should create a new memory entry", () => {
    const title = "TestEntry";
    const content = "This is a test entry content.";
    const tags = ["test", "example"];

    upsertMemoryEntry(memoryId, title, content, tags);

    const entries = readMemory(memoryId);
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe(title);
    expect(entries[0].content).toBe(content);
    expect(entries[0].tags).toEqual(tags);
  });

    it("should update an existing memory entry", () => {
      const title = "UpdateTest";
      const initialContent = "Initial content";
      const updatedContent = "Updated content";

// Create initial entry
    upsertMemoryEntry(memoryId, title, initialContent);
    
    // Update the entry
    upsertMemoryEntry(memoryId, title, updatedContent);

      const entries = readMemory(memoryId);
      expect(entries).toHaveLength(1);
      expect(entries[0].content).toBe(updatedContent);
    });

    it("should handle multiline content correctly", () => {
      const title = "MultilineTest";
      const content = "Line 1\nLine 2\nLine 3";

      upsertMemoryEntry(memoryId, title, content);

      const entries = readMemory(memoryId);
      expect(entries[0].content).toBe(content);
    });
  });

  describe("readMemory", () => {
    it("should return empty array for new memory", () => {
      const entries = readMemory(memoryId);
      expect(entries).toHaveLength(0);
    });

    it("should read multiple entries correctly", () => {
upsertMemoryEntry(memoryId, "Entry1", "Content 1");
    upsertMemoryEntry(memoryId, "Entry2", "Content 2");
      upsertMemoryEntry(memoryId, "Entry3", "Content 3");

      const entries = readMemory(memoryId);
      expect(entries).toHaveLength(3);
      expect(entries.map(e => e.title)).toEqual(["Entry1", "Entry2", "Entry3"]);
    });
  });

  describe("searchMemory", () => {
    beforeEach(() => {
      // Setup test data
      upsertMemoryEntry(memoryId, "Project", "Building a React app with TypeScript");
      upsertMemoryEntry(memoryId, "Config", "Database configuration for PostgreSQL");
      upsertMemoryEntry(memoryId, "Notes", "Remember to update dependencies");
    });

    it("should find entries by content search", () => {
      const results = searchMemory(memoryId, "React");
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Project");
    });

    it("should find entries by title search", () => {
      const results = searchMemory(memoryId, "Config");
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Config");
    });

    it("should return empty array for no matches", () => {
      const results = searchMemory(memoryId, "NonExistent");
      expect(results).toHaveLength(0);
    });

    it("should be case insensitive", () => {
      const results = searchMemory(memoryId, "react");
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Project");
    });
  });

  describe("deleteMemoryEntry", () => {
    it("should delete an existing entry", () => {
      const title = "ToDelete";
      upsertMemoryEntry(memoryId, title, "Content to delete");

      // Verify entry exists
      let entries = readMemory(memoryId);
      expect(entries).toHaveLength(1);

      // Delete entry
      const deleted = deleteMemoryEntry(memoryId, title);
      expect(deleted).toBe(true);

      // Verify entry is gone
      entries = readMemory(memoryId);
      expect(entries).toHaveLength(0);
    });

    it("should return false for non-existent entry", () => {
      const deleted = deleteMemoryEntry(memoryId, memoryName, "NonExistent");
      expect(deleted).toBe(false);
    });
  });
});
