import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  IndianRupee,
  Users,
  Calculator,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Search,
  History,
  Zap,
  Edit3,
  PlusCircle,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import api from '../../utils/api';

const formatCurrency = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return '₹0';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const formatCurrencyDetailed = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const InputField = ({ label, name, value, onChange, type = 'number', placeholder, prefix, disabled, className = '' }) => (
  <div className={className}>
    <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
    <div className="relative">
      {prefix && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{prefix}</span>
      )}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder || '0'}
        disabled={disabled}
        min={type === 'number' ? '0' : undefined}
        step={type === 'number' ? 'any' : undefined}
        className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 ${prefix ? 'pl-7' : ''}`}
      />
    </div>
  </div>
);

const emptySalary = {
  basic: '',
  hra: '',
  da: '',
  specialAllowance: '',
  medicalAllowance: '',
  conveyanceAllowance: '',
  otherAllowance: '',
  otherAllowanceLabel: '',
  employeePf: '',
  employeeEsi: '',
  professionalTax: '',
  tds: '',
  ctcAnnual: '',
  effectiveFrom: new Date().toISOString().split('T')[0],
  notes: '',
};

export default function SalaryStructure() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [salaryForm, setSalaryForm] = useState({ ...emptySalary });
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [isExisting, setIsExisting] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [salaryCache, setSalaryCache] = useState({});

  // Fetch employees
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const res = await api.get('/users');
        const active = (res.data || []).filter((u) => u.isActive !== false);
        setEmployees(active);
      } catch (err) {
        console.error('Failed to fetch employees:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase();
    return employees.filter(
      (e) =>
        (e.name && e.name.toLowerCase().includes(q)) ||
        (e.employeeId && e.employeeId.toLowerCase().includes(q)) ||
        (e.department && e.department.toLowerCase().includes(q))
    );
  }, [employees, searchQuery]);

  // Calculations
  const calculations = useMemo(() => {
    const num = (v) => parseFloat(v) || 0;
    const ctcAnnual = num(salaryForm.ctcAnnual);
    const ctcMonthly = ctcAnnual / 12;

    const grossEarnings =
      num(salaryForm.basic) +
      num(salaryForm.hra) +
      num(salaryForm.da) +
      num(salaryForm.specialAllowance) +
      num(salaryForm.medicalAllowance) +
      num(salaryForm.conveyanceAllowance) +
      num(salaryForm.otherAllowance);

    const totalDeductions =
      num(salaryForm.employeePf) +
      num(salaryForm.employeeEsi) +
      num(salaryForm.professionalTax) +
      num(salaryForm.tds);

    const netPayMonthly = grossEarnings - totalDeductions;

    return { ctcAnnual, ctcMonthly, grossEarnings, totalDeductions, netPayMonthly };
  }, [salaryForm]);

  // Open modal for an employee
  const openSalaryModal = useCallback(async (employee) => {
    setSelectedEmployee(employee);
    setShowModal(true);
    setFormLoading(true);
    setIsExisting(false);
    setSaveMessage(null);
    setShowRevisions(false);
    setRevisions([]);
    setSalaryForm({ ...emptySalary });

    try {
      const res = await api.get(`/payroll/salary/${employee.id}`);
      if (res.data) {
        const d = res.data;
        setSalaryForm({
          basic: d.basic ?? '',
          hra: d.hra ?? '',
          da: d.da ?? '',
          specialAllowance: d.specialAllowance ?? '',
          medicalAllowance: d.medicalAllowance ?? '',
          conveyanceAllowance: d.conveyanceAllowance ?? '',
          otherAllowance: d.otherAllowance ?? '',
          otherAllowanceLabel: d.otherAllowanceLabel ?? '',
          employeePf: d.employeePf ?? '',
          employeeEsi: d.employeeEsi ?? '',
          professionalTax: d.professionalTax ?? '',
          tds: d.tds ?? '',
          ctcAnnual: d.ctcAnnual ?? '',
          effectiveFrom: d.effectiveFrom
            ? new Date(d.effectiveFrom).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          notes: d.notes ?? '',
        });
        setIsExisting(true);
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error('Failed to fetch salary:', err);
      }
    } finally {
      setFormLoading(false);
    }
  }, []);

  // Close modal
  const closeModal = useCallback(() => {
    setShowModal(false);
    setSelectedEmployee(null);
    setSalaryForm({ ...emptySalary });
    setSaveMessage(null);
  }, []);

  // Handle form change
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setSalaryForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Quick fill
  const quickFill = useCallback(() => {
    const ctcAnnual = parseFloat(salaryForm.ctcAnnual);
    if (!ctcAnnual || ctcAnnual <= 0) {
      setSaveMessage({ type: 'error', text: 'Enter CTC Annual first to use Quick Fill.' });
      return;
    }

    const ctcMonthly = ctcAnnual / 12;
    const basic = Math.round(ctcMonthly * 0.4);
    const hra = Math.round(basic * 0.5);
    const pfAmount = Math.min(Math.round(basic * 0.12), 1800);
    const grossEstimate = ctcMonthly;
    const esiAmount = grossEstimate < 21000 ? Math.round(grossEstimate * 0.0075) : 0;
    const pt = 200;
    const specialAllowance = Math.round(ctcMonthly - basic - hra - pfAmount);

    setSalaryForm((prev) => ({
      ...prev,
      basic: basic.toString(),
      hra: hra.toString(),
      da: '0',
      specialAllowance: Math.max(0, specialAllowance).toString(),
      medicalAllowance: '0',
      conveyanceAllowance: '0',
      otherAllowance: '0',
      otherAllowanceLabel: '',
      employeePf: pfAmount.toString(),
      employeeEsi: esiAmount.toString(),
      professionalTax: pt.toString(),
      tds: '0',
    }));
    setSaveMessage({ type: 'success', text: 'Quick Fill applied. Review and adjust as needed.' });
  }, [salaryForm.ctcAnnual]);

  // Save salary
  const saveSalary = useCallback(async () => {
    if (!selectedEmployee) return;
    setSaving(true);
    setSaveMessage(null);

    const payload = {
      basic: parseFloat(salaryForm.basic) || 0,
      hra: parseFloat(salaryForm.hra) || 0,
      da: parseFloat(salaryForm.da) || 0,
      specialAllowance: parseFloat(salaryForm.specialAllowance) || 0,
      medicalAllowance: parseFloat(salaryForm.medicalAllowance) || 0,
      conveyanceAllowance: parseFloat(salaryForm.conveyanceAllowance) || 0,
      otherAllowance: parseFloat(salaryForm.otherAllowance) || 0,
      otherAllowanceLabel: salaryForm.otherAllowanceLabel || '',
      employeePf: parseFloat(salaryForm.employeePf) || 0,
      employeeEsi: parseFloat(salaryForm.employeeEsi) || 0,
      professionalTax: parseFloat(salaryForm.professionalTax) || 0,
      tds: parseFloat(salaryForm.tds) || 0,
      ctcAnnual: parseFloat(salaryForm.ctcAnnual) || 0,
      effectiveFrom: salaryForm.effectiveFrom,
      notes: salaryForm.notes || '',
    };

    try {
      await api.put(`/payroll/salary/${selectedEmployee.id}`, payload);
      setIsExisting(true);
      setSaveMessage({ type: 'success', text: 'Salary structure saved successfully.' });
      setSalaryCache((prev) => ({
        ...prev,
        [selectedEmployee.id]: payload.ctcAnnual,
      }));
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save salary structure.';
      setSaveMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  }, [selectedEmployee, salaryForm]);

  // Fetch revisions
  const toggleRevisions = useCallback(async () => {
    if (showRevisions) {
      setShowRevisions(false);
      return;
    }
    if (!selectedEmployee) return;
    setRevisionsLoading(true);
    setShowRevisions(true);

    try {
      const res = await api.get(`/payroll/salary/${selectedEmployee.id}/revisions`);
      setRevisions(res.data || []);
    } catch (err) {
      console.error('Failed to fetch revisions:', err);
      setRevisions([]);
    } finally {
      setRevisionsLoading(false);
    }
  }, [showRevisions, selectedEmployee]);

  // Render employee table
  const renderEmployeeTable = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
          <span className="text-slate-500">Loading employees...</span>
        </div>
      );
    }

    if (filteredEmployees.length === 0) {
      return (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            {searchQuery ? 'No employees match your search.' : 'No active employees found.'}
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60">
              <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                Employee ID
              </th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                Name
              </th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                Department
              </th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                Designation
              </th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                CTC
              </th>
              <th className="text-right py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredEmployees.map((emp) => {
              const cachedCtc = salaryCache[emp.id];
              return (
                <tr
                  key={emp.id}
                  className="hover:bg-blue-50/40 transition-colors duration-150"
                >
                  <td className="py-3 px-4 text-slate-600 font-mono text-xs">
                    {emp.employeeId || '—'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800">{emp.name}</div>
                    <div className="text-xs text-slate-400">{emp.email}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{emp.department || '—'}</td>
                  <td className="py-3 px-4 text-slate-600">{emp.designation || '—'}</td>
                  <td className="py-3 px-4">
                    {cachedCtc !== undefined ? (
                      <span className="text-emerald-700 font-medium">
                        {formatCurrency(cachedCtc)}
                        <span className="text-slate-400 font-normal text-xs"> /yr</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => openSalaryModal(emp)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 ${
                        cachedCtc !== undefined
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {cachedCtc !== undefined ? (
                        <>
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit CTC
                        </>
                      ) : (
                        <>
                          <PlusCircle className="w-3.5 h-3.5" />
                          Set CTC
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Render salary modal
  const renderModal = () => {
    if (!showModal || !selectedEmployee) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto">
        {/* Overlay */}
        <div className="fixed inset-0 bg-black/40" onClick={closeModal} />

        {/* Modal content */}
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 z-10">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-blue-600" />
                {isExisting ? 'Edit Salary Structure' : 'Set Salary Structure'}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {selectedEmployee.name}
                {selectedEmployee.employeeId ? ` (${selectedEmployee.employeeId})` : ''}
                {selectedEmployee.designation ? ` — ${selectedEmployee.designation}` : ''}
              </p>
            </div>
            <button
              onClick={closeModal}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {formLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
              <span className="text-slate-500">Loading salary data...</span>
            </div>
          ) : (
            <div className="px-6 py-5 space-y-6">
              {/* CTC Annual & Quick Fill */}
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                    CTC Annual
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                    <input
                      type="number"
                      name="ctcAnnual"
                      value={salaryForm.ctcAnnual}
                      onChange={handleChange}
                      placeholder="e.g. 600000"
                      min="0"
                      step="any"
                      className="w-full border-2 border-blue-200 rounded-lg pl-8 pr-4 py-2.5 text-base font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="text-center px-4 py-2">
                  <div className="text-xs text-slate-400 mb-0.5">Monthly</div>
                  <div className="text-base font-bold text-slate-700">
                    {formatCurrency(calculations.ctcMonthly)}
                  </div>
                </div>
                <button
                  onClick={quickFill}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-lg text-sm font-medium transition-colors"
                  title="Auto-distribute CTC across components"
                >
                  <Zap className="w-4 h-4" />
                  Quick Fill
                </button>
              </div>

              {/* Two-column layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Earnings */}
                <div className="bg-emerald-50/50 rounded-xl border border-emerald-100 p-4">
                  <h3 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-1.5">
                    <ChevronUp className="w-4 h-4" />
                    Earnings (Monthly)
                  </h3>
                  <div className="space-y-3">
                    <InputField
                      label="Basic Salary"
                      name="basic"
                      value={salaryForm.basic}
                      onChange={handleChange}
                      prefix="₹"
                    />
                    <InputField
                      label="HRA (House Rent Allowance)"
                      name="hra"
                      value={salaryForm.hra}
                      onChange={handleChange}
                      prefix="₹"
                    />
                    <InputField
                      label="Dearness Allowance (DA)"
                      name="da"
                      value={salaryForm.da}
                      onChange={handleChange}
                      prefix="₹"
                    />
                    <InputField
                      label="Special Allowance"
                      name="specialAllowance"
                      value={salaryForm.specialAllowance}
                      onChange={handleChange}
                      prefix="₹"
                    />
                    <InputField
                      label="Medical Allowance"
                      name="medicalAllowance"
                      value={salaryForm.medicalAllowance}
                      onChange={handleChange}
                      prefix="₹"
                    />
                    <InputField
                      label="Conveyance Allowance"
                      name="conveyanceAllowance"
                      value={salaryForm.conveyanceAllowance}
                      onChange={handleChange}
                      prefix="₹"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <InputField
                        label="Other Allowance"
                        name="otherAllowance"
                        value={salaryForm.otherAllowance}
                        onChange={handleChange}
                        prefix="₹"
                      />
                      <InputField
                        label="Other Allowance Label"
                        name="otherAllowanceLabel"
                        value={salaryForm.otherAllowanceLabel}
                        onChange={handleChange}
                        type="text"
                        placeholder="e.g. Food Allowance"
                      />
                    </div>

                    {/* Gross total */}
                    <div className="pt-2 border-t border-emerald-200 flex justify-between items-center">
                      <span className="text-sm font-semibold text-emerald-800">Gross Earnings</span>
                      <span className="text-base font-bold text-emerald-700">
                        {formatCurrencyDetailed(calculations.grossEarnings)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Deductions */}
                <div className="bg-red-50/50 rounded-xl border border-red-100 p-4">
                  <h3 className="text-sm font-bold text-red-800 mb-3 flex items-center gap-1.5">
                    <ChevronDown className="w-4 h-4" />
                    Deductions (Monthly)
                  </h3>
                  <div className="space-y-3">
                    <InputField
                      label="Employee PF"
                      name="employeePf"
                      value={salaryForm.employeePf}
                      onChange={handleChange}
                      prefix="₹"
                    />
                    <InputField
                      label="Employee ESI"
                      name="employeeEsi"
                      value={salaryForm.employeeEsi}
                      onChange={handleChange}
                      prefix="₹"
                    />
                    <InputField
                      label="Professional Tax"
                      name="professionalTax"
                      value={salaryForm.professionalTax}
                      onChange={handleChange}
                      prefix="₹"
                    />
                    <InputField
                      label="TDS (Income Tax)"
                      name="tds"
                      value={salaryForm.tds}
                      onChange={handleChange}
                      prefix="₹"
                    />

                    {/* Total deductions */}
                    <div className="pt-2 border-t border-red-200 flex justify-between items-center">
                      <span className="text-sm font-semibold text-red-800">Total Deductions</span>
                      <span className="text-base font-bold text-red-600">
                        {formatCurrencyDetailed(calculations.totalDeductions)}
                      </span>
                    </div>
                  </div>

                  {/* Net Pay Summary */}
                  <div className="mt-4 bg-white rounded-lg border border-slate-200 p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Gross Earnings</span>
                      <span className="font-medium text-slate-700">
                        {formatCurrencyDetailed(calculations.grossEarnings)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Total Deductions</span>
                      <span className="font-medium text-red-600">
                        - {formatCurrencyDetailed(calculations.totalDeductions)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex justify-between">
                      <span className="text-sm font-bold text-slate-700">Net Pay (Monthly)</span>
                      <span
                        className={`text-lg font-bold ${
                          calculations.netPayMonthly >= 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {formatCurrencyDetailed(calculations.netPayMonthly)}
                      </span>
                    </div>
                    {calculations.ctcMonthly > 0 && calculations.grossEarnings > 0 && (
                      <div className="flex justify-between text-xs text-slate-400 pt-1">
                        <span>
                          Earnings vs CTC Monthly: {((calculations.grossEarnings / calculations.ctcMonthly) * 100).toFixed(1)}%
                        </span>
                        <span>
                          Net Annual: {formatCurrency(calculations.netPayMonthly * 12)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom row: Effective date & notes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InputField
                  label="Effective From"
                  name="effectiveFrom"
                  value={salaryForm.effectiveFrom}
                  onChange={handleChange}
                  type="date"
                />
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes / Remarks</label>
                  <textarea
                    name="notes"
                    value={salaryForm.notes}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Optional notes about this salary revision..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>

              {/* Save message */}
              {saveMessage && (
                <div
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${
                    saveMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {saveMessage.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  )}
                  {saveMessage.text}
                </div>
              )}

              {/* Revision History Toggle */}
              {isExisting && (
                <div>
                  <button
                    onClick={toggleRevisions}
                    className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <History className="w-4 h-4" />
                    {showRevisions ? 'Hide' : 'Show'} Revision History
                    {showRevisions ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {showRevisions && (
                    <div className="mt-3 bg-slate-50 rounded-lg border border-slate-200 p-4">
                      {revisionsLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-4 h-4 animate-spin text-slate-400 mr-2" />
                          <span className="text-sm text-slate-400">Loading revisions...</span>
                        </div>
                      ) : revisions.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-4">No revision history found.</p>
                      ) : (
                        <div className="space-y-3">
                          {revisions.map((rev, idx) => (
                            <div
                              key={rev.id || idx}
                              className="flex items-start gap-3 relative"
                            >
                              {/* Timeline dot and line */}
                              <div className="flex flex-col items-center mt-1">
                                <div
                                  className={`w-2.5 h-2.5 rounded-full ${
                                    idx === 0 ? 'bg-blue-500' : 'bg-slate-300'
                                  }`}
                                />
                                {idx < revisions.length - 1 && (
                                  <div className="w-px h-full bg-slate-200 mt-1" />
                                )}
                              </div>
                              <div className="flex-1 pb-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-medium text-slate-700">
                                    {rev.effectiveFrom
                                      ? new Date(rev.effectiveFrom).toLocaleDateString('en-IN', {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric',
                                        })
                                      : rev.createdAt
                                      ? new Date(rev.createdAt).toLocaleDateString('en-IN', {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric',
                                        })
                                      : '—'}
                                  </span>
                                  {rev.oldCtcAnnual != null && rev.newCtcAnnual != null && (
                                    <span className="text-xs text-slate-400">
                                      {formatCurrency(rev.oldCtcAnnual)}{' '}
                                      <span className="mx-1">→</span>{' '}
                                      <span className="font-medium text-slate-600">
                                        {formatCurrency(rev.newCtcAnnual)}
                                      </span>
                                    </span>
                                  )}
                                  {rev.ctcAnnual != null && rev.oldCtcAnnual == null && (
                                    <span className="text-xs text-slate-500">
                                      CTC: {formatCurrency(rev.ctcAnnual)}
                                    </span>
                                  )}
                                </div>
                                {rev.notes && (
                                  <p className="text-xs text-slate-400 mt-0.5">{rev.notes}</p>
                                )}
                                {rev.revisedBy && (
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    By: {rev.revisedBy.name || rev.revisedBy}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          {!formLoading && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/50 rounded-b-xl">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveSalary}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {isExisting ? 'Update Salary' : 'Save Salary'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-blue-600" />
            Salary Structure
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage employee CTC breakdown and salary components
          </p>
        </div>
        <div className="text-sm text-slate-400">
          {employees.length} active employee{employees.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Search & Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {/* Search Bar */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, employee ID, or department..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {renderEmployeeTable()}

        {/* Footer count */}
        {filteredEmployees.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400">
            Showing {filteredEmployees.length} of {employees.length} employees
            {searchQuery && ' (filtered)'}
          </div>
        )}
      </div>

      {/* Modal */}
      {renderModal()}
    </div>
  );
}
