import { useState, useEffect } from 'react';
import { LoginPage } from './pages/LoginPage';
import { TenantsPage } from './pages/TenantsPage';

function App() {
  const [adminName, setAdminName] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem('admin_token');
    const name = sessionStorage.getItem('admin_name');
    if (token && name) setAdminName(name);
  }, []);

  if (!adminName) {
    return <LoginPage onLogin={name => {
      sessionStorage.setItem('admin_name', name);
      setAdminName(name);
    }} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: '#1B2A4A', padding: '0 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#93C5FD', fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>NORTH 37</span>
          <span style={{ color: '#334155', fontSize: 18 }}>|</span>
          <span style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>Canopy Routes Admin</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#94A3B8', fontSize: 13 }}>{adminName}</span>
          <button onClick={() => { sessionStorage.clear(); setAdminName(null); }}
            style={{ color: '#94A3B8', background: 'none', border: '1px solid #334155', borderRadius: 6, padding: '4px 12px', fontSize: 13, cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </div>
      <TenantsPage />
    </div>
  );
}

export default App;
