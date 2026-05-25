import { useEffect, useState } from 'react';
import { Database, HardDrive, FileText, Eye, Plus } from 'lucide-react';
import { api, type SystemInfo, type MemoryInfo } from '../api.ts';

interface Props {
  memories: MemoryInfo[];
  loading: boolean;
  onNavigate: (
    page: 'memory' | 'memories',
    params?: { memoryId?: string; memoryName?: string }
  ) => void;
}

export default function Dashboard({ memories, loading, onNavigate }: Props) {
  const [info, setInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    api
      .info()
      .then(setInfo)
      .catch(() => {});
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  const totalEntries = memories.reduce((a, m) => a + m.entries, 0);
  const totalSize = memories.reduce((a, m) => a + m.size, 0);

  return (
    <div>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}
      >
        <img src="/memlink.png" alt="Memlink" style={{ width: 40, height: 40, borderRadius: 8 }} />
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            Overview
          </h1>
          <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            Universal Memory for AI Agents
          </span>
        </div>
      </div>

      <div className="grid-3">
        <div className="card">
          <div className="stat">
            <span className="stat-label">
              <Database size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Memories
            </span>
            <span className="stat-value">{memories.length}</span>
          </div>
        </div>
        <div className="card">
          <div className="stat">
            <span className="stat-label">
              <FileText size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Entries
            </span>
            <span className="stat-value">{totalEntries}</span>
          </div>
        </div>
        <div className="card">
          <div className="stat">
            <span className="stat-label">
              <HardDrive size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Total Size
            </span>
            <span className="stat-value">{(totalSize / 1024).toFixed(1)} KB</span>
          </div>
        </div>
      </div>

      {info && (
        <div className="card">
          <div className="card-title">System Info</div>
          <table className="table">
            <tbody>
              <tr>
                <td style={{ color: 'var(--text-dim)' }}>Version</td>
                <td>{info.version}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-dim)' }}>Data Directory</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{info.memlinkDir}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-dim)' }}>Server</td>
                <td>
                  http://{info.serverHost}:{info.serverPort}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <div className="card-title" style={{ marginBottom: 0 }}>
            Memories
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => onNavigate('memories')}>
            <Plus size={14} /> New Memory
          </button>
        </div>
        {memories.length === 0 ? (
          <div className="empty-state">
            <img
              src="/memlink.png"
              alt="Memlink"
              style={{
                width: 64,
                height: 64,
                borderRadius: 12,
                marginBottom: '1rem',
                opacity: 0.5,
              }}
            />
            <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>No memories yet</p>
            <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              Create a memory to start storing information.
            </p>
            <button className="btn btn-primary" onClick={() => onNavigate('memories')}>
              <Plus size={16} /> Create Memory
            </button>
          </div>
        ) : (
          <div className="memory-list">
            {memories.map((m) => (
              <div
                key={m.memoryId}
                className="memory-item"
                onClick={() =>
                  onNavigate('memory', { memoryId: m.memoryId, memoryName: m.memoryName })
                }
              >
                <div>
                  <div className="memory-item-name">{m.memoryName}</div>
                  <div className="memory-item-meta">
                    <span>{m.entries} entries</span>
                    <span>{(m.size / 1024).toFixed(1)} KB</span>
                    <span style={{ fontFamily: 'monospace' }}>{m.memoryId}</span>
                  </div>
                </div>
                <button
                  className="btn btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate('memory', { memoryId: m.memoryId, memoryName: m.memoryName });
                  }}
                >
                  <Eye size={14} /> View
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
