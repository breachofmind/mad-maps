// Used by the demo local plugin at ../weather-forecast.js — fetches a real
// 5-day forecast and resolves local time for a lat/lng via Open-Meteo
// (https://open-meteo.com), a free weather API that needs no API key/signup.
// Its forecast endpoint also resolves the location's IANA timezone
// (timezone=auto), which is all "local time" needs — no separate
// geocoding/timezone lookup required.

const WEATHER_CODE_LABELS = {
  0: 'Clear sky',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light rain showers',
  81: 'Rain showers',
  82: 'Violent rain showers',
  85: 'Light snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with light hail',
  99: 'Thunderstorm with heavy hail',
};

function weatherLabel(code) {
  return WEATHER_CODE_LABELS[code] || `Unclear (code ${code})`;
}

// daily.time entries are calendar dates already aggregated in the target
// timezone by Open-Meteo — parsing/formatting in UTC here just reads the
// weekday name back out without letting the server's own local timezone
// shift the date by a day.
function weekdayLabel(dateStr) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  return date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

async function getFiveDayForecastAndLocalTime(lat, lng) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lng);
  url.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min');
  url.searchParams.set('forecast_days', '5');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    throw new Error(`Open-Meteo responded with status ${response.status}`);
  }
  const json = await response.json();

  const timezone = json.timezone;
  const localTime = new Date().toLocaleString('en-US', {
    timeZone: timezone,
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const days = json.daily.time.map((dateStr, i) => ({
    label: weekdayLabel(dateStr),
    high: Math.round(json.daily.temperature_2m_max[i]),
    low: Math.round(json.daily.temperature_2m_min[i]),
    condition: weatherLabel(json.daily.weathercode[i]),
  }));

  return { timezone, localTime, days };
}

module.exports = { getFiveDayForecastAndLocalTime };
