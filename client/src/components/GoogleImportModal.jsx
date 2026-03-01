import { useState, useEffect } from 'react';
import api from '../utils/api';
import { X, Download, Check, Loader2, Users, AlertCircle } from 'lucide-react';

export default function GoogleImportModal({ onClose, onImported }) {
  const [googleUsers, setGoogleUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const fetchGoogleUsers = async () => {
      try {
        const res = await api.get('/google/import-users');
        setGoogleUsers(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch Google Workspace users. Check your Google Admin setup.');
      } finally {
        setLoading(false);
      }
    };
    fetchGoogleUsers();
  }, []);

  const toggleSelect = (googleId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(googleId)) next.delete(googleId);
      else next.add(googleId);
      return next;
    });
  };

  const selectAll = () => {
    const newUsers = googleUsers.filter((u) => !u.alreadyExists);
    if (selected.size === newUsers.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(newUsers.map((u) => u.googleId)));
    }
  };

  const handleImport = async () => {
    const usersToImport = googleUsers.filter((u) => selected.has(u.googleId));
    if (!usersToImport.length) return;

    setImporting(true);
    try {
      const res = await api.post('/google/import-users', { users: usersToImport });
      setResult(res.data);
      if (onImported) onImported();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to import users.');
    } finally {
      setImporting(false);
    }
  };

  const newUsers = googleUsers.filter((u) => !u.alreadyExists);
  const existingUsers = googleUsers.filter((u) => u.alreadyExists);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Import from Google Workspace</h2>
              <p className="text-sm text-slate-500">Select users to add to the system</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-2" />
              <span className="text-slate-500">Fetching users from Google Workspace...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          ) : result ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
                <Check className="w-5 h-5" />
                <span className="font-medium">{result.message}</span>
              </div>
              {result.users?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Imported Users (with temporary passwords):</p>
                  <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                    {result.users.map((u) => (
                      <div key={u.id} className="flex justify-between text-sm">
                        <span className="text-slate-700">{u.name} ({u.email})</span>
                        <code className="text-xs bg-white px-2 py-0.5 rounded border text-slate-600">{u.tempPassword}</code>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Please share these temporary passwords with the imported users.</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* New Users */}
              {newUsers.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-slate-700">
                      New Users ({newUsers.length})
                    </p>
                    <button
                      onClick={selectAll}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      {selected.size === newUsers.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {newUsers.map((u) => (
                      <label
                        key={u.googleId}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(u.googleId)}
                          onChange={() => toggleSelect(u.googleId)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">{u.name}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                        <span className="text-xs text-slate-400">{u.department}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Already Existing */}
              {existingUsers.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-400 mb-2">
                    Already in System ({existingUsers.length})
                  </p>
                  <div className="space-y-1 opacity-60">
                    {existingUsers.map((u) => (
                      <div key={u.googleId} className="flex items-center gap-3 p-3 rounded-lg">
                        <Check className="w-4 h-4 text-green-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-600">{u.name}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                        <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded">Exists</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {googleUsers.length === 0 && (
                <div className="flex flex-col items-center py-12 text-slate-400">
                  <Users className="w-12 h-12 mb-3" />
                  <p>No users found in Google Workspace.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && !error && !loading && (
            <button
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Import {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
