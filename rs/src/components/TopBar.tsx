import {
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import type { UniversalMemory } from "../lib/api";

interface Props {
  memories: UniversalMemory[];
  selectedMemory: UniversalMemory | null;
  onSelectMemory: (m: UniversalMemory) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNewEntry: () => void;
  onRefresh: () => void;
}

export default function TopBar({
  memories,
  selectedMemory,
  onSelectMemory,
  searchQuery,
  onSearchChange,
  onNewEntry,
  onRefresh,
}: Props) {
  return (
    <header className="flex items-center gap-3 px-4 h-12 bg-gray-900 border-b border-gray-800 shrink-0">
      <h1 className="text-lg font-semibold tracking-tight text-white mr-2">
        memlink
      </h1>

      <select
        className="bg-gray-800 text-sm text-gray-200 rounded px-2 py-1 border border-gray-700 outline-none focus:ring-1 focus:ring-indigo-500"
        value={selectedMemory?.memory_id ?? ""}
        onChange={(e) => {
          const m = memories.find((x) => x.memory_id === e.target.value);
          if (m) onSelectMemory(m);
        }}
      >
        <option value="" disabled>
          Select memory…
        </option>
        {memories.map((m) => (
          <option key={m.memory_id} value={m.memory_id}>
            {m.memory_name}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1.5 bg-gray-800 rounded px-2 py-1 border border-gray-700 flex-1 max-w-sm">
        <MagnifyingGlassIcon className="size-4 text-gray-400 shrink-0" />
        <input
          className="bg-transparent text-sm text-gray-200 outline-none w-full placeholder:text-gray-500"
          placeholder="Search entries…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <button
        onClick={onNewEntry}
        disabled={!selectedMemory}
        className="flex items-center gap-1 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded px-3 py-1.5 transition"
      >
        <PlusIcon className="size-4" />
        New
      </button>

      <button
        onClick={onRefresh}
        className="text-gray-400 hover:text-white p-1.5 rounded transition"
        title="Refresh"
      >
        <ArrowPathIcon className="size-4" />
      </button>
    </header>
  );
}
