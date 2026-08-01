declare module 'tokml' {
  interface TokmlOptions {
    documentName?: string;
    documentDescription?: string;
    name?: string;
    description?: string;
    simplestyle?: boolean;
    timestamp?: string;
  }

  function tokml(geojson: GeoJSON.FeatureCollection, options?: TokmlOptions): string;

  export = tokml;
}
