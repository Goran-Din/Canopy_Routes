import { useState, useRef, useEffect, useCallback } from 'react';
import { http } from '../../api/http';

type ModalState = 'idle' | 'uploading' | 'geocoding' | 'complete' | 'error';

interface JobStatus {
  status: string;
  jobId: string;
  total?: number;
  progress?: number;
  imported?: number;
  failed?: number;
  errorRows?: Array<{ rowNumber: number; clientName: string; errorMessage: string }>;
}

interface UploadModalProps {
  isOpen: boolean;
  seasonId: string;
  seasonName: string;
  onClose: () => void;
  onComplete: () => void;
}

export function UploadModal({ isOpen, seasonId, seasonName, onClose, onComplete }: UploadModalProps) {
  const [state, setState] = useState<ModalState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [job, setJob] = useState<JobStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [dragging, setDragging] = useState(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setState('idle');
      setFile(null);
      setError('');
      setJob(null);
    }
  }, [isOpen]);

  const startPolling = useCallback((jobId: string) => {
    setState('geocoding');
    pollRef.current = setInterval(async () => {
      try {
        const res = await http.get(`/v1/clients/upload/${jobId}`);
        const data = res.data.data as JobStatus;
        setJob(data);
        if (data.status === 'complete') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setState('complete');
        } else if (data.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setError(data.errorRows?.[0]?.errorMessage ?? 'Upload job failed.');
          setState('error');
        }
      } catch {
        // Keep polling on transient errors
      }
    }, 2000);
  }, []);

  async function handleUpload() {
    if (!file) return;
    setState('uploading');
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('season_id', seasonId);
      const res = await http.post('/v1/clients/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { jobId } = res.data.data;
      setJob(res.data.data);
      startPolling(jobId);
    } catch (err: any) {
      const msg = err.response?.data?.error ?? 'Upload failed.';
      setError(msg);
      setState('error');
    }
  }

  function handleDone() {
    onComplete();
    onClose();
  }

  function handleTryAgain() {
    setState('idle');
    setFile(null);
    setError('');
    setJob(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) setFile(f);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  if (!isOpen) return null;

  const progressPct = job?.progress ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-cr-text">Upload Client CSV</h2>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* State 1: File Selection */}
          {state === 'idle' && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  dragging ? 'border-cr-blue bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-3xl mb-2 text-gray-400">&uarr;</div>
                {file ? (
                  <div className="text-sm font-medium text-cr-text">{file.name}</div>
                ) : (
                  <div className="text-sm text-gray-500">
                    Drop your CSV file here or click to browse
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="text-xs text-gray-500">
                Season: <span className="font-medium text-cr-text">{seasonName}</span>
              </div>
            </>
          )}

          {/* State 2: Uploading */}
          {state === 'uploading' && (
            <div className="text-center py-6">
              <div className="inline-block w-8 h-8 border-3 border-cr-navy border-t-transparent rounded-full animate-spin mb-3" />
              <div className="text-sm text-gray-600">Uploading...</div>
            </div>
          )}

          {/* State 2b: Geocoding progress */}
          {state === 'geocoding' && (
            <div className="py-4 space-y-3">
              <div className="text-sm text-gray-600 text-center">
                Geocoding {job?.imported ?? 0} of {job?.total ?? '?'} addresses...
              </div>
              <div className="w-full h-3 rounded-full bg-gray-200">
                <div
                  className="h-3 rounded-full bg-green-500 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 text-center">{progressPct}%</div>
            </div>
          )}

          {/* State 3: Complete */}
          {state === 'complete' && (
            <div className="text-center py-4 space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 text-2xl font-bold">
                &#10003;
              </div>
              <div className="text-base font-semibold text-cr-text">Upload complete!</div>
              <div className="text-sm text-gray-600">
                {job?.imported ?? 0} clients imported successfully
              </div>
              {(job?.failed ?? 0) > 0 && (
                <div className="text-sm text-amber-600">
                  {job!.failed} addresses could not be geocoded — you can fix these later
                </div>
              )}
            </div>
          )}

          {/* State 4: Error */}
          {state === 'error' && (
            <div className="text-center py-4 space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 text-2xl font-bold">
                &#10007;
              </div>
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
          {state === 'idle' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-cr-border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!file}
                className="px-4 py-2 text-sm font-medium text-white bg-cr-navy rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                Upload &amp; Geocode
              </button>
            </>
          )}
          {state === 'complete' && (
            <button
              onClick={handleDone}
              className="px-4 py-2 text-sm font-medium text-white bg-cr-navy rounded-lg hover:opacity-90"
            >
              Done
            </button>
          )}
          {state === 'error' && (
            <button
              onClick={handleTryAgain}
              className="px-4 py-2 text-sm font-medium text-white bg-cr-navy rounded-lg hover:opacity-90"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
