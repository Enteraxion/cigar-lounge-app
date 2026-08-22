import { useCallback, useEffect, useState } from 'react';
import AdminShell from '../components/AdminShell';
import { deleteReview, fetchReviews, type AdminReview } from '../lib/opsData';

/**
 * Every review, newest first, so an abusive or fake one can be found and removed.
 *
 * A caveat stated plainly rather than hidden behind a button that fails:
 * firestore.rules currently lets only a review's **author** delete it —
 * `allow delete: if isSignedIn() && resource.data.userId == request.auth.uid`.
 * There is no isAdmin() branch, so Delete below will be refused by the database.
 *
 * That rule is left alone deliberately. Widening who may destroy a member's
 * writing is a decision worth making on purpose, not a side effect of building a
 * moderation page — so the page surfaces the real error and says what the fix is,
 * rather than quietly appearing to work.
 */
export default function ReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setReviews(await fetchReviews());
    } catch {
      setError('Could not load reviews.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (review: AdminReview) => {
    if (!window.confirm('Delete this review permanently?')) {
      return;
    }
    setBusy(review.id);
    try {
      await deleteReview(review.path);
      await load();
    } catch {
      setError(
        'Refused by the database. firestore.rules only lets a review’s own author ' +
          'delete it — an isAdmin() branch has to be added to the reviews delete rule ' +
          'and deployed before moderation can remove anything.',
      );
    } finally {
      setBusy('');
    }
  };

  return (
    <AdminShell
      active="reviews"
      title="Reviews"
      subtitle={reviews ? `${reviews.length} review${reviews.length === 1 ? '' : 's'}` : 'Loading…'}
      actions={
        <button className="btn btn--secondary" onClick={load}>
          Refresh
        </button>
      }
    >
      <p className="hint">
        Deleting is not yet permitted by the security rules — only a review’s author can
        remove it. The button below will report that rather than pretend to work.
      </p>

      {error && <div className="notice notice--error">{error}</div>}

      {reviews === null ? (
        <p className="muted">Loading…</p>
      ) : reviews.length === 0 ? (
        <div className="empty">No reviews have been written yet.</div>
      ) : (
        <div className="stack">
          {reviews.map(review => (
            <section className="card" key={review.id}>
              <header className="card__head">
                <div>
                  <h2 className="card__title">
                    {review.userName || 'Member'}
                    {typeof review.rating === 'number' && (
                      <span className="pill" style={{ marginLeft: 10 }}>
                        {review.rating} / 5
                      </span>
                    )}
                  </h2>
                  <p className="card__meta">
                    {review.createdAt ? review.createdAt.toDate().toLocaleString() : 'no date'} ·
                    lounge {review.loungeId}
                  </p>
                </div>
              </header>
              {review.text && <p className="body">{review.text}</p>}
              <footer className="card__foot">
                <button
                  className="btn btn--reject"
                  disabled={busy === review.id}
                  onClick={() => remove(review)}
                >
                  {busy === review.id ? 'Working…' : 'Delete'}
                </button>
              </footer>
            </section>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
