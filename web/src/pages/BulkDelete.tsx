import { useState } from 'react';
import { api, type MemoryInfo } from '../api.ts';

interface Props {
  memories: MemoryInfo[];
  onNavigate: (page: 'memory', params: { memoryId: string; memoryName: string }) => void;
}

export default function BulkDelete({ memories }: Props) {
  const [memoryId, setMemoryId] = useState('');
  const [method, setMethod] = useState<'titles' | 'tags' | 'pattern'>('titles');
  const [value, setValue] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    if (!memoryId || !value.trim()) return;
    setProcessing(true);
    setError('');
    setResult(null);
    try {
      const data = await api.bulkDelete(memoryId, method, value.trim(), useRegex, dryRun);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Bulk Delete</h1>

      <div className="card">
        <div className="form-group">
          <label className="form-label">Memory</label>
          <select className="input" value={memoryId} onChange={(e) => setMemoryId(e.target.value)}>
            <option value="">Select a memory...</option>
            {memories.map((m) => (
              <option key={m.memoryId} value={m.memoryId}>
                {m.memoryName}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Method</label>
          <div className="btn-group">
            {(['titles', 'tags', 'pattern'] as const).map((m) => (
              <button
                key={m}
                className={`btn btn-sm ${method === m ? 'btn-primary' : ''}`}
                onClick={() => setMethod(m)}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            {method === 'titles'
              ? 'Titles (comma-separated)'
              : method === 'tags'
                ? 'Tags (comma-separated)'
                : 'Search Pattern'}
          </label>
          <input
            className="input"
            placeholder={
              method === 'titles'
                ? 'Entry1, Entry2, Entry3'
                : method === 'tags'
                  ? 'project, config, preference'
                  : 'keyword or regex pattern'
            }
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>

        {method === 'pattern' && (
          <div className="form-group">
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={useRegex}
                onChange={(e) => setUseRegex(e.target.checked)}
              />
              <span style={{ marginLeft: '0.5rem' }}>Use regex</span>
            </label>
          </div>
        )}

        <div className="form-group">
          <label className="form-checkbox">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            <span style={{ marginLeft: '0.5rem' }}>Dry run (preview without deleting)</span>
          </label>
        </div>

        <button
          className="btn btn-danger"
          onClick={handleDelete}
          disabled={processing || !memoryId || !value.trim()}
        >
          {processing ? 'Processing...' : dryRun ? 'Preview' : 'Delete'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div className="card">
          <div className="card-title">Result</div>
          <pre className="markdown-preview">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
