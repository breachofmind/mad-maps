export interface MapStyleOption {
  id: string;
  label: string;
  styleUrl: string;
}

export const MAP_STYLE_OPTIONS: MapStyleOption[] = [
  { id: 'streets', label: 'Streets', styleUrl: 'mapbox://styles/mapbox/streets-v12' },
  { id: 'satellite', label: 'Satellite', styleUrl: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { id: 'outdoors', label: 'Terrain', styleUrl: 'mapbox://styles/mapbox/outdoors-v12' },
  { id: 'dark', label: 'Dark', styleUrl: 'mapbox://styles/mapbox/dark-v11' },
];

export const DEFAULT_MAP_STYLE = MAP_STYLE_OPTIONS[0];
