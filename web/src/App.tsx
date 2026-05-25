import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { api, type MemoryInfo } from './api.ts';
import Home from './pages/Home.tsx';
import SearchPage from './pages/SearchPage.tsx';
import MemoryPage from './pages/MemoryPage.tsx';
import EntryEditPage from './pages/EntryEditPage.tsx';
import ExportPage from './pages/ExportPage.tsx';
import '@fontsource/geist-sans';
import '@fontsource/geist-mono';
import './App.css';

function Layout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [memories, setMemories] = useState<MemoryInfo[]>([]);
  const [q, setQ] = useState(searchParams.get('q') || '');

  useEffect(() => {
    api
      .listMemories()
      .then(setMemories)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setQ(searchParams.get('q') || '');
  }, [searchParams]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && q.trim()) {
      const match = memories.find((m) => m.memoryName.toLowerCase() === q.trim().toLowerCase());
      if (match) {
        navigate(`/${match.memoryId}`);
        setQ('');
      } else {
        navigate(`/search?q=${encodeURIComponent(q.trim())}`);
      }
    }
  }

  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="logo">
          Memlink
        </Link>
        <div className="search-wrap">
          <Search size={14} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={handleKey}
          />
          {q && (
            <button
              className="search-clear"
              onClick={() => {
                setQ('');
                navigate('/');
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Home memories={memories} />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/:memId" element={<MemoryPage />} />
          <Route path="/:memId/edit" element={<EntryEditPage />} />
          <Route path="/:memId/export" element={<ExportPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
