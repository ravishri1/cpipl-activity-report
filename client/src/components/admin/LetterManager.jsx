import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  FileSignature,
  Plus,
  Edit,
  Printer,
  Eye,
  FileText,
  ChevronDown,
  Search,
  X,
  Check,
  Loader2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Copy,
} from 'lucide-react';

const LETTER_TYPES = [
  { value: 'offer', label: 'Offer Letter' },
  { value: 'appointment', label: 'Appointment Letter' },
  { value: 'salary_revision', label: 'Salary Revision' },
  { value: 'experience', label: 'Experience Letter' },
  { value: 'relieving', label: 'Relieving Letter' },
  { value: 'custom', label: 'Custom' },
];

const TYPE_COLORS = {
  offer: 'bg-green-100 text-green-700',
  appointment: 'bg-blue-100 text-blue-700',
  salary_revision: 'bg-amber-100 text-amber-700',
  experience: 'bg-purple-100 text-purple-700',
  relieving: 'bg-red-100 text-red-700',
  custom: 'bg-slate-100 text-slate-700',
};

const PLACEHOLDERS = [
  { key: '{{name}}', desc: 'Employee full name' },
  { key: '{{employeeId}}', desc: 'Employee ID' },
  { key: '{{designation}}', desc: 'Job designation' },
  { key: '{{department}}', desc: 'Department name' },
  { key: '{{dateOfJoining}}', desc: 'Date of joining' },
  { key: '{{company.name}}', desc: 'Company name' },
  { key: '{{company.address}}', desc: 'Company address' },
  { key: '{{ctcAnnual}}', desc: 'Annual CTC' },
  { key: '{{ctcMonthly}}', desc: 'Monthly CTC' },
  { key: '{{date}}', desc: 'Current date' },
  { key: '{{email}}', desc: 'Employee email' },
  { key: '{{phone}}', desc: 'Phone number' },
];

const EMPTY_TEMPLATE = {
  name: '',
  type: 'offer',
  content: '',
  isActive: true,
};

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getTypeLabel(type) {
  return LETTER_TYPES.find((t) => t.value === type)?.label || type;
}

// ─── Template Form Modal ──────────────────────────────────────────────
function TemplateModal({ template, onClose, onSaved }) {
  const isEdit = !!template?.id;
  const [form, setForm] = useState(
    isEdit
      ? { name: template.name, type: template.type, content: template.content, isActive: template.isActive }
      : { ...EMPTY_TEMPLATE }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const textareaRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const insertPlaceholder = (placeholder) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = form.content.substring(0, start);
    const after = form.content.substring(end);
    const newContent = before + placeholder + after;
    setForm((f) => ({ ...f, content: newContent }));
    setTimeout(() => {
      ta.focus();
      const pos = start + placeholder.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Template name is required.');
    if (!form.content.trim()) return setError('Template content is required.');
    setError('');
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/letters/templates/${template.id}`, form);
      } else {
        await api.post('/letters/templates', form);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            {isEdit ? <Edit className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
            {isEdit ? 'Edit Template' : 'New Template'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Template Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Standard Offer Letter"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Letter Type</label>
              <div className="relative">
                <select
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                >
                  {LETTER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
              className="flex items-center gap-2 text-sm"
            >
              {form.isActive ? (
                <ToggleRight className="w-6 h-6 text-blue-600" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-slate-400" />
              )}
              <span className={form.isActive ? 'text-blue-700 font-medium' : 'text-slate-500'}>
                {form.isActive ? 'Active' : 'Inactive'}
              </span>
            </button>
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">
                Template Content <span className="text-slate-400 font-normal">(HTML with placeholders)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPlaceholders((v) => !v)}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                {showPlaceholders ? 'Hide' : 'Show'} Placeholders
              </button>
            </div>

            {showPlaceholders && (
              <div className="mb-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-xs font-medium text-slate-500 mb-2">Click a placeholder to insert at cursor position:</p>
                <div className="flex flex-wrap gap-1.5">
                  {PLACEHOLDERS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => insertPlaceholder(p.key)}
                      title={p.desc}
                      className="px-2 py-1 text-xs font-mono bg-white border border-slate-200 rounded hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                    >
                      {p.key}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              ref={textareaRef}
              name="content"
              value={form.content}
              onChange={handleChange}
              rows={14}
              placeholder={`<div style="font-family: Arial, sans-serif; padding: 40px;">\n  <h2>Offer Letter</h2>\n  <p>Dear {{name}},</p>\n  <p>We are pleased to offer you the position of {{designation}}...</p>\n</div>`}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isEdit ? 'Update Template' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Letter Preview Modal ─────────────────────────────────────────────
function LetterPreviewModal({ letter, onClose }) {
  const printRef = useRef(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank', 'width=800,height=1000');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${letter.templateName || 'Letter'}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
          .print-content { padding: 20px; }
        </style>
      </head>
      <body>
        <div class="print-content">${letter.content}</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-600" />
              Letter Preview
            </h2>
            {letter.templateName && (
              <p className="text-sm text-slate-500 mt-0.5">{letter.templateName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Letter content - A4 style */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
          <div
            ref={printRef}
            className="mx-auto bg-white shadow-lg border border-slate-200 rounded"
            style={{
              maxWidth: '210mm',
              minHeight: '297mm',
              padding: '20mm',
            }}
          >
            <div dangerouslySetInnerHTML={{ __html: letter.content }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────
export default function LetterManager() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('templates');

  // ── Templates state ──
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // ── Generate state ──
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [generatedLetter, setGeneratedLetter] = useState(null);

  // ── Employee letters history ──
  const [employeeLetters, setEmployeeLetters] = useState([]);
  const [lettersLoading, setLettersLoading] = useState(false);

  // ── Preview modal ──
  const [previewLetter, setPreviewLetter] = useState(null);

  const employeeDropdownRef = useRef(null);

  // ── Fetch templates ──
  const fetchTemplates = useCallback(async () => {
    try {
      setTemplatesError('');
      const res = await api.get('/letters/templates');
      setTemplates(res.data);
    } catch (err) {
      setTemplatesError(err.response?.data?.error || 'Failed to load templates.');
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  // ── Fetch employees ──
  const fetchEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    try {
      const res = await api.get('/users');
      setEmployees(res.data);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  // ── Fetch letters for selected employee ──
  const fetchEmployeeLetters = useCallback(async (userId) => {
    if (!userId) {
      setEmployeeLetters([]);
      return;
    }
    setLettersLoading(true);
    try {
      const res = await api.get(`/letters/employee/${userId}`);
      setEmployeeLetters(res.data);
    } catch (err) {
      console.error('Failed to fetch letters:', err);
      setEmployeeLetters([]);
    } finally {
      setLettersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (activeTab === 'generate') {
      fetchEmployees();
      fetchTemplates();
    }
  }, [activeTab, fetchEmployees, fetchTemplates]);

  useEffect(() => {
    if (selectedEmployee) {
      fetchEmployeeLetters(selectedEmployee.id);
    }
  }, [selectedEmployee, fetchEmployeeLetters]);

  // ── Close employee dropdown on click outside ──
  useEffect(() => {
    function handleClickOutside(e) {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(e.target)) {
        setShowEmployeeDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Filtered templates ──
  const filteredTemplates = templates.filter((t) => {
    if (!templateSearch) return true;
    const q = templateSearch.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.type.toLowerCase().includes(q) ||
      getTypeLabel(t.type).toLowerCase().includes(q)
    );
  });

  // ── Filtered employees for dropdown ──
  const filteredEmployees = employees.filter((e) => {
    if (!employeeSearch) return true;
    const q = employeeSearch.toLowerCase();
    return (
      e.name?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q) ||
      e.employeeId?.toLowerCase().includes(q)
    );
  });

  // ── Active templates for generate dropdown ──
  const activeTemplates = templates.filter((t) => t.isActive !== false);

  // ── Generate letter ──
  const handleGenerate = async () => {
    if (!selectedEmployee) return setGenerateError('Please select an employee.');
    if (!selectedTemplateId) return setGenerateError('Please select a template.');
    setGenerateError('');
    setGenerating(true);
    setGeneratedLetter(null);
    try {
      const res = await api.post('/letters/generate', {
        userId: selectedEmployee.id,
        templateId: parseInt(selectedTemplateId, 10),
      });
      setGeneratedLetter(res.data);
      fetchEmployeeLetters(selectedEmployee.id);
    } catch (err) {
      setGenerateError(err.response?.data?.error || 'Failed to generate letter.');
    } finally {
      setGenerating(false);
    }
  };

  // ── Print generated letter ──
  const handlePrintGenerated = () => {
    if (!generatedLetter?.content) return;
    const printWindow = window.open('', '_blank', 'width=800,height=1000');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Letter</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
          .print-content { padding: 20px; }
        </style>
      </head>
      <body>
        <div class="print-content">${generatedLetter.content}</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  // ── Select employee ──
  const selectEmployee = (emp) => {
    setSelectedEmployee(emp);
    setEmployeeSearch(emp.name || emp.email);
    setShowEmployeeDropdown(false);
    setGeneratedLetter(null);
  };

  // ── Template toggle active ──
  const handleToggleActive = async (template) => {
    try {
      await api.put(`/letters/templates/${template.id}`, {
        ...template,
        isActive: !template.isActive,
      });
      fetchTemplates();
    } catch (err) {
      console.error('Failed to toggle template:', err);
    }
  };

  // ── Render: Templates Tab ──
  const renderTemplatesTab = () => (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={templateSearch}
            onChange={(e) => setTemplateSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {templateSearch && (
            <button
              onClick={() => setTemplateSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => {
            setEditingTemplate(null);
            setShowTemplateModal(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add Template
        </button>
      </div>

      {/* Templates table */}
      {templatesLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          <span className="ml-2 text-sm text-slate-500">Loading templates...</span>
        </div>
      ) : templatesError ? (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {templatesError}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            {templateSearch ? 'No templates match your search.' : 'No letter templates yet. Create your first template.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Template Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Created</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTemplates.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileSignature className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800">{t.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          TYPE_COLORS[t.type] || TYPE_COLORS.custom
                        }`}
                      >
                        {getTypeLabel(t.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(t)}
                        title={t.isActive !== false ? 'Active - click to deactivate' : 'Inactive - click to activate'}
                      >
                        {t.isActive !== false ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                            Inactive
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingTemplate(t);
                            setShowTemplateModal(true);
                          }}
                          title="Edit template"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            setPreviewLetter({
                              content: t.content,
                              templateName: t.name,
                            })
                          }
                          title="Preview template"
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
            {templateSearch ? ` matching "${templateSearch}"` : ''}
          </div>
        </div>
      )}
    </div>
  );

  // ── Render: Generate Tab ──
  const renderGenerateTab = () => (
    <div className="space-y-6">
      {/* Form card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-blue-600" />
          Generate Letter
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Employee search/select */}
          <div ref={employeeDropdownRef} className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={employeeSearch}
                onChange={(e) => {
                  setEmployeeSearch(e.target.value);
                  setShowEmployeeDropdown(true);
                  if (!e.target.value) {
                    setSelectedEmployee(null);
                    setEmployeeLetters([]);
                    setGeneratedLetter(null);
                  }
                }}
                onFocus={() => setShowEmployeeDropdown(true)}
                placeholder="Search by name, email, or ID..."
                className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {selectedEmployee && (
                <button
                  onClick={() => {
                    setSelectedEmployee(null);
                    setEmployeeSearch('');
                    setEmployeeLetters([]);
                    setGeneratedLetter(null);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dropdown */}
            {showEmployeeDropdown && !selectedEmployee && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {employeesLoading ? (
                  <div className="flex items-center gap-2 px-3 py-4 text-sm text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-slate-500 text-center">No employees found.</div>
                ) : (
                  filteredEmployees.slice(0, 20).map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => selectEmployee(emp)}
                      className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center gap-3 border-b border-slate-50 last:border-0 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {(emp.name || emp.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{emp.name || 'Unnamed'}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {emp.email}
                          {emp.employeeId ? ` - ${emp.employeeId}` : ''}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Template select */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Template</label>
            <div className="relative">
              <select
                value={selectedTemplateId}
                onChange={(e) => {
                  setSelectedTemplateId(e.target.value);
                  setGeneratedLetter(null);
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="">Select a template...</option>
                {activeTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({getTypeLabel(t.type)})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Selected employee info */}
        {selectedEmployee && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-sm font-bold shrink-0">
              {(selectedEmployee.name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-blue-900">{selectedEmployee.name || 'Unnamed'}</p>
              <p className="text-xs text-blue-700">
                {selectedEmployee.email}
                {selectedEmployee.designation ? ` | ${selectedEmployee.designation}` : ''}
                {selectedEmployee.department ? ` | ${selectedEmployee.department}` : ''}
              </p>
            </div>
          </div>
        )}

        {generateError && (
          <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {generateError}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={generating || !selectedEmployee || !selectedTemplateId}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileSignature className="w-4 h-4" />
          )}
          {generating ? 'Generating...' : 'Generate Letter'}
        </button>
      </div>

      {/* Generated letter preview */}
      {generatedLetter && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Eye className="w-5 h-5 text-green-600" />
              Generated Letter Preview
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintGenerated}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={() =>
                  setPreviewLetter({
                    content: generatedLetter.content,
                    templateName: generatedLetter.templateName || 'Generated Letter',
                  })
                }
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors"
              >
                <Eye className="w-4 h-4" />
                Full View
              </button>
            </div>
          </div>

          {/* A4-like preview */}
          <div className="p-6 bg-slate-100">
            <div
              className="mx-auto bg-white shadow-lg border border-slate-200 rounded"
              style={{
                maxWidth: '210mm',
                minHeight: '200mm',
                padding: '20mm',
              }}
            >
              <div dangerouslySetInnerHTML={{ __html: generatedLetter.content }} />
            </div>
          </div>
        </div>
      )}

      {/* Previously generated letters */}
      {selectedEmployee && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-500" />
              Letter History
              {selectedEmployee && (
                <span className="text-sm font-normal text-slate-500">
                  for {selectedEmployee.name || selectedEmployee.email}
                </span>
              )}
            </h3>
          </div>

          {lettersLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              <span className="ml-2 text-sm text-slate-500">Loading letters...</span>
            </div>
          ) : employeeLetters.length === 0 ? (
            <div className="text-center py-10">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No letters generated for this employee yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Letter</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Generated On</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employeeLetters.map((letter) => (
                    <tr key={letter.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800">
                          {letter.templateName || letter.template?.name || 'Letter'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            TYPE_COLORS[letter.type || letter.template?.type] || TYPE_COLORS.custom
                          }`}
                        >
                          {getTypeLabel(letter.type || letter.template?.type || 'custom')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(letter.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() =>
                              setPreviewLetter({
                                content: letter.content,
                                templateName: letter.templateName || letter.template?.name || 'Letter',
                              })
                            }
                            title="View letter"
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              const pw = window.open('', '_blank', 'width=800,height=1000');
                              pw.document.write(`
                                <!DOCTYPE html>
                                <html>
                                <head>
                                  <title>${letter.templateName || 'Letter'}</title>
                                  <style>
                                    @page { size: A4; margin: 15mm; }
                                    body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
                                    .print-content { padding: 20px; }
                                  </style>
                                </head>
                                <body>
                                  <div class="print-content">${letter.content}</div>
                                </body>
                                </html>
                              `);
                              pw.document.close();
                              pw.focus();
                              setTimeout(() => {
                                pw.print();
                                pw.close();
                              }, 300);
                            }}
                            title="Print letter"
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                {employeeLetters.length} letter{employeeLetters.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ─── Main Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <FileSignature className="w-6 h-6 text-blue-600" />
          Letter Manager
        </h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-0 -mb-px">
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              Templates
            </span>
          </button>
          <button
            onClick={() => setActiveTab('generate')}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'generate'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <FileSignature className="w-4 h-4" />
              Generate Letter
            </span>
          </button>
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'templates' ? renderTemplatesTab() : renderGenerateTab()}

      {/* Template modal */}
      {showTemplateModal && (
        <TemplateModal
          template={editingTemplate}
          onClose={() => {
            setShowTemplateModal(false);
            setEditingTemplate(null);
          }}
          onSaved={fetchTemplates}
        />
      )}

      {/* Preview modal */}
      {previewLetter && (
        <LetterPreviewModal
          letter={previewLetter}
          onClose={() => setPreviewLetter(null)}
        />
      )}
    </div>
  );
}
