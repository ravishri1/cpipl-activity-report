import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import {
  Building2, Plus, Edit2, ChevronRight, X, Loader2,
  MapPin, Hash, Shield, AlertCircle, Check, Globe,
  FileText, RefreshCw, Building,
} from 'lucide-react';
import AlertMessage from '../shared/AlertMessage';
import LoadingSpinner from '../shared/LoadingSpinner';

// ─── Small Helpers ────────────────────────────────────────────────────────────
function InputField({ label, value, onChange, placeholder, required = false, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function SelectField({ label, value, onChange, options, required = false }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">— Select —</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Legal Entity Modal ───────────────────────────────────────────────────────
function LegalEntityModal({ entity, onClose, onSaved }) {
  const [form, setForm] = useState({
    legalName: entity?.legalName || '',
    pan:       entity?.pan       || '',
    tan:       entity?.tan       || '',
    lei:       entity?.lei       || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.legalName.trim()) { setError('Legal name is required.'); return; }
    setSaving(true); setError(null);
    try {
      if (entity) {
        await api.put(`/company-master/legal-entities/${entity.id}`, form);
      } else {
        await api.post('/company-master/legal-entities', form);
      }
      onSaved();
    } catch (err) {
      setError(String(err.response?.data?.error || 'Failed to save entity.'));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            {entity ? 'Edit Legal Entity' : 'Add Legal Entity'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && <AlertMessage type="error" message={error} />}
          <InputField label="Legal Name" value={form.legalName}
            onChange={v => setField('legalName', v)}
            placeholder="e.g. Color Papers India Pvt. Ltd." required />
          <InputField label="PAN" value={form.pan}
            onChange={v => setField('pan', v.toUpperCase())}
            placeholder="e.g. AAJCC2415M" hint="10-character PAN number" />
          <InputField label="TAN" value={form.tan}
            onChange={v => setField('tan', v.toUpperCase())}
            placeholder="e.g. PNEC15279F" hint="Tax Deduction Account Number" />
          <InputField label="LEI" value={form.lei}
            onChange={v => setField('lei', v.toUpperCase())}
            placeholder="e.g. 9845004936B8T0DFE094" hint="Legal Entity Identifier (yearly renewal)" />
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg
                       hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {entity ? 'Save Changes' : 'Create Entity'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Registration Modal ───────────────────────────────────────────────────────
function RegistrationModal({ registration, entities, onClose, onSaved }) {
  const [form, setForm] = useState({
    legalEntityId:  String(registration?.legalEntityId || ''),
    gstin:          registration?.gstin      || '',
    officeCity:     registration?.officeCity || '',
    state:          registration?.state      || '',
    district:       registration?.district   || '',
    placeType:      registration?.placeType  || 'Principal',
    address:        registration?.address    || '',
    fssai:          registration?.fssai      || '',
    udyam:          registration?.udyam      || '',
    iec:            registration?.iec        || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const [abbrPreview, setAbbrPreview] = useState(registration?.abbr || '');

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Live abbr preview via API
  const fetchAbbrPreview = useCallback(async (f) => {
    if (!f.gstin || f.gstin.length !== 15 || !f.legalEntityId || !f.officeCity) {
      setAbbrPreview('');
      return;
    }
    try {
      const res = await api.get(`/company-master/abbr-preview?gstin=${f.gstin}&legalEntityId=${f.legalEntityId}&officeCity=${encodeURIComponent(f.officeCity)}`);
      setAbbrPreview(res.data.abbr || '');
    } catch { setAbbrPreview(''); }
  }, []);

  useEffect(() => { fetchAbbrPreview(form); }, [form.gstin, form.legalEntityId, form.officeCity, fetchAbbrPreview]);

  const handleSubmit = async () => {
    if (!form.legalEntityId || !form.gstin || !form.officeCity || !form.state) {
      setError('Legal entity, GSTIN, city, and state are required.'); return;
    }
    if (form.gstin.length !== 15) { setError('GSTIN must be exactly 15 characters.'); return; }
    setSaving(true); setError(null);
    try {
      if (registration) {
        await api.put(`/company-master/registrations/${registration.id}`, form);
      } else {
        await api.post('/company-master/registrations', form);
      }
      onSaved();
    } catch (err) {
      setError(String(err.response?.data?.error || 'Failed to save registration.'));
      setSaving(false);
    }
  };

  const entityOptions = entities.map(e => ({ value: String(e.id), label: e.legalName }));
  const placeOptions  = [{ value: 'Principal', label: 'Principal Place' }, { value: 'Additional', label: 'Additional Place' }];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {registration ? 'Edit Registration' : 'Add Registration'}
            </h2>
            {abbrPreview && (
              <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 mt-0.5 inline-block">
                Preview: {abbrPreview}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && <AlertMessage type="error" message={error} />}
          <SelectField label="Legal Entity" value={form.legalEntityId}
            onChange={v => setField('legalEntityId', v)} options={entityOptions} required />
          <div className="grid grid-cols-2 gap-4">
            <InputField label="GSTIN" value={form.gstin}
              onChange={v => setField('gstin', v.toUpperCase())}
              placeholder="27AAJCC2415M1ZJ" required
              hint="15-character GST Identification Number" />
            <SelectField label="Place Type" value={form.placeType}
              onChange={v => setField('placeType', v)} options={placeOptions} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="State" value={form.state}
              onChange={v => setField('state', v)} placeholder="e.g. Maharashtra" required />
            <InputField label="District" value={form.district}
              onChange={v => setField('district', v)} placeholder="e.g. Mumbai City" />
          </div>
          <InputField label="Office City" value={form.officeCity}
            onChange={v => setField('officeCity', v)} placeholder="e.g. Mumbai" required
            hint="Used to generate the abbreviation code" />
          <InputField label="Registered Address" value={form.address}
            onChange={v => setField('address', v)}
            placeholder="Full registered address as per GST certificate" />
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Additional Registrations (optional)
            </p>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="FSSAI" value={form.fssai}
                onChange={v => setField('fssai', v)} placeholder="Licence number" />
              <InputField label="Udyam" value={form.udyam}
                onChange={v => setField('udyam', v.toUpperCase())} placeholder="UDYAM-MH-33-..." />
              <InputField label="IEC" value={form.iec}
                onChange={v => setField('iec', v.toUpperCase())} placeholder="Import Export Code" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg
                       hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {registration ? 'Save Changes' : 'Create Registration'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Deactivation Confirm Dialog ──────────────────────────────────────────────
function DeactivateDialog({ registration, onClose, onDeactivated }) {
  const [preview, setPreview]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    api.put(`/company-master/registrations/${registration.id}`, { isActive: false })
      .then(res => { setPreview(res.data); setLoading(false); })
      .catch(err => { setError(String(err.response?.data?.error || 'Failed.')); setLoading(false); });
  }, [registration.id]);

  const handleConfirm = async () => {
    setSaving(true); setError(null);
    try {
      await api.put(`/company-master/registrations/${registration.id}?confirm=true`, { isActive: false });
      onDeactivated();
    } catch (err) {
      setError(String(err.response?.data?.error || 'Failed to deactivate.'));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Deactivate Registration</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-6">
          {loading && <LoadingSpinner />}
          {error  && <AlertMessage type="error" message={error} />}
          {preview && preview.preview && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Deactivating <span className="font-mono">{registration.abbr}</span> will affect:
                  </p>
                  <ul className="mt-2 text-sm text-amber-700 space-y-0.5">
                    <li>• {preview.employees} employee(s) linked to this registration</li>
                    <li>• {preview.assets} asset(s) linked to this registration</li>
                    <li>• {preview.certificates} certificate(s) suspended from alerts</li>
                  </ul>
                </div>
              </div>
              <p className="text-sm text-slate-600">
                Employee and asset references are retained — only the registration status changes.
                Compliance alerts will stop for suspended certificates.
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={saving || loading}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg
                       hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm Deactivation
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Registration Row ─────────────────────────────────────────────────────────
function RegistrationRow({ reg, onEdit, onToggleActive }) {
  return (
    <tr className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${!reg.isActive ? 'opacity-60' : ''}`}>
      <td className="px-4 py-3">
        <span className="font-mono text-sm font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
          {reg.abbr}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-slate-600">{reg.gstin}</td>
      <td className="px-4 py-3 text-sm text-slate-700">{reg.officeCity}, {reg.state}</td>
      <td className="px-4 py-3 text-xs text-slate-500">{reg.placeType}</td>
      <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate" title={reg.address}>
        {reg.address || <span className="italic text-slate-400">—</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {reg.fssai && <span className="text-xs bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200">FSSAI</span>}
          {reg.udyam && <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">Udyam</span>}
          {reg.iec   && <span className="text-xs bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-200">IEC</span>}
        </div>
      </td>
      <td className="px-4 py-3">
        {reg.isActive
          ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">Active</span>
          : <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">Inactive</span>
        }
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(reg)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => onToggleActive(reg)}
            className={`p-1.5 rounded hover:bg-slate-100 ${reg.isActive ? 'text-slate-500 hover:text-red-600' : 'text-slate-400 hover:text-green-600'}`}
            title={reg.isActive ? 'Deactivate' : 'Reactivate'}>
            {reg.isActive ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CompanyMaster() {
  const [entities, setEntities]             = useState([]);
  const [registrations, setRegistrations]   = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [success, setSuccess]               = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);

  // Modal states
  const [showEntityModal, setShowEntityModal]         = useState(false);
  const [editingEntity, setEditingEntity]             = useState(null);
  const [showRegModal, setShowRegModal]               = useState(false);
  const [editingReg, setEditingReg]                   = useState(null);
  const [deactivatingReg, setDeactivatingReg]         = useState(null);

  const showMsg = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); };

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [entRes, regRes] = await Promise.all([
        api.get('/company-master/legal-entities'),
        api.get('/company-master/registrations'),
      ]);
      const ents = Array.isArray(entRes.data) ? entRes.data : [];
      const regs = Array.isArray(regRes.data) ? regRes.data : [];
      setEntities(ents);
      setRegistrations(regs);
      // Auto-select first entity if none selected
      setSelectedEntity(prev => {
        if (prev) return ents.find(e => e.id === prev.id) || ents[0] || null;
        return ents[0] || null;
      });
    } catch (err) {
      setError(String(err.response?.data?.error || 'Failed to load data.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleReactivate = async (reg) => {
    try {
      await api.put(`/company-master/registrations/${reg.id}?confirm=true`, { isActive: true });
      showMsg(`${reg.abbr} reactivated.`);
      fetchData();
    } catch (err) {
      setError(String(err.response?.data?.error || 'Failed to reactivate.'));
    }
  };

  const handleToggleActive = (reg) => {
    if (reg.isActive) {
      setDeactivatingReg(reg);
    } else {
      handleReactivate(reg);
    }
  };

  // Filter registrations for selected entity
  const filteredRegs = selectedEntity
    ? registrations.filter(r => r.legalEntityId === selectedEntity.id)
    : registrations;

  const entityRegCount = (entityId) => registrations.filter(r => r.legalEntityId === entityId).length;
  const entityActiveCount = (entityId) => registrations.filter(r => r.legalEntityId === entityId && r.isActive).length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner />
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* ── Page Header ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Company Master</h1>
              <p className="text-sm text-slate-500">Legal entities and GSTIN registrations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => { setEditingEntity(null); setShowEntityModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm
                         rounded-lg hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4" />
              Add Entity
            </button>
          </div>
        </div>
        {(error || success) && (
          <div className="mt-3">
            {error   && <AlertMessage type="error"   message={error}   />}
            {success && <AlertMessage type="success" message={success} />}
          </div>
        )}
      </div>

      {/* ── Two-Panel Layout ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Entity List */}
        <div className="w-72 flex-shrink-0 border-r border-slate-200 overflow-y-auto bg-slate-50">
          <div className="p-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-2 mb-2">
              Legal Entities ({entities.length})
            </p>
            {entities.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                No entities yet. Add one to get started.
              </div>
            ) : (
              <div className="space-y-1">
                {entities.map(entity => {
                  const total  = entityRegCount(entity.id);
                  const active = entityActiveCount(entity.id);
                  const isSelected = selectedEntity?.id === entity.id;
                  return (
                    <button
                      key={entity.id}
                      onClick={() => setSelectedEntity(entity)}
                      className={`w-full text-left px-3 py-3 rounded-lg transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'hover:bg-white hover:shadow-sm text-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium leading-tight truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                            {entity.legalName}
                          </p>
                          {entity.pan && (
                            <p className={`text-xs font-mono mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                              PAN: {entity.pan}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            isSelected ? 'bg-blue-500 text-blue-100' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {total} GSTIN{total !== 1 ? 's' : ''}
                          </span>
                          {total !== active && (
                            <span className={`text-xs ${isSelected ? 'text-blue-200' : 'text-amber-600'}`}>
                              {active} active
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`flex items-center gap-2 mt-1.5 flex-wrap ${isSelected ? '' : ''}`}>
                        {entity.tan && (
                          <span className={`text-xs ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                            TAN: {entity.tan}
                          </span>
                        )}
                        {entity.lei && (
                          <span className={`text-xs ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                            LEI ✓
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Registration Table */}
        <div className="flex-1 overflow-auto">
          {selectedEntity ? (
            <div>
              {/* Entity detail header */}
              <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-slate-500" />
                      <h2 className="text-base font-semibold text-slate-800">
                        {selectedEntity.legalName}
                      </h2>
                      <button
                        onClick={() => { setEditingEntity(selectedEntity); setShowEntityModal(true); }}
                        className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-4 mt-0.5">
                      {selectedEntity.pan && (
                        <span className="text-xs text-slate-500">PAN: <span className="font-mono">{selectedEntity.pan}</span></span>
                      )}
                      {selectedEntity.tan && (
                        <span className="text-xs text-slate-500">TAN: <span className="font-mono">{selectedEntity.tan}</span></span>
                      )}
                      {selectedEntity.lei && (
                        <span className="text-xs text-slate-500">LEI: <span className="font-mono">{selectedEntity.lei}</span></span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => { setEditingReg(null); setShowRegModal(true); }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white text-sm
                               rounded-lg hover:bg-slate-700 transition-colors">
                    <Plus className="w-4 h-4" />
                    Add GSTIN
                  </button>
                </div>
              </div>

              {/* Registrations table */}
              {filteredRegs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Globe className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-sm font-medium">No registrations for this entity</p>
                  <p className="text-xs mt-1">Add a GSTIN registration to get started</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Abbr</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">GSTIN</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Location</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Address</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Licences</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {filteredRegs.map(reg => (
                        <RegistrationRow
                          key={reg.id}
                          reg={reg}
                          onEdit={r => { setEditingReg(r); setShowRegModal(true); }}
                          onToggleActive={handleToggleActive}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Building2 className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Select a legal entity to view registrations</p>
            </div>
          )}
        </div>
      </div>

      {/* ── All Registrations Summary (below entity panel) ── */}
      <div className="border-t border-slate-200 bg-slate-50 px-6 py-2">
        <div className="flex items-center gap-6 text-xs text-slate-500">
          <span>{registrations.length} total registrations</span>
          <span className="text-green-600 font-medium">{registrations.filter(r => r.isActive).length} active</span>
          <span className="text-slate-400">{registrations.filter(r => !r.isActive).length} inactive</span>
        </div>
      </div>

      {/* ── Modals ── */}
      {showEntityModal && (
        <LegalEntityModal
          entity={editingEntity}
          onClose={() => { setShowEntityModal(false); setEditingEntity(null); }}
          onSaved={() => {
            setShowEntityModal(false); setEditingEntity(null);
            showMsg(editingEntity ? 'Entity updated.' : 'Entity created.');
            fetchData();
          }}
        />
      )}

      {showRegModal && (
        <RegistrationModal
          registration={editingReg}
          entities={entities}
          onClose={() => { setShowRegModal(false); setEditingReg(null); }}
          onSaved={() => {
            setShowRegModal(false); setEditingReg(null);
            showMsg(editingReg ? 'Registration updated.' : 'Registration created.');
            fetchData();
          }}
        />
      )}

      {deactivatingReg && (
        <DeactivateDialog
          registration={deactivatingReg}
          onClose={() => setDeactivatingReg(null)}
          onDeactivated={() => {
            setDeactivatingReg(null);
            showMsg(`${deactivatingReg.abbr} deactivated.`);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
