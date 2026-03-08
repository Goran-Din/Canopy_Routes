import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ZoneFitTab } from './ZoneFitTab';
import { RemovalImpactTab } from './RemovalImpactTab';
import { RouteFTab } from './RouteFTab';
import { PdfExportTab } from './PdfExportTab';
import type { Client, RouteWithSummary } from '../../types/map.types';

type TabKey = 'zone-fit' | 'removal-impact' | 'route-f' | 'pdf-export';

interface ToolsPanelProps {
  open: boolean;
  onClose: () => void;
  initialTab?: number;
  seasonId: string;
  userRole: string;
  clients: Client[];
  routes: RouteWithSummary[];
}

const TABS: { key: TabKey; label: string; roles?: string[] }[] = [
  { key: 'zone-fit', label: 'Zone Fit' },
  { key: 'removal-impact', label: 'Removal Impact', roles: ['owner', 'coordinator'] },
  { key: 'route-f', label: 'Route F', roles: ['owner', 'coordinator'] },
  { key: 'pdf-export', label: 'PDF Export', roles: ['owner', 'coordinator'] },
];

export function ToolsPanel({ open, onClose, initialTab, seasonId, userRole, clients, routes }: ToolsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('zone-fit');

  const visibleTabs = TABS.filter((t) => !t.roles || t.roles.includes(userRole));

  // When panel opens with a specific initialTab, switch to it
  useEffect(() => {
    if (open && initialTab != null && initialTab >= 0 && initialTab < visibleTabs.length) {
      setActiveTab(visibleTabs[initialTab].key);
    }
  }, [open, initialTab]);

  // Reset to first visible tab if current is hidden
  if (!visibleTabs.find((t) => t.key === activeTab) && visibleTabs.length > 0) {
    setActiveTab(visibleTabs[0].key);
  }

  return (
    <div
      className={`absolute top-0 right-0 h-full bg-white shadow-xl border-l border-cr-border z-20 flex flex-col transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ width: 380 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cr-border">
        <h3 className="text-sm font-semibold text-cr-text">Tools</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-cr-border">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 text-xs font-medium py-2.5 text-center transition-colors ${
              activeTab === t.key
                ? 'text-cr-blue border-b-2 border-cr-blue'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'zone-fit' && <ZoneFitTab seasonId={seasonId} userRole={userRole} />}
        {activeTab === 'removal-impact' && <RemovalImpactTab clients={clients} routes={routes} />}
        {activeTab === 'route-f' && <RouteFTab seasonId={seasonId} />}
        {activeTab === 'pdf-export' && <PdfExportTab seasonId={seasonId} routes={routes} />}
      </div>
    </div>
  );
}
