/**
 * weatherService
 *
 * Real current conditions for the Map tab's weather card, which until
 * 2026-08-23 showed a hardcoded "72° — Perfect weather for patio smoking" to
 * every member regardless of where they were or what the sky was doing.
 *
 * Source: api.weather.gov, the US National Weather Service.
 *
 * **Why this one.** It is free for any purpose including commercial, needs no
 * API key, and carries no attribution obligation — US federal government data is
 * public domain. That matters, because the obvious alternative does not qualify:
 * Open-Meteo's free tier is licensed for NON-commercial use only, and this app
 * is commercial (App Store, and $399/month lounge subscriptions). Using it would
 * have been a licence breach that nothing would ever have flagged.
 *
 * **The cost is coverage.** api.weather.gov is the United States and its
 * territories only. A member in Berlin gets a 404, and the card then renders
 * nothing rather than inventing a temperature — the same rule the Passport
 * follows when it cannot anchor a distance. About 95% of the directory is US, so
 * this is the right trade for now; if international membership grows, the honest
 * fix is a paid global provider, not a guess.
 *
 * No API key means no Cloud Function: this is called straight from the app.
 */

import { createKeyedAsyncCache } from '../utils/asyncCache';
import type { PatioConditions } from '../utils/patioWeather';

/**
 * Required by weather.gov, which asks for contact details so they can reach an
 * operator about a security event. Sending a generic agent gets you rate-limited
 * or blocked, so this is not decoration.
 */
const USER_AGENT = 'LoungeLocator/1.0 (enteraxion.com, rohith.akepati@enteraxion.com)';

/**
 * Half an hour. The NWS updates hourly, so anything shorter is spending requests
 * to re-read the same number — and this is called on a screen a member pans
 * around, which would otherwise mean a request per gesture.
 */
const WEATHER_TTL_MS = 30 * 60 * 1000;

/**
 * Coordinates rounded to 2dp — about 1km — before being used as a cache key.
 *
 * Without this, panning the map one pixel is a different key and the cache never
 * hits. The forecast grid is 2.5km squares, so a finer key could not describe
 * anything the data distinguishes anyway.
 */
function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

type PointsResponse = {
  properties?: { forecastHourly?: string };
};

type HourlyResponse = {
  properties?: {
    periods?: Array<{
      temperature?: number;
      temperatureUnit?: string;
      probabilityOfPrecipitation?: { value?: number | null };
      windSpeed?: string;
      shortForecast?: string;
    }>;
  };
};

/** "5 mph" / "10 to 15 mph" -> the highest number in it, which is what matters. */
function parseWindMph(windSpeed: string | undefined): number | null {
  if (!windSpeed) {
    return null;
  }
  const numbers = windSpeed.match(/\d+/g);
  if (!numbers || numbers.length === 0) {
    return null;
  }
  return Math.max(...numbers.map(Number));
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
  });
  if (!response.ok) {
    // 404 is the ordinary answer for a coordinate outside the United States, not
    // a fault. Everything else is treated the same way: no data, say nothing.
    return null;
  }
  return (await response.json()) as T;
}

/**
 * Two requests, because that is how the API works: /points resolves a coordinate
 * to a forecast grid, and the grid URL returns the hours.
 */
async function loadConditions(key: string): Promise<PatioConditions | null> {
  const [lat, lng] = key.split(',');
  try {
    const points = await fetchJson<PointsResponse>(`https://api.weather.gov/points/${lat},${lng}`);
    const hourlyUrl = points?.properties?.forecastHourly;
    if (!hourlyUrl) {
      return null;
    }

    const hourly = await fetchJson<HourlyResponse>(hourlyUrl);
    const now = hourly?.properties?.periods?.[0];
    if (!now || typeof now.temperature !== 'number') {
      return null;
    }

    // Guard the unit rather than assume. The API reports F for US locations, but
    // silently treating a Celsius number as Fahrenheit would put "18°" on the
    // card and call a cold day pleasant.
    if (now.temperatureUnit && now.temperatureUnit.toUpperCase() !== 'F') {
      return null;
    }

    const precipitation = now.probabilityOfPrecipitation?.value;
    return {
      temperatureF: now.temperature,
      // null and 0 are different claims: "not forecast" versus "no chance".
      precipitationChance: typeof precipitation === 'number' ? precipitation : null,
      windMph: parseWindMph(now.windSpeed),
      shortForecast: now.shortForecast ?? '',
    };
  } catch {
    // Offline, DNS, a rate limit. The card is a nicety; failing it must never
    // surface as an error on a map screen.
    return null;
  }
}

const weatherCache = createKeyedAsyncCache(loadConditions, WEATHER_TTL_MS);

/**
 * Current conditions near a coordinate, or null when there is nothing true to say —
 * outside the US, offline, or a malformed response. Callers render nothing on
 * null; they must not substitute a default.
 */
export async function getCurrentConditions(
  lat: number,
  lng: number,
): Promise<PatioConditions | null> {
  return weatherCache.get(cacheKey(lat, lng));
}
