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
  Trash2,
  UserPlus,
  FileText,
  Settings2,
  Lock,
  ToggleLeft,
  ToggleRight,
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

const emptyTemplate = {
  name: '',
  description: '',
  ctcAnnual: '',
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
};

const TABS = [
  { key: 'components', label: 'Components', icon: Settings2 },
  { key: 'templates', label: 'Salary Templates', icon: FileText },
  { key: 'assign', label: 'Assign Structure', icon: UserPlus },
  { key: 'employees', label: 'Employee Salary', icon: IndianRupee },
];

const emptyComponentForm = {
  name: '',
  code: '',
  type: 'earning',
  isTaxable: false,
  isMandatory: false,
  calculationType: 'fixed',
  percentageOf: 'basic',
  defaultPercentage: '',
  description: '',
  complianceNote: '',
};

export default function SalaryStructure() {
  const [activeTab, setActiveTab] = useState('employees');

  // ─── Employee Salary tab state (existing) ───
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
  const [pendingSalary, setPendingSalary] = useState([]);

  // ─── Templates tab state ───
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateForm, setTemplateForm] = useState({ ...emptyTemplate });
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateMsg, setTemplateMsg] = useState(null);

  // ─── Components tab state ───
  const [components, setComponents] = useState([]);
  const [componentsLoading, setComponentsLoading] = useState(false);
  const [showComponentModal, setShowComponentModal] = useState(false);
  const [componentForm, setComponentForm] = useState({ ...emptyComponentForm });
  const [editingComponentId, setEditingComponentId] = useState(null);
  const [componentSaving, setComponentSaving] = useState(false);
  const [componentMsg, setComponentMsg] = useState(null);

  // ─── Assign tab state ───
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [assignEffectiveFrom, setAssignEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState(null);
  const [assignSearch, setAssignSearch] = useState('');

  // ─── Fetch employees ───
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

  // Fetch pending salary
  useEffect(() => {
    api.get('/payroll/pending-salary')
      .then((r) => setPendingSalary(r.data || []))
      .catch(() => {});
  }, []);

  // ─── Fetch templates ───
  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await api.get('/payroll/templates');
      setTemplates(res.data || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // ─── Fetch components ───
  const fetchComponents = useCallback(async () => {
    setComponentsLoading(true);
    try {
      const res = await api.get('/payroll/components');
      setComponents(res.data || []);
    } catch (err) {
      console.error('Failed to fetch components:', err);
    } finally {
      setComponentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComponents();
  }, [fetchComponents]);

  // ─── Filtered employees ───
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

  // Filtered employees for assign tab
  const assignFilteredEmployees = useMemo(() => {
    if (!assignSearch.trim()) return employees;
    const q = assignSearch.toLowerCase();
    return employees.filter(
      (e) =>
        (e.name && e.name.toLowerCase().includes(q)) ||
        (e.employeeId && e.employeeId.toLowerCase().includes(q)) ||
        (e.department && e.department.toLowerCase().includes(q))
    );
  }, [employees, assignSearch]);

  // ─── Calculations (used in both salary modal and template modal) ───
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

  // Template form calculations
  const templateCalcs = useMemo(() => {
    const num = (v) => parseFloat(v) || 0;
    const ctcAnnual = num(templateForm.ctcAnnual);
    const ctcMonthly = ctcAnnual / 12;

    const grossEarnings =
      num(templateForm.basic) +
      num(templateForm.hra) +
      num(templateForm.da) +
      num(templateForm.specialAllowance) +
      num(templateForm.medicalAllowance) +
      num(templateForm.conveyanceAllowance) +
      num(templateForm.otherAllowance);

    const totalDeductions =
      num(templateForm.employeePf) +
      num(templateForm.employeeEsi) +
      num(templateForm.professionalTax) +
      num(templateForm.tds);

    const netPayMonthly = grossEarnings - totalDeductions;

    return { ctcAnnual, ctcMonthly, grossEarnings, totalDeductions, netPayMonthly };
  }, [templateForm]);

  // ──────────────────────────────────────────────
  // Employee Salary tab functions (existing)
  // ──────────────────────────────────────────────

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

  const closeModal = useCallback(() => {
    setShowModal(false);
    setSelectedEmployee(null);
    setSalaryForm({ ...emptySalary });
    setSaveMessage(null);
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setSalaryForm((prev) => ({ ...prev, [name]: value }));
  }, []);

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

  // ──────────────────────────────────────────────
  // Template tab functions
  // ──────────────────────────────────────────────

  const handleTemplateChange = useCallback((e) => {
    const { name, value } = e.target;
    setTemplateForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const openCreateTemplate = useCallback(() => {
    setEditingTemplateId(null);
    setTemplateForm({ ...emptyTemplate });
    setTemplateMsg(null);
    setShowTemplateModal(true);
  }, []);

  const openEditTemplate = useCallback((tpl) => {
    setEditingTemplateId(tpl.id);
    setTemplateForm({
      name: tpl.name || '',
      description: tpl.description || '',
      ctcAnnual: tpl.ctcAnnual || '',
      basic: tpl.basic || '',
      hra: tpl.hra || '',
      da: tpl.da || '',
      specialAllowance: tpl.specialAllowance || '',
      medicalAllowance: tpl.medicalAllowance || '',
      conveyanceAllowance: tpl.conveyanceAllowance || '',
      otherAllowance: tpl.otherAllowance || '',
      otherAllowanceLabel: tpl.otherAllowanceLabel || '',
      employeePf: tpl.employeePf || '',
      employeeEsi: tpl.employeeEsi || '',
      professionalTax: tpl.professionalTax || '',
      tds: tpl.tds || '',
    });
    setTemplateMsg(null);
    setShowTemplateModal(true);
  }, []);

  const closeTemplateModal = useCallback(() => {
    setShowTemplateModal(false);
    setTemplateForm({ ...emptyTemplate });
    setEditingTemplateId(null);
    setTemplateMsg(null);
  }, []);

  const templateQuickFill = useCallback(() => {
    const ctcAnnual = parseFloat(templateForm.ctcAnnual);
    if (!ctcAnnual || ctcAnnual <= 0) {
      setTemplateMsg({ type: 'error', text: 'Enter CTC Annual first to use Quick Fill.' });
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

    setTemplateForm((prev) => ({
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
    setTemplateMsg({ type: 'success', text: 'Quick Fill applied. Review and adjust as needed.' });
  }, [templateForm.ctcAnnual]);

  const saveTemplate = useCallback(async () => {
    if (!templateForm.name.trim()) {
      setTemplateMsg({ type: 'error', text: 'Template name is required.' });
      return;
    }
    setTemplateSaving(true);
    setTemplateMsg(null);

    const payload = {
      name: templateForm.name.trim(),
      description: templateForm.description?.trim() || '',
      ctcAnnual: parseFloat(templateForm.ctcAnnual) || 0,
      basic: parseFloat(templateForm.basic) || 0,
      hra: parseFloat(templateForm.hra) || 0,
      da: parseFloat(templateForm.da) || 0,
      specialAllowance: parseFloat(templateForm.specialAllowance) || 0,
      medicalAllowance: parseFloat(templateForm.medicalAllowance) || 0,
      conveyanceAllowance: parseFloat(templateForm.conveyanceAllowance) || 0,
      otherAllowance: parseFloat(templateForm.otherAllowance) || 0,
      otherAllowanceLabel: templateForm.otherAllowanceLabel || '',
      employeePf: parseFloat(templateForm.employeePf) || 0,
      employeeEsi: parseFloat(templateForm.employeeEsi) || 0,
      professionalTax: parseFloat(templateForm.professionalTax) || 0,
      tds: parseFloat(templateForm.tds) || 0,
    };

    try {
      if (editingTemplateId) {
        await api.put(`/payroll/templates/${editingTemplateId}`, payload);
        setTemplateMsg({ type: 'success', text: 'Template updated successfully.' });
      } else {
        await api.post('/payroll/templates', payload);
        setTemplateMsg({ type: 'success', text: 'Template created successfully.' });
      }
      fetchTemplates();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save template.';
      setTemplateMsg({ type: 'error', text: msg });
    } finally {
      setTemplateSaving(false);
    }
  }, [editingTemplateId, templateForm, fetchTemplates]);

  const deleteTemplate = useCallback(async (id) => {
    if (!window.confirm('Delete this salary template? This cannot be undone.')) return;
    try {
      await api.delete(`/payroll/templates/${id}`);
      fetchTemplates();
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  }, [fetchTemplates]);

  // ──────────────────────────────────────────────
  // Component tab functions
  // ──────────────────────────────────────────────

  const openCreateComponent = useCallback(() => {
    setEditingComponentId(null);
    setComponentForm({ ...emptyComponentForm });
    setComponentMsg(null);
    setShowComponentModal(true);
  }, []);

  const openEditComponent = useCallback((comp) => {
    setEditingComponentId(comp.id);
    setComponentForm({
      name: comp.name || '',
      code: comp.code || '',
      type: comp.type || 'earning',
      isTaxable: comp.isTaxable ?? false,
      isMandatory: comp.isMandatory ?? false,
      calculationType: comp.calculationType || 'fixed',
      percentageOf: comp.percentageOf || 'basic',
      defaultPercentage: comp.defaultPercentage ?? '',
      description: comp.description || '',
      complianceNote: comp.complianceNote || '',
    });
    setComponentMsg(null);
    setShowComponentModal(true);
  }, []);

  const closeComponentModal = useCallback(() => {
    setShowComponentModal(false);
    setComponentForm({ ...emptyComponentForm });
    setEditingComponentId(null);
    setComponentMsg(null);
  }, []);

  const handleComponentChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setComponentForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }, []);

  const saveComponent = useCallback(async () => {
    if (!componentForm.name.trim()) {
      setComponentMsg({ type: 'error', text: 'Component name is required.' });
      return;
    }
    if (!componentForm.code.trim()) {
      setComponentMsg({ type: 'error', text: 'Component code is required.' });
      return;
    }
    setComponentSaving(true);
    setComponentMsg(null);

    const payload = {
      name: componentForm.name.trim(),
      code: componentForm.code.trim().toUpperCase(),
      type: componentForm.type,
      isTaxable: componentForm.isTaxable,
      isMandatory: componentForm.isMandatory,
      calculationType: componentForm.calculationType,
      percentageOf: componentForm.calculationType === 'percentage' ? componentForm.percentageOf : null,
      defaultPercentage: componentForm.calculationType === 'percentage' ? parseFloat(componentForm.defaultPercentage) || 0 : null,
      description: componentForm.description?.trim() || '',
      complianceNote: componentForm.complianceNote?.trim() || '',
    };

    try {
      if (editingComponentId) {
        await api.put(`/payroll/components/${editingComponentId}`, payload);
        setComponentMsg({ type: 'success', text: 'Component updated successfully.' });
      } else {
        await api.post('/payroll/components', payload);
        setComponentMsg({ type: 'success', text: 'Component created successfully.' });
      }
      fetchComponents();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save component.';
      setComponentMsg({ type: 'error', text: msg });
    } finally {
      setComponentSaving(false);
    }
  }, [editingComponentId, componentForm, fetchComponents]);

  const deleteComponent = useCallback(async (id) => {
    if (!window.confirm('Delete this salary component? This cannot be undone.')) return;
    try {
      await api.delete(`/payroll/components/${id}`);
      fetchComponents();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to delete component.';
      setComponentMsg({ type: 'error', text: msg });
    }
  }, [fetchComponents]);

  const toggleComponentActive = useCallback(async (id, isActive) => {
    try {
      await api.put(`/payroll/components/${id}`, { isActive: !isActive });
      fetchComponents();
    } catch (err) {
      console.error('Failed to toggle component:', err);
    }
  }, [fetchComponents]);

  // ──────────────────────────────────────────────
  // Assign tab functions
  // ──────────────────────────────────────────────

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) return null;
    return templates.find((t) => t.id === parseInt(selectedTemplateId));
  }, [selectedTemplateId, templates]);

  const toggleUserSelect = useCallback((userId) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const selectAllUsers = useCallback(() => {
    setSelectedUserIds(new Set(assignFilteredEmployees.map((e) => e.id)));
  }, [assignFilteredEmployees]);

  const deselectAllUsers = useCallback(() => {
    setSelectedUserIds(new Set());
  }, []);

  const assignTemplate = useCallback(async () => {
    if (!selectedTemplateId || selectedUserIds.size === 0) return;
    if (!window.confirm(`Assign this template to ${selectedUserIds.size} employee(s)? This will overwrite their current salary structure.`)) return;

    setAssigning(true);
    setAssignMsg(null);

    try {
      const res = await api.post(`/payroll/templates/${selectedTemplateId}/assign`, {
        userIds: Array.from(selectedUserIds),
        effectiveFrom: assignEffectiveFrom,
      });
      setAssignMsg({ type: 'success', text: res.data?.message || `Template assigned to ${selectedUserIds.size} employee(s).` });
      setSelectedUserIds(new Set());
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to assign template.';
      setAssignMsg({ type: 'error', text: msg });
    } finally {
      setAssigning(false);
    }
  }, [selectedTemplateId, selectedUserIds, assignEffectiveFrom]);

  // ──────────────────────────────────────────────
  // Render: Employee Table (existing)
  // ──────────────────────────────────────────────

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

  // ──────────────────────────────────────────────
  // Render: Salary Modal (existing)
  // ──────────────────────────────────────────────

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
                    <InputField label="Basic Salary" name="basic" value={salaryForm.basic} onChange={handleChange} prefix="₹" />
                    <InputField label="HRA (House Rent Allowance)" name="hra" value={salaryForm.hra} onChange={handleChange} prefix="₹" />
                    <InputField label="Dearness Allowance (DA)" name="da" value={salaryForm.da} onChange={handleChange} prefix="₹" />
                    <InputField label="Special Allowance" name="specialAllowance" value={salaryForm.specialAllowance} onChange={handleChange} prefix="₹" />
                    <InputField label="Medical Allowance" name="medicalAllowance" value={salaryForm.medicalAllowance} onChange={handleChange} prefix="₹" />
                    <InputField label="Conveyance Allowance" name="conveyanceAllowance" value={salaryForm.conveyanceAllowance} onChange={handleChange} prefix="₹" />
                    <div className="grid grid-cols-2 gap-2">
                      <InputField label="Other Allowance" name="otherAllowance" value={salaryForm.otherAllowance} onChange={handleChange} prefix="₹" />
                      <InputField label="Other Allowance Label" name="otherAllowanceLabel" value={salaryForm.otherAllowanceLabel} onChange={handleChange} type="text" placeholder="e.g. Food Allowance" />
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
                    <InputField label="Employee PF" name="employeePf" value={salaryForm.employeePf} onChange={handleChange} prefix="₹" />
                    <InputField label="Employee ESI" name="employeeEsi" value={salaryForm.employeeEsi} onChange={handleChange} prefix="₹" />
                    <InputField label="Professional Tax" name="professionalTax" value={salaryForm.professionalTax} onChange={handleChange} prefix="₹" />
                    <InputField label="TDS (Income Tax)" name="tds" value={salaryForm.tds} onChange={handleChange} prefix="₹" />

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
                                  {rev.oldCtc != null && rev.newCtc != null && (
                                    <span className="text-xs text-slate-400">
                                      {formatCurrency(rev.oldCtc)}{' '}
                                      <span className="mx-1">{'\u2192'}</span>{' '}
                                      <span className="font-medium text-slate-600">
                                        {formatCurrency(rev.newCtc)}
                                      </span>
                                    </span>
                                  )}
                                  {rev.ctcAnnual != null && rev.oldCtc == null && (
                                    <span className="text-xs text-slate-500">
                                      CTC: {formatCurrency(rev.ctcAnnual)}
                                    </span>
                                  )}
                                </div>
                                {rev.notes && (
                                  <p className="text-xs text-slate-400 mt-0.5">{rev.notes}</p>
                                )}
                                {rev.revisedByUser && (
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    By: {rev.revisedByUser?.name}
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

  // ──────────────────────────────────────────────
  // Render: Template Modal
  // ──────────────────────────────────────────────

  const renderTemplateModal = () => {
    if (!showTemplateModal) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto">
        <div className="fixed inset-0 bg-black/40" onClick={closeTemplateModal} />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 z-10">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                {editingTemplateId ? 'Edit Template' : 'Create Salary Template'}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Define a reusable salary structure template
              </p>
            </div>
            <button onClick={closeTemplateModal} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* Name & Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Template Name *"
                name="name"
                value={templateForm.name}
                onChange={handleTemplateChange}
                type="text"
                placeholder="e.g. Junior Engineer, Senior Manager"
              />
              <InputField
                label="Description"
                name="description"
                value={templateForm.description}
                onChange={handleTemplateChange}
                type="text"
                placeholder="Optional description"
              />
            </div>

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
                    value={templateForm.ctcAnnual}
                    onChange={handleTemplateChange}
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
                  {formatCurrency(templateCalcs.ctcMonthly)}
                </div>
              </div>
              <button
                onClick={templateQuickFill}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-lg text-sm font-medium transition-colors"
                title="Auto-distribute CTC across components"
              >
                <Zap className="w-4 h-4" />
                Quick Fill
              </button>
            </div>

            {/* Two-column layout: Earnings & Deductions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Earnings */}
              <div className="bg-emerald-50/50 rounded-xl border border-emerald-100 p-4">
                <h3 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-1.5">
                  <ChevronUp className="w-4 h-4" />
                  Earnings (Monthly)
                </h3>
                <div className="space-y-3">
                  <InputField label="Basic Salary" name="basic" value={templateForm.basic} onChange={handleTemplateChange} prefix="₹" />
                  <InputField label="HRA" name="hra" value={templateForm.hra} onChange={handleTemplateChange} prefix="₹" />
                  <InputField label="DA" name="da" value={templateForm.da} onChange={handleTemplateChange} prefix="₹" />
                  <InputField label="Special Allowance" name="specialAllowance" value={templateForm.specialAllowance} onChange={handleTemplateChange} prefix="₹" />
                  <InputField label="Medical Allowance" name="medicalAllowance" value={templateForm.medicalAllowance} onChange={handleTemplateChange} prefix="₹" />
                  <InputField label="Conveyance Allowance" name="conveyanceAllowance" value={templateForm.conveyanceAllowance} onChange={handleTemplateChange} prefix="₹" />
                  <div className="grid grid-cols-2 gap-2">
                    <InputField label="Other Allowance" name="otherAllowance" value={templateForm.otherAllowance} onChange={handleTemplateChange} prefix="₹" />
                    <InputField label="Other Label" name="otherAllowanceLabel" value={templateForm.otherAllowanceLabel} onChange={handleTemplateChange} type="text" placeholder="e.g. Food" />
                  </div>
                  <div className="pt-2 border-t border-emerald-200 flex justify-between items-center">
                    <span className="text-sm font-semibold text-emerald-800">Gross Earnings</span>
                    <span className="text-base font-bold text-emerald-700">{formatCurrencyDetailed(templateCalcs.grossEarnings)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div className="bg-red-50/50 rounded-xl border border-red-100 p-4">
                <h3 className="text-sm font-bold text-red-800 mb-3 flex items-center gap-1.5">
                  <ChevronDown className="w-4 h-4" />
                  Deductions (Monthly)
                </h3>
                <div className="space-y-3">
                  <InputField label="Employee PF" name="employeePf" value={templateForm.employeePf} onChange={handleTemplateChange} prefix="₹" />
                  <InputField label="Employee ESI" name="employeeEsi" value={templateForm.employeeEsi} onChange={handleTemplateChange} prefix="₹" />
                  <InputField label="Professional Tax" name="professionalTax" value={templateForm.professionalTax} onChange={handleTemplateChange} prefix="₹" />
                  <InputField label="TDS" name="tds" value={templateForm.tds} onChange={handleTemplateChange} prefix="₹" />
                  <div className="pt-2 border-t border-red-200 flex justify-between items-center">
                    <span className="text-sm font-semibold text-red-800">Total Deductions</span>
                    <span className="text-base font-bold text-red-600">{formatCurrencyDetailed(templateCalcs.totalDeductions)}</span>
                  </div>
                </div>

                {/* Net Pay Summary */}
                <div className="mt-4 bg-white rounded-lg border border-slate-200 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Gross Earnings</span>
                    <span className="font-medium text-slate-700">{formatCurrencyDetailed(templateCalcs.grossEarnings)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Total Deductions</span>
                    <span className="font-medium text-red-600">- {formatCurrencyDetailed(templateCalcs.totalDeductions)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex justify-between">
                    <span className="text-sm font-bold text-slate-700">Net Pay (Monthly)</span>
                    <span className={`text-lg font-bold ${templateCalcs.netPayMonthly >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrencyDetailed(templateCalcs.netPayMonthly)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Template message */}
            {templateMsg && (
              <div
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${
                  templateMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {templateMsg.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                {templateMsg.text}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/50 rounded-b-xl">
            <button
              onClick={closeTemplateModal}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveTemplate}
              disabled={templateSaving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {templateSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {editingTemplateId ? 'Update Template' : 'Create Template'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ──────────────────────────────────────────────
  // Render: Components Tab Content
  // ──────────────────────────────────────────────

  const renderComponentSection = (title, emoji, type) => {
    const filtered = components.filter((c) => c.type === type);
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <h3 className="font-semibold text-slate-700 text-sm">{title}</h3>
          <span className="text-xs text-slate-400 ml-auto">{filtered.length} component{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">No {type} components yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60">
                  <th className="text-left py-2.5 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Code</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Name</th>
                  <th className="text-center py-2.5 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Taxable</th>
                  <th className="text-center py-2.5 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Mandatory</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Calculation</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Compliance</th>
                  <th className="text-center py-2.5 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Active</th>
                  <th className="text-right py-2.5 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((comp) => (
                  <tr key={comp.id} className="hover:bg-blue-50/40 transition-colors duration-150">
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-100 text-slate-700">
                        {comp.code}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">{comp.name}</td>
                    <td className="py-2.5 px-4 text-center">
                      {comp.isTaxable ? (
                        <span className="text-emerald-600 font-bold">✓</span>
                      ) : (
                        <span className="text-red-400 font-bold">✕</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {comp.isMandatory ? (
                        <span className="text-emerald-600 font-bold">✓</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 text-xs">
                      {comp.calculationType === 'percentage' ? (
                        <span>
                          {comp.defaultPercentage ?? 0}% of{' '}
                          <span className="capitalize">{comp.percentageOf || 'basic'}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">Fixed</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 text-xs max-w-[150px] truncate" title={comp.complianceNote || ''}>
                      {comp.complianceNote || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => toggleComponentActive(comp.id, comp.isActive)}
                        className="inline-flex items-center"
                        title={comp.isActive ? 'Click to deactivate' : 'Click to activate'}
                      >
                        {comp.isActive ? (
                          <ToggleRight className="w-6 h-6 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-slate-300" />
                        )}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditComponent(comp)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit component"
                        >
                          <Edit3 className="w-4 h-4 text-slate-500" />
                        </button>
                        {comp.isSystem ? (
                          <span className="p-1.5" title="System component — cannot delete">
                            <Lock className="w-4 h-4 text-slate-300" />
                          </span>
                        ) : (
                          <button
                            onClick={() => deleteComponent(comp.id)}
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete component"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderComponentsTab = () => (
    <div className="space-y-4">
      {/* Header with Create button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Define salary components (earnings, deductions, employer contributions) used in salary structures.
        </p>
        <button
          onClick={openCreateComponent}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          Add Component
        </button>
      </div>

      {/* Component message */}
      {componentMsg && (
        <div
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${
            componentMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {componentMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {componentMsg.text}
        </div>
      )}

      {componentsLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
          <span className="text-slate-500">Loading components...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {renderComponentSection('Earnings', '💰', 'earning')}
          {renderComponentSection('Deductions', '📉', 'deduction')}
          {renderComponentSection('Employer Contributions', '🏢', 'employer')}
        </div>
      )}
    </div>
  );

  // ──────────────────────────────────────────────
  // Render: Component Modal
  // ──────────────────────────────────────────────

  const renderComponentModal = () => {
    if (!showComponentModal) return null;

    const isSystemComponent = editingComponentId && components.find((c) => c.id === editingComponentId)?.isSystem;

    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto">
        <div className="fixed inset-0 bg-black/40" onClick={closeComponentModal} />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 z-10">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-blue-600" />
                {editingComponentId ? 'Edit Component' : 'Add Salary Component'}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {editingComponentId ? 'Update component details' : 'Define a new salary component'}
              </p>
            </div>
            <button onClick={closeComponentModal} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Name & Code */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
                <input
                  type="text"
                  name="name"
                  value={componentForm.name}
                  onChange={handleComponentChange}
                  placeholder="e.g. Basic Salary"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Code *</label>
                <input
                  type="text"
                  name="code"
                  value={componentForm.code}
                  onChange={handleComponentChange}
                  placeholder="e.g. BASIC"
                  disabled={isSystemComponent}
                  className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    isSystemComponent ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''
                  }`}
                />
              </div>
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type *</label>
              <select
                name="type"
                value={componentForm.type}
                onChange={handleComponentChange}
                disabled={isSystemComponent}
                className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  isSystemComponent ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''
                }`}
              >
                <option value="earning">Earning</option>
                <option value="deduction">Deduction</option>
                <option value="employer">Employer Contribution</option>
              </select>
            </div>

            {/* Checkboxes */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  name="isTaxable"
                  checked={componentForm.isTaxable}
                  onChange={handleComponentChange}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Taxable
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  name="isMandatory"
                  checked={componentForm.isMandatory}
                  onChange={handleComponentChange}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Mandatory
              </label>
            </div>

            {/* Calculation Type */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Calculation Type</label>
              <select
                name="calculationType"
                value={componentForm.calculationType}
                onChange={handleComponentChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="fixed">Fixed Amount</option>
                <option value="percentage">Percentage</option>
              </select>
            </div>

            {/* Percentage fields (conditional) */}
            {componentForm.calculationType === 'percentage' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Percentage Of</label>
                  <select
                    name="percentageOf"
                    value={componentForm.percentageOf}
                    onChange={handleComponentChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="basic">Basic</option>
                    <option value="gross">Gross</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Default Percentage (%)</label>
                  <input
                    type="number"
                    name="defaultPercentage"
                    value={componentForm.defaultPercentage}
                    onChange={handleComponentChange}
                    placeholder="e.g. 12"
                    min="0"
                    max="100"
                    step="any"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
              <input
                type="text"
                name="description"
                value={componentForm.description}
                onChange={handleComponentChange}
                placeholder="Short description of this component"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Compliance Note */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Compliance Note</label>
              <textarea
                name="complianceNote"
                value={componentForm.complianceNote}
                onChange={handleComponentChange}
                placeholder="Statutory or compliance notes (e.g. Section 80C, EPF Act)"
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* Component message */}
            {componentMsg && (
              <div
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${
                  componentMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {componentMsg.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                {componentMsg.text}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/50 rounded-b-xl">
            <button
              onClick={closeComponentModal}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveComponent}
              disabled={componentSaving}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {componentSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {editingComponentId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ──────────────────────────────────────────────
  // Render: Templates Tab Content
  // ──────────────────────────────────────────────

  const renderTemplatesTab = () => (
    <div className="space-y-4">
      {/* Header with Create button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Create reusable salary templates that can be quickly assigned to employees.
        </p>
        <button
          onClick={openCreateTemplate}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          Create Template
        </button>
      </div>

      {/* Templates table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {templatesLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
            <span className="text-slate-500">Loading templates...</span>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No salary templates yet.</p>
            <p className="text-slate-400 text-xs mt-1">Create one to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60">
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Description</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">CTC Annual</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Basic</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">HRA</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Net Pay</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map((tpl) => {
                  const num = (v) => parseFloat(v) || 0;
                  const gross = num(tpl.basic) + num(tpl.hra) + num(tpl.da) + num(tpl.specialAllowance) + num(tpl.medicalAllowance) + num(tpl.conveyanceAllowance) + num(tpl.otherAllowance);
                  const ded = num(tpl.employeePf) + num(tpl.employeeEsi) + num(tpl.professionalTax) + num(tpl.tds);
                  const net = gross - ded;
                  return (
                    <tr key={tpl.id} className="hover:bg-blue-50/40 transition-colors duration-150">
                      <td className="py-3 px-4 font-medium text-slate-800">{tpl.name}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs max-w-[200px] truncate">{tpl.description || '—'}</td>
                      <td className="py-3 px-4 text-emerald-700 font-medium">{formatCurrency(tpl.ctcAnnual)}</td>
                      <td className="py-3 px-4 text-slate-600">{formatCurrency(tpl.basic)}</td>
                      <td className="py-3 px-4 text-slate-600">{formatCurrency(tpl.hra)}</td>
                      <td className="py-3 px-4">
                        <span className={`font-medium ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatCurrency(net)}
                        </span>
                        <span className="text-slate-400 text-xs"> /mo</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditTemplate(tpl)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit template"
                          >
                            <Edit3 className="w-4 h-4 text-slate-500" />
                          </button>
                          <button
                            onClick={() => deleteTemplate(tpl.id)}
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete template"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
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
    </div>
  );

  // ──────────────────────────────────────────────
  // Render: Assign Tab Content
  // ──────────────────────────────────────────────

  const renderAssignTab = () => (
    <div className="space-y-4">
      {/* Assign message */}
      {assignMsg && (
        <div
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${
            assignMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {assignMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {assignMsg.text}
        </div>
      )}

      {/* Template selector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">1. Select a Salary Template</h3>
        {templates.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No templates available. Create one in the Salary Templates tab first.</p>
          </div>
        ) : (
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full max-w-md border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">-- Select a template --</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {formatCurrency(t.ctcAnnual)}/yr
              </option>
            ))}
          </select>
        )}

        {/* Template summary card */}
        {selectedTemplate && (
          <div className="mt-4 bg-blue-50/50 rounded-lg border border-blue-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-bold text-blue-800">{selectedTemplate.name}</span>
              {selectedTemplate.description && (
                <span className="text-xs text-blue-500">— {selectedTemplate.description}</span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500">CTC Annual</span>
                <div className="font-semibold text-slate-700">{formatCurrency(selectedTemplate.ctcAnnual)}</div>
              </div>
              <div>
                <span className="text-slate-500">Basic</span>
                <div className="font-semibold text-slate-700">{formatCurrency(selectedTemplate.basic)}</div>
              </div>
              <div>
                <span className="text-slate-500">HRA</span>
                <div className="font-semibold text-slate-700">{formatCurrency(selectedTemplate.hra)}</div>
              </div>
              <div>
                <span className="text-slate-500">Special Allowance</span>
                <div className="font-semibold text-slate-700">{formatCurrency(selectedTemplate.specialAllowance)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Employee selection */}
      {selectedTemplateId && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-sm font-bold text-slate-700 mb-3">2. Select Employees</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  placeholder="Search employees..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={selectAllUsers}
                className="px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                Select All
              </button>
              <button
                onClick={deselectAllUsers}
                className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Deselect All
              </button>
              <span className="text-xs text-slate-400">
                {selectedUserIds.size} selected
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
              <span className="text-slate-500 text-sm">Loading...</span>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-y border-slate-200 bg-slate-50/60">
                    <th className="w-10 py-3 px-4">
                      <input
                        type="checkbox"
                        checked={assignFilteredEmployees.length > 0 && assignFilteredEmployees.every((e) => selectedUserIds.has(e.id))}
                        onChange={(e) => {
                          if (e.target.checked) selectAllUsers();
                          else deselectAllUsers();
                        }}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Employee</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Department</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Designation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignFilteredEmployees.map((emp) => (
                    <tr
                      key={emp.id}
                      className={`cursor-pointer transition-colors duration-150 ${
                        selectedUserIds.has(emp.id)
                          ? 'bg-blue-50/60'
                          : 'hover:bg-slate-50'
                      }`}
                      onClick={() => toggleUserSelect(emp.id)}
                    >
                      <td className="py-2.5 px-4">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(emp.id)}
                          onChange={() => toggleUserSelect(emp.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-800">{emp.name}</div>
                        <div className="text-xs text-slate-400">{emp.employeeId || emp.email}</div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{emp.department || '—'}</td>
                      <td className="py-2.5 px-4 text-slate-600">{emp.designation || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Effective date & Assign button */}
      {selectedTemplateId && selectedUserIds.size > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">3. Set Effective Date & Assign</h3>
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Effective From</label>
              <input
                type="date"
                value={assignEffectiveFrom}
                onChange={(e) => setAssignEffectiveFrom(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={assignTemplate}
              disabled={assigning}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {assigning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Assign to {selectedUserIds.size} Employee{selectedUserIds.size !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ──────────────────────────────────────────────
  // Render: Employee Salary Tab Content (existing, wrapped)
  // ──────────────────────────────────────────────

  const renderEmployeesTab = () => (
    <div className="space-y-4">
      {/* Pending Salary Banner */}
      {pendingSalary.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800">
              {pendingSalary.length} active employee{pendingSalary.length !== 1 ? 's have' : ' has'} no salary structure assigned
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {pendingSalary.map((e) => e.name).join(', ')}
            </p>
          </div>
        </div>
      )}

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
    </div>
  );

  // ──────────────────────────────────────────────
  // Main return
  // ──────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
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

      {/* Tabs */}
      <div className="px-6">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-6">
        {activeTab === 'components' && renderComponentsTab()}
        {activeTab === 'templates' && renderTemplatesTab()}
        {activeTab === 'assign' && renderAssignTab()}
        {activeTab === 'employees' && renderEmployeesTab()}
      </div>

      {/* Modals */}
      {renderModal()}
      {renderTemplateModal()}
      {renderComponentModal()}
    </div>
  );
}
