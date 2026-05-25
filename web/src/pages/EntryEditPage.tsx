import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api, type MemoryInfo, type MemoryEntry } from '../api.ts';

export default function EntryEditPage() {
  const { memId } = useParams<{ memId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [memory, setMemory] = useState<MemoryInfo | null>(null);
  const [title, setTitle] = useState(searchParams.get('title') || '');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const isEdit = !!searchParams.get('title');

  useEffect(() => {
    if (!memId) return;
    api
      .getMemory(memId)
      .then(setMemory)
      .catch(() => {});
    if (isEdit) {
      const entryTitle = searchParams.get('title')!;
      api
        .getEntry(memId, entryTitle)
        .then((entry) => {
          setTitle(entry.title);
          setContent(entry.content);
          setTags(entry.tags?.join(', ') || '');
        })
        .catch(() => {});
    }
  }, [memId]);

  async function handleSave() {
    if (!memId || !title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await api.upsertEntry(memId, title.trim(), content.trim(), tagList);
      navigate(`/${memId}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link to={`/${memId}`} className="back-link">
        <ArrowLeft size={14} /> Back
      </Link>

      <h1 className="page-title">{isEdit ? 'Edit Entry' : 'New Entry'}</h1>
      {memory && <p className="page-subtitle">{memory.memoryName}</p>}

      <div className="entry-form">
        <input
          className="input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="input textarea"
          placeholder="Content (Markdown)"
          rows={12}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <input
          className="input"
          placeholder="Tags (comma separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <div className="btn-row">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <Link to={`/${memId}`} className="btn">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
