import { useNavigate, NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function NavBar() {
  const displayName = useAuthStore((s) => s.displayName);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1 text-sm font-medium ${isActive ? 'text-cr-navy border-b-2 border-cr-navy' : 'text-cr-text-muted hover:text-cr-text'}`;

  return (
    <div className="bg-white border-b border-cr-border px-6 h-12 flex items-center flex-shrink-0">
      <button onClick={() => navigate('/')} className="font-bold text-cr-navy text-lg mr-8">
        Canopy Routes
      </button>
      <nav className="flex items-center gap-4 h-full">
        <NavLink to="/" end className={linkCls}>Dashboard</NavLink>
        <NavLink to="/routes" className={linkCls}>Maintenance</NavLink>
        <NavLink to="/snow" className={linkCls}>Snow</NavLink>
        <NavLink to="/ai" className={linkCls}>AI</NavLink>
        <NavLink to="/settings" className={linkCls}>Settings</NavLink>
      </nav>
      <div className="flex-1" />
      {displayName && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-cr-text-muted">{displayName}</span>
          <button
            onClick={() => { clearAuth(); navigate('/login'); }}
            className="text-xs text-cr-text-muted hover:text-cr-text"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
