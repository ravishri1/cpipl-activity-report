import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate, formatINR } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import DeleteErrorModal from '../shared/DeleteErrorModal';
import EmptyState from '../shared/EmptyState';
import {
  AlertTriangle, CheckCircle, Clock, RefreshCw, Plus, Edit2, Trash2,
  ChevronDown, ChevronUp, ExternalLink, CreditCard, Building2, Calendar,
  DollarSign, Shield, History, X, Search, Banknote, FileText, Settings,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const TL_STYLES = {
  red:    { bg: 'bg-red-50',   border: 'border-l-4 border-red-400',   badge: 'bg-red-100 text-red-800',    dot: 'bg-red-500',   label: 'Critical' },
  yellow: { bg: 'bg-amber-50', border: 'border-l-4 border-amber-400', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', label: 'Due Soon' },
  green:  { bg: 'bg-white',    border: 'border-l-4 border-green-400', badge: 'bg-green-100 text-green-800', dot: 'bg-green-500', label: 'Active'   },
  grey:   { bg: 'bg-gray-50',  border: 'border-l-4 border-gray-300',  badge: 'bg-gray-100 text-gray-600',   dot: 'bg-gray-400',  label: 'Expired'  },
};

const BILLING_CYCLES  = ['monthly', 'quarterly', 'half_yearly', 'yearly', 'one_time'];
const BILLING_LABELS  = { monthly: 'Monthly', quarterly: 'Quarterly', half_yearly: 'Half-Yearly', yearly: 'Yearly', one_time: 'One-Time' };
const ACCOUNT_TYPES   = ['credit_card', 'net_banking', 'upi', 'cash', 'other'];
const ACCOUNT_LABELS  = { credit_card: 'Credit Card', net_banking: 'Net Banking', upi: 'UPI', cash: 'Cash', other: 'Other' };
const RECON_STYLES    = { pending: 'bg-amber-100 text-amber-700', done: 'bg-green-100 text-green-700', na: 'bg-gray-100 text-gray-500' };

// ─── Small helpers ────────────────────────────────────────────────────────────

function TrafficDot({ tl }) {
  const s = TL_STYLES[tl] || TL_STYLES.grey;
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${s.dot} flex-shrink-0`} />;
}

function DaysBadge({ daysLeft, tl }) {
  const s = TL_STYLES[tl] || TL_STYLES.grey;
  if (daysLeft == null) return <span className={`text-xs px-2 py-0.5 rounded-full ${s.badge}`}>—</span>;
  const label = daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'TODAY' : `${daysLeft}d`;
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.badge}`}>{label}</span>;
}

const EMPTY_RENEWAL = {
  categoryId: '', itemName: '', vendorName: '', assignedTo: '',
  loginUrl: '', loginUsername: '', loginPassword: '', accountNumber: '',
  startDate: '', renewalDate: '', billingCycle: 'yearly',
  amount: '', currency: 'INR', paymentMedium: '', paymentAccountId: '',
  referenceNumber: '', alertDaysBefore: 15, alertRecipients: '',
  documentPath: '', notes: '', status: 'active',
};

const EMPTY_ACCOUNT = { accountCode: '', type: 'credit_card', name: '', identifier: '', company: '', currency: 'INR' };
const EMPTY_CATEGORY = { name: '', icon: '', sortOrder: 0 };

// ─── SummaryBar ───────────────────────────────────────────────────────────────

function SummaryBar({ summary }) {
  if (!summary) return null;
  const tiles = [
    { key: 'red',    label: 'Critical',  icon: <AlertTriangle className="w-4 h-4" />, cls: 'text-red-600 bg-red-50 border-red-200' },
    { key: 'yellow', label: 'Due Soon',  icon: <Clock className="w-4 h-4" />,         cls: 'text-amber-600 bg-amber-50 border-amber-200' },
    { key: 'green',  label: 'Active',    icon: <CheckCircle className="w-4 h-4" />,   cls: 'text-green-600 bg-green-50 border-green-200' },
    { key: 'grey',   label: 'Expired',   icon: <RefreshCw className="w-4 h-4" />,     cls: 'text-gray-500 bg-gray-50 border-gray-200' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {tiles.map(t => (
        <div key={t.key} className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${t.cls}`}>
          {t.icon}
          <div>
            <div className="text-xl font-bold leading-none">{summary[t.key] ?? 0}</div>
            <div className="text-xs mt-0.5">{t.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── RenewalCard ──────────────────────────────────────────────────────────────

function RenewalCard({ r, onEdit, onDelete, onMarkPaid, onReconcile }) {
  const [open, setOpen] = useState(false);
  const tl = r.trafficLight || 'grey';
  const s  = TL_STYLES[tl];

  return (
    <div className={`rounded-lg border shadow-sm overflow-hidden ${s.bg} ${s.border}`}>
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-black/5 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <TrafficDot tl={tl} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 truncate">{r.itemName}</span>
            {r.category && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{r.category.name}</span>
            )}
            <DaysBadge daysLeft={r.daysLeft} tl={tl} />
          </div>
          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
            {r.vendorName && <span>{r.vendorName}</span>}
            {r.renewalDate && <span>• Renews {formatDate(r.renewalDate)}</span>}
            {r.amount && <span>• ₹{Number(r.amount).toLocaleString('en-IN')}</span>}
            {r.billingCycle && <span>• {BILLING_LABELS[r.billingCycle]}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full ${RECON_STYLES[r.reconciled] || RECON_STYLES.pending}`}>
            {r.reconciled === 'done' ? '✓ Reconciled' : 'Pending'}
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {/* Expanded details */}
      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm mb-4">
            {[
              ['Start Date',       r.startDate ? formatDate(r.startDate) : '—'],
              ['Renewal Date',     r.renewalDate ? formatDate(r.renewalDate) : '—'],
              ['Billing Cycle',    BILLING_LABELS[r.billingCycle] || r.billingCycle || '—'],
              ['Amount',           r.amount ? `₹${Number(r.amount).toLocaleString('en-IN')} ${r.currency || ''}` : '—'],
              ['Last Paid',        r.lastPaidAmount ? `₹${Number(r.lastPaidAmount).toLocaleString('en-IN')}` : '—'],
              ['Last Renewed',     r.lastRenewedDate ? formatDate(r.lastRenewedDate) : '—'],
              ['Payment Account',  r.paymentAccount ? `${r.paymentAccount.accountCode} – ${r.paymentAccount.name}` : '—'],
              ['Reference No.',    r.referenceNumber || '—'],
              ['Assigned To',      r.assignedTo || '—'],
              ['Alert Before',     r.alertDaysBefore ? `${r.alertDaysBefore} days` : '—'],
              ['Login URL',        r.loginUrl ? <a href={r.loginUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">Open <ExternalLink className="w-3 h-3" /></a> : '—'],
              ['Login Username',   r.loginUsername || '—'],
            ].map(([label, val]) => (
              <div key={label}>
                <span className="text-slate-400 text-xs block">{label}</span>
                <span className="text-slate-700 font-medium">{val}</span>
              </div>
            ))}
          </div>
          {r.notes && (
            <div className="text-xs text-slate-500 bg-slate-50 rounded p-2 mb-3">
              <span className="font-semibold">Notes:</span> {r.notes}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onMarkPaid(r)} className="flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
              <CheckCircle className="w-3.5 h-3.5" /> Mark as Paid
            </button>
            {r.reconciled !== 'done' && (
              <button onClick={() => onReconcile(r)} className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                <Shield className="w-3.5 h-3.5" /> Reconcile
              </button>
            )}
            <button onClick={() => onEdit(r)} className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium transition-colors">
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={() => onDelete(r)} className="flex items-center gap-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-medium transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RenewalModal ─────────────────────────────────────────────────────────────

function RenewalModal({ initial, categories, accounts, onClose, onSaved }) {
  const [tab, setTab]   = useState('basic');
  const [form, setForm] = useState(initial || EMPTY_RENEWAL);
  const { execute, loading, error } = useApi();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const fi = (k) => ({ value: form[k] ?? '', onChange: e => set(k, e.target.value) });

  const handleSave = async () => {
    const payload = { ...form };
    if (payload.categoryId)      payload.categoryId      = parseInt(payload.categoryId);
    if (payload.paymentAccountId) payload.paymentAccountId = parseInt(payload.paymentAccountId);
    if (payload.alertDaysBefore) payload.alertDaysBefore = parseInt(payload.alertDaysBefore);
    if (payload.amount)          payload.amount           = parseFloat(payload.amount);
    delete payload.category; delete payload.paymentAccount;
    delete payload.history; delete payload.daysLeft; delete payload.trafficLight;

    const fn = form.id
      ? () => api.put(`/renewals/${form.id}`, payload)
      : () => api.post('/renewals', payload);
    try {
      await execute(fn, form.id ? 'Updated!' : 'Created!');
      onSaved();
    } catch {
      // Error displayed by useApi
    }
  };

  const TABS = [
    { id: 'basic',   label: 'Basic',    icon: <FileText className="w-4 h-4" /> },
    { id: 'dates',   label: 'Dates',    icon: <Calendar className="w-4 h-4" /> },
    { id: 'login',   label: 'Login',    icon: <Shield className="w-4 h-4" /> },
    { id: 'payment', label: 'Payment',  icon: <CreditCard className="w-4 h-4" /> },
    { id: 'alerts',  label: 'Alerts',   icon: <AlertTriangle className="w-4 h-4" /> },
  ];

  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';
  const lbl = 'block text-xs font-medium text-slate-500 mb-1';
  const row = 'grid grid-cols-2 gap-3';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-slate-800">{form.id ? 'Edit Renewal' : 'Add Renewal'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-slate-50">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${tab === t.id ? 'border-b-2 border-blue-600 text-blue-600 bg-white' : 'text-slate-500 hover:text-slate-700'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <AlertMessage type="error" message={error} />}

          {tab === 'basic' && (
            <>
              <div>
                <label className={lbl}>Item Name *</label>
                <input className={inp} placeholder="e.g. Adobe Creative Cloud" {...fi('itemName')} />
              </div>
              <div className={row}>
                <div>
                  <label className={lbl}>Category</label>
                  <select className={inp} {...fi('categoryId')}>
                    <option value="">— Select —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Status</label>
                  <select className={inp} {...fi('status')}>
                    {['active', 'expired', 'cancelled', 'pending'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className={row}>
                <div>
                  <label className={lbl}>Vendor / Provider</label>
                  <input className={inp} placeholder="e.g. Adobe Inc." {...fi('vendorName')} />
                </div>
                <div>
                  <label className={lbl}>Assigned To</label>
                  <input className={inp} placeholder="e.g. IT Team" {...fi('assignedTo')} />
                </div>
              </div>
              <div>
                <label className={lbl}>Notes</label>
                <textarea className={inp} rows={2} {...fi('notes')} />
              </div>
            </>
          )}

          {tab === 'dates' && (
            <>
              <div className={row}>
                <div>
                  <label className={lbl}>Start Date</label>
                  <input type="date" className={inp} {...fi('startDate')} />
                </div>
                <div>
                  <label className={lbl}>Renewal / Expiry Date</label>
                  <input type="date" className={inp} {...fi('renewalDate')} />
                </div>
              </div>
              <div className={row}>
                <div>
                  <label className={lbl}>Billing Cycle</label>
                  <select className={inp} {...fi('billingCycle')}>
                    {BILLING_CYCLES.map(c => <option key={c} value={c}>{BILLING_LABELS[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Amount (₹)</label>
                  <input type="number" className={inp} placeholder="0.00" {...fi('amount')} />
                </div>
              </div>
            </>
          )}

          {tab === 'login' && (
            <>
              <div>
                <label className={lbl}>Login / Portal URL</label>
                <input className={inp} placeholder="https://..." {...fi('loginUrl')} />
              </div>
              <div className={row}>
                <div>
                  <label className={lbl}>Username / Email</label>
                  <input className={inp} {...fi('loginUsername')} />
                </div>
                <div>
                  <label className={lbl}>Password</label>
                  <input type="password" className={inp} {...fi('loginPassword')} autoComplete="new-password" />
                </div>
              </div>
              <div>
                <label className={lbl}>Account / Licence Number</label>
                <input className={inp} {...fi('accountNumber')} />
              </div>
              <div>
                <label className={lbl}>Document / Invoice Path</label>
                <input className={inp} placeholder="e.g. /invoices/adobe-2025.pdf" {...fi('documentPath')} />
              </div>
            </>
          )}

          {tab === 'payment' && (
            <>
              <div className={row}>
                <div>
                  <label className={lbl}>Payment Account</label>
                  <select className={inp} {...fi('paymentAccountId')}>
                    <option value="">— Select —</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.accountCode} – {a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Payment Medium</label>
                  <input className={inp} placeholder="e.g. Auto-debit" {...fi('paymentMedium')} />
                </div>
              </div>
              <div>
                <label className={lbl}>Reference Number</label>
                <input className={inp} {...fi('referenceNumber')} />
              </div>
            </>
          )}

          {tab === 'alerts' && (
            <>
              <div>
                <label className={lbl}>Alert Days Before Renewal</label>
                <input type="number" min={1} max={90} className={inp} {...fi('alertDaysBefore')} />
                <p className="text-xs text-slate-400 mt-1">Send email alert this many days before the renewal date.</p>
              </div>
              <div>
                <label className={lbl}>Alert Recipients (comma-separated)</label>
                <input className={inp} placeholder="e.g. CEO,Accounts,IT" {...fi('alertRecipients')} />
                <p className="text-xs text-slate-400 mt-1">Leave blank to alert all admins by default.</p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={loading}
            className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors">
            {loading ? 'Saving…' : (form.id ? 'Update' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AccountModal ─────────────────────────────────────────────────────────────

function AccountModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial || EMPTY_ACCOUNT);
  const { execute, loading, error } = useApi();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const fi = (k) => ({ value: form[k] ?? '', onChange: e => set(k, e.target.value) });
  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';
  const lbl = 'block text-xs font-medium text-slate-500 mb-1';

  const handleSave = async () => {
    const fn = form.id
      ? () => api.put(`/renewals/accounts/${form.id}`, form)
      : () => api.post('/renewals/accounts', form);
    try {
      await execute(fn, form.id ? 'Updated!' : 'Created!');
      onSaved();
    } catch {
      // Error displayed by useApi
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{form.id ? 'Edit Account' : 'Add Payment Account'}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <AlertMessage type="error" message={error} />}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Account Code *</label>
              <input className={inp} placeholder="e.g. CC-01" {...fi('accountCode')} />
            </div>
            <div>
              <label className={lbl}>Type *</label>
              <select className={inp} {...fi('type')}>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{ACCOUNT_LABELS[t]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Display Name *</label>
            <input className={inp} placeholder="e.g. HDFC Corporate Card" {...fi('name')} />
          </div>
          <div>
            <label className={lbl}>Identifier (last 4 digits / account no.)</label>
            <input className={inp} placeholder="e.g. 4242" {...fi('identifier')} />
          </div>
          <div>
            <label className={lbl}>Company / Bank</label>
            <input className={inp} placeholder="e.g. HDFC Bank" {...fi('company')} />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={loading}
            className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50">
            {loading ? 'Saving…' : (form.id ? 'Update' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CategoryModal ────────────────────────────────────────────────────────────

function CategoryModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial || EMPTY_CATEGORY);
  const { execute, loading, error } = useApi();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const fi = (k) => ({ value: form[k] ?? '', onChange: e => set(k, e.target.value) });
  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';
  const lbl = 'block text-xs font-medium text-slate-500 mb-1';

  const handleSave = async () => {
    const payload = { ...form, sortOrder: parseInt(form.sortOrder) || 0 };
    const fn = form.id
      ? () => api.put(`/renewals/categories/${form.id}`, payload)
      : () => api.post('/renewals/categories', payload);
    try {
      await execute(fn, form.id ? 'Updated!' : 'Created!');
      onSaved();
    } catch {
      // Error displayed by useApi
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{form.id ? 'Edit Category' : 'Add Category'}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <AlertMessage type="error" message={error} />}
          <div>
            <label className={lbl}>Name *</label>
            <input className={inp} placeholder="e.g. SaaS / Software" {...fi('name')} />
          </div>
          <div>
            <label className={lbl}>Icon (emoji)</label>
            <input className={inp} placeholder="e.g. 💻" {...fi('icon')} />
          </div>
          <div>
            <label className={lbl}>Sort Order</label>
            <input type="number" className={inp} {...fi('sortOrder')} />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={loading}
            className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50">
            {loading ? 'Saving…' : (form.id ? 'Update' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MarkPaidModal ────────────────────────────────────────────────────────────

function MarkPaidModal({ renewal, onClose, onSaved }) {
  const [amount, setAmount] = useState(renewal.amount || '');
  const { execute, loading, error } = useApi();

  const handleConfirm = async () => {
    try {
      await execute(
        () => api.post(`/renewals/${renewal.id}/mark-paid`, { amount: parseFloat(amount) || renewal.amount }),
        'Marked as paid! Next renewal date updated.'
      );
      onSaved();
    } catch {
      // Error displayed by useApi
    }
  };

  const billingLabel = BILLING_LABELS[renewal.billingCycle] || renewal.billingCycle;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Mark as Paid</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <AlertMessage type="error" message={error} />}
          <div className="bg-blue-50 rounded-lg p-3 text-sm">
            <p className="font-semibold text-blue-800">{renewal.itemName}</p>
            <p className="text-blue-600 mt-1">Billing: {billingLabel} — next date will auto-advance.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Amount Paid (₹)</label>
            <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter actual amount paid" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleConfirm} disabled={loading}
            className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50">
            {loading ? 'Saving…' : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function CompanyContractsManager() {
  const [activeSection, setActiveSection] = useState('renewals'); // 'renewals' | 'accounts' | 'categories'
  const [activeCatId,   setActiveCatId]   = useState(null);       // null = All
  const [tlFilter,      setTlFilter]      = useState('');
  const [search,        setSearch]        = useState('');
  const [modal,         setModal]         = useState(null);        // { type, data? }

  const { data: categories, refetch: refetchCats } = useFetch('/renewals/categories', []);
  const { data: accounts,   refetch: refetchAccts } = useFetch('/renewals/accounts', []);
  const { data: summary,    refetch: refetchSummary } = useFetch('/renewals/summary', null);

  const queryParts = [];
  if (activeCatId)  queryParts.push(`categoryId=${activeCatId}`);
  if (tlFilter)     queryParts.push(`trafficLight=${tlFilter}`);
  if (search)       queryParts.push(`search=${encodeURIComponent(search)}`);
  const queryStr = queryParts.length ? `?${queryParts.join('&')}` : '';

  const { data: renewals, loading, error, refetch: refetchRenewals } = useFetch(`/renewals${queryStr}`, []);

  const { execute, deleteError, setDeleteError } = useApi();

  const refetchAll = () => { refetchRenewals(); refetchSummary(); };

  const closeModal = () => setModal(null);
  const afterSave  = () => { closeModal(); refetchAll(); refetchCats(); refetchAccts(); };

  const handleDelete = async (r) => {
    if (!window.confirm(`Delete "${r.itemName}"? This cannot be undone.`)) return;
    try {
      await execute(() => api.delete(`/renewals/${r.id}`), 'Deleted');
      refetchAll();
    } catch {
      // Error displayed by useApi
    }
  };

  const handleDeleteAccount = async (a) => {
    if (!window.confirm(`Delete account "${a.name}"?`)) return;
    try {
      await execute(() => api.delete(`/renewals/accounts/${a.id}`), 'Deleted');
      refetchAccts();
    } catch {
      // Error displayed by useApi
    }
  };

  const handleDeleteCat = async (c) => {
    if (!window.confirm(`Delete category "${c.name}"?`)) return;
    try {
      await execute(() => api.delete(`/renewals/categories/${c.id}`), 'Deleted');
      refetchCats(); refetchSummary();
    } catch {
      // Error displayed by useApi
    }
  };

  const handleReconcile = async (r) => {
    if (!window.confirm(`Mark "${r.itemName}" as reconciled?`)) return;
    try {
      await execute(() => api.post(`/renewals/${r.id}/reconcile`), 'Reconciled!');
      refetchAll();
    } catch {
      // Error displayed by useApi
    }
  };

  // ── Sidebar category tabs ──
  const catTabs = [{ id: null, name: 'All', icon: '📋', count: summary?.total ?? 0 }, ...categories.map(c => ({
    id: c.id, name: c.name, icon: c.icon || '📁', count: c._count?.renewals ?? 0,
  }))];

  return (
    <div className="flex flex-col h-full">
      {deleteError && <DeleteErrorModal data={deleteError} onClose={() => setDeleteError(null)} />}
      {/* Sticky page header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Renewals &amp; Expense Control</h1>
          <p className="text-xs text-slate-400 mt-0.5">Track subscriptions, licences, insurance &amp; compliance renewals</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setActiveSection('categories')}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${activeSection === 'categories' ? 'bg-slate-800 text-white border-slate-800' : 'text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            <Settings className="w-4 h-4" /> Categories
          </button>
          <button onClick={() => setActiveSection('accounts')}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${activeSection === 'accounts' ? 'bg-slate-800 text-white border-slate-800' : 'text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            <CreditCard className="w-4 h-4" /> Accounts
          </button>
          <button onClick={() => setActiveSection('renewals')}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${activeSection === 'renewals' ? 'bg-blue-600 text-white border-blue-600' : 'text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            <RefreshCw className="w-4 h-4" /> Renewals
          </button>
          {activeSection === 'renewals' && (
            <button onClick={() => setModal({ type: 'renewal' })}
              className="flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
              <Plus className="w-4 h-4" /> Add Renewal
            </button>
          )}
          {activeSection === 'accounts' && (
            <button onClick={() => setModal({ type: 'account' })}
              className="flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
              <Plus className="w-4 h-4" /> Add Account
            </button>
          )}
          {activeSection === 'categories' && (
            <button onClick={() => setModal({ type: 'category' })}
              className="flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
              <Plus className="w-4 h-4" /> Add Category
            </button>
          )}
        </div>
      </div>

      {/* ── RENEWALS section ── */}
      {activeSection === 'renewals' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 flex-shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto">
            <div className="p-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 px-2">Categories</p>
              {catTabs.map(c => (
                <button key={c.id ?? 'all'} onClick={() => setActiveCatId(c.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors mb-0.5 ${activeCatId === c.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}>
                  <span>{c.icon}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className={`text-xs rounded-full px-1.5 ${activeCatId === c.id ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{c.count}</span>
                </button>
              ))}
            </div>
            {/* Traffic-light filter */}
            <div className="p-3 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 px-2">Status</p>
              {[
                { key: '',       label: 'All',      dot: 'bg-slate-400' },
                { key: 'red',    label: 'Critical',  dot: 'bg-red-500' },
                { key: 'yellow', label: 'Due Soon',  dot: 'bg-amber-500' },
                { key: 'green',  label: 'Active',    dot: 'bg-green-500' },
                { key: 'grey',   label: 'Expired',   dot: 'bg-gray-400' },
              ].map(f => (
                <button key={f.key} onClick={() => setTlFilter(f.key)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-left mb-0.5 transition-colors ${tlFilter === f.key ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-200'}`}>
                  <span className={`w-2 h-2 rounded-full ${f.dot} flex-shrink-0`} />
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Summary */}
            <SummaryBar summary={summary} />

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Search renewals…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {loading && <LoadingSpinner />}
            {error && <AlertMessage type="error" message={typeof error === 'string' ? error : (error?.message || 'An error occurred')} />}
            {!loading && renewals.length === 0 && (
              <EmptyState icon={RefreshCw} title="No renewals found" subtitle="Add your first renewal to get started" />
            )}

            <div className="space-y-2">
              {renewals.map(r => (
                <RenewalCard key={r.id} r={r}
                  onEdit={r => setModal({ type: 'renewal', data: r })}
                  onDelete={handleDelete}
                  onMarkPaid={r => setModal({ type: 'markpaid', data: r })}
                  onReconcile={handleReconcile}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ACCOUNTS section ── */}
      {activeSection === 'accounts' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-base font-semibold text-slate-700 mb-4">Payment Accounts</h2>
            {accounts.length === 0 && (
              <EmptyState icon={CreditCard} title="No accounts yet" subtitle="Add credit cards, net banking or cash accounts to link renewals to." />
            )}
            <div className="grid gap-3">
              {accounts.map(a => (
                <div key={a.id} className="bg-white rounded-lg border border-slate-200 px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">{a.accountCode} — {a.name}</div>
                      <div className="text-xs text-slate-500">
                        {ACCOUNT_LABELS[a.type] || a.type}
                        {a.identifier ? ` · ···${a.identifier}` : ''}
                        {a.company ? ` · ${a.company}` : ''}
                        {' · '}{a._count?.renewals ?? 0} renewals
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setModal({ type: 'account', data: a })}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteAccount(a)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CATEGORIES section ── */}
      {activeSection === 'categories' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-base font-semibold text-slate-700 mb-4">Renewal Categories</h2>
            {categories.length === 0 && (
              <EmptyState icon={FileText} title="No categories yet" subtitle="Add categories to organise your renewals." />
            )}
            <div className="grid gap-2">
              {categories.map(c => (
                <div key={c.id} className="bg-white rounded-lg border border-slate-200 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{c.icon || '📁'}</span>
                    <div>
                      <div className="font-semibold text-slate-800">{c.name}</div>
                      <div className="text-xs text-slate-400">{c._count?.renewals ?? 0} renewal(s) · Order {c.sortOrder}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setModal({ type: 'category', data: c })}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteCat(c)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {modal?.type === 'renewal' && (
        <RenewalModal initial={modal.data} categories={categories} accounts={accounts}
          onClose={closeModal} onSaved={afterSave} />
      )}
      {modal?.type === 'account' && (
        <AccountModal initial={modal.data} onClose={closeModal} onSaved={() => { closeModal(); refetchAccts(); }} />
      )}
      {modal?.type === 'category' && (
        <CategoryModal initial={modal.data} onClose={closeModal} onSaved={() => { closeModal(); refetchCats(); refetchSummary(); }} />
      )}
      {modal?.type === 'markpaid' && (
        <MarkPaidModal renewal={modal.data} onClose={closeModal} onSaved={afterSave} />
      )}
    </div>
  );
}
