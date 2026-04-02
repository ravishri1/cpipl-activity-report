import { useState } from 'react';
import { ScrollText, Download, Eye, X, Calendar } from 'lucide-react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import { useAuth } from '../../context/AuthContext';

const TYPE_LABELS = {
  offer: 'Offer Letter',
  appointment: 'Appointment Letter',
  salary_revision: 'Salary Revision Letter',
  experience: 'Experience Letter',
  relieving: 'Relieving Letter',
  custom: 'Letter',
};

export default function MyLetters() {
  const { user } = useAuth();
  const { data: letters, loading, error } = useFetch(
    user ? `/letters/employee/${user.id}` : null,
    []
  );
  const [preview, setPreview] = useState(null);

  const handlePrint = (letter) => {
    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${letter.template?.name || 'Letter'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          ${letter.content}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ScrollText className="w-6 h-6 text-purple-600" />
        <div>
          <h1 className="text-xl font-bold text-slate-800">My Letters</h1>
          <p className="text-sm text-slate-500">Official letters and certificates issued during your tenure</p>
        </div>
      </div>

      {error && <AlertMessage type="error" message={error} />}

      {!loading && letters.length === 0 ? (
        <EmptyState
          icon="📄"
          title="No letters yet"
          subtitle="Letters issued by HR will appear here. Contact HR if you need a letter."
        />
      ) : (
        <div className="space-y-3">
          {letters.map((letter) => (
            <div
              key={letter.id}
              className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:border-purple-200 hover:bg-purple-50/30 transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
                  <ScrollText className="w-4.5 h-4.5 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 text-sm">
                    {TYPE_LABELS[letter.template?.type] || letter.template?.name || 'Letter'}
                  </div>
                  {letter.template?.name && letter.template.name !== TYPE_LABELS[letter.template?.type] && (
                    <div className="text-xs text-slate-500 truncate">{letter.template.name}</div>
                  )}
                  <div className="flex items-center gap-1.5 mt-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-400">{formatDate(letter.generatedAt)}</span>
                    {letter.generatedByUser && (
                      <span className="text-xs text-slate-400">· Issued by {letter.generatedByUser.name}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setPreview(letter)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View
                </button>
                <button
                  onClick={() => handlePrint(letter)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Print / Save
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">
                {TYPE_LABELS[preview.template?.type] || preview.template?.name || 'Letter'}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrint(preview)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  Print / Save PDF
                </button>
                <button
                  onClick={() => setPreview(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-6 prose prose-sm max-w-none">
              <div dangerouslySetInnerHTML={{ __html: preview.content }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
