import { useState } from 'react';
import { Layers } from 'lucide-react';
import { useLayerStore } from '../../store/layerStore';

type LayerKey = 'routeColours' | 'clientStatusBadges' | 'acreageFlags' | 'driveLines' | 'capacityHeat' | 'hardscapeLayer' | 'prospectLayer' | 'priorSeason';

interface Toggle {
  key: LayerKey;
  label: string;
  roles: string[];
}

const TOGGLES: Toggle[] = [
  { key: 'routeColours', label: 'Route Colours', roles: ['owner', 'coordinator', 'salesperson', 'division_manager'] },
  { key: 'clientStatusBadges', label: 'Client Status Badges', roles: ['owner', 'coordinator', 'salesperson', 'division_manager'] },
  { key: 'acreageFlags', label: 'Acreage Flags', roles: ['owner', 'coordinator', 'salesperson', 'division_manager'] },
  { key: 'driveLines', label: 'Drive Lines', roles: ['coordinator', 'owner'] },
  { key: 'capacityHeat', label: 'Capacity Heat', roles: ['coordinator', 'owner'] },
  { key: 'hardscapeLayer', label: 'Hardscape Pins', roles: ['owner', 'coordinator', 'division_manager'] },
  { key: 'prospectLayer', label: 'Prospect Layer', roles: ['owner', 'coordinator', 'salesperson'] },
  { key: 'priorSeason', label: 'Prior Season', roles: ['coordinator', 'owner'] },
];

interface LayerControlsProps {
  userRole: string;
}

export function LayerControls({ userRole }: LayerControlsProps) {
  const [open, setOpen] = useState(false);
  const store = useLayerStore();

  const visibleToggles = TOGGLES.filter((t) => !userRole || t.roles.includes(userRole));

  console.log('[LayerControls] userRole:', JSON.stringify(userRole), 'visible toggles:', visibleToggles.length, visibleToggles.map(t => t.label));

  return (
    <div className="absolute top-2 left-2 z-10">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-lg shadow-md text-sm font-medium text-cr-text hover:bg-cr-surface"
      >
        <Layers size={16} />
        Layers
      </button>

      {open && (
        <div className="mt-1 bg-white rounded-lg shadow-md p-3 min-w-[200px]">
          {visibleToggles.map((t) => (
            <label key={t.key} className="flex items-center justify-between py-1.5 cursor-pointer">
              <span className="text-sm text-cr-text">{t.label}</span>
              <input
                type="checkbox"
                checked={store[t.key]}
                onChange={() => store.toggleLayer(t.key)}
                className="h-4 w-4 rounded border-cr-border text-cr-blue focus:ring-cr-blue"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
