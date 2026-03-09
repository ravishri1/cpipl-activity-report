import { useState } from 'react';
import { Calculator, Plus, ChevronDown, ChevronUp, Send, FileText } from 'lucide-react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import StatusBadge from '../shared/StatusBadge';
import { formatDate, formatINR } from '../../utils/formatters';
import { DECLARATION_STATUS_STYLES } from '../../utils/constants';

const CURRENT_FY = '2025-26';

const EMPTY_FORM = {
  financialYear: CURRENT_FY,
  // 80C
  ppf: '', elss: '', lic: '', homeLoanPrincipal: '', nsc: '', tuitionFees: '', other80C: '',
  // HRA
  hraRentPaid: '', landlordName: '', landlordPan: '',
  // 80D
  mediclaim80D: '', parentMediclaim80D: '',
  // 80E
  educationLoanInterest80E: '',
  // 24B
  homeLoanInterest24B: '',
  // NPS
  nps80CCDI: '',
  notes: '',
};

function num(val) { return parseFloat(val) || 0; }

function computeTotals(form) {
  const total80C = Math.min(
    num(form.ppf) + num(form.elss) + num(form.lic) + num(form.homeLoanPrincipal) +
    num(form.nsc) + num(form.tuitionFees) + num(form.other80C),
    150000
  );
  const total80D = num(form.mediclaim80D) + num(form.parentMediclaim80D);
  const total24B = num(form.homeLoanInterest24B);
  const totalHRA = num(form.hraRentPaid);
  const total80E = num(form.educationLoanInterest80E);
  const totalNPS = Math.min(num(form.nps80CCDI), 50000);
  const totalDeclared = total80C + total80D + total24B + totalHRA + total80E + totalNPS;
  return { total80C, total80D, total24B, totalHRA, total80E, totalNPS, totalDeclared };
}

function SectionBox({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-700">
        {title}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <div className="p-4 grid grid-cols-2 gap-4">{children}</div>}
    </div>
  );
}

function Field({ label, name, form, onChange, hint }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-400 mb-1">{hint}</p>}
      <input type="number" min="0" value={form[name] || ''}
        onChange={e => onChange(name, e.target.value)}
        placeholder="0"
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    </div>
  );
}

function TextField({ label, name, form, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input type="text" value={form[name] || ''}
        onChange={e => onChange(name, e.target.value)}
        placeholder={placeholder || ''}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    </div>
  );
}

export default function InvestmentDeclaration() {
  const { data: declarations, loading, error, refetch } = useFetch('/investment-declarations/my', []);
  const { execute, loading: saving, error: saveErr, success, clearMessages } = useApi();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);

  const totals = computeTotals(form);

  function setField(name, value) { setForm(f => ({ ...f, [name]: value })); }

  function openNew() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(true);
    clearMessages();
  }

  function openEdit(decl) {
    setForm({ ...EMPTY_FORM, ...decl });
    setEditId(decl.id);
    setShowForm(true);
    clearMessages();
  }

  async function handleSave() {
    const payload = { ...form };
    Object.keys(totals).forEach(k => { payload[k] = totals[k]; });
    if (editId) {
      await execute(() => api.post('/investment-declarations', payload), 'Declaration saved!');
    } else {
      await execute(() => api.post('/investment-declarations', payload), 'Declaration created!');
    }
    refetch();
    setShowForm(false);
  }

  async function handleSubmit(id) {
    if (!window.confirm('Submit this declaration for HR approval? You cannot edit after submission.')) return;
    await execute(() => api.put(`/investment-declarations/${id}/submit`), 'Submitted for approval!');
    refetch();
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 pb-4 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Investment Declaration (Form 12BB)</h1>
          <p className="text-sm text-slate-500 mt-1">Declare your tax-saving investments for the financial year</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Declaration
        </button>
      </div>

      {success && <AlertMessage type="success" message={success} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}

      {!showForm && declarations.length === 0 && (
        <EmptyState icon="📋" title="No declarations yet"
          subtitle="Create your investment declaration for Form 12BB tax savings" />
      )}

      {!showForm && declarations.map(d => (
        <div key={d.id} className="bg-white border border-slate-200 rounded-xl p-5 mb-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <FileText className="w-5 h-5 text-blue-500" />
                <span className="font-semibold text-slate-800">FY {d.financialYear}</span>
                <StatusBadge status={d.status} styles={DECLARATION_STATUS_STYLES} />
              </div>
              <p className="text-xs text-slate-500">Created {formatDate(d.createdAt)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-1">Total Declared</p>
              <p className="text-lg font-bold text-green-700">{formatINR(d.totalDeclared || 0)}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm text-slate-600">
            <div className="bg-slate-50 rounded-lg p-2">
              <p className="text-xs text-slate-400">80C (max ₹1.5L)</p>
              <p className="font-semibold">{formatINR(d.total80C || 0)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2">
              <p className="text-xs text-slate-400">HRA</p>
              <p className="font-semibold">{formatINR(d.totalHRA || 0)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2">
              <p className="text-xs text-slate-400">80D + Others</p>
              <p className="font-semibold">{formatINR((d.total80D || 0) + (d.total80E || 0) + (d.totalNPS || 0))}</p>
            </div>
          </div>
          {d.status === 'draft' && (
            <div className="mt-3 flex gap-2">
              <button onClick={() => openEdit(d)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">
                Edit
              </button>
              <button onClick={() => handleSubmit(d.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                <Send className="w-3.5 h-3.5" /> Submit to HR
              </button>
            </div>
          )}
          {d.status === 'rejected' && d.rejectionNote && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <strong>Rejection reason:</strong> {d.rejectionNote}
            </div>
          )}
        </div>
      ))}

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800">
              {editId ? 'Edit Declaration' : 'New Declaration'} — FY {form.financialYear}
            </h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-sm">Cancel</button>
          </div>

          <SectionBox title="Section 80C — Tax Saving Investments (Max ₹1,50,000)">
            <Field label="PPF Contribution" name="ppf" form={form} onChange={setField} />
            <Field label="ELSS / Mutual Fund" name="elss" form={form} onChange={setField} />
            <Field label="LIC Premium" name="lic" form={form} onChange={setField} />
            <Field label="Home Loan Principal Repayment" name="homeLoanPrincipal" form={form} onChange={setField} />
            <Field label="NSC (National Savings Certificate)" name="nsc" form={form} onChange={setField} />
            <Field label="Tuition Fees (max 2 children)" name="tuitionFees" form={form} onChange={setField} />
            <Field label="Other 80C Investments" name="other80C" form={form} onChange={setField} />
            <div className="col-span-2 bg-blue-50 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm font-medium text-blue-700">Total 80C (capped at ₹1,50,000)</span>
              <span className="text-lg font-bold text-blue-800">{formatINR(totals.total80C)}</span>
            </div>
          </SectionBox>

          <SectionBox title="HRA — House Rent Allowance">
            <Field label="Annual Rent Paid (₹)" name="hraRentPaid" form={form} onChange={setField}
              hint="Only if rent > ₹1,00,000/year, landlord PAN mandatory" />
            <TextField label="Landlord Name" name="landlordName" form={form} onChange={setField} placeholder="As per rental agreement" />
            <TextField label="Landlord PAN" name="landlordPan" form={form} onChange={setField} placeholder="e.g. ABCDE1234F" />
          </SectionBox>

          <SectionBox title="Section 80D — Health Insurance Premiums">
            <Field label="Self / Family Mediclaim Premium" name="mediclaim80D" form={form} onChange={setField}
              hint="Max ₹25,000 (₹50,000 if senior citizen)" />
            <Field label="Parents' Mediclaim Premium" name="parentMediclaim80D" form={form} onChange={setField}
              hint="Max ₹25,000 (₹50,000 if senior citizen parents)" />
          </SectionBox>

          <SectionBox title="Section 80E — Education Loan Interest">
            <Field label="Education Loan Interest Paid" name="educationLoanInterest80E" form={form} onChange={setField}
              hint="No upper limit; deductible for 8 years" />
          </SectionBox>

          <SectionBox title="Section 24B — Home Loan Interest">
            <Field label="Home Loan Interest Paid (₹)" name="homeLoanInterest24B" form={form} onChange={setField}
              hint="Max ₹2,00,000 for self-occupied property" />
          </SectionBox>

          <SectionBox title="Section 80CCD(1B) — NPS (National Pension Scheme)">
            <Field label="NPS Contribution (Max ₹50,000)" name="nps80CCDI" form={form} onChange={setField}
              hint="Additional deduction over 80C limit" />
          </SectionBox>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800">Estimated Total Tax Exemption</span>
              </div>
              <span className="text-2xl font-bold text-green-700">{formatINR(totals.totalDeclared)}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-green-700">
              <span>80C: {formatINR(totals.total80C)}</span>
              <span>HRA: {formatINR(totals.totalHRA)}</span>
              <span>80D: {formatINR(totals.total80D)}</span>
              <span>80E: {formatINR(totals.total80E)}</span>
              <span>24B: {formatINR(totals.total24B)}</span>
              <span>NPS: {formatINR(totals.totalNPS)}</span>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
            <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Any additional information for HR..." />
          </div>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save as Draft'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-6 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
