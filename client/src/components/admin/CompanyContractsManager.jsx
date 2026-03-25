import { useState, useRef } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import { CONTRACT_SIGNING_STATUS_STYLES, CONTRACT_SIGNING_LABELS } from '../../utils/constants';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import StatusBadge from '../shared/StatusBadge';
import {
  Plus, Upload, Send, CheckCircle2, XCircle, RotateCcw,
  Download, Clock, ChevronDown, ChevronRight, Trash2, Edit3, FileSignature,
  LayoutTemplate, ScrollText, X,
} from 'lucide-react';

const TABS = [
  { key: 'contracts', label: 'Contracts', icon: ScrollText },
  { key: 'templates', label: 'Templates', icon: LayoutTemplate },
];

const CATEGORIES = ['software', 'service', 'compliance', 'ip', 'misc'];
const TEMPLATE_TYPES = ['nda', 'service_agreement', 'vendor_contract', 'custom'];
const STATUSES = ['active', 'expired', 'pending', 'cancelled', 'renewed'];

export default function CompanyContractsManager() {
  const [tab, setTab] = useState('contracts');
  const { data: contracts, loading, error: fetchErr, refetch } = useFetch('/api/company-contracts', []);
  const { data: summary, error: summaryErr, refetch: refetchSummary } = useFetch('/api/company-contracts/summary', {});
  const { data: templates, loading: templatesLoading, error: templatesErr, refetch: refetchTemplates } = useFetch('/api/company-contracts/templates', []);
  const { execute, loading: saving, error: saveErr, success, clearMessages } = useApi();

  const [showContractForm, setShowContractForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [showSigningModal, setShowSigningModal] = useState(false);
  const [showCounterSignModal, setShowCounterSignModal] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSigning, setFilterSigning] = useState('');

  const reload = () => { refetch(); refetchSummary(); };

  const filtered = contracts.filter(c => {
    if (filterCategory && c.category !== filterCategory) return false;
    if (filterSigning && (c.signingStatus || 'none') !== filterSigning) return false;
    return true;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Company Contracts</h1>
            <p className="text-sm text-slate-500">Manage contracts, NDAs, and signing workflows</p>
          </div>
        </div>
      </div>

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {summaryErr && <AlertMessage type="error" message={summaryErr} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}
      {success && <AlertMessage type="success" message={success} />}

      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'contracts' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Total', value: summary.total || 0, color: 'text-slate-700' },
              { label: 'Expired', value: summary.expired || 0, color: 'text-red-600' },
              { label: 'Expiring (7d)', value: summary.expiring7 || 0, color: 'text-orange-600' },
              { label: 'Expiring (30d)', value: summary.expiring30 || 0, color: 'text-amber-600' },
              { label: 'Fully Signed', value: summary.bySigningStatus?.fully_signed || 0, color: 'text-green-600' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2">
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <select value={filterSigning} onChange={e => setFilterSigning(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2">
              <option value="">All Signing Status</option>
              {Object.entries(CONTRACT_SIGNING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div className="flex-1" />
            <button onClick={() => { setEditingContract(null); clearMessages(); setShowContractForm(true); }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus className="w-4 h-4" /> New Contract
            </button>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="📄" title="No contracts" subtitle="Create your first contract to get started" />
          ) : (
            <div className="space-y-3">
              {filtered.map(contract => (
                <ContractCard key={contract.id} contract={contract} expanded={expandedId === contract.id}
                  onToggle={() => setExpandedId(expandedId === contract.id ? null : contract.id)}
                  onEdit={() => { setEditingContract(contract); clearMessages(); setShowContractForm(true); }}
                  onDelete={async () => {
                    if (!window.confirm('Delete this contract?')) return;
                    try { await execute(() => api.delete(`/api/company-contracts/${contract.id}`), 'Contract deleted'); reload(); } catch {}
                  }}
                  onSendForSigning={() => { setSelectedContract(contract); clearMessages(); setShowSigningModal(true); }}
                  onResend={async () => {
                    try { await execute(() => api.post(`/api/company-contracts/${contract.id}/resend`), 'Signing link resent'); reload(); } catch {}
                  }}
                  onCancelSigning={async () => {
                    if (!window.confirm('Cancel signing for this contract?')) return;
                    try { await execute(() => api.put(`/api/company-contracts/${contract.id}/cancel-signing`, {}), 'Signing cancelled'); reload(); } catch {}
                  }}
                  onCounterSign={() => { setSelectedContract(contract); clearMessages(); setShowCounterSignModal(true); }}
                  onUploadContract={async (file) => {
                    const fd = new FormData(); fd.append('file', file);
                    try { await execute(() => api.post(`/api/company-contracts/${contract.id}/upload-contract`, fd), 'Contract PDF uploaded'); reload(); } catch {}
                  }}
                  onUploadSigned={async (file) => {
                    const fd = new FormData(); fd.append('file', file);
                    try { await execute(() => api.post(`/api/company-contracts/${contract.id}/upload-signed`, fd), 'Signed copy uploaded'); reload(); } catch {}
                  }}
                  saving={saving}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'templates' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">{templates.length} template(s)</p>
            <button onClick={() => { setEditingTemplate(null); clearMessages(); setShowTemplateForm(true); }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus className="w-4 h-4" /> New Template
            </button>
          </div>
          {templatesErr && <AlertMessage type="error" message={templatesErr} />}
          {templatesLoading ? <LoadingSpinner /> : templates.length === 0 ? (
            <EmptyState icon="📋" title="No templates" subtitle="Create a contract template to get started" />
          ) : (
            <div className="grid gap-3">
              {templates.map(t => (
                <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{t.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Type: {t.type.replace(/_/g, ' ')} &middot; Created {formatDate(t.createdAt)}
                      {t.creator && ` by ${t.creator.name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditingTemplate(t); clearMessages(); setShowTemplateForm(true); }}
                      className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={async () => {
                      if (!window.confirm('Archive this template?')) return;
                      try { await execute(() => api.delete(`/api/company-contracts/templates/${t.id}`), 'Template archived'); refetchTemplates(); } catch {}
                    }} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showContractForm && (
        <ContractFormModal contract={editingContract} onClose={() => setShowContractForm(false)}
          onSave={async (data) => {
            try {
              if (editingContract) await execute(() => api.put(`/api/company-contracts/${editingContract.id}`, data), 'Contract updated');
              else await execute(() => api.post('/api/company-contracts', data), 'Contract created');
              reload(); setShowContractForm(false);
            } catch {}
          }} saving={saving} templates={templates}
          onGenerateFromTemplate={async (contractId, templateId) => {
            try { await execute(() => api.post(`/api/company-contracts/${contractId}/generate-from-template`, { templateId }), 'Template applied'); reload(); } catch {}
          }}
        />
      )}

      {showTemplateForm && (
        <TemplateFormModal template={editingTemplate} onClose={() => setShowTemplateForm(false)}
          onSave={async (data) => {
            try {
              if (editingTemplate) await execute(() => api.put(`/api/company-contracts/templates/${editingTemplate.id}`, data), 'Template updated');
              else await execute(() => api.post('/api/company-contracts/templates', data), 'Template created');
              refetchTemplates(); setShowTemplateForm(false);
            } catch {}
          }} saving={saving}
        />
      )}

      {showSigningModal && selectedContract && (
        <SendForSigningModal contract={selectedContract} onClose={() => setShowSigningModal(false)}
          onSend={async (data) => {
            try { await execute(() => api.post(`/api/company-contracts/${selectedContract.id}/send-for-signing`, data), 'Contract sent for signing'); reload(); setShowSigningModal(false); } catch {}
          }} saving={saving}
        />
      )}

      {showCounterSignModal && selectedContract && (
        <CounterSignModal contract={selectedContract} onClose={() => setShowCounterSignModal(false)}
          onSign={async (file) => {
            const fd = new FormData(); if (file) fd.append('file', file);
            try { await execute(() => api.post(`/api/company-contracts/${selectedContract.id}/counter-sign`, fd), 'Contract counter-signed!'); reload(); setShowCounterSignModal(false); } catch {}
          }} saving={saving}
        />
      )}
    </div>
  );
}

// ── Contract Card ────────────────────────────────────────────────────────────

function ContractCard({ contract, expanded, onToggle, onEdit, onDelete, onSendForSigning, onResend, onCancelSigning, onCounterSign, onUploadContract, onUploadSigned, saving }) {
  const fileRef = useRef(null);
  const signedFileRef = useRef(null);
  const ss = contract.signingStatus || 'none';

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50" onClick={onToggle}>
        {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-800 truncate">{contract.name}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">{contract.category}</span>
            <StatusBadge status={contract.status} styles={{ active: 'bg-green-100 text-green-700', expired: 'bg-red-100 text-red-700', pending: 'bg-amber-100 text-amber-700', cancelled: 'bg-gray-100 text-gray-500', renewed: 'bg-blue-100 text-blue-700' }} />
            {ss !== 'none' && <span className={`text-[10px] px-2 py-0.5 rounded-full border ${CONTRACT_SIGNING_STATUS_STYLES[ss]}`}>{CONTRACT_SIGNING_LABELS[ss]}</span>}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
            {contract.vendorName && <span>Vendor: {contract.vendorName}</span>}
            {contract.expiryDate && <span className={contract.daysToExpiry < 0 ? 'text-red-500' : contract.daysToExpiry <= 30 ? 'text-amber-500' : ''}>Expires: {formatDate(contract.expiryDate)}</span>}
            {contract.company && <span>{contract.company.shortName || contract.company.name}</span>}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 p-4 bg-slate-50/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <DI label="Description" value={contract.description} />
            <DI label="Amount" value={contract.amount ? `₹${contract.amount.toLocaleString('en-IN')}` : null} />
            <DI label="Start Date" value={contract.startDate ? formatDate(contract.startDate) : null} />
            <DI label="Expiry Date" value={contract.expiryDate ? formatDate(contract.expiryDate) : null} />
            <DI label="Vendor Contact" value={contract.vendorContact} />
            <DI label="Payment Mode" value={contract.paymentMode} />
          </div>

          {ss !== 'none' && (
            <div className="mb-4 p-3 bg-white rounded-lg border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">Signing Progress</p>
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <TS label="Created" done />
                <span className="text-slate-300">→</span>
                <TS label="Sent" done={['sent','partially_signed','fully_signed'].includes(ss)} date={contract.sentAt} />
                <span className="text-slate-300">→</span>
                <TS label="Externally Signed" done={['partially_signed','fully_signed'].includes(ss)} date={contract.externalSignedAt} />
                <span className="text-slate-300">→</span>
                <TS label="Counter-Signed" done={ss === 'fully_signed'} date={contract.counterSignedAt} />
              </div>
              {contract.externalSignerName && <p className="text-xs text-slate-500 mt-2">External: {contract.externalSignerName} ({contract.externalSignerEmail})</p>}
              {contract.internalSigner && <p className="text-xs text-slate-500">Counter-signed by: {contract.internalSigner.name}</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            {contract.contractFileUrl && <FileLink href={contract.contractFileUrl} label="Original Contract" color="blue" />}
            {contract.signedFileUrl && <FileLink href={contract.signedFileUrl} label="Signed Copy" color="orange" />}
            {contract.counterSignedFileUrl && <FileLink href={contract.counterSignedFileUrl} label="Final (Counter-Signed)" color="green" />}
          </div>

          <div className="flex flex-wrap gap-2">
            <Btn onClick={onEdit} icon={Edit3} label="Edit" />
            {!contract.contractFileUrl && (
              <>
                <input type="file" ref={fileRef} accept=".pdf" className="hidden" onChange={e => { if (e.target.files[0]) onUploadContract(e.target.files[0]); e.target.value = ''; }} />
                <Btn onClick={() => fileRef.current?.click()} icon={Upload} label="Upload Contract PDF" color="blue" disabled={saving} />
              </>
            )}
            {(ss === 'none' || ss === 'draft') && (contract.contractFileUrl || contract.templateContent) && <Btn onClick={onSendForSigning} icon={Send} label="Send for Signing" color="indigo" />}
            {['sent','expired'].includes(ss) && <Btn onClick={onResend} icon={RotateCcw} label="Resend" color="amber" disabled={saving} />}
            {ss === 'sent' && (
              <>
                <input type="file" ref={signedFileRef} accept=".pdf" className="hidden" onChange={e => { if (e.target.files[0]) onUploadSigned(e.target.files[0]); e.target.value = ''; }} />
                <Btn onClick={() => signedFileRef.current?.click()} icon={Upload} label="Upload Signed Copy" color="orange" disabled={saving} />
              </>
            )}
            {ss === 'partially_signed' && <Btn onClick={onCounterSign} icon={FileSignature} label="Counter-Sign" color="green" />}
            {['sent','partially_signed'].includes(ss) && <Btn onClick={onCancelSigning} icon={XCircle} label="Cancel Signing" color="red" disabled={saving} />}
            <button onClick={onDelete} className="flex items-center gap-1.5 text-xs text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg ml-auto"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DI({ label, value }) {
  if (!value) return null;
  return <div><p className="text-[10px] text-slate-500 uppercase font-semibold">{label}</p><p className="text-sm text-slate-700">{value}</p></div>;
}

function TS({ label, done, date }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${done ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
      <span>{label}</span>
      {date && <span className="text-[10px] opacity-70">({date.slice(0, 10)})</span>}
    </div>
  );
}

function FileLink({ href, label, color }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className={`flex items-center gap-1.5 text-xs bg-${color}-50 text-${color}-700 px-3 py-1.5 rounded-lg hover:bg-${color}-100`}>
      <Download className="w-3.5 h-3.5" /> {label}
    </a>
  );
}

function Btn({ onClick, icon: Icon, label, color = 'slate', disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center gap-1.5 text-xs bg-${color}-50 text-${color}-700 px-3 py-1.5 rounded-lg hover:bg-${color}-100 disabled:opacity-50`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

// ── Contract Form Modal ──────────────────────────────────────────────────────

function ContractFormModal({ contract, onClose, onSave, saving, templates, onGenerateFromTemplate }) {
  const [form, setForm] = useState({
    category: contract?.category || 'service', name: contract?.name || '', description: contract?.description || '',
    status: contract?.status || 'active', vendorName: contract?.vendorName || '', vendorContact: contract?.vendorContact || '',
    amount: contract?.amount || '', startDate: contract?.startDate || '', expiryDate: contract?.expiryDate || '',
    externalSignerName: contract?.externalSignerName || '', externalSignerEmail: contract?.externalSignerEmail || '', notes: contract?.notes || '',
  });
  const [selTpl, setSelTpl] = useState('');
  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <MO onClose={onClose} title={contract ? 'Edit Contract' : 'New Contract'}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FF label="Contract Name *" value={form.name} onChange={v => sf('name', v)} />
        <FS label="Category *" value={form.category} onChange={v => sf('category', v)} options={CATEGORIES} />
        <FF label="Vendor Name" value={form.vendorName} onChange={v => sf('vendorName', v)} />
        <FF label="Vendor Contact" value={form.vendorContact} onChange={v => sf('vendorContact', v)} />
        <FF label="Amount (₹)" value={form.amount} onChange={v => sf('amount', v)} type="number" />
        <FS label="Status" value={form.status} onChange={v => sf('status', v)} options={STATUSES} />
        <FF label="Start Date" value={form.startDate} onChange={v => sf('startDate', v)} type="date" />
        <FF label="Expiry Date" value={form.expiryDate} onChange={v => sf('expiryDate', v)} type="date" />
        <FF label="External Signer Name" value={form.externalSignerName} onChange={v => sf('externalSignerName', v)} />
        <FF label="External Signer Email" value={form.externalSignerEmail} onChange={v => sf('externalSignerEmail', v)} type="email" />
        <div className="md:col-span-2"><FF label="Description" value={form.description} onChange={v => sf('description', v)} ta /></div>
        <div className="md:col-span-2"><FF label="Notes" value={form.notes} onChange={v => sf('notes', v)} ta /></div>
        {contract && templates.length > 0 && !contract.templateContent && (
          <div className="md:col-span-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs font-semibold text-blue-700 mb-2">Generate from Template</p>
            <div className="flex items-center gap-2">
              <select value={selTpl} onChange={e => setSelTpl(e.target.value)} className="flex-1 text-sm border border-blue-200 rounded-lg px-3 py-2 bg-white">
                <option value="">Select template...</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type.replace(/_/g, ' ')})</option>)}
              </select>
              <button disabled={!selTpl || saving} onClick={() => onGenerateFromTemplate(contract.id, selTpl)}
                className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50">Apply</button>
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.name || !form.category}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving...' : contract ? 'Update' : 'Create'}
        </button>
      </div>
    </MO>
  );
}

// ── Template Form Modal ──────────────────────────────────────────────────────

function TemplateFormModal({ template, onClose, onSave, saving }) {
  const [form, setForm] = useState({ name: template?.name || '', type: template?.type || 'nda', content: template?.content || '' });
  const phs = ['{{vendorName}}', '{{companyName}}', '{{date}}', '{{startDate}}', '{{expiryDate}}', '{{amount}}', '{{description}}', '{{contractName}}', '{{vendorContact}}'];

  return (
    <MO onClose={onClose} title={template ? 'Edit Template' : 'New Template'} wide>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <FF label="Template Name *" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} />
        <FS label="Type *" value={form.type} onChange={v => setForm(p => ({ ...p, type: v }))} options={TEMPLATE_TYPES} />
      </div>
      <div className="mb-2">
        <label className="text-xs font-medium text-slate-600 mb-1 block">Content (HTML with placeholders)</label>
        <div className="flex flex-wrap gap-1 mb-2">
          {phs.map(p => (
            <button key={p} onClick={() => setForm(prev => ({ ...prev, content: prev.content + p }))}
              className="text-[10px] px-2 py-1 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 border border-blue-200">{p}</button>
          ))}
        </div>
        <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
          rows={12} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" placeholder="Enter HTML template content..." />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.name || !form.type || !form.content}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving...' : template ? 'Update' : 'Create'}
        </button>
      </div>
    </MO>
  );
}

// ── Send for Signing Modal ───────────────────────────────────────────────────

function SendForSigningModal({ contract, onClose, onSend, saving }) {
  const [form, setForm] = useState({
    externalSignerName: contract.externalSignerName || '', externalSignerEmail: contract.externalSignerEmail || '',
    externalSignerPhone: contract.externalSignerPhone || '', expiryDays: '30',
  });

  return (
    <MO onClose={onClose} title="Send for Signing">
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mb-4">
        <p className="text-sm text-blue-800">Sending: <strong>{contract.name}</strong></p>
        <p className="text-xs text-blue-600 mt-1">The external party will receive an email with a link to download, sign, and upload the contract.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FF label="Signer Name *" value={form.externalSignerName} onChange={v => setForm(p => ({ ...p, externalSignerName: v }))} />
        <FF label="Signer Email *" value={form.externalSignerEmail} onChange={v => setForm(p => ({ ...p, externalSignerEmail: v }))} type="email" />
        <FF label="Phone (optional)" value={form.externalSignerPhone} onChange={v => setForm(p => ({ ...p, externalSignerPhone: v }))} />
        <FF label="Link Expiry (days)" value={form.expiryDays} onChange={v => setForm(p => ({ ...p, expiryDays: v }))} type="number" />
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
        <button onClick={() => onSend(form)} disabled={saving || !form.externalSignerName || !form.externalSignerEmail}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          <Send className="w-4 h-4" /> {saving ? 'Sending...' : 'Send'}
        </button>
      </div>
    </MO>
  );
}

// ── Counter-Sign Modal ───────────────────────────────────────────────────────

function CounterSignModal({ contract, onClose, onSign, saving }) {
  const [file, setFile] = useState(null);
  return (
    <MO onClose={onClose} title="Counter-Sign Contract">
      <div className="p-3 bg-green-50 rounded-lg border border-green-200 mb-4">
        <p className="text-sm text-green-800">Counter-signing: <strong>{contract.name}</strong></p>
        <p className="text-xs text-green-600 mt-1">Externally signed by {contract.externalSignerName} on {contract.externalSignedAt?.slice(0, 10)}.</p>
      </div>
      {contract.signedFileUrl && (
        <a href={contract.signedFileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline mb-3">
          <Download className="w-4 h-4" /> View externally signed copy
        </a>
      )}
      <div className="mb-4">
        <label className="text-xs font-medium text-slate-600 mb-1 block">Upload counter-signed PDF (optional)</label>
        <input type="file" accept=".pdf" onChange={e => setFile(e.target.files[0] || null)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-full" />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
        <button onClick={() => onSign(file)} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
          <FileSignature className="w-4 h-4" /> {saving ? 'Signing...' : 'Counter-Sign & Complete'}
        </button>
      </div>
    </MO>
  );
}

// ── Shared UI ────────────────────────────────────────────────────────────────

function MO({ onClose, title, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-xl ${wide ? 'max-w-3xl' : 'max-w-xl'} w-full max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function FF({ label, value, onChange, type = 'text', ta }) {
  const cls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 mb-1 block">{label}</label>
      {ta ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className={cls} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} className={cls} />}
    </div>
  );
}

function FS({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 mb-1 block">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm capitalize">
        {options.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
      </select>
    </div>
  );
}
