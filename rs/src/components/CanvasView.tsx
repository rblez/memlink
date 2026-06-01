import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import MemoryNodeComponent from "./MemoryNode";
import EntryNodeComponent from "./EntryNode";
import type { UniversalMemory, StorageEntry } from "../lib/api";
import type { MemoryData } from "./MemoryNode";
import type { EntryData } from "./EntryNode";

interface Props {
  memories: UniversalMemory[];
  entries: StorageEntry[];
  selectedMemory: UniversalMemory | null;
  searchQuery: string;
  onSelectMemory: (m: UniversalMemory) => void;
  onEditEntry: (e: StorageEntry) => void;
}

const nodeTypes = {
  memory: MemoryNodeComponent,
  entry: EntryNodeComponent,
};

export default function CanvasView({
  memories,
  entries,
  selectedMemory,
  searchQuery,
  onSelectMemory,
  onEditEntry,
}: Props) {
  const { nodes, edges } = useMemo(() => {
    const result: Node<MemoryData | EntryData>[] = [];
    const edgeList: Edge[] = [];

    const gapX = 220;
    const gapY = 140;
    const startY = 40;

    const filteredMemories = memories.filter((m) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return m.memory_name.toLowerCase().includes(q);
    });

    filteredMemories.forEach((mem, mi) => {
      const mx = 60 + mi * gapX;
      result.push({
        id: `mem-${mem.memory_id}`,
        type: "memory",
        position: { x: mx, y: startY },
        data: { memory: mem, onSelect: () => onSelectMemory(mem) },
      });

      if (selectedMemory?.memory_id === mem.memory_id) {
        const filtered = entries.filter((e) => {
          if (!searchQuery) return true;
          const q = searchQuery.toLowerCase();
          return (
            e.title.toLowerCase().includes(q) ||
            e.content.toLowerCase().includes(q) ||
            e.tags?.some((t) => t.toLowerCase().includes(q))
          );
        });

        filtered.forEach((entry, ei) => {
          const ey = startY + 80 + ei * gapY;
          result.push({
            id: `entry-${entry.id}`,
            type: "entry",
            position: { x: mx + 30, y: ey },
            data: { entry, onEdit: () => onEditEntry(entry) },
          });

          edgeList.push({
            id: `edge-${mem.memory_id}-${entry.id}`,
            source: `mem-${mem.memory_id}`,
            target: `entry-${entry.id}`,
            type: "smoothstep",
            animated: true,
            style: { stroke: "#6366f1", strokeWidth: 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
          });
        });
      }
    });

    return { nodes: result, edges: edgeList };
  }, [memories, entries, selectedMemory, searchQuery, onSelectMemory, onEditEntry]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.3}
      maxZoom={2}
      panOnDrag={[1, 2]}
      selectNodesOnDrag={false}
      proOptions={{ hideAttribution: true }}
      className="bg-gray-950"
    >
      <Background color="#1e293b" gap={20} />
      <Controls className="bg-gray-800 border-gray-700 rounded" />
      <MiniMap
        nodeStrokeColor="#6366f1"
        nodeColor="#1e293b"
        maskColor="rgba(0,0,0,.6)"
        className="border border-gray-800 rounded"
      />
    </ReactFlow>
  );
}
