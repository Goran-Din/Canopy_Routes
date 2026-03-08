import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'warning' | 'error';
}

interface UIState {
  selectedRouteId: string | null;
  expandedRouteIds: Record<string, boolean>;
  isLeftPanelCollapsed: boolean;
  isToolsPanelOpen: boolean;
  toolsPanelInitialTab: number;
  setSelectedRoute: (id: string | null) => void;
  toggleRouteExpanded: (id: string) => void;
  toggleLeftPanel: () => void;
  openToolsPanel: (tab?: number) => void;
  closeToolsPanel: () => void;
  isSuggestModalOpen: boolean;
  openSuggestModal: () => void;
  closeSuggestModal: () => void;
  activeRouteId: string | null;
  setActiveRouteId: (id: string | null) => void;
  isUploadOpen: boolean;
  setUploadOpen: (open: boolean) => void;
  isGeocoderPanelOpen: boolean;
  setGeocoderPanelOpen: (open: boolean) => void;
  toasts: Toast[];
  addToast: (message: string, type: Toast['type']) => void;
  removeToast: (id: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedRouteId: null,
  expandedRouteIds: {},
  isLeftPanelCollapsed: false,
  isToolsPanelOpen: false,
  toolsPanelInitialTab: 0,
  setSelectedRoute: (id) => set({ selectedRouteId: id }),
  toggleRouteExpanded: (id) =>
    set((state) => {
      const wasExpanded = !!state.expandedRouteIds[id];
      if (wasExpanded) {
        // Collapsing — clear selection
        return {
          expandedRouteIds: { ...state.expandedRouteIds, [id]: false },
          selectedRouteId: null,
        };
      }
      // Expanding — collapse all others, select this one
      const newExpanded: Record<string, boolean> = {};
      for (const key of Object.keys(state.expandedRouteIds)) {
        newExpanded[key] = false;
      }
      newExpanded[id] = true;
      return {
        expandedRouteIds: newExpanded,
        selectedRouteId: id,
      };
    }),
  toggleLeftPanel: () =>
    set((state) => ({ isLeftPanelCollapsed: !state.isLeftPanelCollapsed })),
  openToolsPanel: (tab) =>
    set({ isToolsPanelOpen: true, ...(tab != null ? { toolsPanelInitialTab: tab } : {}) }),
  closeToolsPanel: () => set({ isToolsPanelOpen: false }),
  isSuggestModalOpen: false,
  openSuggestModal: () => set({ isSuggestModalOpen: true }),
  closeSuggestModal: () => set({ isSuggestModalOpen: false }),
  activeRouteId: null,
  setActiveRouteId: (id) => set({ activeRouteId: id }),
  isUploadOpen: false,
  setUploadOpen: (open) => set({ isUploadOpen: open }),
  isGeocoderPanelOpen: false,
  setGeocoderPanelOpen: (open) => set({ isGeocoderPanelOpen: open }),
  toasts: [],
  addToast: (message, type) => {
    const id = Date.now();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
