import { create } from 'zustand';

interface AuthState {
  accessToken: string | null;
  userId: string | null;
  role: string | null;
  tenantId: string | null;
  displayName: string | null;
  setAuth: (data: { accessToken: string; userId: string; role: string; tenantId: string; displayName: string }) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  userId: null,
  role: null,
  tenantId: null,
  displayName: null,
  setAuth: (data) => set({
    accessToken: data.accessToken,
    userId: data.userId,
    role: data.role,
    tenantId: data.tenantId,
    displayName: data.displayName,
  }),
  clearAuth: () => set({
    accessToken: null,
    userId: null,
    role: null,
    tenantId: null,
    displayName: null,
  }),
}));
