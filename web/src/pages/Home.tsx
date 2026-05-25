import { useNavigate } from 'react-router-dom';
import { type MemoryInfo } from '../api.ts';

interface Props {
  memories: MemoryInfo[];
}

export default function Home({ memories }: Props) {
  const navigate = useNavigate();

  if (memories.length === 0) {
    return (
      <div className="empty">
        No memories yet.
        <br />
        Create one with <code>memlink init &lt;name&gt;</code>
      </div>
    );
  }

  return (
    <div className="memory-list">
      {memories.map((m) => (
        <div key={m.memoryId} className="memory-row" onClick={() => navigate(`/${m.memoryId}`)}>
          <span className="memory-name">{m.memoryName}</span>
          <span className="memory-count">{m.entries}</span>
        </div>
      ))}
    </div>
  );
}
