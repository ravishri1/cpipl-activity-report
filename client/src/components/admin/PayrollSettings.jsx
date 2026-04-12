import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import AlertMessage from '../shared/AlertMessage';
import LoadingSpinner from '../shared/LoadingSpinner';
import { Settings, Plus, Trash2, Save } from 'lucide-react';

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const DEFAULT_RULES = {
  pf: { employeeRate: 0.12, employerRate: 0.12, wageCap: 15000, maxMonthly: 1800 },
  esi: { employeeRate: 0.0075, employerRate: 0.0325, grossCeiling: 21000 },
  pt: {
    maleSlabs: [
      { minGross: 7501, maxGross: 10000, amount: 175 },
      { minGross: 10001, maxGross: null, amount: 200 },
    ],
    femaleSlabs: [
      { minGross: 25001, maxGross: null, amount: 200 },
    ],
    februaryTopUp: 100,
  },
  lwf: { employeeAmount: 12, employerAmount: 36, months: [6, 12] },
  lop: { divisor: 30 },
};

function pct(val) { return val != null ? (parseFloat(val) * 100).toFixed(4).replace(/\.?0+$/, '') : ''; }
function rate(val) { return val != null ? parseFloat((parseFloat(val) / 100).toFixed(6)) : 0; }

function SlabTable({ slabs, onChange, onAdd, onRemove, label }) {
  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-slate-700">{label}</h4>
        <button onClick={onAdd}
          className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
          <Plus className="w-3 h-3" /> Add Slab
        </button>
      </div>
      {slabs.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-3 border border-dashed border-slate-200 rounded-lg">
          No slabs — PT will be ₹0 for this gender.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2 text-xs font-medium text-slate-500 px-1 mb-1">
            <span>Min Gross (₹)</span><span>Max Gross (₹)</span><span>PT Amount (₹)</span><span></span>
          </div>
          <div className="space-y-2">
            {slabs.map((slab, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 items-center">
                <input type="number" className={inputCls} placeholder="7501"
                  value={slab.minGross ?? ''} onChange={e => onChange(i, 'minGross', e.target.value)} />
                <input type="number" className={inputCls} placeholder="Leave blank = no limit"
                  value={slab.maxGross ?? ''} onChange={e => onChange(i, 'maxGross', e.target.value === '' ? null : e.target.value)} />
                <input type="number" className={inputCls} placeholder="200"
                  value={slab.amount ?? ''} onChange={e => onChange(i, 'amount', e.target.value)} />
                <button onClick={() => onRemove(i)}
                  className="flex items-center justify-center w-8 h-8 text-red-500 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function PayrollSettings() {
  const { data: savedRules, loading, error: fetchErr } = useFetch('/settings/payroll-rules', null);
  const { execute, loading: saving, error: saveErr, success } = useApi();

  const [pf, setPf] = useState(DEFAULT_RULES.pf);
  const [esi, setEsi] = useState(DEFAULT_RULES.esi);
  const [maleSlabs, setMaleSlabs] = useState(DEFAULT_RULES.pt.maleSlabs);
  const [femaleSlabs, setFemaleSlabs] = useState(DEFAULT_RULES.pt.femaleSlabs);
  const [februaryTopUp, setFebruaryTopUp] = useState(DEFAULT_RULES.pt.februaryTopUp);
  const [lwf, setLwf] = useState(DEFAULT_RULES.lwf);
  const [lopDivisor, setLopDivisor] = useState(DEFAULT_RULES.lop.divisor);

  useEffect(() => {
    if (!savedRules) return;
    if (savedRules.pf) setPf(savedRules.pf);
    if (savedRules.esi) setEsi(savedRules.esi);
    if (savedRules.pt) {
      // Support both new (maleSlabs/femaleSlabs) and legacy (slabs) format
      if (savedRules.pt.maleSlabs) setMaleSlabs(savedRules.pt.maleSlabs);
      else if (savedRules.pt.slabs) setMaleSlabs(savedRules.pt.slabs); // migrate legacy
      if (savedRules.pt.femaleSlabs) setFemaleSlabs(savedRules.pt.femaleSlabs);
      if (savedRules.pt.februaryTopUp != null) setFebruaryTopUp(savedRules.pt.februaryTopUp);
    }
    if (savedRules.lwf) setLwf({ ...DEFAULT_RULES.lwf, ...savedRules.lwf });
    if (savedRules.lop?.divisor != null) setLopDivisor(savedRules.lop.divisor);
  }, [savedRules]);

  const updateSlab = (setter) => (i, field, val) => {
    setter(prev => prev.map((s, idx) =>
      idx === i ? { ...s, [field]: val === '' || val === null ? null : parseFloat(val) } : s
    ));
  };
  const addSlab = (setter) => () => setter(prev => [...prev, { minGross: 0, maxGross: null, amount: 0 }]);
  const removeSlab = (setter) => (i) => setter(prev => prev.filter((_, idx) => idx !== i));

  const parseSlab = (s) => ({
    minGross: parseFloat(s.minGross) || 0,
    maxGross: s.maxGross === '' || s.maxGross === null || isNaN(s.maxGross) ? null : parseFloat(s.maxGross),
    amount: parseFloat(s.amount) || 0,
  });

  const handleSave = async () => {
    const payload = {
      pf: { ...pf, wageCap: parseFloat(pf.wageCap), maxMonthly: parseFloat(pf.maxMonthly) },
      esi: { ...esi, grossCeiling: parseFloat(esi.grossCeiling) },
      pt: {
        maleSlabs: maleSlabs.map(parseSlab),
        femaleSlabs: femaleSlabs.map(parseSlab),
        februaryTopUp: parseFloat(februaryTopUp) || 0,
      },
      lwf: {
        employeeAmount: parseFloat(lwf.employeeAmount) || 0,
        employerAmount: parseFloat(lwf.employerAmount) || 0,
        months: lwf.months,
      },
      lop: { divisor: parseInt(lopDivisor) || 30 },
    };
    try {
      await execute(() => api.put('/settings/payroll-rules', payload), 'Payroll rules saved!');
    } catch { /* useApi handles error */ }
  };

  if (loading) return <LoadingSpinner />;

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-2">
        <Settings className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-slate-800">Payroll Statutory Rules</h2>
      </div>
      <p className="text-sm text-slate-500 -mt-4">
        These rules are used during payroll generation to auto-calculate PF, ESI, PT, and LOP deductions.
        Changes apply to the <strong>next payroll run</strong> — existing payslips are not affected.
      </p>

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}
      {success && <AlertMessage type="success" message={success} />}

      {/* PF Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Provident Fund (PF)</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className={labelCls}>Employee Rate (%)</label>
            <input type="number" step="0.01" className={inputCls}
              value={pct(pf.employeeRate)}
              onChange={e => setPf(p => ({ ...p, employeeRate: rate(e.target.value) }))} />
            <p className="text-xs text-slate-400 mt-1">Standard: 12%</p>
          </div>
          <div>
            <label className={labelCls}>Employer Rate (%)</label>
            <input type="number" step="0.01" className={inputCls}
              value={pct(pf.employerRate)}
              onChange={e => setPf(p => ({ ...p, employerRate: rate(e.target.value) }))} />
            <p className="text-xs text-slate-400 mt-1">Standard: 12%</p>
          </div>
          <div>
            <label className={labelCls}>Wage Cap (₹)</label>
            <input type="number" className={inputCls}
              value={pf.wageCap || ''}
              onChange={e => setPf(p => ({ ...p, wageCap: parseFloat(e.target.value) || 0 }))} />
            <p className="text-xs text-slate-400 mt-1">PF on min(basic, cap)</p>
          </div>
          <div>
            <label className={labelCls}>Max Monthly (₹)</label>
            <input type="number" className={inputCls}
              value={pf.maxMonthly || ''}
              onChange={e => setPf(p => ({ ...p, maxMonthly: parseFloat(e.target.value) || 0 }))} />
            <p className="text-xs text-slate-400 mt-1">= wageCap × rate</p>
          </div>
        </div>
      </div>

      {/* ESI Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Employee State Insurance (ESI)</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Employee Rate (%)</label>
            <input type="number" step="0.001" className={inputCls}
              value={pct(esi.employeeRate)}
              onChange={e => setEsi(p => ({ ...p, employeeRate: rate(e.target.value) }))} />
            <p className="text-xs text-slate-400 mt-1">Standard: 0.75%</p>
          </div>
          <div>
            <label className={labelCls}>Employer Rate (%)</label>
            <input type="number" step="0.001" className={inputCls}
              value={pct(esi.employerRate)}
              onChange={e => setEsi(p => ({ ...p, employerRate: rate(e.target.value) }))} />
            <p className="text-xs text-slate-400 mt-1">Standard: 3.25%</p>
          </div>
          <div>
            <label className={labelCls}>Gross Ceiling (₹)</label>
            <input type="number" className={inputCls}
              value={esi.grossCeiling || ''}
              onChange={e => setEsi(p => ({ ...p, grossCeiling: parseFloat(e.target.value) || 0 }))} />
            <p className="text-xs text-slate-400 mt-1">ESI if gross ≤ this</p>
          </div>
        </div>
      </div>

      {/* PT Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Professional Tax (PT) Slabs</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Slabs are gender-aware. Highest matching slab is applied. Set amount to ₹0 to make a range tax-free.
            Mark employee as PT-exempt in their salary structure to skip PT entirely.
          </p>
        </div>

        {/* Male Slabs */}
        <div className="border border-slate-100 rounded-lg p-4 bg-blue-50/30">
          <SlabTable
            label="👨 Male Slabs"
            slabs={maleSlabs}
            onChange={updateSlab(setMaleSlabs)}
            onAdd={addSlab(setMaleSlabs)}
            onRemove={removeSlab(setMaleSlabs)}
          />
        </div>

        {/* Female Slabs */}
        <div className="border border-slate-100 rounded-lg p-4 bg-pink-50/30">
          <SlabTable
            label="👩 Female Slabs"
            slabs={femaleSlabs}
            onChange={updateSlab(setFemaleSlabs)}
            onAdd={addSlab(setFemaleSlabs)}
            onRemove={removeSlab(setFemaleSlabs)}
          />
        </div>

        {/* February Top-Up */}
        <div className="border border-amber-100 rounded-lg p-4 bg-amber-50/30">
          <h4 className="text-sm font-medium text-slate-700 mb-1">February Top-Up (₹)</h4>
          <div className="flex items-center gap-4">
            <div className="w-40">
              <input type="number" min="0" className={inputCls}
                value={februaryTopUp}
                onChange={e => setFebruaryTopUp(e.target.value)} />
            </div>
            <p className="text-xs text-slate-500">
              Extra PT charged in February only.<br />
              Example: ₹100 → a ₹200 slab becomes ₹300 in Feb (Maharashtra rule).
              Set to ₹0 to disable.
            </p>
          </div>
        </div>
      </div>

      {/* LWF Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Labour Welfare Fund (LWF)</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            LWF applies <strong>only to ESIC-covered employees</strong>. If ESIC is removed at contribution period start, LWF is also removed automatically.
            Contribution periods: Apr–Sep and Oct–Mar.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Employee Deduction (₹)</label>
            <input type="number" min="0" className={inputCls}
              value={lwf.employeeAmount}
              onChange={e => setLwf(l => ({ ...l, employeeAmount: e.target.value }))} />
            <p className="text-xs text-slate-400 mt-1">Maharashtra: ₹12</p>
          </div>
          <div>
            <label className={labelCls}>Employer Contribution (₹)</label>
            <input type="number" min="0" className={inputCls}
              value={lwf.employerAmount}
              onChange={e => setLwf(l => ({ ...l, employerAmount: e.target.value }))} />
            <p className="text-xs text-slate-400 mt-1">Maharashtra: ₹36</p>
          </div>
        </div>
        <div>
          <label className={labelCls}>Applicable Months</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {MONTH_LABELS.map((label, i) => {
              const monthNum = i + 1;
              const checked = (lwf.months || []).includes(monthNum);
              return (
                <button key={monthNum} type="button"
                  onClick={() => setLwf(l => ({
                    ...l,
                    months: checked
                      ? l.months.filter(m => m !== monthNum)
                      : [...(l.months || []), monthNum].sort((a, b) => a - b),
                  }))}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${checked ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>
                  {label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 mt-1">Maharashtra: June & December only</p>
        </div>
      </div>

      {/* LOP Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">LOP (Loss of Pay) Calculation</h3>
        <div className="max-w-xs">
          <label className={labelCls}>LOP Divisor</label>
          <input type="number" min="0" max="31" className={inputCls}
            value={lopDivisor}
            onChange={e => setLopDivisor(e.target.value)} />
          <p className="text-xs text-slate-400 mt-1">
            Per-day salary = Monthly CTC ÷ divisor.<br />
            <strong>30</strong> = Greythr-compatible (fixed). <strong>0</strong> = actual days in month.
          </p>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Payroll Rules'}
        </button>
      </div>
    </div>
  );
}
