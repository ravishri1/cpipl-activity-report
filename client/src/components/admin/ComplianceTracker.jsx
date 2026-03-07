import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import StatusBadge from '../shared/StatusBadge';
import {
  COMPLIANCE_STATUS_STYLES,
  CERTIFICATE_TYPES,
  RENEWAL_FREQUENCIES,
} from '../../utils/constants';
import {
  BadgeCheck,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Filter,
  AlertTriangle,
  CheckCircle,
  Clock,
  Infinity,
} from 'lucide-react';

// ─── Status icon helper ────────────────────────────────────────────────────
function StatusIcon({ status }) {
  if (status === 'OVERDUE')  return <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />;
  if (status === 'DUE_SOON') return <Clock className="w-3.5 h-3.5 inline mr-1" />;
  if (status === 'LIFETIME') return <Infinity className="w-3.5 h-3.5 inline mr-1" />;
  return <CheckCircle className="w-3.5 h-3.5 inline mr-1" />;
}

// ─── Days-left display ─────────────────────────────────────────────────────
function DaysLeft({ cert }) {
  if (cert.status === 'LIFETIME') return <span className="text-slate-400 text-sm">—</span>;
  if (cert.daysLeft === null || cert.daysLeft === undefined) return <span className="text-slate-400 text-sm">—</span>;
  if (cert.daysLeft < 0) return <span className="text-red-600 font-semibold text-sm">{Math.abs(cert.daysLeft)}d overdue</span>;
  if (cert.daysLeft === 0) return <span className="text-red-600 font-semibold text-sm">Due today</span>;
  return <span className={cert.daysLeft <= 14 ? 'text-orange-600 font-semibold text-sm' : 'text-slate-700 text-sm'}>{cert.daysLeft}d left</span>;
}

// ─── Add Certificate Modal ─────────────────────────────────────────────────
function AddCertModal({ registrations, onClose, onSaved }) {
  const [form, setForm] = useState({
    companyRegistrationId: '',
    certificateType: '',
    certificateNo: '',
    issueDate: '',
    expiryDate: '',
    renewalFrequency: '',
    lastRenewed: '',
    reminderDays: 30,
    documentUrl: '',
    notes: '',
  });
  const { execute, loading, error } = useApi();

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.companyRegistrationId || !form.certificateType || !form.certificateNo || !form.renewalFrequency) return;
    await execute(
      () => api.post('/compliance/certificates', form),
      'Certificate added successfully!'
    );
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" /> Add Certificate
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <AlertMessage type="error" message={error} />}

          {/* Registration */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Company Registration <span className="text-red-500">*</span>
            </label>
            <select
              value={form.companyRegistrationId}
              onChange={e => setField('companyRegistrationId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select registration…</option>
              {registrations.map(r => (
                <option key={r.id} value={r.id}>
                  {r.abbr} — {r.legalEntity?.legalName}
                </option>
              ))}
            </select>
          </div>

          {/* Certificate Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Certificate Type <span className="text-red-500">*</span>
            </label>
            <select
              value={form.certificateType}
              onChange={e => setField('certificateType', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select type…</option>
              {CERTIFICATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Certificate No */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Certificate No <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.certificateNo}
              onChange={e => setField('certificateNo', e.target.value)}
              placeholder="e.g. 10019022009005"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Renewal Frequency */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Renewal Frequency <span className="text-red-500">*</span>
            </label>
            <select
              value={form.renewalFrequency}
              onChange={e => setField('renewalFrequency', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select frequency…</option>
              {RENEWAL_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Issue Date</label>
              <input
                type="date"
                value={form.issueDate}
                onChange={e => setField('issueDate', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
              <input
                type="date"
                value={form.expiryDate}
                onChange={e => setField('expiryDate', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={form.renewalFrequency === 'LIFETIME' || form.renewalFrequency === 'NONE'}
              />
            </div>
          </div>

          {/* Last Renewed + Reminder Days */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Last Renewed</label>
              <input
                type="date"
                value={form.lastRenewed}
                onChange={e => setField('lastRenewed', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reminder Days</label>
              <input
                type="number"
                min="1"
                max="365"
                value={form.reminderDays}
                onChange={e => setField('reminderDays', parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Document URL */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Document URL</label>
            <input
              type="url"
              value={form.documentUrl}
              onChange={e => setField('documentUrl', e.target.value)}
              placeholder="https://drive.google.com/…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Optional notes…"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              {loading ? 'Adding…' : 'Add Certificate'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Renew Modal ────────────────────────────────────────────────────────────
function RenewModal({ cert, onClose, onSaved }) {
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const { execute, loading, error } = useApi();

  const handleSubmit = async (e) => {
    e.preventDefault();
    await execute(
      () => api.post(`/compliance/certificates/${cert.id}/renew`, { newExpiryDate: newExpiryDate || undefined, notes: notes || undefined }),
      'Certificate renewed successfully!'
    );
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-green-600" /> Renew Certificate
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6">
          {/* Current cert info */}
          <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm space-y-1">
            <p><span className="text-slate-500">Registration:</span> <span className="font-medium">{cert.companyRegistration?.abbr}</span></p>
            <p><span className="text-slate-500">Type:</span> <span className="font-medium">{cert.certificateType}</span></p>
            <p><span className="text-slate-500">Certificate No:</span> <span className="font-medium">{cert.certificateNo}</span></p>
            {cert.expiryDate && (
              <p><span className="text-slate-500">Current Expiry:</span> <span className="font-medium text-red-600">{formatDate(cert.expiryDate)}</span></p>
            )}
          </div>

          {error && <AlertMessage type="error" message={error} />}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                New Expiry Date <span className="text-slate-400 text-xs">(leave blank to auto-calculate from frequency)</span>
              </label>
              <input
                type="date"
                value={newExpiryDate}
                onChange={e => setNewExpiryDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                placeholder="Optional renewal notes…"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm"
              >
                {loading ? 'Renewing…' : 'Mark as Renewed'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Main ComplianceTracker Component ─────────────────────────────────────
export default function ComplianceTracker() {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  // Filters
  const [filterEntity, setFilterEntity] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [renewingCert, setRenewingCert] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Dashboard stats
  const { data: stats } = useFetch('/compliance/dashboard', { total: 0, overdue: 0, dueSoon: 0, valid: 0, lifetime: 0 });

  // Registrations for the Add modal dropdown
  const { data: registrations } = useFetch('/company-master/registrations', []);

  // ── Fetch certificates ───────────────────────────────────────────────────
  const loadCerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterEntity)  params.set('registrationId', filterEntity);
      if (filterType)    params.set('type', filterType);
      if (filterStatus)  params.set('status', filterStatus);

      const res = await api.get(`/compliance/certificates?${params.toString()}`);
      setCerts(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load certificates');
    } finally {
      setLoading(false);
    }
  }, [filterEntity, filterType, filterStatus]);

  useEffect(() => { loadCerts(); }, [loadCerts]);

  // ── Delete handler ───────────────────────────────────────────────────────
  const handleDelete = async (cert) => {
    if (!window.confirm(`Delete ${cert.certificateType} certificate (${cert.certificateNo})?\nThis cannot be undone.`)) return;
    setDeletingId(cert.id);
    try {
      await api.delete(`/compliance/certificates/${cert.id}`);
      setSuccess('Certificate deleted.');
      loadCerts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err?.response?.data?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  // ── After add/renew ──────────────────────────────────────────────────────
  const handleSaved = (msg) => {
    setShowAddModal(false);
    setRenewingCert(null);
    setSuccess(msg || 'Saved!');
    loadCerts();
    setTimeout(() => setSuccess(''), 3000);
  };

  // ── Unique entities for filter dropdown ─────────────────────────────────
  const entityOptions = registrations.map(r => ({ id: r.id, label: `${r.abbr} — ${r.legalEntity?.legalName}` }));

  return (
    <div className="p-6 max-w-full">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <BadgeCheck className="w-7 h-7 text-blue-600" />
              Compliance Tracker
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Monitor certificate renewals across all legal entities and registrations.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> Add Certificate
          </button>
        </div>
      </div>

      {/* ── Dashboard Stats ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total',    value: stats.total,    color: 'bg-slate-50 border-slate-200 text-slate-700' },
          { label: 'Overdue',  value: stats.overdue,  color: 'bg-red-50 border-red-200 text-red-700' },
          { label: 'Due Soon', value: stats.dueSoon,  color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
          { label: 'Valid',    value: stats.valid,    color: 'bg-green-50 border-green-200 text-green-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-sm font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Feedback messages ─────────────────────────────────────────────── */}
      {success && <div className="mb-4"><AlertMessage type="success" message={success} /></div>}
      {error   && <div className="mb-4"><AlertMessage type="error"   message={error}   /></div>}

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-600">Filters</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {/* Entity filter */}
          <select
            value={filterEntity}
            onChange={e => setFilterEntity(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
          >
            <option value="">All Registrations</option>
            {entityOptions.map(e => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </select>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            {CERTIFICATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="OVERDUE">Overdue</option>
            <option value="DUE_SOON">Due Soon</option>
            <option value="VALID">Valid</option>
            <option value="LIFETIME">Lifetime</option>
          </select>

          {/* Clear */}
          {(filterEntity || filterType || filterStatus) && (
            <button
              onClick={() => { setFilterEntity(''); setFilterType(''); setFilterStatus(''); }}
              className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-800 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16"><LoadingSpinner /></div>
        ) : certs.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No certificates found"
            subtitle={filterEntity || filterType || filterStatus ? 'Try adjusting the filters.' : 'Add a certificate to start tracking.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Registration</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Legal Entity</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Certificate No</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Issue Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Expiry Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Days Left</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {certs.map(cert => (
                  <tr
                    key={cert.id}
                    className={`hover:bg-slate-50 transition-colors ${cert.status === 'OVERDUE' ? 'bg-red-50/40' : ''}`}
                  >
                    {/* Registration abbr */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {cert.companyRegistration?.abbr || '—'}
                      </span>
                    </td>

                    {/* Legal Entity name */}
                    <td className="px-4 py-3 text-slate-700">
                      {cert.companyRegistration?.legalEntity?.legalName || '—'}
                    </td>

                    {/* Certificate Type */}
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">{cert.certificateType}</span>
                    </td>

                    {/* Certificate No */}
                    <td className="px-4 py-3">
                      {cert.documentUrl ? (
                        <a
                          href={cert.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline font-mono text-xs"
                        >
                          {cert.certificateNo}
                        </a>
                      ) : (
                        <span className="font-mono text-xs text-slate-600">{cert.certificateNo}</span>
                      )}
                    </td>

                    {/* Issue Date */}
                    <td className="px-4 py-3 text-slate-600">
                      {cert.issueDate ? formatDate(cert.issueDate) : '—'}
                    </td>

                    {/* Expiry Date */}
                    <td className="px-4 py-3">
                      {cert.expiryDate ? (
                        <span className={cert.status === 'OVERDUE' ? 'text-red-600 font-medium' : 'text-slate-600'}>
                          {formatDate(cert.expiryDate)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Days Left */}
                    <td className="px-4 py-3">
                      <DaysLeft cert={cert} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${COMPLIANCE_STATUS_STYLES[cert.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        <StatusIcon status={cert.status} />
                        {cert.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {cert.status !== 'LIFETIME' && (
                          <button
                            onClick={() => setRenewingCert(cert)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 text-xs font-medium transition-colors"
                            title="Renew certificate"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Renew
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(cert)}
                          disabled={deletingId === cert.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                          title="Delete certificate"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer: cert count */}
        {!loading && certs.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500">{certs.length} certificate{certs.length !== 1 ? 's' : ''} shown</p>
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showAddModal && (
        <AddCertModal
          registrations={registrations}
          onClose={() => setShowAddModal(false)}
          onSaved={() => handleSaved('Certificate added successfully!')}
        />
      )}

      {renewingCert && (
        <RenewModal
          cert={renewingCert}
          onClose={() => setRenewingCert(null)}
          onSaved={() => handleSaved('Certificate renewed successfully!')}
        />
      )}
    </div>
  );
}
