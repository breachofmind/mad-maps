export interface ExternalDataset {
  id: string;
  label: string;
  url: string;
  description: string;
  // 'geojson' (the default/original curated shape — parsed server-side into
  // discrete features) or 'raster' (a {z}/{x}/{y} tile template, rendered
  // client-side straight from the URL — see AddExternalLayerDialog).
  format?: 'geojson' | 'raster';
}

// A small, hand-picked list of public endpoints offered in the "Add data
// layer" dialog. Add more entries here as they're identified and verified
// (for 'geojson' entries: fetch the URL directly and confirm it returns a
// valid GeoJSON FeatureCollection under the server's size cap; for 'raster'
// entries: confirm the URL is a real {z}/{x}/{y} tile template) — the dialog
// and underlying create/render paths work for any URL of the right shape,
// curated or custom.
export const EXTERNAL_DATASETS: ExternalDataset[] = [
  {
    id: 'or-current-wildfire-perimeters',
    label: 'Oregon Wildfire Perimeters (current)',
    url: 'https://services9.arcgis.com/RHVPKKiFTONKtxq3/ArcGIS/rest/services/USA_Wildfires_v1/FeatureServer/1/query?where=UnitID+LIKE+%27OR%25%27&outFields=IncidentName%2CUnitID%2CGISAcres%2CDateCurrent&f=geojson',
    description: 'Current active wildfire perimeters in Oregon, from the National Interagency Fire Center (NIFC).',
  },
  {
    id: 'weather-radar-nexrad',
    label: 'Weather Radar (NEXRAD, live)',
    format: 'raster',
    url: 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png',
    description:
      'Live composite reflectivity radar mosaic for the continental US, refreshed roughly every 5 minutes (Iowa Environmental Mesonet).',
  },
];
