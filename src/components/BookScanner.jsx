import { useBookScanner } from "../hooks/useBookScanner";

export default function BookScanner({ onSave }) {
  const { step, statusMessage, startScan, fileInputRef, onFileInputChange } =
    useBookScanner({ onSave });

  const busy = step !== "idle" && step !== "error";

  return (
    <div className="book-scanner sr-only" role="region" aria-label="Scan a book">
      <button
        type="button"
        onClick={startScan}
        disabled={busy}
        aria-busy={busy}
        className="book-scanner__button"
      >
        📷 Scan a book
      </button>

      {/* capture="environment" opens the rear camera directly on mobile,
          skipping the gallery picker — one less step for a blind user. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFileInputChange}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* assertive: scan status should interrupt and be heard immediately,
          unlike the general nav status which is merely "polite". */}
      <p className="sr-only" aria-live="assertive">
        {statusMessage}
      </p>
    </div>
  );
}
