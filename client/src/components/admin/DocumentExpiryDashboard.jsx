import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';

const TYPE_LABELS = {
  id_proof:       'ID Proof',
  address_proof:  'Address Proof',
  education:      'Education',
  certification:  'Certification',
  other:          'Other',
};

function urgencyClass(daysLeft) {
  if (daysLeft < 0)   return 'bg-red-100 text-red-700 border-red-200';
  if (daysLeft <= 30) return 'bg-red-50 text-red-600 border-red-100';
  if (daysLeft <= 60) return 'bg-amber-50 text-amber-600 border-amber-100';
  return 'bg-green-50 text-green-600 border-green-100';
}

function daysText(daysLeft) {
  if (daysLeft < 0)   return `Expired ${Math.abs(daysLeft)}d ago`;
  if (daysLeft === 0) return 'Expires today';
  if (daysLeft <= 30) return `Expires in ${daysLeft}d`;
  return `${daysLeft} days left`;
}

function daysLeft(expiryDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  return Math.round((exp - today) / (1000 * 60 * 60 * 24));
}

export default function DocumentExpiryDashboard() {
  const [days, setDays] = useState(60);

  const { data: docs, loading, error: fetchErr } = useFetch(`/api/users/documents-expiring?days=${days}`, []);

  const expired  = docs.filter(d => daysLeft(d.expiryDate) < 0);
  const critical = docs.filter(d => { const dl = daysLeft(d.expiryDate); return dl >= 0 && dl <= 30; });
  const warning  = docs.filter(d => { const dl = daysLeft(d.expiryDate); return dl > 30 && dl <= days; });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Document Expiry Tracker</h1>
          <p className="text-slate-500 text-sm mt-0.5">Monitor employee document expiry dates</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">Show next:</label>
          <select value={days} onChange={e => setDays(parseInt(e.target.value))} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
            <option value={365}>1 year</option>
          </select>
        </div>
      </div>

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}

      {/* Summary cards */}
      {!loading && docs.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            ['Expired', expired.length, 'bg-red-50 border-red-200 text-red-700'],
            ['Critical (≤30d)', critical.length, 'bg-amber-50 border-amber-200 text-amber-700'],
            ['Upcoming', warning.length, 'bg-blue-50 border-blue-200 text-blue-700'],
          ].map(([label, count, cls]) => (
            <div key={label} className={`rounded-xl border p-4 ${cls}`}>
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs font-medium mt-0.5 opacity-80">{label}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? <LoadingSpinner /> : docs.length === 0 ? (
        <EmptyState icon="✅" title="All documents up to date" subtitle={`No documents expiring in the next ${days} days`} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Employee','Department','Document','Type','Doc No.','Expiry Date','Status'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...expired, ...critical, ...warning].map(doc => {
                const dl = daysLeft(doc.expiryDate);
                return (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-800">{doc.user?.name}</div>
                      <div className="text-xs text-slate-400">{doc.user?.employeeId}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">{doc.user?.department}</td>
                    <td className="px-3 py-2.5 font-medium">{doc.name}</td>
                    <td className="px-3 py-2.5 text-slate-500">{TYPE_LABELS[doc.type] || doc.type}</td>
                    <td className="px-3 py-2.5 text-slate-500 font-mono text-xs">{doc.docNumber || '—'}</td>
                    <td className="px-3 py-2.5 font-medium">{formatDate(doc.expiryDate)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${urgencyClass(dl)}`}>
                        {daysText(dl)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
