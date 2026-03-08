import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Maximize2, Minimize2, Wrench, Upload, Settings, Bot } from 'lucide-react';

interface MapToolbarProps {
  onToolsToggle?: () => void;
  onUploadClick?: () => void;
  onAiToggle?: () => void;
}

export function MapToolbar({ onToolsToggle, onUploadClick, onAiToggle }: MapToolbarProps) {
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggle = useCallback(() => {
    const el = document.getElementById('route-builder-map');
    if (!el) return;

    if (isFullscreen) {
      el.style.position = '';
      el.style.inset = '';
      el.style.zIndex = '';
    } else {
      el.style.position = 'fixed';
      el.style.inset = '0';
      el.style.zIndex = '50';
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  return (
    <div className="absolute top-2 right-2 z-10 flex gap-2">
      {onUploadClick && (
        <button
          onClick={onUploadClick}
          className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-lg shadow-md text-sm font-medium text-cr-text hover:bg-cr-surface"
          title="Upload CSV"
        >
          <Upload size={16} />
          Upload CSV
        </button>
      )}
      {onToolsToggle && (
        <button
          onClick={onToolsToggle}
          className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-lg shadow-md text-sm font-medium text-cr-text hover:bg-cr-surface"
          title="Tools"
        >
          <Wrench size={16} />
          Tools
        </button>
      )}
      {onAiToggle && (
        <button
          onClick={onAiToggle}
          className="flex items-center gap-1.5 bg-cr-navy text-white px-3 py-2 rounded-lg shadow-md text-sm font-medium hover:opacity-90"
          title="AI Assistant"
        >
          <Bot size={16} />
          AI
        </button>
      )}
      <button
        onClick={() => navigate('/settings')}
        className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-lg shadow-md text-sm font-medium text-cr-text hover:bg-cr-surface"
        title="Settings"
      >
        <Settings size={16} />
      </button>
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-lg shadow-md text-sm font-medium text-cr-text hover:bg-cr-surface"
        title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
      >
        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        {isFullscreen ? 'Exit' : 'Full Screen'}
      </button>
    </div>
  );
}
