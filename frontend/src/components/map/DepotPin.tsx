import { useEffect, useRef } from 'react';
import { useMap } from './MapCanvas';

const DEPOT = { lat: 41.7606, lng: -88.1381 };

export function DepotPin() {
  const map = useMap();
  const markerRef = useRef<google.maps.Marker | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);

  useEffect(() => {
    if (!map) return;

    if (markerRef.current) return;

    const marker = new google.maps.Marker({
      map,
      position: DEPOT,
      title: 'Sunset Services Depot',
      icon: {
        path: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
        fillColor: '#1B3A5C',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 1.5,
        scale: 1.3,
        anchor: new google.maps.Point(12, 22),
      },
    });

    const infoWindow = new google.maps.InfoWindow({
      content: '<div style="font-family:sans-serif;padding:4px"><strong>Sunset Services Depot</strong><br/>1630 Mountain Dr, Aurora IL</div>',
    });

    marker.addListener('click', () => {
      infoWindow.open({ anchor: marker, map });
    });

    markerRef.current = marker;
    infoRef.current = infoWindow;

    return () => {
      if (markerRef.current) markerRef.current.setMap(null);
      markerRef.current = null;
    };
  }, [map]);

  return null;
}
