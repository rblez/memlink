import { useEffect, useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '../api.ts';

interface Props {
  memoryId: string;
  memoryName: string;
  entryTitle?: string;
  onNavigate: (page: 'memory', params: { memoryId: string; memoryName: string }) => void;
}

export default function EntryEdit({ memoryId, memoryName, entryTitle, onNavigate }: Props) {
  const [title, setTitle] = useState(entryTitle || '');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isEditing = !!entryTitle;

  useEffect(() => {
    if (entryTitle) {
      setLoading(true);
      api
        .getEntry(memoryId, entryTitle)
        .then((entry) => {
          setTitle(entry.title);
          setContent(entry.content);
          setTagsInput(entry.tags?.join(', ') || '');
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load entry'))
        .finally(() => setLoading(false));
    }
  }, [memoryId, entryTitle]);

  async function handleSave() {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!content.trim()) {
      setError('Content is required');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const tags = tagsInput.trim()
        ? tagsInput
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined;
      await api.upsertEntry(memoryId, title.trim(), content, tags);
      setSuccess(isEditing ? 'Entry updated' : 'Entry created');
      if (!isEditing) {
        setTitle('');
        setContent('');
        setTagsInput('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="back-link" onClick={() => onNavigate('memory', { memoryId, memoryName })}>
        <ArrowLeft size={14} /> Back to {memoryName}
      </div>

      <h1 className="page-title">{isEditing ? 'Edit Entry' : 'New Entry'}</h1>
      <div className="form-hint" style={{ marginBottom: '1rem' }}>
        Memory: {memoryName}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="form-group">
          <label className="form-label">Title</label>
          <input
            className="input"
            placeholder="Use PascalCase or Title Case (e.g. DatabaseConfig)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="form-hint">Short, descriptive name. Max 200 characters.</div>
        </div>

        <div className="form-group">
          <label className="form-label">Content</label>
          <textarea
            className="textarea"
            placeholder="Entry content..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
          />
          <div className="form-hint">Max 100,000 characters. Markdown supported.</div>
        </div>

        <div className="form-group">
          <label className="form-label">Tags (optional)</label>
          <input
            className="input"
            placeholder="Comma-separated: project, config, preference"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />
          <div className="form-hint">Max 20 tags, 50 characters each.</div>
        </div>

        <div className="btn-group">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : isEditing ? 'Update Entry' : 'Create Entry'}
          </button>
          <button className="btn" onClick={() => onNavigate('memory', { memoryId, memoryName })}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
