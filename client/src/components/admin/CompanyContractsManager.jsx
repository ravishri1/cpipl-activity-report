import { useState } from 'react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate, formatINR } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import {
  Plus, Search, Edit2, Trash2, X, ChevronDown, ChevronUp,
  AlertTriangle, AlertCircle, Monitor, Wrench, ShieldCheck,
  Landmark, Package, ExternalLink, CalendarClock, IndianRupee,
  Building2, User, FileText, CreditCard,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'software',    label: 'Software',    icon: Monitor,      color: 'blue'   },
  { key: 'service',     label: 'Services',    icon: Wrench,       color: 'purple' },
  { key: 'compliance',  label: 'Compliance',  icon: ShieldCheck,  color: 'green'  },
  { key: 'ip',          label: 'IP Assets',   icon: Landmark,     color: 'amber'  },
  { key: 'misc',        label: 'Misc',        icon: Package,      color: 'slate'  },
];

const SUBCATEGORY_OPTIONS = {
  software:   ['tally', 'windows_license', 'aws', 'github', 'gsuite', 'zoho', 'adobe', 'antivirus', 'other'],
  service:    ['pest_control', 'water_filter', 'ac_maintenance', 'cctv', 'internet', 'electricity', 'other'],
  compliance: ['fssai', 'fire_safety', 'gst_filing', 'shop_act', 'labour_license', 'other'],
  ip:         ['trademark', 'patent', 'copyright', 'domain', 'other'],
  misc:       ['harwala', 'fish_tank', 'activa', 'other'],
};

const STATUS_STYLES = {
  active:    'bg-green-50 text-green-700 border-green-200',
  expired:   'bg-red-50 text-red-700 border-red-200',
  pending:   'bg-amber-50 text-amber-700 border-amber-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  renewed:   'bg-blue-50 text-blue-700 border-blue-200',
};

const PAYMENT_MODES = ['cash', 'upi', 'bank_transfer', 'cheque', 'neft', 'rtgs', 'other'];

const EMPTY_FORM = {
  category: 'software', subCategory: '', name: '', description: '', status: 'active',
  companyId: '',
  vendorName: '', vendorContact: '', vendorPAN: '', vendorGST: '',
  vendorBankName: '', vendorBankAccount: '', vendorIfsc: '',
  amount: '', paymentMode: '', paymentDate: '', paymentUTR: '',
  invoiceNumber: '', invoiceDate: '', invoiceFileUrl: '',
  startDate: '', expiryDate: '', renewalDate: '', lastServiceDate: '',
  licenseKey: '', seats: '',
  registrationNumber: '', ipClass: '', ipJurisdiction: '',
  notes: '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function alertBadge(contract) {
  if (contract.expiryAlert === 'expired') {
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5"><AlertCircle className="w-3 h-3" /> Expired</span>;
  }
  if (contract.expiryAlert === 'warning') {
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5"><AlertTriangle className="w-3 h-3" /> {contract.daysToExpiry}d left</span>;
  }
  return null;
}

function catMeta(key) {
  return CATEGORIES.find(c => c.key === key) || CATEGORIES[CATEGORIES.length - 1];
}

// ── Sub-component: Contract Card ──────────────────────────────────────────────

function ContractCard({ contract, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const meta = catMeta(contract.category);
  const Icon = meta.icon;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
      {/* Header row */}
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className={`p-2 rounded-lg bg-${meta.color}-50 border border-${meta.color}-100 flex-shrink-0`}>
          <Icon className={`w-4 h-4 text-${meta.color}-600`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-800 truncate">{contract.name}</p>
            {alertBadge(contract)}
            <span className={`text-xs px-2 py-0.5 rounded border capitalize ${STATUS_STYLES[contract.status] || STATUS_STYLES.active}`}>{contract.status}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {contract.vendorName && <span className="text-xs text-slate-500 flex items-center gap-1"><Building2 className="w-3 h-3" />{contract.vendorName}</span>}
            {contract.expiryDate && <span className="text-xs text-slate-500 flex items-center gap-1"><CalendarClock className="w-3 h-3" />Expires {formatDate(contract.expiryDate)}</span>}
            {contract.amount && <span className="text-xs text-slate-500 flex items-center gap-1"><IndianRupee className="w-3 h-3" />{formatINR(contract.amount)}</span>}
            {contract.company && <span className="text-xs text-slate-400">{contract.company.shortName || contract.company.name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); onEdit(contract); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
          <button onClick={e => { e.stopPropagation(); onDelete(contract); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-xs">
          {contract.subCategory    && <Detail label="Sub-type"    value={contract.subCategory.replace(/_/g, ' ')} />}
          {contract.description    && <Detail label="Description" value={contract.description} span />}
          {contract.startDate      && <Detail label="Start Date"  value={formatDate(contract.startDate)} />}
          {contract.renewalDate    && <Detail label="Renewal Due" value={formatDate(contract.renewalDate)} />}
          {contract.lastServiceDate && <Detail label="Last Service" value={formatDate(contract.lastServiceDate)} />}
          {contract.invoiceNumber  && <Detail label="Invoice No." value={contract.invoiceNumber} />}
          {contract.invoiceDate    && <Detail label="Invoice Date" value={formatDate(contract.invoiceDate)} />}
          {contract.paymentMode    && <Detail label="Payment Mode" value={contract.paymentMode.replace(/_/g, ' ')} />}
          {contract.paymentDate    && <Detail label="Payment Date" value={formatDate(contract.paymentDate)} />}
          {contract.paymentUTR     && <Detail label="UTR / Ref"   value={contract.paymentUTR} />}
          {contract.invoiceFileUrl && (
            <div className="col-span-full">
              <a href={contract.invoiceFileUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                <FileText className="w-3 h-3" /> View Invoice <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          {/* Vendor bank */}
          {(contract.vendorBankName || contract.vendorBankAccount) && (
            <div className="col-span-full border-t border-slate-100 pt-2 mt-1">
              <p className="text-[10px] uppercase text-slate-400 font-medium mb-1">Vendor Bank</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
                {contract.vendorBankName    && <Detail label="Bank"    value={contract.vendorBankName} />}
                {contract.vendorBankAccount && <Detail label="Account" value={contract.vendorBankAccount} />}
                {contract.vendorIfsc        && <Detail label="IFSC"    value={contract.vendorIfsc} />}
                {contract.vendorPAN         && <Detail label="PAN"     value={contract.vendorPAN} />}
                {contract.vendorGST         && <Detail label="GST"     value={contract.vendorGST} />}
                {contract.vendorContact     && <Detail label="Contact" value={contract.vendorContact} />}
              </div>
            </div>
          )}
          {/* Software-specific */}
          {contract.category === 'software' && (contract.licenseKey || contract.seats) && (
            <div className="col-span-full border-t border-slate-100 pt-2 mt-1">
              {contract.licenseKey && <Detail label="License Key" value={contract.licenseKey} />}
              {contract.seats      && <Detail label="Seats"       value={String(contract.seats)} />}
            </div>
          )}
          {/* IP-specific */}
          {contract.category === 'ip' && (
            <div className="col-span-full border-t border-slate-100 pt-2 mt-1 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
              {contract.registrationNumber && <Detail label="Reg. No."      value={contract.registrationNumber} />}
              {contract.ipClass            && <Detail label="Class"         value={contract.ipClass} />}
              {contract.ipJurisdiction     && <Detail label="Jurisdiction"  value={contract.ipJurisdiction} />}
            </div>
          )}
          {contract.notes && <Detail label="Notes" value={contract.notes} span />}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, span }) {
  return (
    <div className={span ? 'col-span-full' : ''}>
      <p className="text-[10px] uppercase text-slate-400 font-medium">{label}</p>
      <p className="text-slate-700 mt-0.5 capitalize-first">{value}</p>
    </div>
  );
}

// ── Sub-component: Create / Edit Modal ────────────────────────────────────────

function ContractModal({ contract, companies, onClose, onSaved }) {
  const isEdit = !!contract?.id;
  const [form, setForm] = useState(isEdit ? {
    ...EMPTY_FORM, ...contract,
    companyId:  String(contract.companyId || ''),
    amount:     contract.amount != null ? String(contract.amount) : '',
    seats:      contract.seats  != null ? String(contract.seats)  : '',
  } : { ...EMPTY_FORM });
  const [section, setSection] = useState('basic'); // basic | vendor | finance | dates | extra
  const { execute, loading, error } = useApi();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form };
    if (!payload.name.trim()) return;
    await execute(
      () => isEdit
        ? api.put(`/api/company-contracts/${contract.id}`, payload)
        : api.post('/api/company-contracts', payload),
      isEdit ? 'Contract updated' : 'Contract created',
    );
    onSaved();
    onClose();
  }

  const subcats = SUBCATEGORY_OPTIONS[form.category] || [];

  const Tab = ({ id, label }) => (
    <button type="button" onClick={() => setSection(id)}
      className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${section === id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">{isEdit ? 'Edit Contract' : 'New Contract'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-4">
            {error && <AlertMessage type="error" message={error} />}

            {/* Tab nav */}
            <div className="flex gap-1 flex-wrap bg-slate-50 rounded-lg p-1">
              <Tab id="basic"   label="Basic Info" />
              <Tab id="dates"   label="Dates" />
              <Tab id="vendor"  label="Vendor" />
              <Tab id="finance" label="Finance" />
              <Tab id="extra"   label="Extra" />
            </div>

            {/* ── Basic Info ── */}
            {section === 'basic' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Category *</label>
                    <select value={form.category} onChange={e => set('category', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                      {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Sub-type</label>
                    <select value={form.subCategory} onChange={e => set('subCategory', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">— select —</option>
                      {subcats.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)} required
                    placeholder="e.g. Tally Prime, FSSAI License 2026"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                    <select value={form.status} onChange={e => set('status', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                      {['active','pending','expired','cancelled','renewed'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Company</label>
                    <select value={form.companyId} onChange={e => set('companyId', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">All / General</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                  <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
              </div>
            )}

            {/* ── Dates ── */}
            {section === 'dates' && (
              <div className="grid grid-cols-2 gap-3">
                <MField label="Start Date"    value={form.startDate}       onChange={v => set('startDate', v)}       type="date" />
                <MField label="Expiry Date"   value={form.expiryDate}      onChange={v => set('expiryDate', v)}      type="date" />
                <MField label="Renewal Due"   value={form.renewalDate}     onChange={v => set('renewalDate', v)}     type="date" />
                <MField label="Last Service"  value={form.lastServiceDate} onChange={v => set('lastServiceDate', v)} type="date" />
              </div>
            )}

            {/* ── Vendor ── */}
            {section === 'vendor' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <MField label="Vendor Name"    value={form.vendorName}    onChange={v => set('vendorName', v)}    placeholder="ABC Pvt Ltd" />
                  <MField label="Contact"        value={form.vendorContact} onChange={v => set('vendorContact', v)} placeholder="phone / email" />
                  <MField label="Vendor PAN"     value={form.vendorPAN}     onChange={v => set('vendorPAN', v)} />
                  <MField label="Vendor GST"     value={form.vendorGST}     onChange={v => set('vendorGST', v)} />
                </div>
                <p className="text-xs font-medium text-slate-500 border-t border-slate-100 pt-2">Bank Details (for payment)</p>
                <div className="grid grid-cols-2 gap-3">
                  <MField label="Bank Name"      value={form.vendorBankName}    onChange={v => set('vendorBankName', v)} />
                  <MField label="Account No."    value={form.vendorBankAccount} onChange={v => set('vendorBankAccount', v)} />
                  <MField label="IFSC Code"      value={form.vendorIfsc}        onChange={v => set('vendorIfsc', v)} />
                </div>
              </div>
            )}

            {/* ── Finance ── */}
            {section === 'finance' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <MField label="Amount (₹)"      value={form.amount}        onChange={v => set('amount', v)}        type="number" placeholder="0" />
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Payment Mode</label>
                    <select value={form.paymentMode} onChange={e => set('paymentMode', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">— select —</option>
                      {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                  <MField label="Payment Date"    value={form.paymentDate}   onChange={v => set('paymentDate', v)}   type="date" />
                  <MField label="UTR / Cheque No" value={form.paymentUTR}    onChange={v => set('paymentUTR', v)}    placeholder="UTR123456..." />
                  <MField label="Invoice No."     value={form.invoiceNumber} onChange={v => set('invoiceNumber', v)} />
                  <MField label="Invoice Date"    value={form.invoiceDate}   onChange={v => set('invoiceDate', v)}   type="date" />
                </div>
                <MField label="Invoice File URL (Google Drive)" value={form.invoiceFileUrl} onChange={v => set('invoiceFileUrl', v)} placeholder="https://drive.google.com/..." />
              </div>
            )}

            {/* ── Extra (software / IP) ── */}
            {section === 'extra' && (
              <div className="space-y-3">
                {form.category === 'software' && (
                  <>
                    <MField label="License Key" value={form.licenseKey} onChange={v => set('licenseKey', v)} />
                    <MField label="Seats / Users" value={form.seats} onChange={v => set('seats', v)} type="number" placeholder="e.g. 5" />
                  </>
                )}
                {form.category === 'ip' && (
                  <>
                    <MField label="Registration / Application No." value={form.registrationNumber} onChange={v => set('registrationNumber', v)} />
                    <div className="grid grid-cols-2 gap-3">
                      <MField label="Class (e.g. Class 16)" value={form.ipClass}        onChange={v => set('ipClass', v)} />
                      <MField label="Jurisdiction"           value={form.ipJurisdiction} onChange={v => set('ipJurisdiction', v)} placeholder="India" />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? 'Saving…' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Mini field helper for modal */
function MField({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CompanyContractsManager() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: contracts, loading, error, refetch } = useFetch('/api/company-contracts', []);
  const { data: summary, refetch: refetchSummary }   = useFetch('/api/company-contracts/summary', {});
  const { data: companies } = useFetch('/api/companies', []);
  const { execute: execDelete, loading: deleting }   = useApi();

  if (loading) return <LoadingSpinner />;
  if (error)   return <AlertMessage type="error" message={error} />;

  // Filter
  const visible = contracts.filter(c => {
    const catOk = activeCategory === 'all' || c.category === activeCategory;
    const q = search.toLowerCase();
    const searchOk = !q || c.name.toLowerCase().includes(q) || (c.vendorName || '').toLowerCase().includes(q) || (c.subCategory || '').toLowerCase().includes(q);
    return catOk && searchOk;
  });

  function openCreate() { setEditingContract(null); setShowModal(true); }
  function openEdit(c)  { setEditingContract(c);    setShowModal(true); }
  async function confirmDelete() {
    await execDelete(() => api.delete(`/api/company-contracts/${deleteTarget.id}`), 'Deleted');
    setDeleteTarget(null);
    refetch();
    refetchSummary();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Page Header ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Company Contracts</h1>
            <p className="text-xs text-slate-500 mt-0.5">Software licenses · Services · Compliance · IP · Misc</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Contract
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* ── Expiry Alert Summary Cards ── */}
        {(summary.expired > 0 || summary.expiring7 > 0 || summary.expiring30 > 0) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Total"         value={summary.total}      color="slate"  />
            <SummaryCard label="Expired"       value={summary.expired}    color="red"    icon={<AlertCircle className="w-4 h-4" />} />
            <SummaryCard label="Due in 7 days" value={summary.expiring7}  color="amber"  icon={<AlertTriangle className="w-4 h-4" />} />
            <SummaryCard label="Due in 30 days" value={summary.expiring30} color="yellow" icon={<CalendarClock className="w-4 h-4" />} />
          </div>
        )}

        {/* ── Category Tabs ── */}
        <div className="flex gap-2 flex-wrap">
          <CategoryTab active={activeCategory === 'all'} onClick={() => setActiveCategory('all')} label="All" count={contracts.length} color="slate" />
          {CATEGORIES.map(c => (
            <CategoryTab key={c.key} active={activeCategory === c.key} onClick={() => setActiveCategory(c.key)}
              label={c.label} count={summary.byCategory?.[c.key] || 0} color={c.color} />
          ))}
        </div>

        {/* ── Search ── */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, vendor…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* ── Contract List ── */}
        {visible.length === 0 ? (
          <EmptyState icon="📋" title="No contracts" subtitle={search ? 'No matches found' : 'Add your first contract with the button above'} />
        ) : (
          <div className="space-y-3">
            {visible.map(c => (
              <ContractCard key={c.id} contract={c} onEdit={openEdit} onDelete={setDeleteTarget} />
            ))}
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <ContractModal
          contract={editingContract}
          companies={companies}
          onClose={() => setShowModal(false)}
          onSaved={() => { refetch(); refetchSummary(); }}
        />
      )}

      {/* ── Delete Confirm ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-semibold text-slate-800 mb-2">Delete Contract?</h3>
            <p className="text-sm text-slate-600 mb-5">"{deleteTarget.name}" will be permanently removed.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">Cancel</button>
              <button onClick={confirmDelete} disabled={deleting} className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, icon }) {
  const colors = {
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
    red:   'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    yellow:'bg-yellow-50 border-yellow-200 text-yellow-700',
  };
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${colors[color] || colors.slate}`}>
      {icon && <span className="opacity-70">{icon}</span>}
      <div>
        <p className="text-xl font-bold">{value ?? 0}</p>
        <p className="text-xs opacity-70">{label}</p>
      </div>
    </div>
  );
}

function CategoryTab({ active, onClick, label, count, color }) {
  const colors = {
    slate:  active ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 border-slate-200',
    blue:   active ? 'bg-blue-600 text-white'  : 'bg-white text-slate-600 border-slate-200',
    purple: active ? 'bg-purple-600 text-white': 'bg-white text-slate-600 border-slate-200',
    green:  active ? 'bg-green-600 text-white' : 'bg-white text-slate-600 border-slate-200',
    amber:  active ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 border-slate-200',
  };
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${colors[color] || colors.slate}`}>
      {label}
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
    </button>
  );
}
