import { useQuery } from '@tanstack/react-query';
import { X, Download, RotateCw, AlertTriangle } from 'lucide-react';
import { getFailedClients, downloadFailedClientsCsv, retryGeocode } from '../../api/failedClients.api';
import { useUIStore } from '../../store/uiStore';

export function GeocoderPanel() {
  const isOpen = useUIStore((s) => s.isGeocoderPanelOpen);
  const close = useUIStore((s) => s.setGeocoderPanelOpen);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['failed-clients'],
    queryFn: getFailedClients,
    enabled: isOpen,
  });

  if (!isOpen) return null;

  async function handleRetry(clientId: string) {
    try {
      await retryGeocode(clientId);
    } catch {
      // 501 expected — stub endpoint
    }
    refetch();
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 bg-white border-l border-cr-border shadow-xl flex flex-col">
      {/* Header */}
      <div className="h-12 flex items-center px-4 border-b border-cr-border flex-shrink-0">
        <AlertTriangle size={16} className="text-amber-500 mr-2" />
        <h2 className="font-semibold text-cr-text text-sm">
          Geocode Issues {data ? `\u00B7 ${data.total} client${data.total !== 1 ? 's' : ''}` : ''}
        </h2>
        <div className="flex-1" />
        <button
          onClick={() => downloadFailedClientsCsv()}
          className="flex items-center gap-1 border border-gray-300 text-gray-600 text-xs font-medium px-2 py-1 rounded hover:bg-gray-50 mr-2"
          title="Download Report"
        >
          <Download size={12} />
          Download
        </button>
        <button onClick={() => close(false)} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="px-4 py-8 text-center text-sm text-cr-text-muted">Loading...</div>
        )}
        {data && data.clients.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-cr-text-muted">
            No geocode issues found.
          </div>
        )}
        {data?.clients.map((c) => (
          <div key={c.id} className="px-4 py-3 border-b border-cr-border">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-cr-text truncate">{c.client_name}</div>
                <div className="text-xs text-cr-text-muted mt-0.5">
                  {c.service_address}, {c.city}, {c.state} {c.zip}
                </div>
                <div className="mt-1">
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                    {c.geocode_status}
                  </span>
                  {c.failure_reason && (
                    <span className="text-xs text-cr-text-muted ml-2">{c.failure_reason}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleRetry(c.id)}
                className="text-gray-400 hover:text-cr-navy flex-shrink-0 mt-1"
                title="Retry Geocode"
              >
                <RotateCw size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
