/**
 * Turning a real forecast into the one line the Map tab shows.
 *
 * The Map's weather card used to read "72° — Perfect weather for patio smoking"
 * for every member, everywhere, always. There was no weather data anywhere in
 * this app; the number and the sentence were both invented, and the sentence was
 * the worse half — it is a recommendation, and it was being made without knowing
 * anything at all. Rohith asked for something real on 2026-08-23.
 *
 * Kept pure and separate from the fetch so the judgement is testable. The thing
 * worth testing is not "does it call the API" but "does it ever tell someone to
 * sit outside in the rain".
 */

export type PatioConditions = {
  /** Fahrenheit, as api.weather.gov reports it for US locations. */
  temperatureF: number;
  /** 0–100. api.weather.gov can report null here, which is not the same as zero. */
  precipitationChance: number | null;
  /** mph. */
  windMph: number | null;
  /** e.g. "Mostly Clear", "Light Rain". Straight from the forecast. */
  shortForecast: string;
};

/**
 * Thresholds.
 *
 * Deliberately conservative about the good case: a cigar on a patio is a
 * forty-minute commitment, so "fine right now" is not the same as "pleasant".
 * The bands below are about sitting still outdoors, not about walking past.
 */
const COLD_F = 55;
const HOT_F = 93;
/** At or above this, the forecast is calling for rain, not hinting at it. */
const RAIN_LIKELY_PERCENT = 50;
/** Enough wind to keep relighting. */
const BREEZY_MPH = 18;

export type PatioVerdict = {
  /** The sentence under the temperature. Always about what is actually outside. */
  message: string;
  /** True only when nothing argues against sitting outside. */
  favourable: boolean;
};

export function patioVerdict(conditions: PatioConditions): PatioVerdict {
  const { temperatureF, precipitationChance, windMph, shortForecast } = conditions;

  // Rain first: it is the one condition that makes the rest irrelevant.
  //
  // Checked against the forecast text as well as the percentage, because
  // api.weather.gov reports probabilityOfPrecipitation as null often enough that
  // trusting it alone would let "Light Rain" through as good patio weather.
  const forecastMentionsWet = /rain|shower|storm|thunder|drizzle|snow|sleet/i.test(shortForecast);
  if ((precipitationChance !== null && precipitationChance >= RAIN_LIKELY_PERCENT) || forecastMentionsWet) {
    return { message: 'Rain about — the indoor lounge is the better bet.', favourable: false };
  }

  if (temperatureF <= COLD_F) {
    return { message: 'Cold for the patio right now.', favourable: false };
  }

  if (temperatureF >= HOT_F) {
    return { message: 'Hot out — find somewhere with shade or air conditioning.', favourable: false };
  }

  if (windMph !== null && windMph >= BREEZY_MPH) {
    return { message: 'Breezy — you will be relighting.', favourable: false };
  }

  return { message: 'Good weather for the patio.', favourable: true };
}

/** "87°" — the unit is implied by the card, and the degree sign does the work. */
export function formatTemperature(temperatureF: number): string {
  return `${Math.round(temperatureF)}°`;
}
