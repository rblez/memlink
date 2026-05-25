import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, FileText, RefreshCw } from 'lucide-react';
import { api, type MemoryInfo } from '../api.ts';

export default function ExportPage() {
  const { memId } = useParams<{ memId: string }>();
  const [memory, setMemory] = useState<MemoryInfo | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memId) return;
    Promise.all([
      api.getMemory(memId).catch(() => null),
      api
        .getMarkdown(memId)
        .then((r) => r.markdown)
        .catch(() => ''),
    ])
      .then(([mem, md]) => {
        if (mem) setMemory(mem);
        setMarkdown(md);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [memId]);

  async function handleExport() {
    if (!memId) return;
    try {
      const result = await api.exportMemory(memId);
      alert(`Exported to:\n${result.formatsDir}\n\nFormats: ${result.formats.join(', ')}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed');
    }
  }

  async function handleSync() {
    if (!memId) return;
    try {
      const result = await api.sync(memId);
      alert(`Sync OK — ${result.entries} entries, ${(result.size / 1024).toFixed(1)} KB`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Sync failed');
    }
  }

  if (loading) return <div className="loading">Loading...</div>;
  if (!memory) return <div className="empty">Memory not found.</div>;

  return (
    <div>
      <Link to={`/${memId}`} className="back-link">
        <ArrowLeft size={14} /> Back
      </Link>
      <h1 className="page-title">{memory.memoryName}</h1>

      <div className="btn-group" style={{ marginBottom: '1rem' }}>
        <button className="btn btn-primary" onClick={handleExport}>
          <Download size={14} /> Export Files
        </button>
        <button className="btn" onClick={handleSync}>
          <RefreshCw size={14} /> Sync
        </button>
      </div>

      {markdown && (
        <div className="card">
          <div className="card-title">
            <FileText size={14} /> Markdown Preview
          </div>
          <pre className="code-block" style={{ maxHeight: 400, overflow: 'auto' }}>
            {markdown}
          </pre>
        </div>
      )}
    </div>
  );
}
