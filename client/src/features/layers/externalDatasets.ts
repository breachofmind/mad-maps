export interface ExternalDataset {
  id: string;
  label: string;
  url: string;
  description: string;
}

// A small, hand-picked list of public GeoJSON-capable endpoints offered in
// the "Add data layer" dialog. Add more entries here as they're identified
// and verified (fetch the URL directly, confirm it returns a valid
// GeoJSON FeatureCollection under the server's size cap) — the dialog and
// server-side fetch/validation both work for any GeoJSON URL, curated or
// custom.
export const EXTERNAL_DATASETS: ExternalDataset[] = [
  {
    id: 'or-current-wildfire-perimeters',
    label: 'Oregon Wildfire Perimeters (current)',
    url: 'https://services9.arcgis.com/RHVPKKiFTONKtxq3/ArcGIS/rest/services/USA_Wildfires_v1/FeatureServer/1/query?where=UnitID+LIKE+%27OR%25%27&outFields=IncidentName%2CUnitID%2CGISAcres%2CDateCurrent&f=geojson',
    description: 'Current active wildfire perimeters in Oregon, from the National Interagency Fire Center (NIFC).',
  },
];
