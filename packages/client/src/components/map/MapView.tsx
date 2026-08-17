import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import 'mapbox-gl/dist/mapbox-gl.css';
import { mapboxgl } from '../../lib/map/mapbox';

export interface MapViewChange {
  center: { lng: number; lat: number };
  zoom: number;
}

interface MapViewProps {
  initialCenter: { lng: number; lat: number };
  initialZoom: number;
  initialStyleUrl: string;
  onMoveEnd?: (change: MapViewChange) => void;
  onMapReady?: (map: mapboxgl.Map) => void;
}

export function MapView({ initialCenter, initialZoom, initialStyleUrl, onMoveEnd, onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: initialStyleUrl,
      center: [initialCenter.lng, initialCenter.lat],
      zoom: initialZoom,
      // Lets FeatureLayer read back rendered pixels to pick a highlight
      // color that contrasts with the current basemap — without this, the
      // browser is free to clear the WebGL buffer before that read happens.
      preserveDrawingBuffer: true,
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

  // Style selection lives in BaseLayerPanel (SideBar), which persists the
  // choice to map.baseStyle — this effect is the single place that applies
  // it to the live map instance once that refetch flows back down as a new
  // initialStyleUrl.
  const lastAppliedStyleUrlRef = useRef(initialStyleUrl);
  useEffect(() => {
    if (initialStyleUrl === lastAppliedStyleUrlRef.current) return;
    lastAppliedStyleUrlRef.current = initialStyleUrl;
    mapRef.current?.setStyle(initialStyleUrl);
  }, [initialStyleUrl]);

  return (
    <Box position="relative" width="100%" height="100%">
      <Box ref={containerRef} width="100%" height="100%" />
    </Box>
  );
}
