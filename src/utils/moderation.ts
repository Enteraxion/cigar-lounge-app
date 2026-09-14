/**
 * Keeping what members post about each other civil.
 *
 * App Store guideline 1.2 asks four things of any app carrying user-generated
 * content, and reviews and their photographs are exactly that. Three of them
 * live here or next door:
 *
 *   1. a method for filtering objectionable material before it is posted
 *      — `objectionInReview` below, checked in WriteReviewScreen;
 *   2. a way to report offensive content — `reportReview`;
 *   3. a way to block abusive members — `blockMember`;
 *   4. published contact details — already in the privacy policy and terms.
 *
 * Both are in `moderationService.ts`; the judgement lives here so it can be
 * tested without Firestore.
 *
 * **The filter is deliberately narrow.** It catches slurs and explicit
 * sexual language — the things nobody defends and that no honest review of a
 * cigar lounge needs. It does not police rudeness: "the staff were useless and
 * the humidor was dry" is a bad review, not an objectionable one, and a
 * directory whose filter silences criticism is worth less than one with no
 * filter at all. Everything short of the list goes up and can be reported by
 * the people who read it, which is what the reporting queue is for.
 */

/**
 * Matched on word boundaries against the lower-cased text.
 *
 * Kept short on purpose. A long list is a long list of false positives —
 * "Scunthorpe" and "cockpit" are the classic ones — and every wrong block is
 * a member told their honest review is abusive.
 */
const SLURS = [
  'nigger',
  'nigga',
  'faggot',
  'fag',
  'tranny',
  'retard',
  'retarded',
  'spic',
  'chink',
  'kike',
  'wetback',
  'towelhead',
  'paki',
  'gook',
  'coon',
  'dyke',
];

const SEXUAL = ['cunt', 'whore', 'slut', 'rape', 'raping', 'rapist'];

/**
 * Letters that get substituted to slip a word past a naive list — a zero for
 * an o, a 1 for an i. Folded before matching so `n1gger` is caught too.
 */
function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't');
}

/**
 * The word with padding removed, both ways.
 *
 * "reeeetard" needs every repeat collapsed to one letter to reach "retard";
 * "niiiigger" needs them collapsed to two to reach "nigger". Neither rule
 * alone catches both, and collapsing everything to one letter would fold
 * innocent doubles ("bookkeeper", "coffee") into words that are not there. So
 * a word is checked in both forms and flagged if either matches.
 */
function paddingVariants(word: string): string[] {
  return [word, word.replace(/(.)\1+/g, '$1$1'), word.replace(/(.)\1+/g, '$1')];
}

export type Objection = {
  /** What to tell the member, in their words. Never quotes the word back. */
  message: string;
};

/**
 * Whether a review should be refused, and what to say if so.
 *
 * Returns null for anything acceptable — which is the overwhelming majority,
 * and should stay that way.
 */
export function objectionInReview(text: string): Objection | null {
  const words = new Set(
    fold(text)
      .split(/[^a-z]+/)
      .filter(Boolean)
      .flatMap(paddingVariants),
  );

  for (const term of [...SLURS, ...SEXUAL]) {
    if (words.has(term)) {
      return {
        message:
          'This review contains language we do not publish. Please rewrite it — ' +
          'criticism is welcome, abuse is not.',
      };
    }
  }
  return null;
}

/** Why somebody reported a review. Shown as a picker, stored on the report. */
export const REPORT_REASONS = [
  'Offensive or abusive language',
  'Not a real visit',
  'Spam or advertising',
  'Personal information about someone',
  'Something else',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];
