import { objectionInReview, REPORT_REASONS } from '../moderation';

describe('objectionInReview', () => {
  it('lets an ordinary review through', () => {
    for (const text of [
      'Great humidor, friendly staff, and the patio is lovely in the evening.',
      'Quiet on a Tuesday. Good whiskey list. Parking was a nightmare.',
      'Not worth the money.',
    ]) {
      expect(objectionInReview(text)).toBeNull();
    }
  });

  it('lets harsh criticism through — that is not what this is for', () => {
    // The failure mode that matters. A filter that silences bad reviews makes
    // the directory worth less than one with no filter at all.
    for (const text of [
      'The staff were useless and the humidor was bone dry. Avoid.',
      'Rude, overpriced, and the place stank. I will not be back.',
      'Absolutely terrible. Worst lounge in the city.',
    ]) {
      expect(objectionInReview(text)).toBeNull();
    }
  });

  it('refuses slurs', () => {
    expect(objectionInReview('the owner is a faggot')).not.toBeNull();
    expect(objectionInReview('retard staff')).not.toBeNull();
  });

  it('sees through letter substitution and padding', () => {
    expect(objectionInReview('f4ggot')).not.toBeNull();
    expect(objectionInReview('reeeetard')).not.toBeNull();
  });

  it('does not fire on an innocent word containing a flagged one', () => {
    // The Scunthorpe problem: matching on substrings rather than whole words
    // is how a filter starts rejecting honest reviews.
    for (const text of [
      'Great spot near Scunthorpe.',
      'The cockpit-style seating in the back room is comfortable.',
      'Analysis of the draw was spot on.',
    ]) {
      expect(objectionInReview(text)).toBeNull();
    }
  });

  it('never quotes the offending word back', () => {
    const objection = objectionInReview('the owner is a faggot');
    expect(objection?.message.toLowerCase()).not.toContain('faggot');
  });

  it('offers reasons a member can actually pick between', () => {
    expect(REPORT_REASONS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(REPORT_REASONS).size).toBe(REPORT_REASONS.length);
  });
});
