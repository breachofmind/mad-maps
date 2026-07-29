import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import 'mapbox-gl/dist/mapbox-gl.css';
import { mapboxgl, DEFAULT_MAP_STYLE, MAP_STYLE_OPTIONS } from './mapbox';
import { StyleSwitcher } from './StyleSwitcher';

const DEFAULT_CENTER: [number, number] = [-98.5795, 39.8283];
const DEFAULT_ZOOM = 3.5;

export function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [activeStyleId, setActiveStyleId] = useState(DEFAULT_MAP_STYLE.id);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: DEFAULT_MAP_STYLE.styleUrl,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  function handleStyleChange(styleId: string) {
    const option = MAP_STYLE_OPTIONS.find((s) => s.id === styleId);
    if (!option || !mapRef.current) return;
    mapRef.current.setStyle(option.styleUrl);
    setActiveStyleId(styleId);
  }

  return (
    <Box position="relative" width="100vw" height="100vh">
      <Box ref={containerRef} width="100%" height="100%" />
      <StyleSwitcher activeStyleId={activeStyleId} onChange={handleStyleChange} />
    </Box>
  );
}
