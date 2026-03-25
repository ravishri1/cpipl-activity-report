import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate, formatINR } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import DeleteErrorModal from '../shared/DeleteErrorModal';
import StatusBadge from '../shared/StatusBadge';
import {
  RENEWAL_STATUS_STYLES,
  RENEWAL_TRAFFIC_LIGHT,
  BILLING_CYCLE_LABELS,
  EMAIL_SCAN_STATUS_STYLES,
} from '../../utils/constants';
import {
  RefreshCw, Plus, Pencil, DollarSign, History, Link, Eye, EyeOff,
  Copy, CheckCircle, X, Search, Filter, Mail, Scan, ExternalLink,
  Calendar, Tag, User, Trash2, ChevronDown, CreditCard, Globe,
} from 'lucide-react';

// ─── Helper: advance renewal date by billing cycle ─────────────────────────────
function advanceDate(dateStr, cycle) {
  const d = new Date(dateStr);
  switch (cycle) {
    case 'monthly':     d.setMonth(d.getMonth() + 1); break;
    case 'quarterly':   d.setMonth(d.getMonth() + 3); break;
    case 'half_yearly': d.setMonth(d.getMonth() + 6); break;
    case 'yearly':      d.setFullYear(d.getFullYear() + 1); break;
    default: break;
  }
  return d.toISOString().slice(0, 10);
}

// ─── Traffic light dot ──────────────────────────────────────────────────────────
function TrafficDot({ light }) {
  const cfg = RENEWAL_TRAFFIC_LIGHT[light] || RENEWAL_TRAFFIC_LIGHT.grey;
  return (
    <span className="relative flex items-center gap-1.5">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${cfg.dot}`} title={cfg.label} />
    </span>
  );
}

// ─── Copy-to-clipboard button ──────────────────────────────────────────────────
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="text-slate-400 hover:text-slate-700 ml-1" title="Copy">
      {copied ? <CheckCircle size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  );
}

// ─── BLANK RENEWAL FORM ─────────────────────────────────────────────────────────
const BLANK = {
  itemName: '', vendorName: '', categoryId: '', assignedTo: '',
  billingCycle: 'yearly', renewalDate: '', startDate: '',
  amount: '', currency: 'INR', paymentAccountId: '', referenceNo: '',
  loginUrl: '', loginUsername: '', loginPassword: '',
  alertDaysBefore: 15, alertRecipients: '', documentUrl: '', notes: '',
  status: 'active',
};

// ─── ADD / EDIT RENEWAL MODAL ──────────────────────────────────────────────────
function RenewalModal({ renewal, categories, accounts, onClose, onSaved }) {
  const isEdit = !!renewal;
  const [form, setForm] = useState(isEdit ? {
    ...BLANK,
    ...renewal,
    categoryId: renewal.categoryId || '',
    paymentAccountId: renewal.paymentAccountId || '',
    renewalDate: renewal.renewalDate ? renewal.renewalDate.slice(0, 10) : '',
    startDate: renewal.startDate ? renewal.startDate.slice(0, 10) : '',
    amount: renewal.amount != null ? String(renewal.amount) : '',
  } : { ...BLANK });
  const [showPwd, setShowPwd] = useState(false);
  const { execute, loading, error } = useApi();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const body = { ...form };
    if (body.amount === '') delete body.amount; else body.amount = parseFloat(body.amount);
    if (!body.categoryId) delete body.categoryId;
    if (!body.paymentAccountId) delete body.paymentAccountId;
    if (!body.startDate) delete body.startDate;

    await execute(
      () => isEdit ? api.put(`/renewals/${renewal.id}`, body) : api.post('/renewals', body),
      isEdit ? 'Renewal updated!' : 'Renewal created!'
    );
    onSaved();
    onClose();
  };

  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';
  const sel = `${inp} bg-white`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-semibold text-slate-800">{isEdit ? 'Edit Renewal' : 'Add Renewal'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <AlertMessage type="error" message={error} />}

          {/* Basic */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Item Name *</label>
              <input className={inp} required value={form.itemName} onChange={e => set('itemName', e.target.value)} placeholder="e.g. Google Workspace" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
              <select className={sel} value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
                <option value="">— Select —</option>
                {(categories || []).map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vendor / Provider</label>
              <input className={inp} value={form.vendorName} onChange={e => set('vendorName', e.target.value)} placeholder="e.g. Google LLC" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Assigned To</label>
              <input className={inp} value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)} placeholder="Person or team" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select className={sel} value={form.status} onChange={e => set('status', e.target.value)}>
                {['active', 'expired', 'cancelled', 'on_hold'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>

          {/* Login */}
          <div className="border border-slate-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Login Details</p>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Login URL</label>
              <input className={inp} type="url" value={form.loginUrl} onChange={e => set('loginUrl', e.target.value)} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Username / Email</label>
                <input className={inp} value={form.loginUsername} onChange={e => set('loginUsername', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
                <div className="relative">
                  <input className={`${inp} pr-9`} type={showPwd ? 'text' : 'password'} value={form.loginPassword} onChange={e => set('loginPassword', e.target.value)} />
                  <button type="button" onClick={() => setShowPwd(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Dates & Billing */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Renewal Date *</label>
              <input className={inp} required type="date" value={form.renewalDate} onChange={e => set('renewalDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
              <input className={inp} type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Billing Cycle</label>
              <select className={sel} value={form.billingCycle} onChange={e => set('billingCycle', e.target.value)}>
                {Object.entries(BILLING_CYCLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Finance */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount</label>
              <input className={inp} type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Currency</label>
              <select className={sel} value={form.currency} onChange={e => set('currency', e.target.value)}>
                <option value="INR">INR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment Account</label>
              <select className={sel} value={form.paymentAccountId} onChange={e => set('paymentAccountId', e.target.value)}>
                <option value="">— None —</option>
                {(accounts || []).map(a => <option key={a.id} value={a.id}>{a.accountCode} — {a.name}</option>)}
              </select>
            </div>
          </div>

          {/* Alerts */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Alert Days Before</label>
              <input className={inp} type="number" min="0" value={form.alertDaysBefore} onChange={e => set('alertDaysBefore', parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Reference No</label>
              <input className={inp} value={form.referenceNo} onChange={e => set('referenceNo', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea className={`${inp} h-20 resize-none`} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Renewal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── LOGIN DETAILS MODAL ────────────────────────────────────────────────────────
function LoginDetailsModal({ renewal, onClose }) {
  const [showPwd, setShowPwd] = useState(false);
  const fields = [
    { label: 'URL', value: renewal.loginUrl, isUrl: true },
    { label: 'Username', value: renewal.loginUsername },
    { label: 'Password', value: renewal.loginPassword, secret: true },
  ].filter(f => f.value);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Login Details — {renewal.itemName}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {fields.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No login details stored.</p>
          ) : fields.map(f => (
            <div key={f.label} className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">{f.label}</p>
              <div className="flex items-center gap-2">
                {f.isUrl ? (
                  <a href={f.value} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate flex-1 flex items-center gap-1">
                    <Globe size={13} /> {f.value}
                  </a>
                ) : (
                  <span className="text-sm text-slate-800 flex-1 font-mono">
                    {f.secret && !showPwd ? '••••••••' : f.value}
                  </span>
                )}
                {f.secret && (
                  <button onClick={() => setShowPwd(s => !s)} className="text-slate-400 hover:text-slate-700">
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
                <CopyBtn text={f.value} />
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 pb-5 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── MARK PAID MODAL ────────────────────────────────────────────────────────────
function MarkPaidModal({ renewal, onClose, onSaved }) {
  const [amount, setAmount] = useState(renewal.amount != null ? String(renewal.amount) : '');
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const { execute, loading, error } = useApi();
  const nextDate = renewal.renewalDate ? advanceDate(renewal.renewalDate, renewal.billingCycle) : '—';

  const handleSubmit = async (e) => {
    e.preventDefault();
    await execute(
      () => api.post(`/renewals/${renewal.id}/mark-paid`, {
        amount: amount ? parseFloat(amount) : undefined,
        paidOn,
        notes,
      }),
      'Marked as paid!'
    );
    onSaved();
    onClose();
  };

  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Mark as Paid — {renewal.itemName}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <AlertMessage type="error" message={error} />}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-800">
            Next renewal date will advance to: <strong>{nextDate}</strong>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Amount Paid ({renewal.currency})</label>
            <input className={inp} type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Paid On</label>
            <input className={inp} type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea className={`${inp} h-16 resize-none`} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional reference or notes" />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60">
              {loading ? 'Saving…' : 'Mark Paid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── HISTORY DRAWER ─────────────────────────────────────────────────────────────
function HistoryDrawer({ renewal, onClose }) {

  const { data: history, loading } = useFetch(`/renewals/${renewal.id}/history`, []);

  const ACTION_COLORS = {
    created:    'bg-blue-100 text-blue-700',
    updated:    'bg-slate-100 text-slate-600',
    paid:       'bg-green-100 text-green-700',
    reconciled: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg h-full shadow-2xl flex flex-col">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">History</h3>
            <p className="text-xs text-slate-500">{renewal.itemName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? <LoadingSpinner /> : history.length === 0 ? (
            <EmptyState icon="📋" title="No history" subtitle="Events will appear here" />
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-slate-100" />
              {history.map(h => (
                <div key={h.id} className="relative mb-6">
                  <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-300" />
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[h.action] || 'bg-slate-100 text-slate-600'}`}>
                        {h.action}
                      </span>
                      <span className="text-xs text-slate-400">{formatDate(h.createdAt)}</span>
                    </div>
                    {h.performer && <p className="text-xs text-slate-400 mt-1">by {h.performer.name}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RenewalManager() {
  const { execute, deleteError, setDeleteError } = useApi();

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [tab, setTab] = useState('dashboard');

  // ── Filter state ───────────────────────────────────────────────────────────
  const [filterCat, setFilterCat]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLight, setFilterLight]   = useState('');
  const [sortBy, setSortBy]             = useState('');
  const [search, setSearch]             = useState('');
  const [selectedIds, setSelectedIds]   = useState(new Set());

  // ── Renewal modal state ────────────────────────────────────────────────────
  const [openModal, setOpenModal]       = useState(false);
  const [selectedRenewal, setSelected]  = useState(null);

  // ── Detail modal states ────────────────────────────────────────────────────
  const [showHistory, setShowHistory]   = useState(null);
  const [showLogin, setShowLogin]       = useState(null);
  const [showMarkPaid, setShowMarkPaid] = useState(null);

  // ── Category inline modal ──────────────────────────────────────────────────
  const [catModal, setCatModal] = useState(false);
  const [editCat, setEditCat]   = useState(null);
  const [catForm, setCatForm]   = useState({ name: '', icon: '' });

  // ── Account inline modal ───────────────────────────────────────────────────
  const [acctModal, setAcctModal] = useState(false);
  const [editAcct, setEditAcct]   = useState(null);
  const [acctForm, setAcctForm]   = useState({ accountCode: '', type: '', name: '', identifier: '' });

  // ── Email scan state ───────────────────────────────────────────────────────
  const [scanning, setScanning]     = useState(false);
  const [scanResult, setScanResult] = useState(null);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: summary, refetch: refetchSummary } = useFetch('/renewals/summary', {});

  const renewalsUrl = (() => {
    const p = new URLSearchParams();
    if (filterCat)    p.set('categoryId', filterCat);
    if (filterStatus) p.set('status', filterStatus);
    if (filterLight)  p.set('trafficLight', filterLight);
    if (sortBy)       p.set('sort', sortBy);
    if (search)       p.set('search', search);
    return `/renewals?${p.toString()}`;
  })();
  const { data: renewals, loading: loadingRenewals, refetch: refetchRenewals } = useFetch(renewalsUrl, []);

  const { data: categories, refetch: refetchCats } = useFetch('/renewals/categories', []);
  const { data: accounts,   refetch: refetchAccts } = useFetch('/renewals/accounts', []);
  const { data: scans,      refetch: refetchScans } = useFetch('/renewals/email-scans?status=pending', []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function refetchAll() { refetchRenewals(); refetchSummary(); }

  async function handleDeleteCat(id) {
    if (!window.confirm('Delete this category?')) return;
    await execute(() => api.delete(`/renewals/categories/${id}`), 'Category deleted');
    refetchCats();
  }

  async function handleSaveCat() {
    if (editCat) {
      await execute(() => api.put(`/renewals/categories/${editCat.id}`, catForm), 'Category updated');
    } else {
      await execute(() => api.post('/renewals/categories', catForm), 'Category created');
    }
    setCatModal(false); setEditCat(null); setCatForm({ name: '', icon: '' });
    refetchCats();
  }

  async function handleDeleteAcct(id) {
    if (!window.confirm('Delete this account?')) return;
    await execute(() => api.delete(`/renewals/accounts/${id}`), 'Account deleted');
    refetchAccts();
  }

  async function handleDeleteRenewal(id) {
    if (!window.confirm('Are you sure you want to delete this renewal? This cannot be undone.')) return;
    try {
      await execute(() => api.delete(`/renewals/${id}`), 'Renewal deleted!');
      refetchAll();
    } catch {
      // Error (including dependency errors) displayed by useApi hook
    }
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === renewals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(renewals.map(r => r.id)));
    }
  }

  async function handleBulkDelete() {
    if (!window.confirm(`Delete ${selectedIds.size} selected renewal(s)? This cannot be undone.`)) return;
    try {
      await execute(() => api.post('/renewals/bulk-delete', { ids: [...selectedIds] }), `${selectedIds.size} renewal(s) deleted!`);
      setSelectedIds(new Set());
      refetchAll();
    } catch {
      // Errors displayed by useApi hook
    }
  }

  async function handleBulkStatusChange(status) {
    if (!window.confirm(`Change status to "${status}" for ${selectedIds.size} renewal(s)?`)) return;
    try {
      await execute(() => api.post('/renewals/bulk-update', { ids: [...selectedIds], status }), `${selectedIds.size} renewal(s) updated!`);
      setSelectedIds(new Set());
      refetchAll();
    } catch {}
  }

  async function handleSaveAcct() {
    if (editAcct) {
      await execute(() => api.put(`/renewals/accounts/${editAcct.id}`, acctForm), 'Account updated');
    } else {
      await execute(() => api.post('/renewals/accounts', acctForm), 'Account created');
    }
    setAcctModal(false); setEditAcct(null); setAcctForm({ accountCode: '', type: '', name: '', identifier: '' });
    refetchAccts();
  }

  async function handleScanEmail() {
    setScanning(true); setScanResult(null);
    try {
      const res = await api.post('/renewals/scan-email');
      setScanResult(res.data);
      refetchScans();
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Scan failed. Check Gmail OAuth token.';
      setScanResult({ error: msg });
    } finally {
      setScanning(false);
    }
  }

  async function handleDismissScan(id) {
    await execute(() => api.post(`/renewals/email-scans/${id}/dismiss`), 'Dismissed');
    refetchScans();
  }

  // ── Summary card config ────────────────────────────────────────────────────
  const cards = [
    { key: 'red',    label: 'Due ≤7 days',  dot: 'bg-red-500',    bg: 'bg-red-50 border-red-200',    text: 'text-red-700' },
    { key: 'yellow', label: 'Due ≤30 days', dot: 'bg-yellow-500', bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700' },
    { key: 'green',  label: 'OK (>30 days)',dot: 'bg-green-500',  bg: 'bg-green-50 border-green-200',   text: 'text-green-700' },
    { key: 'grey',   label: 'Expired',      dot: 'bg-slate-400',  bg: 'bg-slate-50 border-slate-200',   text: 'text-slate-600' },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {deleteError && <DeleteErrorModal data={deleteError} onClose={() => setDeleteError(null)} />}

      {/* ── Page Header ── */}
      <div className="sticky top-0 z-10 bg-slate-50 pb-3 -mx-6 px-6 pt-0 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Renewal Manager</h1>
            <p className="text-sm text-slate-500 mt-0.5">Track subscriptions, licences &amp; recurring payments</p>
          </div>
          <button
            onClick={() => { setSelected(null); setOpenModal(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Renewal
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-4">
          {[
            { id: 'dashboard',   label: 'Dashboard & Renewals' },
            { id: 'categories',  label: 'Categories & Accounts' },
            { id: 'emailScans',  label: 'Email Scans' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════ TAB 1: DASHBOARD & RENEWALS ══════════════ */}
      {tab === 'dashboard' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {cards.map(c => (
              <div key={c.key} className={`border rounded-xl p-4 flex flex-col gap-2 ${c.bg}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${c.dot}`} />
                  <span className={`text-xs font-medium ${c.text}`}>{c.label}</span>
                </div>
                <p className={`text-3xl font-bold ${c.text}`}>
                  {summary?.[c.key] ?? '—'}
                </p>
              </div>
            ))}
          </div>

          {/* Spend summary row */}
          {(summary?.totalINR || summary?.totalUSD) && (
            <div className="flex gap-4 text-sm text-slate-600">
              {summary.totalINR > 0 && (
                <span>Monthly spend (INR): <strong className="text-slate-800">₹{formatINR(summary.totalINR)}</strong></span>
              )}
              {summary.totalUSD > 0 && (
                <span>Monthly spend (USD): <strong className="text-slate-800">${summary.totalUSD}</strong></span>
              )}
            </div>
          )}

          {/* Filter bar */}
          <div className="flex flex-wrap gap-3 items-center bg-white border border-slate-200 rounded-xl p-3">
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {['active', 'expired', 'cancelled', 'on_hold'].map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>

            <select
              value={filterLight}
              onChange={e => setFilterLight(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Due Dates</option>
              <option value="red">🔴 Due ≤7 days</option>
              <option value="yellow">🟡 Due ≤30 days</option>
              <option value="green">🟢 OK</option>
              <option value="grey">⚪ Expired</option>
            </select>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sort: Due Soon</option>
              <option value="newest_first">⬇️ Newest Added</option>
              <option value="oldest_first">⬆️ Oldest Added</option>
              <option value="due_later">📅 Due Later First</option>
              <option value="name_asc">🔤 Name A→Z</option>
              <option value="name_desc">🔤 Name Z→A</option>
              <option value="amount_desc">💰 Amount High→Low</option>
              <option value="amount_asc">💰 Amount Low→High</option>
            </select>

            <div className="flex items-center gap-2 flex-1 min-w-48">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search item or vendor…"
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {(filterCat || filterStatus || filterLight || sortBy || search) && (
              <button
                onClick={() => { setFilterCat(''); setFilterStatus(''); setFilterLight(''); setSortBy(''); setSearch(''); }}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Renewals Table */}
          {loadingRenewals ? (
            <LoadingSpinner />
          ) : renewals.length === 0 ? (
            <EmptyState icon="🔄" title="No renewals found" subtitle="Add your first renewal or adjust the filters" />
          ) : (
            <>
            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl mb-3">
                <span className="text-sm font-medium text-blue-800">{selectedIds.size} selected</span>
                <button onClick={handleBulkDelete} className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">
                  Delete Selected
                </button>
                <button onClick={() => handleBulkStatusChange('active')} className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">
                  Set Active
                </button>
                <button onClick={() => handleBulkStatusChange('cancelled')} className="px-3 py-1 text-xs font-medium bg-slate-600 text-white rounded-lg hover:bg-slate-700">
                  Set Cancelled
                </button>
                <button onClick={() => handleBulkStatusChange('on_hold')} className="px-3 py-1 text-xs font-medium bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">
                  Set On Hold
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-slate-500 hover:text-slate-700 underline">
                  Clear
                </button>
              </div>
            )}

            <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs text-slate-500 uppercase tracking-wide">
                    <th className="px-3 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={renewals.length > 0 && selectedIds.size === renewals.length}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 w-6" />
                    <th className="px-4 py-3">Item / Vendor</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Assigned To</th>
                    <th className="px-4 py-3">Renewal Date</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Cycle</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {renewals.map(r => (
                    <tr key={r.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(r.id) ? 'bg-blue-50' : ''}`}>
                      {/* Checkbox */}
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      {/* Traffic dot */}
                      <td className="px-4 py-3">
                        <TrafficDot light={r.trafficLight} />
                      </td>

                      {/* Item + vendor */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{r.itemName}</p>
                        {r.vendorName && <p className="text-xs text-slate-500">{r.vendorName}</p>}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        {r.category ? (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-xs">
                            {r.category.icon} {r.category.name}
                          </span>
                        ) : '—'}
                      </td>

                      {/* Assigned to */}
                      <td className="px-4 py-3 text-slate-600">{r.assignedTo || '—'}</td>

                      {/* Renewal date + days left */}
                      <td className="px-4 py-3">
                        <p className="text-slate-800">{formatDate(r.renewalDate)}</p>
                        {r.daysLeft != null && (
                          <p className={`text-xs ${r.daysLeft < 0 ? 'text-red-500' : r.daysLeft <= 7 ? 'text-red-500' : r.daysLeft <= 30 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {r.daysLeft < 0 ? `${Math.abs(r.daysLeft)}d overdue` : `${r.daysLeft}d left`}
                          </p>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-slate-700">
                        {r.amount
                          ? (r.currency === 'USD' ? `$${r.amount}` : `₹${formatINR(r.amount)}`)
                          : '—'}
                      </td>

                      {/* Billing cycle */}
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {BILLING_CYCLE_LABELS[r.billingCycle] || r.billingCycle || '—'}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} styles={RENEWAL_STATUS_STYLES} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit */}
                          <button
                            title="Edit"
                            onClick={() => { setSelected(r); setOpenModal(true); }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {/* Login details */}
                          {(r.loginUrl || r.loginUsername || r.loginPassword) && (
                            <button
                              title="Login Details"
                              onClick={() => setShowLogin(r)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                            >
                              <Link className="w-4 h-4" />
                            </button>
                          )}
                          {/* Mark paid */}
                          {r.status === 'active' && (
                            <button
                              title="Mark Paid / Renew"
                              onClick={() => setShowMarkPaid(r)}
                              className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}
                          {/* History */}
                          <button
                            title="History"
                            onClick={() => setShowHistory(r)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          {/* Delete */}
                          <button
                            title="Delete"
                            onClick={() => handleDeleteRenewal(r.id)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </>
      )}

      {/* ══════════════ TAB 2: CATEGORIES & ACCOUNTS ══════════════ */}
      {tab === 'categories' && (
        <div className="grid md:grid-cols-2 gap-6">

          {/* ─── Categories ─── */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h2 className="font-semibold text-slate-700">Categories</h2>
              <button
                onClick={() => { setEditCat(null); setCatForm({ name: '', icon: '' }); setCatModal(true); }}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            {categories.length === 0 ? (
              <EmptyState icon="📂" title="No categories" subtitle="Add a category to get started" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-2 text-left">Icon</th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-right">#</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {categories.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-lg">{c.icon || '📦'}</td>
                      <td className="px-4 py-2 text-slate-700">{c.name}</td>
                      <td className="px-4 py-2 text-right text-slate-400 text-xs">{c._count?.renewals ?? 0}</td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => { setEditCat(c); setCatForm({ name: c.name, icon: c.icon || '' }); setCatModal(true); }}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCat(c.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ─── Payment Accounts ─── */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h2 className="font-semibold text-slate-700">Payment Accounts</h2>
              <button
                onClick={() => { setEditAcct(null); setAcctForm({ accountCode: '', type: '', name: '', identifier: '' }); setAcctModal(true); }}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            {accounts.length === 0 ? (
              <EmptyState icon="💳" title="No accounts" subtitle="Add a payment account" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-2 text-left">Code</th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {accounts.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-xs text-slate-600">{a.accountCode}</td>
                      <td className="px-4 py-2 text-slate-700">{a.name}</td>
                      <td className="px-4 py-2 text-slate-500 capitalize text-xs">{a.type}</td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => { setEditAcct(a); setAcctForm({ accountCode: a.accountCode, type: a.type || '', name: a.name, identifier: a.identifier || '' }); setAcctModal(true); }}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteAcct(a.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ─── Category add/edit modal ─── */}
          {catModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
                <h3 className="font-semibold text-slate-800">{editCat ? 'Edit Category' : 'Add Category'}</h3>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Icon (emoji)</label>
                  <input
                    value={catForm.icon}
                    onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))}
                    placeholder="☁️"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
                  <input
                    value={catForm.name}
                    onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Software & Cloud"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => { setCatModal(false); setEditCat(null); }} className="flex-1 border border-slate-300 rounded-lg py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button onClick={handleSaveCat} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">Save</button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Account add/edit modal ─── */}
          {acctModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <form onSubmit={e => { e.preventDefault(); handleSaveAcct(); }} className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
                <h3 className="font-semibold text-slate-800">{editAcct ? 'Edit Account' : 'Add Account'}</h3>
                {[
                  { key: 'accountCode', label: 'Code', placeholder: 'HDFC-CC' },
                  { key: 'name', label: 'Name', placeholder: 'HDFC Credit Card' },
                  { key: 'type', label: 'Type', placeholder: 'credit_card / bank / upi / wallet' },
                  { key: 'identifier', label: 'Last 4 / UPI ID', placeholder: '1234' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                    <input
                      value={acctForm[f.key]}
                      onChange={e => setAcctForm(fm => ({ ...fm, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => { setAcctModal(false); setEditAcct(null); }} className="flex-1 border border-slate-300 rounded-lg py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button type="submit" className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">Save</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ TAB 3: EMAIL SCANS ══════════════ */}
      {tab === 'emailScans' && (
        <div className="space-y-4">

          {/* Scan trigger */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-slate-700">Gmail Inbox Scanner</p>
              <p className="text-sm text-slate-500 mt-0.5">
                Searches the admin Gmail inbox for renewal/subscription emails and uses AI to extract renewal data.
                Runs automatically every Monday at 8:30 AM.
              </p>
            </div>
            <button
              onClick={handleScanEmail}
              disabled={scanning}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-60 text-sm font-medium whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning…' : 'Scan Inbox Now'}
            </button>
          </div>

          {/* Scan result feedback */}
          {scanResult && (
            <AlertMessage
              type={scanResult.error ? 'error' : 'success'}
              message={
                scanResult.error
                  ? scanResult.error
                  : `Scan complete — ${scanResult.newFound ?? 0} new renewal emails found, ${scanResult.alreadyProcessed ?? 0} already processed.`
              }
            />
          )}

          {/* Pending scans table */}
          {scans.length === 0 ? (
            <EmptyState icon="📧" title="No pending email scans" subtitle="Scan the inbox or wait for the Monday auto-scan" />
          ) : (
            <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Subject / Sender</th>
                    <th className="px-4 py-3">Received</th>
                    <th className="px-4 py-3">AI Extracted Data</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scans.map(s => {
                    let parsed = {};
                    try { parsed = JSON.parse(s.extractedData || '{}'); } catch {}
                    return (
                      <tr key={s.id} className="hover:bg-slate-50">
                        {/* Subject + sender */}
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800 truncate max-w-xs">{s.subject}</p>
                          <p className="text-xs text-slate-500">{s.sender}</p>
                        </td>
                        {/* Received date */}
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {formatDate(s.receivedAt)}
                        </td>
                        {/* Extracted data */}
                        <td className="px-4 py-3">
                          <div className="text-xs space-y-0.5 text-slate-600">
                            {parsed.vendor      && <p><span className="text-slate-400">Vendor:</span> {parsed.vendor}</p>}
                            {parsed.itemName    && <p><span className="text-slate-400">Item:</span> {parsed.itemName}</p>}
                            {parsed.amount      && <p><span className="text-slate-400">Amount:</span> {parsed.currency === 'USD' ? `$${parsed.amount}` : `₹${formatINR(parsed.amount)}`}</p>}
                            {parsed.renewalDate && <p><span className="text-slate-400">Due:</span> {formatDate(parsed.renewalDate)}</p>}
                            {parsed.billingCycle && <p><span className="text-slate-400">Cycle:</span> {BILLING_CYCLE_LABELS[parsed.billingCycle] || parsed.billingCycle}</p>}
                          </div>
                        </td>
                        {/* Confidence */}
                        <td className="px-4 py-3">
                          {parsed.confidence != null && (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              parsed.confidence >= 70
                                ? 'bg-green-100 text-green-700'
                                : parsed.confidence >= 40
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {parsed.confidence}%
                            </span>
                          )}
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {/* Create New — pre-fill Add Renewal modal */}
                            <button
                              title="Create new renewal from this email"
                              onClick={() => {
                                const prefill = {
                                  ...BLANK,
                                  itemName:     parsed.itemName || '',
                                  vendorName:   parsed.vendor || '',
                                  amount:       parsed.amount || '',
                                  currency:     parsed.currency || 'INR',
                                  renewalDate:  parsed.renewalDate || '',
                                  billingCycle: parsed.billingCycle || '',
                                  notes:        `Detected from email: ${s.subject}`,
                                };
                                setSelected(prefill);
                                setOpenModal(true);
                              }}
                              className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                            >
                              + Create New
                            </button>
                            {/* Dismiss */}
                            <button
                              title="Dismiss"
                              onClick={() => handleDismissScan(s.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ MODALS ══════════════ */}

      {openModal && (
        <RenewalModal
          renewal={selectedRenewal}
          categories={categories}
          accounts={accounts}
          onClose={() => { setOpenModal(false); setSelected(null); }}
          onSaved={() => { setOpenModal(false); setSelected(null); refetchAll(); }}
        />
      )}

      {showLogin && (
        <LoginDetailsModal
          renewal={showLogin}
          onClose={() => setShowLogin(null)}
        />
      )}

      {showMarkPaid && (
        <MarkPaidModal
          renewal={showMarkPaid}
          onClose={() => setShowMarkPaid(null)}
          onSaved={() => { setShowMarkPaid(null); refetchAll(); }}
        />
      )}

      {showHistory && (
        <HistoryDrawer
          renewal={showHistory}
          onClose={() => setShowHistory(null)}
        />
      )}
    </div>
  );
}
