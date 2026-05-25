import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  Plus,
  Download,
  RefreshCw,
  FileText,
  Edit3,
  Trash2,
  Search as SearchIcon,
} from 'lucide-react';
import { api, type MemoryEntry, type MemoryStats } from '../api.ts';

interface Props {
  memoryId: string;
  memoryName: string;
  onNavigate: (
    page: 'entry-edit' | 'memories',
    params?: { memoryId?: string; memoryName?: string; entryTitle?: string }
  ) => void;
}

export default function MemoryView({ memoryId, memoryName, onNavigate }: Props) {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'markdown'>('list');
  const [markdown, setMarkdown] = useState('');

  useEffect(() => {
    loadEntries();
    loadStats();
  }, [memoryId]);

  async function loadEntries() {
    setError('');
    setLoading(true);
    try {
      const data = await api.getEntries(memoryId);
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    setError('');
    try {
      const s = await api.getStats(memoryId);
      setStats(s);
    } catch {}
  }

  async function handleDelete(title: string) {
    setError('');
    if (!confirm(`Delete entry "${title}"?`)) return;
    try {
      await api.deleteEntry(memoryId, title);
      setEntries((prev) => prev.filter((e) => e.title !== title));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  async function handleExport() {
    setError('');
    try {
      const result = await api.exportMemory(memoryId);
      alert(`Exported to: ${result.formats.join(', ')}\nDirectory: ${result.formatsDir}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  }

  async function handleSync() {
    setError('');
    try {
      const result = await api.sync(memoryId);
      alert(`Sync OK — ${result.entries} entries, ${(result.size / 1024).toFixed(1)} KB`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    }
  }

  async function loadMarkdown() {
    setError('');
    try {
      const result = await api.getMarkdown(memoryId);
      setMarkdown(result.markdown);
      setViewMode('markdown');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }

  const filteredEntries = searchQuery
    ? entries.filter(
        (e) =>
          e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : entries;

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="back-link" onClick={() => onNavigate('memories')}>
        <ArrowLeft size={14} /> Back to Memories
      </div>

      <h1 className="page-title">{memoryName}</h1>

      {error && <div className="alert alert-error">{error}</div>}

      {stats && (
        <div className="card">
          <div className="grid-3">
            <div className="stat">
              <span className="stat-label">
                <FileText size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Entries
              </span>
              <span className="stat-value">{stats.entries}</span>
            </div>
            <div className="stat">
              <span className="stat-label">
                <Download size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Size
              </span>
              <span className="stat-value">{(stats.size / 1024).toFixed(1)} KB</span>
            </div>
            <div className="stat">
              <span className="stat-label">ID</span>
              <span className="stat-value" style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>
                {stats.memoryId}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="btn-group" style={{ marginBottom: '1rem' }}>
        <button
          className="btn btn-primary"
          onClick={() => onNavigate('entry-edit', { memoryId, memoryName })}
        >
          <Plus size={16} /> New Entry
        </button>
        <button className="btn" onClick={handleExport}>
          <Download size={16} /> Export
        </button>
        <button className="btn" onClick={handleSync}>
          <RefreshCw size={16} /> Sync
        </button>
        <button className="btn" onClick={loadMarkdown}>
          <FileText size={16} /> Markdown
        </button>
      </div>

      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <div className="card-title" style={{ marginBottom: 0 }}>
            Entries ({filteredEntries.length})
          </div>
          <div style={{ position: 'relative', maxWidth: 240 }}>
            <SearchIcon
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-dim)',
              }}
            />
            <input
              className="input"
              style={{ padding: '0.3rem 0.6rem 0.3rem 1.8rem', fontSize: '0.8rem' }}
              placeholder="Filter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {viewMode === 'markdown' ? (
          <div>
            <button
              className="btn btn-sm"
              style={{ marginBottom: '0.5rem' }}
              onClick={() => setViewMode('list')}
            >
              <ArrowLeft size={14} /> Back to List
            </button>
            <div className="markdown-preview">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="empty-state">
            <FileText size={32} className="empty-state-icon" />
            <p>{entries.length === 0 ? 'No entries yet.' : 'No matching entries.'}</p>
          </div>
        ) : (
          <div>
            {filteredEntries.map((entry, i) => (
              <div key={i} className="entry-item">
                <div className="entry-item-header">
                  <span
                    className="entry-item-title"
                    onClick={() =>
                      onNavigate('entry-edit', { memoryId, memoryName, entryTitle: entry.title })
                    }
                  >
                    {entry.title}
                  </span>
                  <div className="btn-group">
                    <button
                      className="btn btn-sm"
                      onClick={() =>
                        onNavigate('entry-edit', { memoryId, memoryName, entryTitle: entry.title })
                      }
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(entry.title)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="entry-item-content">{entry.content}</div>
                <div className="entry-item-meta">
                  {entry.tags && entry.tags.length > 0 && (
                    <span>
                      {entry.tags.map((t) => (
                        <span key={t} className="tag">
                          {t}
                        </span>
                      ))}
                    </span>
                  )}
                  <span>{new Date(entry.updatedAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
