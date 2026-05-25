import { useEffect, useState } from 'react';
import { api } from '../api.ts';

export default function Server() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getConfig()
      .then(setConfig)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load config'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading server info...</div>;

  return (
    <div>
      <h1 className="page-title">Server</h1>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="card-title">Server Configuration</div>
        {config ? (
          <table className="table">
            <tbody>
              {Object.entries(config).map(([key, value]) => (
                <tr key={key}>
                  <td style={{ color: 'var(--text-dim)', width: '200px' }}>{key}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <p>No config loaded.</p>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">MCP Info</div>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: '1.6' }}>
          The MCP server runs on the Express instance that hosts this web app. Memories are accessed
          via <code style={{ color: 'var(--primary)' }}>?id=MEMORY_ID</code> in the query string.
          <br />
          <br />
          For agent setup, use the <strong>memlink CLI</strong> command:{' '}
          <code style={{ color: 'var(--primary)' }}>memlink connect &lt;memory-name&gt;</code>
        </p>
      </div>
    </div>
  );
}
