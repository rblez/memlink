import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, Edit3, Trash2, ArrowLeft, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, type MemoryEntry, type MemoryInfo } from '../api.ts';

export default function MemoryPage() {
  const { memId } = useParams<{ memId: string }>();
  const navigate = useNavigate();
  const [memory, setMemory] = useState<MemoryInfo | null>(null);
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memId) return;
    setLoading(true);
    Promise.all([api.getMemory(memId).catch(() => null), api.getEntries(memId)])
      .then(([mem, ents]) => {
        if (mem) setMemory(mem);
        setEntries(ents);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [memId]);

  async function handleDelete(title: string) {
    if (!memId || !confirm(`Delete "${title}"?`)) return;
    try {
      await api.deleteEntry(memId, title);
      setEntries((prev) => prev.filter((e) => e.title !== title));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  const isJson = (s: string) => {
    try {
      JSON.parse(s);
      return true;
    } catch {
      return false;
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!memory) return <div className="empty">Memory not found.</div>;

  return (
    <div>
      <Link to="/" className="back-link">
        <ArrowLeft size={14} /> Back
      </Link>

      <div className="memory-detail-header">
        <h1 className="memory-detail-name">{memory.memoryName}</h1>
        <div className="btn-group">
          <Link to={`/${memId}/edit`} className="btn btn-primary">
            <Plus size={14} /> New Entry
          </Link>
          <Link to={`/${memId}/export`} className="btn">
            <Download size={14} /> Export
          </Link>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="empty">No entries yet.</div>
      ) : (
        <div className="entries-list">
          {entries.map((entry, i) => (
            <div key={i} className="entry-item">
              <div className="entry-head">
                <span className="entry-title">{entry.title}</span>
                <div className="entry-actions">
                  <Link
                    to={`/${memId}/edit?title=${encodeURIComponent(entry.title)}`}
                    className="icon-btn"
                    title="Edit"
                  >
                    <Edit3 size={14} />
                  </Link>
                  <button
                    className="icon-btn icon-btn-danger"
                    onClick={() => handleDelete(entry.title)}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="entry-content">
                {isJson(entry.content) ? (
                  <pre className="code-block">
                    {JSON.stringify(JSON.parse(entry.content), null, 2)}
                  </pre>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.content}</ReactMarkdown>
                )}
              </div>
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
