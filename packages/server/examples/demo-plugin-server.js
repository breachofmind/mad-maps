// Demo plugin endpoint for Mad Maps' "Plugin endpoint URL" layer feature.
// Fetches a real 5-day forecast and local time via Open-Meteo — see
// lib/weatherForecast.js, shared with the local-plugin equivalent at
// plugins/weather-forecast.js (loaded in-process via PLUGINS_DIR instead of
// over HTTP — see that file for the difference between the two).
//
// Mad Maps' server calls this same URL two ways:
//   GET  -> expects { name, description } (the plugin's identity, shown as
//           the properties panel's section heading)
//   POST -> body shaped like { feature: { id, type, geometry, properties:
//           { title } }, layer: { id, name } }, expects back
//           { blocks: [ { type: 'heading'|'text'|'keyValue'|'image'|'link', ... } ] }
//
// Run: node packages/server/examples/demo-plugin-server.js [port]
// Then expose it publicly (Mad Maps' server refuses to fetch localhost/private
// IPs by design), e.g.: npx localtunnel --port 8931

const http = require('http');
const { getFiveDayForecastAndLocalTime } = require('./lib/weatherForecast');

const port = Number(process.argv[2]) || 8931;
const PLUGIN_NAME = 'Weather Forecast';
const PLUGIN_DESCRIPTION = "Shows a real 5-day forecast and local time for the pin's location, via Open-Meteo (no API key required).";

const server = http.createServer((req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ name: PLUGIN_NAME, description: PLUGIN_DESCRIPTION }));
    return;
  }

  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', async () => {
    if (req.method !== 'POST') {
      res.writeHead(405).end();
      return;
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'bad json' }));
      return;
    }

    console.log(`[demo-plugin] ${payload.layer?.name ?? '?'} / ${payload.feature?.properties?.title || 'untitled pin'} (${payload.feature?.geometry?.coordinates})`);

    // Visit the pin with title "broken" to exercise the client's error state.
    if (payload.feature?.properties?.title?.toLowerCase() === 'broken') {
      res.writeHead(500, { 'Content-Type': 'text/plain' }).end('simulated upstream failure');
      return;
    }

    if (payload.feature?.geometry?.type !== 'Point') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ blocks: [{ type: 'text', text: 'Weather Forecast only supports point pins.' }] }));
      return;
    }

    const [lng, lat] = payload.feature.geometry.coordinates;
    const title = payload.feature?.properties?.title || 'This pin';

    try {
      const forecast = await getFiveDayForecastAndLocalTime(lat, lng);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          blocks: [
            { type: 'heading', text: '5-Day Forecast' },
            { type: 'text', text: `${title} — local time is ${forecast.localTime} (${forecast.timezone}).` },
            {
              type: 'keyValue',
              items: forecast.days.map((d) => ({ label: d.label, value: `${d.high}°/${d.low}°F — ${d.condition}` })),
            },
            { type: 'link', text: 'Forecast data from Open-Meteo', href: 'https://open-meteo.com' },
          ],
        }),
      );
    } catch (err) {
      console.error('[demo-plugin] forecast fetch failed:', err);
      res.writeHead(502, { 'Content-Type': 'text/plain' }).end('failed to fetch forecast: ' + err.message);
    }
  });
});

server.listen(port, () => {
  console.log(`Demo plugin server listening on http://localhost:${port}`);
  console.log('Rename a pin to "broken" to see the error state in the properties panel.');
});
