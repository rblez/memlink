import { useState, useEffect } from 'react';
import { api, type BackupInfo, type MemoryInfo } from '../api.ts';

interface Props {
  memories: MemoryInfo[];
  onNavigate: (page: 'memory', params: { memoryId: string; memoryName: string }) => void;
}

export default function Backups({ memories }: Props) {
  const [memoryId, setMemoryId] = useState('');
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (memoryId) loadBackups();
    else setBackups([]);
  }, [memoryId]);

  async function loadBackups() {
    setLoading(true);
    try {
      const data = await api.listBackups(memoryId);
      setBackups(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBackup() {
    try {
      const result = await api.createBackup(memoryId);
      setSuccess(`Backup created: ${result.path}`);
      loadBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup');
    }
  }

  async function handleRestore(backupPath: string) {
    if (!confirm('Restore this backup? This will replace all current entries.')) return;
    try {
      const result = await api.restoreBackup(memoryId, backupPath, true);
      setSuccess(`Restored ${result.restored} entries`);
      loadBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
    }
  }

  async function handleDeleteBackup(backupPath: string) {
    if (!confirm('Delete this backup?')) return;
    try {
      await api.deleteBackup(backupPath);
      setBackups((prev) => prev.filter((b) => b.path !== backupPath));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete backup');
    }
  }

  async function handleCleanup() {
    const keep = prompt('Number of backups to keep:', '10');
    if (keep === null) return;
    const count = parseInt(keep, 10);
    if (isNaN(count) || count < 1) return;
    try {
      const result = await api.cleanupBackups(memoryId, count);
      setSuccess(`Cleanup: kept ${result.kept}, deleted ${result.deleted}`);
      loadBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cleanup failed');
    }
  }

  return (
    <div>
      <h1 className="page-title">Backups</h1>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

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

        {memoryId && (
          <div className="btn-group">
            <button className="btn btn-primary" onClick={handleCreateBackup}>
              Create Backup
            </button>
            <button className="btn" onClick={loadBackups}>
              Refresh
            </button>
            <button className="btn" onClick={handleCleanup}>
              Cleanup Old
            </button>
          </div>
        )}
      </div>

      {loading && <div className="loading">Loading backups...</div>}

      {backups.length > 0 && (
        <div className="card">
          <div className="card-title">Backups ({backups.length})</div>
          <table className="table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Entries</th>
                <th>Size</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.filename}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{b.filename}</td>
                  <td>{b.entryCount}</td>
                  <td>{(b.size / 1024).toFixed(1)} KB</td>
                  <td>{new Date(b.createdAt).toLocaleString()}</td>
                  <td>
                    <div className="btn-group">
                      <button className="btn btn-sm" onClick={() => handleRestore(b.path)}>
                        Restore
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteBackup(b.path)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {memoryId && !loading && backups.length === 0 && (
        <div className="empty-state">
          <p>No backups for this memory.</p>
        </div>
      )}
    </div>
  );
}
