import Modal from './Modal';

/**
 * ConfirmDialog
 *
 * A reusable confirmation dialog built on top of the existing Modal component.
 *
 * Props:
 *   isOpen      {boolean}  — controls visibility
 *   onClose     {function} — called when dialog is dismissed (Cancel / backdrop)
 *   onConfirm   {function} — called when the confirm button is clicked
 *   title       {string}   — modal heading
 *   message     {string}   — body text
 *   confirmLabel{string}   — label for confirm button (default: "Delete")
 *   loading     {boolean}  — disables both buttons and shows "Please wait..."
 *   variant     {"danger"|"warning"} — button style (default: "danger")
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  loading = false,
  variant = 'danger',
}) {
  const confirmClass = variant === 'warning'
    ? 'bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
    : 'btn-danger disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="text-slate-600 text-sm mb-6">{message}</p>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </button>

        <button
          type="button"
          className={confirmClass}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Please wait…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
