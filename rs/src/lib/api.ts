import { invoke } from "@tauri-apps/api/core";

export interface UniversalMemory {
  memory_id: string;
  memory_name: string;
  created_at: string;
  last_seen?: string;
}

export interface StorageEntry {
  id: number;
  title: string;
  content: string;
  tags?: string[];
  updated_at: string;
}

// ── Commands ────────────────────────────────────

export async function getMemories(): Promise<UniversalMemory[]> {
  return invoke("get_memories");
}

export async function getEntries(memoryName: string): Promise<StorageEntry[]> {
  return invoke("get_entries", { memoryName });
}

export async function getEntry(
  memoryName: string,
  id: number,
): Promise<StorageEntry> {
  return invoke("get_entry", { memoryName, id });
}

export async function createEntry(
  memoryName: string,
  title: string,
  content: string,
  tags: string[],
): Promise<StorageEntry> {
  return invoke("create_entry", { memoryName, title, content, tags });
}

export async function updateEntry(
  memoryName: string,
  id: number,
  title: string,
  content: string,
  tags: string[],
): Promise<StorageEntry> {
  return invoke("update_entry", { memoryName, id, title, content, tags });
}

export async function deleteEntry(
  memoryName: string,
  id: number,
): Promise<void> {
  return invoke("delete_entry", { memoryName, id });
}

export async function searchEntries(
  memoryName: string,
  query: string,
): Promise<StorageEntry[]> {
  return invoke("search_entries", { memoryName, query });
}
