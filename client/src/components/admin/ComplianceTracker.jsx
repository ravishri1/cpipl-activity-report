import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import { ShieldCheck, Plus, RefreshCw, Filter } from 'lucide-react';
import { COMPLIANCE_STATUS_STYLES, CERTIFICATE_TYPES, RENEWAL_FREQUENCIES } from '../../utils/constants';

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const style = COMPLIANCE_STATUS_STYLES[status] || 'bg-gray-100 text-gray-600';
  const labels = { VALID: 'Valid', DUE_SOON: 'Due Soon', OVERDUE: 'Overdue', LIFETIME: 'Lifetime' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style}`}>
      {labels[status] || status}
    </span>
  );
}

// ─── Days Remaining Cell ──────────────────────────────────────────────────────

function DaysCell({ daysLeft, status }) {
  if (status === 'LIFETIME') return <span className="text-xs text-gray-400">—</span>;
  if (daysLeft === null) return <span className="text-xs text-gray-400">—</span>;
  if (daysLeft < 0) return <span className="text-xs font-semibold text-red-600">{Math.abs(daysLeft)}d overdue</span>;
  if (daysLeft <= 30) return <span className="text-xs font-semibold text-amber-600">{daysLeft}d left</span>;
  return <span className="text-xs text-green-700">{daysLeft}d left</span>;
}

// ─── Renew Modal ──────────────────────────────────────────────────────────────

function RenewModal({ cert, onClose, onSaved }) {
  const { execute, loading, error } = useApi();
  const today = new Date().toISOString().slice(0, 10);
  const [renewedDate, setRenewedDate] = useState(today);
  const [newExpiryDate, setNewExpiryDate] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    await execute(
      () => api.post(`/compliance/certificates/${cert.id}/renew`, {
        renewedDate,
        newExpiryDate: newExpiryDate || undefined,
      }),
      'Certificate renewed!'
    );
    onSaved();
    onClose();
  };

  // Auto-compute suggested expiry
  const computeSuggested = () => {
    if (!renewedDate) return '';
    const d = new Date(renewedDate);
    if (cert.renewalFrequency === 'YEARLY') d.setFullYear(d.getFullYear() + 1);
    else if (cert.renewalFrequency === '5_YEARLY') d.setFullYear(d.getFullYear() + 5);
    else return '';
    return d.toISOString().slice(0, 10);
  };

  const suggested = computeSuggested();

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Renew Certificate</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm">
          <p className="font-medium text-blue-800">{cert.certificateType} — {cert.certificateNo}</p>
          <p className="text-blue-600 text-xs mt-0.5">{cert.companyRegistration?.abbr}</p>
        </div>
        {error && <AlertMessage type="error" message={error} />}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Renewal Date *</label>
            <input type="date" value={renewedDate} onChange={e => setRenewedDate(e.target.value)}
              required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Expiry Date
              {suggested && (
                <button type="button" onClick={() => setNewExpiryDate(suggested)}
                  className="ml-2 text-xs text-blue-600 hover:underline">
                  Use {suggested}
                </button>
              )}
            </label>
            <input type="date" value={newExpiryDate} onChange={e => setNewExpiryDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">Leave blank to auto-calculate from renewal frequency.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {loading ? 'Renewing...' : 'Mark Renewed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Certificate Modal ────────────────────────────────────────────────────

function AddCertModal({ registrations, onClose, onSaved }) {
  const { execute, loading, error } = useApi();
  const [form, setForm] = useState({
    companyRegistrationId: '',
    certificateType: '',
    certificateNo: '',
    issueDate: '',
    expiryDate: '',
    renewalFrequency: 'YEARLY',
    reminderDays: '30',
    documentUrl: '',
    notes: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await execute(
      () => api.post('/compliance/certificates', {
        ...form,
        companyRegistrationId: parseInt(form.companyRegistrationId),
        reminderDays: parseInt(form.reminderDays),
        issueDate: form.issueDate || null,
        expiryDate: form.expiryDate || null,
        documentUrl: form.documentUrl || null,
        notes: form.notes || null,
      }),
      'Certificate added!'
    );
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Add Compliance Certificate</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && <AlertMessage type="error" message={error} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Registration (GSTIN) *</label>
            <select value={form.companyRegistrationId} onChange={e => set('companyRegistrationId', e.target.value)}
              required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select registration...</option>
              {registrations.filter(r => r.isActive).map(r => (
                <option key={r.id} value={r.id}>{r.abbr} — {r.officeCity}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Type *</label>
              <select value={form.certificateType} onChange={e => set('certificateType', e.target.value)}
                required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select type...</option>
                {CERTIFICATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Number *</label>
              <input value={form.certificateNo} onChange={e => set('certificateNo', e.target.value)}
                required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
              <input type="date" value={form.issueDate} onChange={e => set('issueDate', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
              <input type="date" value={form.expiryDate} onChange={e => set('expiryDate', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Renewal Frequency *</label>
              <select value={form.renewalFrequency} onChange={e => set('renewalFrequency', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {RENEWAL_FREQUENCIES.map(f => <option key={f} value={f}>{f.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reminder (days before)</label>
              <input type="number" min="1" max="365" value={form.reminderDays}
                onChange={e => set('reminderDays', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Adding...' : 'Add Certificate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ComplianceTracker() {
  const { data: certs, loading, error, refetch } = useFetch('/compliance/certificates', []);
  const { data: registrations } = useFetch('/company-master/registrations', []);
  const { execute } = useApi();

  const [filterEntity, setFilterEntity] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [renewModal, setRenewModal] = useState(null);
  const [addModal, setAddModal] = useState(false);

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;

  // Unique entities from loaded certs
  const entityOptions = Array.from(
    new Map(certs.map(c => [
      c.companyRegistration?.legalEntity?.id,
      c.companyRegistration?.legalEntity?.legalName
    ])).entries()
  ).filter(([id]) => id);

  // Filter logic
  const filtered = certs.filter(c => {
    if (filterEntity && String(c.companyRegistration?.legalEntity?.id) !== filterEntity) return false;
    if (filterType && c.certificateType !== filterType) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    return true;
  });

  // Summary counts
  const overdue = certs.filter(c => c.status === 'OVERDUE').length;
  const dueSoon = certs.filter(c => c.status === 'DUE_SOON').length;

  const handleDelete = async (cert) => {
    if (!window.confirm(`Delete ${cert.certificateType} — ${cert.certificateNo}?`)) return;
    await execute(() => api.delete(`/compliance/certificates/${cert.id}`), 'Certificate deleted');
    refetch();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-green-600" size={22} />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Compliance Tracker</h1>
              <p className="text-xs text-gray-500">
                {certs.length} certificates
                {overdue > 0 && <span className="ml-2 text-red-600 font-medium">· {overdue} overdue</span>}
                {dueSoon > 0 && <span className="ml-2 text-amber-600 font-medium">· {dueSoon} due soon</span>}
              </p>
            </div>
          </div>
          <button onClick={() => setAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            <Plus size={15} /> Add Certificate
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 mt-3">
          <Filter size={14} className="text-gray-400" />
          <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Entities</option>
            {entityOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Types</option>
            {CERTIFICATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Statuses</option>
            <option value="VALID">Valid</option>
            <option value="DUE_SOON">Due Soon</option>
            <option value="OVERDUE">Overdue</option>
            <option value="LIFETIME">Lifetime</option>
          </select>
          {(filterEntity || filterType || filterStatus) && (
            <button onClick={() => { setFilterEntity(''); setFilterType(''); setFilterStatus(''); }}
              className="text-xs text-gray-500 hover:text-red-600 underline">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <EmptyState icon="🛡️" title="No certificates found" subtitle="Add certificates or adjust filters" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
              <tr>
                {['Registration', 'Legal Entity', 'Type', 'Cert No.', 'Expiry', 'Days Left', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(cert => (
                <tr key={cert.id}
                  className={`hover:bg-gray-50 ${cert.status === 'OVERDUE' ? 'bg-red-50' : cert.status === 'DUE_SOON' ? 'bg-amber-50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-blue-700">
                      {cert.companyRegistration?.abbr || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[160px] truncate">
                    {cert.companyRegistration?.legalEntity?.legalName || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded font-medium">
                      {cert.certificateType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 font-mono max-w-[140px] truncate">
                    {cert.certificateNo}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {cert.expiryDate ? formatDate(cert.expiryDate) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <DaysCell daysLeft={cert.daysLeft} status={cert.status} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={cert.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {cert.status !== 'LIFETIME' && (
                        <button onClick={() => setRenewModal(cert)}
                          className="text-xs text-green-600 hover:underline flex items-center gap-1">
                          <RefreshCw size={11} /> Renew
                        </button>
                      )}
                      <button onClick={() => handleDelete(cert)}
                        className="text-xs text-red-400 hover:underline">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {renewModal && (
        <RenewModal cert={renewModal} onClose={() => setRenewModal(null)} onSaved={refetch} />
      )}
      {addModal && (
        <AddCertModal registrations={registrations} onClose={() => setAddModal(false)} onSaved={refetch} />
      )}
    </div>
  );
}
