/**
 * The Map tab's weather verdict.
 *
 * The card previously read "72° — Perfect weather for patio smoking" for
 * everyone, everywhere, always, from no data at all. Now it makes a real
 * recommendation from a real forecast — which means it can be wrong in a way the
 * hardcoded string never could, and being wrong here means telling a member to
 * take a forty-minute cigar outside into a thunderstorm.
 *
 * These tests are about that. The fetch is not tested; the judgement is.
 */

import { formatTemperature, patioVerdict } from '../patioWeather';

const pleasant = {
  temperatureF: 74,
  precipitationChance: 0,
  windMph: 5,
  shortForecast: 'Mostly Clear',
};

describe('patioVerdict', () => {
  it('approves a genuinely pleasant evening', () => {
    const verdict = patioVerdict(pleasant);
    expect(verdict.favourable).toBe(true);
    expect(verdict.message).toContain('patio');
  });

  it('refuses when rain is likely', () => {
    const verdict = patioVerdict({ ...pleasant, precipitationChance: 60 });
    expect(verdict.favourable).toBe(false);
    expect(verdict.message.toLowerCase()).toContain('rain');
  });

  it('refuses on a wet forecast even when the percentage is null', () => {
    // The real reason this check exists: api.weather.gov reports
    // probabilityOfPrecipitation as null often enough that trusting the number
    // alone would send someone out into "Light Rain" with a cigar.
    const verdict = patioVerdict({
      ...pleasant,
      precipitationChance: null,
      shortForecast: 'Light Rain Likely',
    });
    expect(verdict.favourable).toBe(false);
  });

  it.each(['Showers And Thunderstorms', 'Chance Snow Showers', 'Patchy Drizzle', 'Sleet'])(
    'refuses a "%s" forecast',
    shortForecast => {
      expect(patioVerdict({ ...pleasant, precipitationChance: null, shortForecast }).favourable).toBe(
        false,
      );
    },
  );

  it('does not mistake "Partly Cloudy" for wet weather', () => {
    // The wet-word check must not be so eager that a fine day reads as rain.
    expect(patioVerdict({ ...pleasant, shortForecast: 'Partly Cloudy' }).favourable).toBe(true);
    expect(patioVerdict({ ...pleasant, shortForecast: 'Sunny' }).favourable).toBe(true);
  });

  it('refuses when it is cold', () => {
    const verdict = patioVerdict({ ...pleasant, temperatureF: 41 });
    expect(verdict.favourable).toBe(false);
    expect(verdict.message.toLowerCase()).toContain('cold');
  });

  it('refuses when it is hot', () => {
    const verdict = patioVerdict({ ...pleasant, temperatureF: 99 });
    expect(verdict.favourable).toBe(false);
    expect(verdict.message.toLowerCase()).toContain('hot');
  });

  it('refuses when it is windy enough to keep relighting', () => {
    const verdict = patioVerdict({ ...pleasant, windMph: 24 });
    expect(verdict.favourable).toBe(false);
  });

  it('treats a null wind reading as unknown, not as calm-and-fine', () => {
    // Absent data must not become a favourable claim by default — but it also
    // must not veto an otherwise clear, mild day.
    const verdict = patioVerdict({ ...pleasant, windMph: null });
    expect(verdict.favourable).toBe(true);
  });

  it('puts rain ahead of temperature, because rain settles it', () => {
    const verdict = patioVerdict({
      ...pleasant,
      temperatureF: 40,
      shortForecast: 'Rain',
    });
    expect(verdict.message.toLowerCase()).toContain('rain');
  });

  it('never claims a favourable verdict for the old hardcoded conditions blindly', () => {
    // 72° with no other information used to be "Perfect weather for patio
    // smoking". With real inputs, 72° in the rain is not.
    expect(patioVerdict({ ...pleasant, temperatureF: 72 }).favourable).toBe(true);
    expect(
      patioVerdict({ ...pleasant, temperatureF: 72, shortForecast: 'Heavy Rain' }).favourable,
    ).toBe(false);
  });
});

describe('formatTemperature', () => {
  it('rounds to a whole degree', () => {
    expect(formatTemperature(86.6)).toBe('87°');
    expect(formatTemperature(72)).toBe('72°');
  });

  it('handles freezing and below without breaking', () => {
    expect(formatTemperature(0)).toBe('0°');
    expect(formatTemperature(-4.2)).toBe('-4°');
  });
});
