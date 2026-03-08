import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { fetchClients, assignClientToRoute } from '../../api/clients.api';
import { fetchRoutes, fetchStops, removeStop, reorderStops } from '../../api/routes.api';
import { getHardscapePins } from '../../api/hardscapePins.api';
import type { HardscapePin } from '../../api/hardscapePins.api';
import type { RouteStop } from '../../types/map.types';
import { MapCanvas } from './MapCanvas';
import { DepotPin } from './DepotPin';
import { MarkerManager } from './MarkerManager';
import { DriveLines } from './DriveLines';
import { ClientInfoWindow } from './ClientInfoWindow';
import { HardscapePinManager } from './HardscapePinManager';
import { AddHardscapePinModal } from './AddHardscapePinModal';
import { EditHardscapePinModal } from './EditHardscapePinModal';
import { LayerControls } from './LayerControls';
import { MapToolbar } from './MapToolbar';
import { LeftPanel } from '../panel/LeftPanel';
import { GeocoderPanel } from '../panel/GeocoderPanel';
import { ToolsPanel } from '../tools/ToolsPanel';
import { UploadModal } from '../upload/UploadModal';
import { SuggestRoutesModal } from '../upload/SuggestRoutesModal';
import { AddClientModal } from '../AddClientModal';
import { AiChatPanel } from '../AiChatPanel';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { useLayerStore } from '../../store/layerStore';
import type { Client } from '../../types/map.types';

interface RouteBuilderMapProps {
  seasonId: string;
  seasonName: string;
  userRole: string;
  seasonStatus: string;
}

export function RouteBuilderMap({ seasonId, seasonName, userRole, seasonStatus }: RouteBuilderMapProps) {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.userId);
  const addToast = useUIStore((s) => s.addToast);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const isSuggestModalOpen = useUIStore((s) => s.isSuggestModalOpen);
  const openSuggestModal = useUIStore((s) => s.openSuggestModal);
  const closeSuggestModal = useUIStore((s) => s.closeSuggestModal);
  const isToolsPanelOpen = useUIStore((s) => s.isToolsPanelOpen);
  const toolsPanelInitialTab = useUIStore((s) => s.toolsPanelInitialTab);
  const openToolsPanel = useUIStore((s) => s.openToolsPanel);
  const closeToolsPanel = useUIStore((s) => s.closeToolsPanel);

  // Hardscape pins state
  const hardscapeLayerOn = useLayerStore((s) => s.hardscapeLayer);
  const [hardscapePins, setHardscapePins] = useState<HardscapePin[]>([]);
  const [addPinOpen, setAddPinOpen] = useState(false);
  const [addPinCoords, setAddPinCoords] = useState<{ lat: number; lng: number }>({ lat: 0, lng: 0 });
  const [editPin, setEditPin] = useState<HardscapePin | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  useEffect(() => {
    if (hardscapeLayerOn) {
      getHardscapePins(seasonId).then(setHardscapePins).catch(() => {});
    } else {
      setHardscapePins([]);
    }
  }, [hardscapeLayerOn, seasonId]);

  const handleMapClickForPin = useCallback((lat: number, lng: number) => {
    if (!hardscapeLayerOn) return;
    if (userRole !== 'coordinator' && userRole !== 'owner') return;
    setAddPinCoords({ lat, lng });
    setAddPinOpen(true);
  }, [hardscapeLayerOn, userRole]);

  const handlePinAdded = useCallback((pin: HardscapePin) => {
    setHardscapePins((prev) => [pin, ...prev]);
    addToast('Hardscape pin added', 'success');
  }, [addToast]);

  const handlePinUpdated = useCallback((updated: HardscapePin) => {
    setHardscapePins((prev) => prev.map((p) => p.id === updated.id ? { ...p, ...updated } : p));
    addToast('Pin updated', 'success');
  }, [addToast]);

  const handlePinDeleted = useCallback((pinId: string) => {
    setHardscapePins((prev) => prev.filter((p) => p.id !== pinId));
    addToast('Pin deleted', 'success');
  }, [addToast]);

  const { data: routes = [] } = useQuery({
    queryKey: ['routes', seasonId],
    queryFn: () => fetchRoutes(seasonId),
    enabled: !!seasonId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', seasonId],
    queryFn: () => fetchClients(seasonId),
    enabled: !!seasonId,
  });

  const stopsQueries = useQueries({
    queries: routes.map((r) => ({
      queryKey: ['stops', r.route.id],
      queryFn: () => fetchStops(r.route.id),
      enabled: !!r.route.id,
    })),
  });

  const stopsByRouteId = useMemo(() => {
    const map: Record<string, RouteStop[]> = {};
    routes.forEach((r, i) => {
      map[r.route.id] = stopsQueries[i]?.data ?? r.stops;
    });
    return map;
  }, [routes, stopsQueries]);

  const invalidateAll = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['clients', seasonId] });
    await queryClient.invalidateQueries({ queryKey: ['routes', seasonId] });
    await queryClient.invalidateQueries({ queryKey: ['stops'] });
  }, [seasonId, queryClient]);

  const handleClose = useCallback(() => setSelectedClient(null), []);

  const handleAssign = useCallback(
    async (clientId: string, routeId: string) => {
      try {
        await assignClientToRoute(routeId, clientId);
        await invalidateAll();
        setSelectedClient(null);
      } catch {
        // TODO: show toast
      }
    },
    [invalidateAll]
  );

  const handlePanelAssign = useCallback(
    async (routeId: string, clientId: string) => {
      try {
        await assignClientToRoute(routeId, clientId);
        await invalidateAll();
      } catch {
        // TODO: show toast
      }
    },
    [invalidateAll]
  );

  const handleRemoveStop = useCallback(
    async (stopId: string) => {
      try {
        await removeStop(stopId);
        await invalidateAll();
      } catch {
        // TODO: show toast
      }
    },
    [invalidateAll]
  );

  const handleReorder = useCallback(
    async (routeId: string, orderedStopIds: string[]) => {
      try {
        await reorderStops(routeId, orderedStopIds);
        await invalidateAll();
      } catch {
        // TODO: show toast
      }
    },
    [invalidateAll]
  );

  const handleClientClick = useCallback((client: Client) => setSelectedClient(client), []);

  const handleEditClient = useCallback((client: Client) => {
    setEditClient(client);
    setSelectedClient(null);
  }, []);

  const handleCheckImpact = useCallback((_client: Client) => {
    openToolsPanel(1);
    setSelectedClient(null);
  }, [openToolsPanel]);

  const geocodeFailedCount = clients.filter((c) => c.address_lat === null).length;
  const readOnly = seasonStatus === 'published' && userRole === 'coordinator';

  return (
    <div id="route-builder-map" className="flex w-full h-full bg-cr-surface">
      <LeftPanel
        seasonId={seasonId}
        routes={routes}
        clients={clients}
        stopsByRouteId={stopsByRouteId}
        userRole={userRole}
        readOnly={readOnly}
        onAssignClient={handlePanelAssign}
        onRemoveStop={handleRemoveStop}
        onReorder={handleReorder}
        onUploadClick={() => setUploadOpen(true)}
        onSuggestClick={openSuggestModal}
        onAddClientClick={() => setAddClientOpen(true)}
        onClientStatusChanged={invalidateAll}
        geocodeFailedCount={geocodeFailedCount}
      />
      <div className="relative flex-1 h-full">
        <MapCanvas onMapClick={hardscapeLayerOn ? handleMapClickForPin : undefined}>
          <DepotPin />
          <MarkerManager clients={clients} routes={routes} stopsByRouteId={stopsByRouteId} onClientClick={handleClientClick} />
          <DriveLines routes={routes} />
          <ClientInfoWindow
            client={selectedClient}
            routes={routes}
            userRole={userRole}
            onClose={handleClose}
            onAssignToRoute={handleAssign}
            onEditClient={handleEditClient}
            onCheckImpact={handleCheckImpact}
          />
          {hardscapeLayerOn && hardscapePins.length > 0 && (
            <HardscapePinManager
              pins={hardscapePins}
              userRole={userRole}
              currentUserId={currentUserId}
              onEditPin={(pin) => setEditPin(pin)}
              onPinDeleted={handlePinDeleted}
            />
          )}
        </MapCanvas>
        <LayerControls userRole={userRole} />
        <MapToolbar
          onToolsToggle={() => isToolsPanelOpen ? closeToolsPanel() : openToolsPanel()}
          onUploadClick={() => setUploadOpen(true)}
          onAiToggle={() => setAiPanelOpen((v) => !v)}
        />
        <ToolsPanel
          open={isToolsPanelOpen}
          onClose={closeToolsPanel}
          initialTab={toolsPanelInitialTab}
          seasonId={seasonId}
          userRole={userRole}
          clients={clients}
          routes={routes}
        />
        <AiChatPanel seasonId={seasonId} open={aiPanelOpen} onClose={() => setAiPanelOpen(false)} />
      </div>
      <UploadModal
        isOpen={uploadOpen}
        seasonId={seasonId}
        seasonName={seasonName}
        onClose={() => setUploadOpen(false)}
        onComplete={invalidateAll}
      />
      <SuggestRoutesModal
        isOpen={isSuggestModalOpen}
        seasonId={seasonId}
        routes={routes}
        onClose={closeSuggestModal}
        onComplete={invalidateAll}
      />
      <GeocoderPanel />
      <AddClientModal
        isOpen={addClientOpen}
        onClose={() => setAddClientOpen(false)}
        onClientAdded={() => invalidateAll()}
      />
      <AddClientModal
        isOpen={!!editClient}
        onClose={() => setEditClient(null)}
        onClientAdded={() => { setEditClient(null); invalidateAll(); }}
        initialData={editClient}
      />
      <AddHardscapePinModal
        isOpen={addPinOpen}
        lat={addPinCoords.lat}
        lng={addPinCoords.lng}
        seasonId={seasonId}
        onClose={() => setAddPinOpen(false)}
        onAdded={handlePinAdded}
      />
      <EditHardscapePinModal
        isOpen={!!editPin}
        pin={editPin}
        onClose={() => setEditPin(null)}
        onUpdated={handlePinUpdated}
      />
    </div>
  );
}
