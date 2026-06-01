import { useState, useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { createEntry, updateEntry, type StorageEntry } from "../lib/api";

interface Props {
  memoryName: string;
  entry: StorageEntry | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function EntryEditor({ memoryName, entry, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  const isEdit = entry !== null;

  useEffect(() => {
    if (entry) {
      setTitle(entry.title);
      setContent(entry.content);
      setTags(entry.tags?.join(", ") ?? "");
    } else {
      setTitle("");
      setContent("");
      setTags("");
    }
  }, [entry]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const tagArr = tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (isEdit) {
        await updateEntry(memoryName, entry!.id, title, content, tagArr);
      } else {
        await createEntry(memoryName, title, content, tagArr);
      }
      onSaved();
    } catch (e) {
      console.error("save:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="w-96 border-l border-gray-800 bg-gray-900/80 backdrop-blur flex flex-col shrink-0">
      <div className="flex items-center justify-between px-4 h-12 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-100">
          {isEdit ? "Edit Entry" : "New Entry"}
        </h2>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-white p-1 rounded transition"
        >
          <XMarkIcon className="size-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Title</label>
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-gray-600"
            placeholder="Entry title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Tags <span className="text-gray-600">(comma separated)</span>
          </label>
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-gray-600"
            placeholder="tag1, tag2"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>

        <div className="flex-1 flex flex-col">
          <label className="block text-xs text-gray-400 mb-1">Content</label>
          <textarea
            className="w-full flex-1 min-h-[200px] bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-gray-600 resize-none font-mono leading-relaxed"
            placeholder="Plain text content…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-800">
        <button
          onClick={onCancel}
          className="flex-1 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded px-3 py-2 transition"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="flex-1 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded px-3 py-2 transition"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </aside>
  );
}
