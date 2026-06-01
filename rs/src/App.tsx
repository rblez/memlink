import { useState, useEffect, useCallback } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import TopBar from "./components/TopBar";
import CanvasView from "./components/CanvasView";
import EntryEditor from "./components/EntryEditor";
import { getMemories, getEntries, type UniversalMemory, type StorageEntry } from "./lib/api";

export default function App() {
  const [memories, setMemories] = useState<UniversalMemory[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<UniversalMemory | null>(null);
  const [entries, setEntries] = useState<StorageEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<StorageEntry | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadMemories = useCallback(async () => {
    try {
      const m = await getMemories();
      setMemories(m);
    } catch (e) {
      console.error("load memories:", e);
    }
  }, []);

  const loadEntries = useCallback(
    async (memory: UniversalMemory) => {
      try {
        const e = await getEntries(memory.memory_name);
        setEntries(e);
        setSelectedMemory(memory);
      } catch (err) {
        console.error("load entries:", err);
      }
    },
    [],
  );

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  const handleStartNew = useCallback(() => {
    setEditingEntry(null);
    setEditorOpen(true);
  }, []);

  const handleEditEntry = useCallback((entry: StorageEntry) => {
    setEditingEntry(entry);
    setEditorOpen(true);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setEditorOpen(false);
    setEditingEntry(null);
  }, []);

  const handleSaved = useCallback(() => {
    if (selectedMemory) loadEntries(selectedMemory);
    setEditorOpen(false);
    setEditingEntry(null);
  }, [selectedMemory, loadEntries]);

  return (
    <div className="h-full w-full flex flex-col">
      <TopBar
        memories={memories}
        selectedMemory={selectedMemory}
        onSelectMemory={loadEntries}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNewEntry={handleStartNew}
        onRefresh={loadMemories}
      />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <ReactFlowProvider>
            <CanvasView
              memories={memories}
              entries={entries}
              selectedMemory={selectedMemory}
              searchQuery={searchQuery}
              onSelectMemory={loadEntries}
              onEditEntry={handleEditEntry}
            />
          </ReactFlowProvider>
        </div>
        {editorOpen && (
          <EntryEditor
            memoryName={selectedMemory?.memory_name ?? ""}
            entry={editingEntry}
            onSaved={handleSaved}
            onCancel={handleCloseEditor}
          />
        )}
      </div>
    </div>
  );
}
