import { useEffect, useRef, useCallback } from 'react';
import { useMap } from './MapCanvas';
import { deleteHardscapePin } from '../../api/hardscapePins.api';
import type { HardscapePin } from '../../api/hardscapePins.api';

const CATEGORY_LABELS: Record<string, string> = {
  driveway: 'Driveway',
  patio: 'Patio',
  retaining_wall: 'Retaining Wall',
  steps: 'Steps',
  other: 'Other',
};

const DIAMOND_ICON = {
  path: 'M 0,-12 L 8,0 L 0,12 L -8,0 Z',
  fillColor: '#0d9488',
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 2,
  scale: 1.2,
};

interface HardscapePinManagerProps {
  pins: HardscapePin[];
  userRole: string;
  currentUserId: string | null;
  onEditPin: (pin: HardscapePin) => void;
  onPinDeleted: (pinId: string) => void;
}

export function HardscapePinManager({ pins, userRole, currentUserId, onEditPin, onPinDeleted }: HardscapePinManagerProps) {
  const map = useMap();
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);

  const handleDelete = useCallback(
    async (pin: HardscapePin) => {
      try {
        await deleteHardscapePin(pin.id);
        onPinDeleted(pin.id);
        if (infoRef.current) infoRef.current.close();
      } catch {
        // error handled silently
      }
    },
    [onPinDeleted]
  );

  useEffect(() => {
    if (!map) return;

    // Clear old markers
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];

    if (!infoRef.current) {
      infoRef.current = new google.maps.InfoWindow();
    }

    for (const pin of pins) {
      const marker = new google.maps.Marker({
        map,
        position: { lat: Number(pin.lat), lng: Number(pin.lng) },
        title: pin.label,
        icon: DIAMOND_ICON,
      });

      marker.addListener('click', () => {
        const canEdit = userRole === 'owner' || pin.created_by === currentUserId;

        let html = `<div style="font-family:sans-serif;min-width:180px;max-width:260px;font-size:13px;line-height:1.5">`;
        html += `<div style="margin-bottom:4px"><strong style="font-size:14px">${esc(pin.label)}</strong></div>`;
        html += `<div><span style="background:#0d9488;color:#fff;padding:1px 8px;border-radius:10px;font-size:11px">${CATEGORY_LABELS[pin.category] || pin.category}</span></div>`;
        if (pin.notes) {
          html += `<div style="margin-top:6px;color:#555">${esc(pin.notes)}</div>`;
        }
        html += `<div style="margin-top:6px;font-size:11px;color:#999">Added by ${esc(pin.created_by_name || 'Unknown')}</div>`;

        if (canEdit) {
          const btnStyle = 'display:inline-block;font-size:11px;padding:4px 10px;border:1px solid #E2E8F0;border-radius:4px;cursor:pointer;background:#F8FAFC;margin-right:6px;margin-top:8px';
          html += `<div>`;
          html += `<button id="__hp_edit" style="${btnStyle}">Edit</button>`;
          html += `<button id="__hp_delete" style="${btnStyle};color:#DC2626;border-color:#FCA5A5">Delete</button>`;
          html += `</div>`;
        }
        html += `</div>`;

        const iw = infoRef.current!;
        iw.setContent(html);
        iw.open(map, marker);

        google.maps.event.addListenerOnce(iw, 'domready', () => {
          const editBtn = document.getElementById('__hp_edit');
          const deleteBtn = document.getElementById('__hp_delete');
          if (editBtn) editBtn.addEventListener('click', () => { iw.close(); onEditPin(pin); });
          if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
              if (confirm('Delete this pin? This cannot be undone.')) {
                handleDelete(pin);
              }
            });
          }
        });
      });

      markersRef.current.push(marker);
    }

    return () => {
      for (const m of markersRef.current) m.setMap(null);
      markersRef.current = [];
    };
  }, [map, pins, userRole, currentUserId, onEditPin, handleDelete]);

  return null;
}

function esc(s: string | null | undefined): string {
  if (!s) return '';
  const el = document.createElement('span');
  el.textContent = s;
  return el.innerHTML;
}
