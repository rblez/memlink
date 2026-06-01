import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import type { StorageEntry } from "../lib/api";

interface EntryNodeData {
  entry: StorageEntry;
  onEdit: () => void;
}

function EntryNode({ data }: NodeProps<EntryNodeData>) {
  const { entry, onEdit } = data;
  const preview = entry.content.slice(0, 60);

  return (
    <div
      onClick={onEdit}
      className="px-3 py-2 rounded-lg border border-gray-700/60 bg-gray-900/80 backdrop-blur shadow cursor-pointer hover:border-gray-500 transition-colors min-w-[160px] max-w-[220px]"
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      <div className="flex items-center gap-1.5">
        <DocumentTextIcon className="size-4 text-gray-400 shrink-0" />
        <span className="text-sm font-medium text-gray-100 truncate">
          {entry.title}
        </span>
      </div>
      {entry.tags && entry.tags.length > 0 && (
        <div className="flex gap-1 mt-1 flex-wrap">
          {entry.tags.map((t) => (
            <span
              key={t}
              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {preview && (
        <p className="text-xs text-gray-500 mt-1 leading-snug line-clamp-2">
          {preview}
          {entry.content.length > 60 ? "…" : ""}
        </p>
      )}
    </div>
  );
}

export default memo(EntryNode);
