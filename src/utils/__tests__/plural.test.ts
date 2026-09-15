import { pluralize } from '../plural';

describe('pluralize', () => {
  it('does not say "1 lounges"', () => {
    // The actual bug: a single search result read "1 LOUNGES FOUND", and a
    // lounge with one review read "1 REVIEWS".
    expect(pluralize(1, 'lounge')).toBe('1 lounge');
    expect(pluralize(1, 'Review')).toBe('1 Review');
  });

  it('pluralises everything else', () => {
    expect(pluralize(0, 'lounge')).toBe('0 lounges');
    expect(pluralize(2, 'lounge')).toBe('2 lounges');
    expect(pluralize(8513, 'lounge')).toBe('8513 lounges');
  });

  it('takes an explicit plural when adding an s is wrong', () => {
    expect(pluralize(1, 'city', 'cities')).toBe('1 city');
    expect(pluralize(3, 'city', 'cities')).toBe('3 cities');
  });
});
