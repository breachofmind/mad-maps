import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import 'mapbox-gl/dist/mapbox-gl.css';
import { mapboxgl, MAP_STYLE_OPTIONS } from './mapbox';
import { StyleSwitcher } from './StyleSwitcher';

export interface MapViewChange {
  center: { lng: number; lat: number };
  zoom: number;
}

interface MapViewProps {
  initialCenter: { lng: number; lat: number };
  initialZoom: number;
  initialStyleUrl: string;
  onMoveEnd?: (change: MapViewChange) => void;
  onStyleChange?: (styleUrl: string) => void;
  onMapReady?: (map: mapboxgl.Map) => void;
}

function styleIdForUrl(styleUrl: string): string {
  return MAP_STYLE_OPTIONS.find((s) => s.styleUrl === styleUrl)?.id ?? MAP_STYLE_OPTIONS[0].id;
}

export function MapView({
  initialCenter,
  initialZoom,
  initialStyleUrl,
  onMoveEnd,
  onStyleChange,
  onMapReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [activeStyleId, setActiveStyleId] = useState(styleIdForUrl(initialStyleUrl));

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: initialStyleUrl,
      center: [initialCenter.lng, initialCenter.lat],
      zoom: initialZoom,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    map.on('moveend', () => {
      const center = map.getCenter();
      onMoveEnd?.({ center: { lng: center.lng, lat: center.lat }, zoom: map.getZoom() });
    });

    map.on('load', () => onMapReady?.(map));

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleStyleChange(styleId: string) {
    const option = MAP_STYLE_OPTIONS.find((s) => s.id === styleId);
    if (!option || !mapRef.current) return;
    mapRef.current.setStyle(option.styleUrl);
    setActiveStyleId(styleId);
    onStyleChange?.(option.styleUrl);
  }

  return (
    <Box position="relative" width="100vw" height="100vh">
      <Box ref={containerRef} width="100%" height="100%" />
      <StyleSwitcher activeStyleId={activeStyleId} onChange={handleStyleChange} />
    </Box>
  );
}
