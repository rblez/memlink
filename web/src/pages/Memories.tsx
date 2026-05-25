import { useState } from 'react';
import { Plus, Eye, Trash2, FileEdit } from 'lucide-react';
import { api, type MemoryInfo } from '../api.ts';

interface Props {
  memories: MemoryInfo[];
  loading: boolean;
  onNavigate: (
    page: 'memory' | 'entry-edit',
    params: { memoryId: string; memoryName: string; entryTitle?: string }
  ) => void;
}

export default function Memories({ memories, loading, onNavigate }: Props) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [list, setList] = useState(memories);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    setSuccess('');
    try {
      await api.createMemory(name.trim());
      setSuccess(`Memory "${name.trim()}" created`);
      setName('');
      const updated = await api.listMemories();
      setList(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create memory');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(memoryId: string, memoryName: string) {
    if (!confirm(`Delete memory "${memoryName}"? This cannot be undone.`)) return;
    try {
      await api.deleteMemory(memoryId);
      setList((prev) => prev.filter((m) => m.memoryId !== memoryId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      <h1 className="page-title">Memories</h1>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="card-title">Create Memory</div>
        <div className="inline-form">
          <input
            className="input"
            placeholder="Memory name (e.g. my-project)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={creating || !name.trim()}
          >
            {creating ? (
              'Creating...'
            ) : (
              <>
                <Plus size={16} /> Create
              </>
            )}
          </button>
        </div>
        <div className="form-hint">
          Only letters, numbers, hyphens, underscores, and dots allowed.
        </div>
      </div>

      <div className="card">
        <div className="card-title">All Memories ({list.length})</div>
        {list.length === 0 ? (
          <div className="empty-state">
            <img
              src="/memlink.png"
              alt=""
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                marginBottom: '0.75rem',
                opacity: 0.4,
              }}
            />
            <p>No memories yet. Create one above.</p>
          </div>
        ) : (
          <div className="memory-list">
            {list.map((m) => (
              <div key={m.memoryId} className="memory-item">
                <div
                  style={{ flex: 1, minWidth: 0 }}
                  onClick={() =>
                    onNavigate('memory', { memoryId: m.memoryId, memoryName: m.memoryName })
                  }
                >
                  <div className="memory-item-name">{m.memoryName}</div>
                  <div className="memory-item-meta">
                    <span>{m.entries} entries</span>
                    <span>{(m.size / 1024).toFixed(1)} KB</span>
                    <span style={{ fontFamily: 'monospace' }}>{m.memoryId}</span>
                    {m.tags.length > 0 && <span>Tags: {m.tags.join(', ')}</span>}
                  </div>
                </div>
                <div className="memory-item-actions">
                  <button
                    className="btn btn-sm"
                    onClick={() =>
                      onNavigate('entry-edit', { memoryId: m.memoryId, memoryName: m.memoryName })
                    }
                  >
                    <FileEdit size={13} />
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() =>
                      onNavigate('memory', { memoryId: m.memoryId, memoryName: m.memoryName })
                    }
                  >
                    <Eye size={13} />
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(m.memoryId, m.memoryName)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
