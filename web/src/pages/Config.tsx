import { useEffect, useState } from 'react';
import { api } from '../api.ts';

export default function Config() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState<Record<string, string>>({});

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const c = await api.getConfig();
      setConfig(c);
      const edit: Record<string, string> = {};
      for (const [key, val] of Object.entries(c)) {
        if (key === 'version' || key === 'baseDir' || key === 'universalMemories') continue;
        edit[key] = typeof val === 'object' ? JSON.stringify(val) : String(val);
      }
      setEditing(edit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(key: string) {
    try {
      let parsed: unknown = editing[key];
      try {
        parsed = JSON.parse(editing[key]);
      } catch {
        parsed = editing[key];
      }
      const update: Record<string, unknown> = {};
      update[key] = parsed;
      await api.updateConfig(update);
      setSuccess(`Updated ${key}`);
      loadConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  if (loading) return <div className="loading">Loading config...</div>;

  const editableKeys = config
    ? Object.keys(config).filter((k) => !['version', 'baseDir', 'universalMemories'].includes(k))
    : [];

  return (
    <div>
      <h1 className="page-title">Configuration</h1>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="card-title">Edit Config</div>
        {editableKeys.map((key) => (
          <div key={key} className="form-group">
            <label className="form-label">{key}</label>
            <div className="inline-form">
              <input
                className="input"
                value={editing[key] || ''}
                onChange={(e) => setEditing((prev) => ({ ...prev, [key]: e.target.value }))}
              />
              <button className="btn btn-primary btn-sm" onClick={() => handleSave(key)}>
                Save
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Raw Config</div>
        <pre className="markdown-preview">{JSON.stringify(config, null, 2)}</pre>
      </div>
    </div>
  );
}
