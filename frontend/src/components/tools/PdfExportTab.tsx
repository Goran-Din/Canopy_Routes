import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Download, CheckSquare, Square } from 'lucide-react';
import { startPdfGeneration, pollPdfJob, downloadPdfZip, PdfJobStatus } from '../../api/exportPdf.api';
import type { RouteWithSummary } from '../../types/map.types';

interface PdfExportTabProps {
  seasonId: string;
  routes: RouteWithSummary[];
}

export function PdfExportTab({ seasonId, routes }: PdfExportTabProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [includeRevenue, setIncludeRevenue] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<PdfJobStatus | null>(null);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Select all routes by default when routes change
  useEffect(() => {
    setSelectedIds(new Set(routes.map((r) => r.route.id)));
  }, [routes]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const allSelected = selectedIds.size === routes.length && routes.length > 0;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(routes.map((r) => r.route.id)));
    }
  }

  function toggleRoute(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const startPolling = useCallback((id: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const status = await pollPdfJob(id);
        setJobStatus(status);

        if (status.status === 'complete' || status.status === 'error') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setGenerating(false);

          if (status.status === 'error') {
            setError(status.error || 'PDF generation failed.');
          }
        }
      } catch {
        // Keep polling on transient errors
      }
    }, 2000);
  }, []);

  async function handleGenerate() {
    if (selectedIds.size === 0) return;
    setError('');
    setJobStatus(null);
    setGenerating(true);

    try {
      const id = await startPdfGeneration({
        route_ids: Array.from(selectedIds),
        season_id: seasonId,
        include_revenue: includeRevenue,
      });
      setJobId(id);
      setJobStatus({ status: 'pending', progress: 0, total: selectedIds.size, completed: 0, files: [] });
      startPolling(id);
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to start PDF generation.');
      setGenerating(false);
    }
  }

  async function handleDownload() {
    if (!jobId) return;
    try {
      await downloadPdfZip(jobId);
    } catch {
      setError('Download failed.');
    }
  }

  const isComplete = jobStatus?.status === 'complete';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FileText size={18} className="text-red-500" />
        <h3 className="text-sm font-semibold text-cr-text">Print Route Sheets (PDF)</h3>
      </div>

      <p className="text-xs text-gray-500">
        Generate printable PDF route sheets for your crews. Select routes below and click Generate.
      </p>

      {/* Route selector */}
      <div className="border border-cr-border rounded-lg overflow-hidden">
        <button
          onClick={toggleSelectAll}
          disabled={generating}
          className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-600 hover:bg-gray-100 border-b border-cr-border disabled:opacity-50"
        >
          {allSelected ? <CheckSquare size={14} className="text-cr-blue" /> : <Square size={14} />}
          Select All ({routes.length} routes)
        </button>
        <div className="max-h-48 overflow-y-auto">
          {routes.map((r) => {
            const selected = selectedIds.has(r.route.id);
            return (
              <button
                key={r.route.id}
                onClick={() => toggleRoute(r.route.id)}
                disabled={generating}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {selected ? <CheckSquare size={14} className="text-cr-blue" /> : <Square size={14} className="text-gray-300" />}
                <span className="font-medium">{r.route.route_label}</span>
                <span className="text-gray-400 capitalize">{r.route.day_of_week}</span>
                <span className="ml-auto text-gray-400">{r.summary.stop_count} stops</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Options */}
      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={includeRevenue}
          onChange={(e) => setIncludeRevenue(e.target.checked)}
          disabled={generating}
          className="rounded border-gray-300 text-cr-navy focus:ring-cr-blue"
        />
        Include revenue column
      </label>

      {/* Generate / Progress / Download */}
      {!generating && !isComplete && (
        <button
          onClick={handleGenerate}
          disabled={selectedIds.size === 0}
          className="w-full py-2.5 bg-cr-navy text-white rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50"
        >
          Generate PDFs ({selectedIds.size} routes)
        </button>
      )}

      {generating && jobStatus && (
        <div className="space-y-2">
          <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-3 rounded-full bg-cr-navy transition-all duration-300"
              style={{ width: `${jobStatus.progress}%` }}
            />
          </div>
          <div className="text-xs text-gray-600 text-center">
            Generating PDFs... ({jobStatus.completed} / {jobStatus.total} complete)
          </div>
        </div>
      )}

      {isComplete && (
        <button
          onClick={handleDownload}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700"
        >
          <Download size={16} />
          Download All (ZIP)
        </button>
      )}

      {/* Reset after download */}
      {isComplete && (
        <button
          onClick={() => { setJobId(null); setJobStatus(null); }}
          className="w-full py-2 text-xs text-gray-500 hover:text-gray-700"
        >
          Generate new set
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
