import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/auth.api';
import { useAuthStore } from '../store/authStore';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(email, password, tenantSlug);
      setAuth({
        accessToken: data.accessToken,
        userId: data.user.id,
        role: data.user.role,
        tenantId: data.user.tenantId,
        displayName: data.user.displayName,
      });
      navigate('/', { replace: true });
    } catch {
      setError('Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cr-surface">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm space-y-4"
      >
        <h1 className="text-2xl font-bold text-cr-navy text-center">Canopy Routes</h1>

        {error && (
          <p className="text-sm text-cr-red bg-red-50 rounded px-3 py-2">{error}</p>
        )}

        <input
          type="text"
          placeholder="Tenant slug (e.g. sunset-services)"
          value={tenantSlug}
          onChange={(e) => setTenantSlug(e.target.value)}
          required
          className="w-full px-3 py-2 border border-cr-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cr-blue"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2 border border-cr-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cr-blue"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-3 py-2 border border-cr-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cr-blue"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-cr-blue text-white rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
