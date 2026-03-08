import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import { Building2, Plus, Edit2, ChevronRight, MapPin, Globe, Hash, Shield, AlertTriangle } from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

function Badge({ children, color = 'gray' }) {
  const colors = {
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-blue-100 text-blue-800',
    gray: 'bg-gray-100 text-gray-700',
    amber: 'bg-amber-100 text-amber-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}

// ─── Legal Entity Modal ───────────────────────────────────────────────────────

function EntityModal({ entity, onClose, onSaved }) {
  const { execute, loading, error } = useApi();
  const [form, setForm] = useState({
    legalName: entity?.legalName || '',
    pan: entity?.pan || '',
    tan: entity?.tan || '',
    lei: entity?.lei || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      legalName: form.legalName,
      pan: form.pan || null,
      tan: form.tan || null,
      lei: form.lei || null,
    };
    if (entity) {
      await execute(() => api.put(`/company-master/legal-entities/${entity.id}`, payload), 'Entity updated!');
    } else {
      await execute(() => api.post('/company-master/legal-entities', payload), 'Entity created!');
    }
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {entity ? 'Edit Legal Entity' : 'Add Legal Entity'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <AlertMessage type="error" message={error} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Legal Name *</label>
            <input value={form.legalName} onChange={e => set('legalName', e.target.value)}
              required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Color Papers India Pvt. Ltd." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PAN</label>
              <input value={form.pan} onChange={e => set('pan', e.target.value.toUpperCase())}
                maxLength={10} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="AAJCC2415M" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TAN</label>
              <input value={form.tan} onChange={e => set('tan', e.target.value.toUpperCase())}
                maxLength={10} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="PNEC15279F" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LEI (Legal Entity Identifier)</label>
            <input value={form.lei} onChange={e => set('lei', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="20-char alphanumeric" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Saving...' : entity ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Registration Modal ───────────────────────────────────────────────────────

function RegistrationModal({ registration, entityId, onClose, onSaved }) {
  const { execute, loading, error } = useApi();
  const [form, setForm] = useState({
    gstin: registration?.gstin || '',
    officeCity: registration?.officeCity || '',
    state: registration?.state || '',
    district: registration?.district || '',
    placeType: registration?.placeType || 'Principal',
    address: registration?.address || '',
    fssai: registration?.fssai || '',
    udyam: registration?.udyam || '',
    iec: registration?.iec || '',
    legalEntityId: registration?.legalEntityId || entityId || '',
  });
  const [abbrPreview, setAbbrPreview] = useState(registration?.abbr || '');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      legalEntityId: parseInt(form.legalEntityId),
      district: form.district || null,
      address: form.address || null,
      fssai: form.fssai || null,
      udyam: form.udyam || null,
      iec: form.iec || null,
    };
    let result;
    if (registration) {
      result = await execute(() => api.put(`/company-master/registrations/${registration.id}`, payload), 'Registration updated!');
    } else {
      result = await execute(() => api.post('/company-master/registrations', payload), 'Registration created!');
    }
    if (result?.abbr) setAbbrPreview(result.abbr);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {registration ? 'Edit Registration' : 'Add GSTIN Registration'}
            </h2>
            {abbrPreview && (
              <p className="text-xs text-blue-600 font-mono mt-0.5">Abbr: {abbrPreview}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && <AlertMessage type="error" message={error} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN *</label>
            <input value={form.gstin} onChange={e => set('gstin', e.target.value.toUpperCase())}
              required maxLength={15} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="27AAJCC2415M1ZJ" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Office City *</label>
              <input value={form.officeCity} onChange={e => set('officeCity', e.target.value)}
                required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mumbai" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
              <input value={form.state} onChange={e => set('state', e.target.value)}
                required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Maharashtra" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
              <input value={form.district} onChange={e => set('district', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Place Type</label>
              <select value={form.placeType} onChange={e => set('placeType', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>Principal</option>
                <option>Additional</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Registered Address</label>
            <textarea value={form.address} onChange={e => set('address', e.target.value)}
              rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">FSSAI</label>
              <input value={form.fssai} onChange={e => set('fssai', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Udyam</label>
              <input value={form.udyam} onChange={e => set('udyam', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IEC</label>
              <input value={form.iec} onChange={e => set('iec', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Saving...' : registration ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Registration Detail Panel ────────────────────────────────────────────────

function RegistrationDetail({ reg, onEdit, onDeactivate }) {
  const fields = [
    { label: 'GSTIN', value: reg.gstin, mono: true },
    { label: 'State Code', value: reg.stateCode },
    { label: 'State', value: reg.state },
    { label: 'District', value: reg.district },
    { label: 'Place Type', value: reg.placeType },
    { label: 'Address', value: reg.address },
    { label: 'FSSAI', value: reg.fssai },
    { label: 'Udyam', value: reg.udyam },
    { label: 'IEC', value: reg.iec },
  ].filter(f => f.value);

  return (
    <div className={`border rounded-xl p-4 ${reg.isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-70'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-blue-700 text-sm">{reg.abbr}</span>
            {!reg.isActive && <Badge color="gray">Inactive</Badge>}
            {reg.placeType === 'Principal' && reg.isActive && <Badge color="blue">Principal</Badge>}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{reg.officeCity} · {reg.state}</p>
        </div>
        {reg.isActive && (
          <div className="flex items-center gap-2">
            <button onClick={() => onEdit(reg)}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              <Edit2 size={12} /> Edit
            </button>
            <button onClick={() => onDeactivate(reg)}
              className="text-xs text-red-500 hover:underline">
              Deactivate
            </button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {fields.map(f => (
          <div key={f.label} className="min-w-0">
            <p className="text-xs text-gray-400">{f.label}</p>
            <p className={`text-xs text-gray-800 truncate ${f.mono ? 'font-mono' : ''}`}>{f.value}</p>
          </div>
        ))}
      </div>
      {/* Stats */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
        <span>{reg._count?.users ?? 0} employees</span>
        <span>{reg._count?.assets ?? 0} assets</span>
        <span>{reg._count?.certificates ?? reg.certificates?.length ?? 0} certs</span>
      </div>
    </div>
  );
}

// ─── Deactivate Confirm Modal ─────────────────────────────────────────────────

function DeactivateModal({ reg, onClose, onDone }) {
  const { execute, loading, error } = useApi();
  const [preview, setPreview] = useState(null);
  const [checked, setChecked] = useState(false);

  const fetchPreview = async () => {
    const res = await execute(
      () => api.put(`/company-master/registrations/${reg.id}`, { isActive: false }),
      null
    );
    if (res?.preview) setPreview(res);
  };

  useState(() => { fetchPreview(); }, []);

  const handleConfirm = async () => {
    await execute(
      () => api.put(`/company-master/registrations/${reg.id}?confirm=true`, { isActive: false }),
      'Registration deactivated'
    );
    onDone();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="text-amber-500" size={20} />
          <h3 className="text-lg font-semibold text-gray-900">Deactivate {reg.abbr}?</h3>
        </div>
        {error && <AlertMessage type="error" message={error} />}
        {preview ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm space-y-1">
            <p className="font-medium text-amber-800">This will affect:</p>
            <p className="text-amber-700">{preview.employees} employee(s)</p>
            <p className="text-amber-700">{preview.assets} asset(s)</p>
            <p className="text-amber-700">{preview.certificates} certificate(s)</p>
            <p className="text-xs text-amber-600 mt-2">References are preserved. A warning badge will appear on affected records.</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-4">Loading impact preview...</p>
        )}
        <label className="flex items-center gap-2 text-sm text-gray-700 mb-4 cursor-pointer">
          <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />
          I understand the impact and want to deactivate this registration.
        </label>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={!checked || loading || !preview}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Deactivating...' : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CompanyMaster() {
  const { data: entities, loading: entLoading, error: entError, refetch: refetchEntities } =
    useFetch('/company-master/legal-entities', []);
  const { data: registrations, loading: regLoading, refetch: refetchRegs } =
    useFetch('/company-master/registrations', []);

  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [entityModal, setEntityModal] = useState(null); // null | 'add' | entity object
  const [regModal, setRegModal] = useState(null);       // null | 'add' | registration object
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  if (entLoading) return <LoadingSpinner />;
  if (entError) return <AlertMessage type="error" message={entError} />;

  const selectedEntity = entities.find(e => e.id === selectedEntityId) || entities[0] || null;
  const effectiveId = selectedEntity?.id;

  const entityRegs = registrations.filter(r => r.legalEntityId === effectiveId);
  const activeRegs = entityRegs.filter(r => r.isActive);
  const inactiveRegs = entityRegs.filter(r => !r.isActive);

  const handleSaved = () => { refetchEntities(); refetchRegs(); };

  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="text-blue-600" size={22} />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Company Master</h1>
              <p className="text-xs text-gray-500">Legal entities and GSTIN registrations</p>
            </div>
          </div>
          <button onClick={() => setEntityModal('add')}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            <Plus size={15} /> Add Entity
          </button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel: Legal Entities */}
        <div className="w-72 border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Legal Entities ({entities.length})
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {entities.length === 0 ? (
              <EmptyState icon="🏢" title="No entities yet" subtitle="Add a legal entity to start" />
            ) : (
              entities.map(entity => {
                const isSelected = entity.id === (effectiveId);
                const regCount = registrations.filter(r => r.legalEntityId === entity.id).length;
                return (
                  <button key={entity.id}
                    onClick={() => setSelectedEntityId(entity.id)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-100 border border-transparent'}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">{entity.legalName}</p>
                      <ChevronRight size={14} className={`flex-shrink-0 ml-1 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`} />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {entity.pan && <span className="text-xs text-gray-400 font-mono">{entity.pan}</span>}
                      <Badge color="blue">{regCount} GSTINs</Badge>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right panel: Registrations for selected entity */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedEntity ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon="👈" title="Select an entity" subtitle="Choose a legal entity from the left panel" />
            </div>
          ) : (
            <>
              {/* Entity header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{selectedEntity.legalName}</h2>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      {selectedEntity.pan && <span><span className="text-gray-400">PAN:</span> <span className="font-mono">{selectedEntity.pan}</span></span>}
                      {selectedEntity.tan && <span><span className="text-gray-400">TAN:</span> <span className="font-mono">{selectedEntity.tan}</span></span>}
                      {selectedEntity.lei && <span><span className="text-gray-400">LEI:</span> <span className="font-mono truncate max-w-[140px]">{selectedEntity.lei}</span></span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEntityModal(selectedEntity)}
                      className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1">
                      <Edit2 size={14} /> Edit Entity
                    </button>
                    <button onClick={() => setRegModal('add')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                      <Plus size={14} /> Add GSTIN
                    </button>
                  </div>
                </div>
              </div>

              {/* Registrations grid */}
              <div className="flex-1 overflow-y-auto p-6">
                {regLoading ? (
                  <LoadingSpinner />
                ) : entityRegs.length === 0 ? (
                  <EmptyState icon="🏛️" title="No registrations" subtitle="Add a GSTIN registration for this entity" />
                ) : (
                  <div className="space-y-6">
                    {activeRegs.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                          Active ({activeRegs.length})
                        </p>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          {activeRegs.map(reg => (
                            <RegistrationDetail key={reg.id} reg={reg}
                              onEdit={r => setRegModal(r)}
                              onDeactivate={r => setDeactivateTarget(r)} />
                          ))}
                        </div>
                      </div>
                    )}
                    {inactiveRegs.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                          Inactive ({inactiveRegs.length})
                        </p>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          {inactiveRegs.map(reg => (
                            <RegistrationDetail key={reg.id} reg={reg}
                              onEdit={() => {}} onDeactivate={() => {}} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {entityModal && (
        <EntityModal
          entity={entityModal === 'add' ? null : entityModal}
          onClose={() => setEntityModal(null)}
          onSaved={handleSaved} />
      )}
      {regModal && (
        <RegistrationModal
          registration={regModal === 'add' ? null : regModal}
          entityId={effectiveId}
          onClose={() => setRegModal(null)}
          onSaved={handleSaved} />
      )}
      {deactivateTarget && (
        <DeactivateModal
          reg={deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
          onDone={handleSaved} />
      )}
    </div>
  );
}
