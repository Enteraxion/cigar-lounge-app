import { type ReactNode, useEffect } from 'react';

/**
 * Centered overlay dialog — Escape-to-close, click-backdrop-to-close, header
 * with title + X. Used by Inventory's add/edit form, matching the modal
 * pattern the Kiki Momo admin uses for quick edits (as opposed to a full
 * page navigation, which this app reserves for heavier forms like Edit
 * Listing).
 */
export default function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal__head">
          <h2 className="modal__title">{title}</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
