import mapboxgl from 'mapbox-gl';

const accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

if (!accessToken) {
  // eslint-disable-next-line no-console
  console.warn(
    'VITE_MAPBOX_ACCESS_TOKEN is not set. Set it in client/.env.local to render the map — see .env.example at the repo root.',
  );
}

mapboxgl.accessToken = accessToken ?? '';

export { mapboxgl };
export { MAP_STYLE_OPTIONS, DEFAULT_MAP_STYLE, type MapStyleOption } from './mapStyles';
