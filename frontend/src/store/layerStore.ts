import { create } from 'zustand';

interface LayerState {
  routeColours: boolean;
  clientStatusBadges: boolean;
  driveLines: boolean;
  capacityHeat: boolean;
  hardscapeLayer: boolean;
  prospectLayer: boolean;
  priorSeason: boolean;
  snowContractType: boolean;
  acreageFlags: boolean;
  toggleLayer: (layer: keyof Omit<LayerState, 'toggleLayer'>) => void;
}

export const useLayerStore = create<LayerState>((set) => ({
  routeColours: true,
  clientStatusBadges: true,
  driveLines: false,
  capacityHeat: false,
  hardscapeLayer: false,
  prospectLayer: false,
  priorSeason: false,
  snowContractType: false,
  acreageFlags: true,
  toggleLayer: (layer) =>
    set((state) => ({ [layer]: !state[layer] })),
}));
