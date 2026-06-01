import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { CubeIcon } from "@heroicons/react/24/outline";
import type { UniversalMemory } from "../lib/api";

export type MemoryData = {
  memory: UniversalMemory;
  onSelect: () => void;
};

export type MemoryNode = Node<MemoryData, "memory">;

function MemoryNodeComponent({ data }: NodeProps<MemoryNode>) {
  const { memory, onSelect } = data;

  return (
    <div
      onClick={onSelect}
      className="px-4 py-3 rounded-xl border border-indigo-500/40 bg-indigo-950/60 backdrop-blur shadow-lg shadow-indigo-500/10 cursor-pointer hover:border-indigo-400 transition-colors min-w-[160px]"
    >
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-500" />
      <div className="flex items-center gap-2">
        <CubeIcon className="size-5 text-indigo-400 shrink-0" />
        <span className="text-sm font-semibold text-white truncate">
          {memory.memory_name}
        </span>
      </div>
      <p className="text-xs text-gray-400 mt-0.5 truncate">
        {memory.memory_id.slice(0, 8)}
      </p>
    </div>
  );
}

export default memo(MemoryNodeComponent);
