// Demo local plugin for Mad Maps' "Installed plugin" layer option.
//
// Point the server's PLUGINS_DIR env var at this folder (e.g.
// PLUGINS_DIR=plugins in packages/server/.env — resolved relative to the
// server process's cwd, which is packages/server in both `npm run
// dev:server` and `npm run start` — then restart the server) and "Weather
// Forecast" will show up in the plugin picker for local layers.
//
// A plugin file must export { name, description, handler }. handler receives
// { feature, layer, map } (see PluginHandlerArgs in
// packages/server/src/plugins/pluginRegistry.ts) and returns/resolves a
// { blocks } object matching @mad-maps/shared's pluginPanelResponseSchema.
//
// Real forecast + local time, via Open-Meteo (see lib/weatherForecast.js)
// — local plugins run in-process and are trusted code, so unlike an
// external-URL plugin this can freely reach out to a third-party API on its
// own. lib/ is a subdirectory, not a top-level .js file, so the plugin
// loader (which only scans top-level *.js entries) skips it.

const { getFiveDayForecastAndLocalTime } = require('./lib/weatherForecast');

module.exports = {
  name: 'Weather Forecast',
  description: "Shows a real 5-day forecast and local time for the pin's location, via Open-Meteo (no API key required).",
  handler: async ({ feature, layer, map }) => {
    // Rename a pin's title to "broken" to see the client's error state.
    if (feature.properties.title?.toLowerCase() === 'broken') {
      throw new Error('simulated handler failure');
    }

    if (feature.geometry.type !== 'Point') {
      return { blocks: [{ type: 'text', text: 'Weather Forecast only supports point pins.' }] };
    }

    const [lng, lat] = feature.geometry.coordinates;
    const title = feature.properties.title || 'This pin';
    const forecast = await getFiveDayForecastAndLocalTime(lat, lng);

    return {
      blocks: [
        { type: 'heading', text: '5-Day Forecast' },
        {
          type: 'text',
          text: `${title} on "${layer.name}" (map: ${map.title}) — local time is ${forecast.localTime} (${forecast.timezone}).`,
        },
        {
          type: 'table',
          headers: ['Day', 'High', 'Low', 'Condition'],
          rows: forecast.days.map((d) => [
            { type: 'text', text: d.label },
            { type: 'text', text: `${d.high}°F` },
            { type: 'text', text: `${d.low}°F` },
            { type: 'image', url: d.iconUrl, alt: d.condition },
          ]),
        },
        { type: 'link', text: 'Forecast data from Open-Meteo', href: 'https://open-meteo.com' },
      ],
    };
  },
};
