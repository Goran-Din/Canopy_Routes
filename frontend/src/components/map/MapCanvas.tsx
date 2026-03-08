import React, { useRef, useEffect, useState, createContext, useContext } from 'react';

export const MapContext = createContext<google.maps.Map | null>(null);
export const useMap = () => useContext(MapContext);

interface MapCanvasProps {
  children?: React.ReactNode;
  onMapClick?: (lat: number, lng: number) => void;
}

export function MapCanvas({ children, onMapClick }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [gmapsLoaded, setGmapsLoaded] = useState(
    typeof google !== 'undefined' && !!google.maps
  );

  useEffect(() => {
    if (gmapsLoaded) return;

    // Poll for google.maps to become available (loaded via async script tag)
    const interval = setInterval(() => {
      if (typeof google !== 'undefined' && google.maps) {
        setGmapsLoaded(true);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [gmapsLoaded]);

  useEffect(() => {
    if (!gmapsLoaded || !containerRef.current || mapRef.current) return;

    try {
      mapRef.current = new google.maps.Map(containerRef.current, {
        center: { lat: 41.7489, lng: -88.2674 },
        zoom: 11,
        mapTypeId: 'roadmap',
        gestureHandling: 'greedy',
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: false,
      });

      setMapReady(true);
    } catch (e) {
      console.error('Failed to initialize Google Maps:', e);
    }
  }, [gmapsLoaded]);

  // Map click handler for hardscape pins etc.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onMapClick) return;
    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        onMapClick(e.latLng.lat(), e.latLng.lng());
      }
    });
    return () => google.maps.event.removeListener(listener);
  }, [mapReady, onMapClick]);

  if (!gmapsLoaded) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-cr-surface text-cr-text-muted">
        Loading map...
      </div>
    );
  }

  return (
    <MapContext.Provider value={mapRef.current}>
      <div ref={containerRef} className="w-full h-full" />
      {mapReady && children}
    </MapContext.Provider>
  );
}
