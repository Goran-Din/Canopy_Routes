import { useState } from 'react';
import { adminFetch, setToken } from '../api/http';

interface Props {
  onLogin: (name: string) => void;
}

export function LoginPage({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch('/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(data.data.accessToken);
      onLogin(data.data.name);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: '#1E293B', borderRadius: 16, padding: 40, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ color: '#93C5FD', fontSize: 13, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>NORTH 37 LLC</div>
          <div style={{ color: 'white', fontSize: 24, fontWeight: 700 }}>Canopy Routes</div>
          <div style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>Super-Admin Panel</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ color: '#94A3B8', fontSize: 13, display: 'block', marginBottom: 6 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px', color: 'white', fontSize: 14, boxSizing: 'border-box' }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ color: '#94A3B8', fontSize: 13, display: 'block', marginBottom: 6 }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px', color: 'white', fontSize: 14, boxSizing: 'border-box' }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </div>

        {error && <div style={{ color: '#FCA5A5', fontSize: 13, marginBottom: 16, padding: '8px 12px', background: '#1F0F0F', borderRadius: 6 }}>{error}</div>}

        <button onClick={handleLogin} disabled={loading || !email || !password}
          style={{ width: '100%', background: '#2563EB', color: 'white', border: 'none', borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </div>
    </div>
  );
}
