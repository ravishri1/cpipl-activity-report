import { AlertTriangle, X, Link2, Database } from 'lucide-react';

/**
 * Modal that displays when a delete operation fails due to linked dependencies.
 * Shows exactly which models/records are blocking the delete.
 *
 * Usage:
 *   const [deleteError, setDeleteError] = useState(null);
 *
 *   // In catch block of delete handler:
 *   if (err.response?.data?.code === 'DEPENDENCY_EXISTS') {
 *     setDeleteError(err.response.data);
 *   }
 *
 *   // In JSX:
 *   {deleteError && <DeleteErrorModal data={deleteError} onClose={() => setDeleteError(null)} />}
 */
export default function DeleteErrorModal({ data, onClose }) {
  if (!data) return null;

  const dependencies = data.dependencies || [];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-red-50 border-b border-red-100 px-6 py-4 flex items-start gap-3">
          <div className="p-2 bg-red-100 rounded-lg flex-shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-red-800">Cannot Delete</h3>
            <p className="text-sm text-red-600 mt-0.5">This record has linked data that must be removed first</p>
          </div>
          <button onClick={onClose} className="flex-shrink-0 p-1 hover:bg-red-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-red-400" />
          </button>
        </div>

        {/* Dependencies List */}
        {dependencies.length > 0 && (
          <div className="px-6 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Linked Records ({dependencies.length} {dependencies.length === 1 ? 'type' : 'types'})
              </span>
            </div>
            <div className="space-y-2">
              {dependencies.map((dep, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100"
                >
                  <div className="flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">{dep.label}</span>
                  </div>
                  <span className="text-sm font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                    {dep.count} {dep.count === 1 ? 'record' : 'records'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message if no structured dependencies but still blocked */}
        {dependencies.length === 0 && data.error && (
          <div className="px-6 py-4">
            <p className="text-sm text-slate-600">{data.error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 flex items-center justify-between">
          <p className="text-xs text-slate-400">Remove linked records before deleting</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            OK, Got it
          </button>
        </div>
      </div>
    </div>
  );
}
