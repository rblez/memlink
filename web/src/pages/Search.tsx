import { useState } from 'react';
import { Search as SearchIcon, FileText, ArrowRight } from 'lucide-react';
import { api, type MemoryEntry, type MemoryInfo } from '../api.ts';

interface Props {
  memories: MemoryInfo[];
  onNavigate: (page: 'memory', params: { memoryId: string; memoryName: string }) => void;
}

export default function Search({ memories, onNavigate }: Props) {
  const [selectedMemory, setSelectedMemory] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemoryEntry[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [scope, setScope] = useState<'all' | 'specific'>('all');
  const [failedMemories, setFailedMemories] = useState<string[]>([]);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    setFailedMemories([]);
    setResults([]);
    try {
      if (scope === 'specific' && selectedMemory) {
        const data = await api.search(selectedMemory, query.trim());
        const mem = memories.find((m) => m.memoryId === selectedMemory);
        setResults(
          data.results.map(
            (e) =>
              ({
                ...e,
                _memoryName: mem?.memoryName,
                _memoryId: selectedMemory,
              }) as MemoryEntry & { _memoryName: string; _memoryId: string }
          )
        );
      } else {
        const memMap = new Map(memories.map((m) => [m.memoryId, m.memoryName]));
        const allResults = await Promise.allSettled(
          memories.map((m) =>
            api.search(m.memoryId, query.trim()).then((data) =>
              data.results.map(
                (e) =>
                  ({
                    ...e,
                    _memoryName: memMap.get(m.memoryId) || m.memoryName,
                    _memoryId: m.memoryId,
                  }) as MemoryEntry & { _memoryName: string; _memoryId: string }
              )
            )
          )
        );
        const all: MemoryEntry[] = [];
        const failed: string[] = [];
        for (let i = 0; i < allResults.length; i++) {
          const r = allResults[i];
          if (r.status === 'fulfilled') {
            all.push(...r.value);
          } else {
            failed.push(memories[i].memoryName);
          }
        }
        setResults(all);
        setFailedMemories(failed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }

  return (
    <div>
      <h1 className="page-title">Search</h1>

      <div className="card">
        <div className="form-group">
          <label className="form-label">Scope</label>
          <div className="btn-group">
            <button
              className={`btn btn-sm ${scope === 'all' ? 'btn-primary' : ''}`}
              onClick={() => setScope('all')}
            >
              All Memories
            </button>
            <button
              className={`btn btn-sm ${scope === 'specific' ? 'btn-primary' : ''}`}
              onClick={() => setScope('specific')}
            >
              Specific Memory
            </button>
          </div>
        </div>

        {scope === 'specific' && (
          <div className="form-group">
            <label className="form-label">Memory</label>
            <select
              className="input"
              value={selectedMemory}
              onChange={(e) => setSelectedMemory(e.target.value)}
            >
              <option value="">Select a memory...</option>
              {memories.map((m) => (
                <option key={m.memoryId} value={m.memoryId}>
                  {m.memoryName}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Search Query</label>
          <div className="inline-form">
            <input
              className="input"
              placeholder="Search in titles, content, and tags..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              className="btn btn-primary"
              onClick={handleSearch}
              disabled={searching || !query.trim()}
            >
              {searching ? (
                'Searching...'
              ) : (
                <>
                  <SearchIcon size={16} /> Search
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {searched && (
        <div className="card">
          <div className="card-title">
            Results ({results.length})
            {failedMemories.length > 0 && (
              <span style={{ color: 'var(--danger)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                ({failedMemories.length} memories failed)
              </span>
            )}
          </div>
          {failedMemories.length > 0 && (
            <div className="alert alert-warning" style={{ fontSize: '0.85rem' }}>
              Search failed in: {failedMemories.join(', ')}
            </div>
          )}
          {results.length === 0 ? (
            <div className="empty-state">
              <SearchIcon size={32} className="empty-state-icon" />
              <p>No matches found for "{query}"</p>
            </div>
          ) : (
            results.map((entry, i) => {
              const e = entry as MemoryEntry & { _memoryName?: string; _memoryId?: string };
              return (
                <div key={i} className="entry-item">
                  <div className="entry-item-header">
                    <span
                      className="entry-item-title"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        if (e._memoryId && e._memoryName) {
                          onNavigate('memory', {
                            memoryId: e._memoryId,
                            memoryName: e._memoryName,
                          });
                        }
                      }}
                    >
                      {e.title}
                      <ArrowRight size={12} style={{ marginLeft: 4, opacity: 0.4 }} />
                    </span>
                  </div>
                  <div className="entry-item-content">{e.content}</div>
                  <div className="entry-item-meta">
                    {e._memoryName && (
                      <span style={{ color: 'var(--primary)', marginRight: '0.5rem' }}>
                        {e._memoryName}
                      </span>
                    )}
                    {e.tags?.map((t: string) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                    <span>{new Date(e.updatedAt).toLocaleString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
