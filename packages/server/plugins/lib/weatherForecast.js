// Used by the demo local plugin at ../weather-forecast.js — fetches a real
// 5-day forecast and resolves local time for a lat/lng via Open-Meteo
// (https://open-meteo.com), a free weather API that needs no API key/signup.
// Its forecast endpoint also resolves the location's IANA timezone
// (timezone=auto), which is all "local time" needs — no separate
// geocoding/timezone lookup required.
//
// Condition icons come from meteocons (https://meteocons.com), served from
// its npm package via jsdelivr's CDN. Pinned to the exact published version
// (rather than @latest) so this plugin doesn't silently break if a future
// meteocons release renames/removes an icon — bump METEOCONS_VERSION
// deliberately if you want to pick up newer icons.
const METEOCONS_VERSION = '0.1.0';
const METEOCONS_BASE_URL = `https://cdn.jsdelivr.net/npm/@meteocons/svg-static@${METEOCONS_VERSION}/fill`;

function meteoconUrl(icon) {
  return `${METEOCONS_BASE_URL}/${icon}.svg`;
}

// WMO weather codes (what Open-Meteo's `weathercode` field returns) mapped
// to a human label and a meteocons icon slug. Daily aggregates aren't tied
// to a specific time of day, so "day" icon variants are used throughout
// rather than picking day/night per-icon.
const WEATHER_CODES = {
  0: { label: 'Clear sky', icon: 'clear-day' },
  1: { label: 'Mostly clear', icon: 'mostly-clear-day' },
  2: { label: 'Partly cloudy', icon: 'partly-cloudy-day' },
  3: { label: 'Overcast', icon: 'overcast' },
  45: { label: 'Fog', icon: 'fog' },
  48: { label: 'Depositing rime fog', icon: 'fog' },
  51: { label: 'Light drizzle', icon: 'drizzle' },
  53: { label: 'Drizzle', icon: 'drizzle' },
  55: { label: 'Dense drizzle', icon: 'extreme-drizzle' },
  56: { label: 'Light freezing drizzle', icon: 'sleet' },
  57: { label: 'Freezing drizzle', icon: 'sleet' },
  61: { label: 'Light rain', icon: 'rain' },
  63: { label: 'Rain', icon: 'rain' },
  65: { label: 'Heavy rain', icon: 'extreme-rain' },
  66: { label: 'Light freezing rain', icon: 'sleet' },
  67: { label: 'Freezing rain', icon: 'sleet' },
  71: { label: 'Light snow', icon: 'snow' },
  73: { label: 'Snow', icon: 'snow' },
  75: { label: 'Heavy snow', icon: 'extreme-snow' },
  77: { label: 'Snow grains', icon: 'snow' },
  80: { label: 'Light rain showers', icon: 'rain' },
  81: { label: 'Rain showers', icon: 'rain' },
  82: { label: 'Violent rain showers', icon: 'extreme-rain' },
  85: { label: 'Light snow showers', icon: 'snow' },
  86: { label: 'Snow showers', icon: 'snow' },
  95: { label: 'Thunderstorm', icon: 'thunderstorms' },
  96: { label: 'Thunderstorm with light hail', icon: 'thunderstorms-hail' },
  99: { label: 'Thunderstorm with heavy hail', icon: 'extreme-thunderstorms-hail' },
};

function weatherInfo(code) {
  return WEATHER_CODES[code] || { label: `Unclear (code ${code})`, icon: 'not-available' };
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

  const days = json.daily.time.map((dateStr, i) => {
    const info = weatherInfo(json.daily.weathercode[i]);
    return {
      label: weekdayLabel(dateStr),
      high: Math.round(json.daily.temperature_2m_max[i]),
      low: Math.round(json.daily.temperature_2m_min[i]),
      condition: info.label,
      iconUrl: meteoconUrl(info.icon),
    };
  });

  return { timezone, localTime, days };
}

module.exports = { getFiveDayForecastAndLocalTime, meteoconUrl };
