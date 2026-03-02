import { AlertCircle, CheckCircle, X } from 'lucide-react';

/**
 * Reusable alert banner for error/success messages.
 * Renders nothing if message is empty.
 *
 * Usage:
 *   <AlertMessage type="error" message={error} />
 *   <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />
 */
export default function AlertMessage({ type = 'error', message, onClose, className = '' }) {
  if (!message) return null;

  const isError = type === 'error';
  const bg = isError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700';
  const Icon = isError ? AlertCircle : CheckCircle;

  return (
    <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${bg} ${className}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onClose && (
        <button onClick={onClose} className="p-0.5 rounded hover:bg-black/5">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
