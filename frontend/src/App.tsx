import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useUIStore } from './store/uiStore';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { RouteBuilderPage } from './pages/RouteBuilderPage';
import { SnowRouteBuilderPage } from './pages/SnowRouteBuilderPage';
import { SettingsPage } from './pages/SettingsPage';
import AiAssistantPage from './pages/AiAssistantPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);
  if (toasts.length === 0) return null;

  const colours = {
    success: 'bg-green-600',
    warning: 'bg-amber-500',
    error: 'bg-red-600',
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${colours[t.type]} text-white text-sm px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 max-w-sm animate-[slideIn_0.2s_ease-out]`}
        >
          <span className="flex-1">{t.message}</span>
          <button onClick={() => removeToast(t.id)} className="text-white/70 hover:text-white">&times;</button>
        </div>
      ))}
    </div>
  );
}

export function App() {
  return (
    <>
    <ToastContainer />
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/routes"
        element={
          <RequireAuth>
            <RouteBuilderPage />
          </RequireAuth>
        }
      />
      <Route
        path="/snow"
        element={
          <RequireAuth>
            <SnowRouteBuilderPage />
          </RequireAuth>
        }
      />
      <Route
        path="/ai"
        element={
          <RequireAuth>
            <AiAssistantPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
