import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { api, type MemoryEntry } from '../api.ts';

interface SearchResult extends MemoryEntry {
  _memoryId: string;
  _memoryName: string;
}

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const q = searchParams.get('q') || '';

  useEffect(() => {
    if (!q.trim()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .listMemories()
      .then((memories) => {
        const memMap = new Map(memories.map((m) => [m.memoryId, m.memoryName]));
        return Promise.allSettled(
          memories.map((m) =>
            api
              .search(m.memoryId, q.trim())
              .then((data) =>
                data.results.map(
                  (e) =>
                    ({
                      ...e,
                      _memoryId: m.memoryId,
                      _memoryName: memMap.get(m.memoryId) || m.memoryName,
                    }) as SearchResult
                )
              )
          )
        );
      })
      .then((allResults) => {
        const all: SearchResult[] = [];
        for (const r of allResults || []) {
          if (r.status === 'fulfilled') all.push(...r.value);
        }
        setResults(all);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [q]);

  return (
    <div>
      <div className="results-info">
        {loading
          ? 'Searching...'
          : `${results.length} result${results.length !== 1 ? 's' : ''} for "${q}"`}
      </div>

      {loading ? (
        <div className="loading">Searching...</div>
      ) : results.length === 0 ? (
        <div className="empty">No matches for "{q}"</div>
      ) : (
        <div className="memory-list">
          {results.map((entry, i) => (
            <div key={i} className="search-row" onClick={() => navigate(`/${entry._memoryId}`)}>
              <div className="search-row-head">
                <span className="entry-title">{entry.title}</span>
                <div className="search-row-meta">
                  <span className="search-memory-name">{entry._memoryName}</span>
                  <ArrowUpRight size={12} className="search-arrow" />
                </div>
              </div>
              <div className="entry-content">{entry.content}</div>
              <div className="entry-meta">
                {entry.tags?.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
                <span>{new Date(entry.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
