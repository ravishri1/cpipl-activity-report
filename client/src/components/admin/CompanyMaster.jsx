import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import BranchManager from './BranchManager';
import {
  Building2, Plus, Edit2, ChevronRight, ChevronDown, MapPin, Globe, Hash,
  Shield, AlertTriangle, GitBranch, Settings, X, Trash2, Layers
} from 'lucide-react';

const PLACE_TYPE_OPTIONS = ['Principal', 'Additional', 'E-APOB', 'I-APOB'];
const LOCATION_TYPES = [
  'Principal Place', 'Additional Place', 'E-APOB', 'I-APOB',
  'Godown', 'Warehouse', 'Factory', 'Office',
];

const LOCATION_TYPE_STYLE = {
  'Principal Place':  { bg: 'bg-blue-100',   text: 'text-blue-700',   short: 'P' },
  'Additional Place': { bg: 'bg-amber-100',  text: 'text-amber-700',  short: 'A' },
  'E-APOB':           { bg: 'bg-purple-100', text: 'text-purple-700', short: 'E' },
  'I-APOB':           { bg: 'bg-pink-100',   text: 'text-pink-700',   short: 'I' },
  'Godown':           { bg: 'bg-gray-100',   text: 'text-gray-600',   short: 'G' },
  'Warehouse':        { bg: 'bg-slate-100',  text: 'text-slate-600',  short: 'W' },
  'Factory':          { bg: 'bg-orange-100', text: 'text-orange-700', short: 'F' },
  'Office':           { bg: 'bg-teal-100',   text: 'text-teal-700',   short: 'O' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function Badge({ children, color = 'gray' }) {
  const colors = {
    green:  'bg-green-100 text-green-800',
    red:    'bg-red-100 text-red-800',
    blue:   'bg-blue-100 text-blue-800',
    gray:   'bg-gray-100 text-gray-700',
    amber:  'bg-amber-100 text-amber-800',
    purple: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[color] || colors.gray}`}>
      {children}
    </span>
  );
}

// ─── Legal Entity Modal ───────────────────────────────────────────────────────

function EntityModal({ entity, onClose, onSaved }) {
  const { execute, loading, error } = useApi();
  const [form, setForm] = useState({
    legalName: entity?.legalName || '',
    shortName: entity?.shortName || '',
    pan: entity?.pan || '',
    tan: entity?.tan || '',
    lei: entity?.lei || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      legalName: form.legalName,
      shortName: form.shortName || null,
      pan: form.pan || null,
      tan: form.tan || null,
      lei: form.lei || null,
    };
    try {
      if (entity) {
        await execute(() => api.put(`/company-master/legal-entities/${entity.id}`, payload), 'Entity updated!');
      } else {
        await execute(() => api.post('/company-master/legal-entities', payload), 'Entity created!');
      }
      onSaved();
      onClose();
    } catch {}
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
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Legal Name *</label>
              <input value={form.legalName} onChange={e => set('legalName', e.target.value)}
                required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Color Papers India Pvt. Ltd." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Abbreviation</label>
              <input value={form.shortName} onChange={e => set('shortName', e.target.value.toUpperCase())}
                maxLength={10} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="CPIPL" />
            </div>
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

function RegistrationModal({ registration, entityId, onClose, onSaved, allRegistrations = [], initialPrincipalId = null }) {
  const { execute, loading, error } = useApi();
  const [form, setForm] = useState({
    gstin: registration?.gstin || '',
    officeCity: registration?.officeCity || '',
    state: registration?.state || '',
    district: registration?.district || '',
    placeType: registration?.placeType || (initialPrincipalId ? 'Additional' : 'Principal'),
    principalRegistrationId: registration?.principalRegistrationId || initialPrincipalId || '',
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
      principalRegistrationId: form.principalRegistrationId ? parseInt(form.principalRegistrationId) : null,
      district: form.district || null,
      address: form.address || null,
      fssai: form.fssai || null,
      udyam: form.udyam || null,
      iec: form.iec || null,
    };
    try {
      let result;
      if (registration) {
        result = await execute(() => api.put(`/company-master/registrations/${registration.id}`, payload), 'Registration updated!');
      } else {
        result = await execute(() => api.post('/company-master/registrations', payload), 'Registration created!');
      }
      if (result?.abbr) setAbbrPreview(result.abbr);
      onSaved();
      onClose();
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {registration ? 'Edit Registration' : initialPrincipalId ? 'Add Additional Place' : 'Add GSTIN Registration'}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Principal City *</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Registration Type</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {PLACE_TYPE_OPTIONS.map(opt => {
                  const selected = (form.placeType || '').split(',').map(s => s.trim()).filter(Boolean);
                  const isChecked = selected.includes(opt);
                  const toggle = () => {
                    const next = isChecked
                      ? selected.filter(s => s !== opt)
                      : [...selected, opt];
                    set('placeType', next.join(',') || 'Principal');
                  };
                  return (
                    <label key={opt} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors
                      ${isChecked ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={isChecked} onChange={toggle} className="rounded text-blue-600 w-3.5 h-3.5" />
                      {opt}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          {/* Principal Registration dropdown — show when NOT Principal */}
          {!(form.placeType || '').includes('Principal') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Linked Principal Registration *</label>
              <select value={form.principalRegistrationId} onChange={e => set('principalRegistrationId', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">-- Select Principal --</option>
                {allRegistrations
                  .filter(r => (r.placeType || '').includes('Principal') && r.id !== registration?.id && r.legalEntityId === parseInt(form.legalEntityId))
                  .map(r => (
                    <option key={r.id} value={r.id}>{r.abbr} — {r.officeCity} ({r.gstin})</option>
                  ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Registered Address</label>
            <textarea value={form.address} onChange={e => set('address', e.target.value)}
              rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {(() => {
            const isPrincipal = (form.placeType || '').includes('Principal');
            const linkedPrincipal = !isPrincipal && form.principalRegistrationId
              ? allRegistrations.find(r => r.id === parseInt(form.principalRegistrationId))
              : null;
            return isPrincipal ? (
              <div>
                <p className="text-xs text-gray-500 mb-2 font-medium">Licences & Registrations</p>
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
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-2">Inherited from Principal {linkedPrincipal ? `(${linkedPrincipal.abbr})` : '— select a Principal above'}</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-xs text-gray-500">FSSAI</span>
                    <p className="text-sm font-medium text-gray-800">{linkedPrincipal?.fssai || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Udyam</span>
                    <p className="text-sm font-medium text-gray-800">{linkedPrincipal?.udyam || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">IEC</span>
                    <p className="text-sm font-medium text-gray-800">{linkedPrincipal?.iec || '—'}</p>
                  </div>
                </div>
              </div>
            );
          })()}
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

// ─── Location Modal ───────────────────────────────────────────────────────────

function LocationModal({ location, registrationId, registrationState, onClose, onSaved }) {
  const { execute, loading, error } = useApi();
  const [form, setForm] = useState({
    locationType: location?.locationType || 'Additional Place',
    locationName: location?.locationName || '',
    city: location?.city || '',
    state: location?.state || registrationState || '',
    district: location?.district || '',
    pincode: location?.pincode || '',
    address: location?.address || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      locationType: form.locationType,
      locationName: form.locationName || null,
      city: form.city,
      state: form.state || null,
      district: form.district || null,
      pincode: form.pincode || null,
      address: form.address || null,
    };
    try {
      if (location) {
        await execute(() => api.put(`/company-master/locations/${location.id}`, payload), 'Location updated!');
      } else {
        await execute(() => api.post(`/company-master/registrations/${registrationId}/locations`, payload), 'Location added!');
      }
      onSaved();
      onClose();
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {location ? 'Edit Location' : 'Add Location'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Physical address registered under this GSTIN</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <AlertMessage type="error" message={error} />}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location Type *</label>
              <select value={form.locationType} onChange={e => set('locationType', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {LOCATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">As registered in GST certificate</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location Name / Label</label>
              <input value={form.locationName} onChange={e => set('locationName', e.target.value)}
                placeholder="e.g. Head Office, North Warehouse"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">Optional — for internal reference</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input value={form.city} onChange={e => set('city', e.target.value)}
                required placeholder="Mumbai"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input value={form.state} onChange={e => set('state', e.target.value)}
                placeholder="Maharashtra"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
              <input value={form.district} onChange={e => set('district', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
              <input value={form.pincode} onChange={e => set('pincode', e.target.value)}
                maxLength={6} placeholder="400001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Address</label>
            <textarea value={form.address} onChange={e => set('address', e.target.value)}
              rows={2} placeholder="Shop No. 5, Tardeo Road, Mumbai — 400034"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Saving...' : location ? 'Update Location' : 'Add Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Registration Card ────────────────────────────────────────────────────────

function RegistrationCard({ reg, onEdit, onDeactivate, onReactivate, onLocationsUpdated, onAddAdditional }) {
  const [showLocations, setShowLocations] = useState(true);
  const [locationModal, setLocationModal] = useState(null); // null | 'add' | location object
  const { execute } = useApi();

  const locations = reg.locations || [];
  const isPrincipal = (reg.placeType || '').includes('Principal');

  const handleDeleteLocation = async (loc) => {
    if (!window.confirm(`Remove "${loc.city} — ${loc.locationType}" from this registration?`)) return;
    try {
      await execute(() => api.delete(`/company-master/locations/${loc.id}`), 'Location removed');
      onLocationsUpdated();
    } catch {}
  };

  return (
    <div className={`border rounded-xl overflow-hidden transition-all shadow-sm ${
      reg.isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300 opacity-70'
    }`}>

      {/* ── Card Header ─────────────────────────────────────── */}
      <div className={`flex items-stretch ${isPrincipal ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-amber-400'}`}>
        <div className="flex-1 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {/* Abbr + status badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-sm text-gray-900">{reg.abbr}</span>
                {!reg.isActive && <Badge color="gray">Inactive</Badge>}
                {reg.isActive && (reg.placeType || 'Principal').split(',').map(t => t.trim()).filter(Boolean).map(t => (
                  <Badge key={t} color={t === 'Principal' ? 'blue' : 'amber'}>{t}</Badge>
                ))}
              </div>
              {/* City + State */}
              <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                <MapPin size={10} className="flex-shrink-0" />
                <span>{reg.officeCity}, {reg.state}</span>
              </div>
              {/* Linked Principal — shown when standalone Additional card (principal in diff entity) */}
              {reg.principalRegistration && (
                <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
                  ↳ Under Principal:
                  <span className="font-mono font-semibold">{reg.principalRegistration.abbr}</span>
                  <span className="text-blue-400">({reg.principalRegistration.officeCity})</span>
                </p>
              )}
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {reg.isActive ? (
                <>
                  <button onClick={() => onEdit(reg)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit registration">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => onDeactivate(reg)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Deactivate">
                    <Shield size={14} />
                  </button>
                </>
              ) : (
                <button onClick={() => onReactivate(reg)}
                  className="text-xs text-green-700 border border-green-300 bg-green-50 hover:bg-green-100 px-2 py-1 rounded-md flex items-center gap-1 transition-colors">
                  ↩ Reactivate
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Registration Details ──────────────────────────── */}
      <div className="px-4 py-3 border-t border-gray-100 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
        <div>
          <p className="text-gray-400 uppercase tracking-wide text-[10px] mb-0.5">GSTIN</p>
          <p className="font-mono text-gray-800 font-semibold tracking-wide">{reg.gstin}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-wide text-[10px] mb-0.5">State Code</p>
          <p className="text-gray-700">{reg.stateCode} — {reg.state}</p>
        </div>
        {reg.address && (
          <div className="col-span-2">
            <p className="text-gray-400 uppercase tracking-wide text-[10px] mb-0.5">Registered Address</p>
            <p className="text-gray-700 leading-relaxed">{reg.address}</p>
          </div>
        )}
        {(reg.fssai || reg.udyam || reg.iec) && (
          <>
            {reg.fssai && (
              <div>
                <p className="text-gray-400 uppercase tracking-wide text-[10px] mb-0.5">FSSAI</p>
                <p className="font-mono text-gray-700">{reg.fssai}</p>
              </div>
            )}
            {reg.udyam && (
              <div>
                <p className="text-gray-400 uppercase tracking-wide text-[10px] mb-0.5">Udyam</p>
                <p className="font-mono text-gray-700">{reg.udyam}</p>
              </div>
            )}
            {reg.iec && (
              <div>
                <p className="text-gray-400 uppercase tracking-wide text-[10px] mb-0.5">IEC</p>
                <p className="font-mono text-gray-700">{reg.iec}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Additional Places (nested child registrations) ── */}
      {reg.additionalRegistrations?.length > 0 && (
        <div className="border-t border-amber-100 bg-amber-50/20">
          <div className="px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={12} className="text-amber-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-amber-700">
                Additional Places ({reg.additionalRegistrations.filter(r => r.isActive).length} active
                {reg.additionalRegistrations.filter(r => !r.isActive).length > 0
                  ? `, ${reg.additionalRegistrations.filter(r => !r.isActive).length} inactive`
                  : ''})
              </span>
            </div>
            {reg.isActive && onAddAdditional && (
              <button onClick={() => onAddAdditional(reg.id)}
                className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-0.5 px-2 py-0.5 rounded hover:bg-amber-100 transition-colors">
                <Plus size={11} /> Add Place
              </button>
            )}
          </div>
          <div className="px-4 pb-3 space-y-2">
            {reg.additionalRegistrations.map(child => (
              <div key={child.id}
                className={`group flex items-start gap-3 p-2.5 rounded-lg border transition-all ${
                  child.isActive
                    ? 'border-amber-200 bg-white hover:border-amber-300 hover:shadow-sm'
                    : 'border-gray-200 bg-gray-50 opacity-60'
                }`}>
                {/* Left accent bar */}
                <div className={`flex-shrink-0 w-1 self-stretch rounded-full mt-0.5 ${child.isActive ? 'bg-amber-400' : 'bg-gray-300'}`} />
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-mono font-bold text-gray-800">{child.abbr}</span>
                    {(child.placeType || '').split(',').map(t => t.trim()).filter(Boolean).map(t => (
                      <span key={t} className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        t === 'Principal' ? 'bg-blue-100 text-blue-700' :
                        t === 'E-APOB' ? 'bg-purple-100 text-purple-700' :
                        t === 'I-APOB' ? 'bg-pink-100 text-pink-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{t}</span>
                    ))}
                    {!child.isActive && (
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Inactive</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                    <MapPin size={9} className="flex-shrink-0" />
                    <span>{child.officeCity}{child.district ? `, ${child.district}` : ''} · {child.state}</span>
                  </div>
                  {child.address && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{child.address}</p>
                  )}
                  <p className="text-xs font-mono text-gray-300 mt-0.5">{child.gstin}</p>
                </div>
                {/* Edit action */}
                {reg.isActive && (
                  <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(child)}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Edit additional place">
                      <Edit2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Locations Section ─────────────────────────────── */}
      <div className="border-t border-gray-100">
        {/* Locations toggle header */}
        <button
          onClick={() => setShowLocations(s => !s)}
          className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50/80 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <MapPin size={12} className="text-blue-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-gray-600">
              Locations under this GSTIN
            </span>
            {locations.length > 0 ? (
              <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full">
                {locations.length}
              </span>
            ) : (
              <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                None added
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {reg.isActive && (
              <button
                onClick={e => { e.stopPropagation(); setLocationModal('add'); }}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5 px-2 py-0.5 rounded hover:bg-blue-50 transition-colors"
              >
                <Plus size={11} /> Add Location
              </button>
            )}
            <ChevronDown
              size={13}
              className={`text-gray-400 transition-transform ${showLocations ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        {/* Locations list */}
        {showLocations && (
          <div className="px-4 pb-3">
            {locations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 py-4 text-center">
                <MapPin size={18} className="mx-auto mb-1.5 text-gray-300" />
                <p className="text-xs text-gray-400 font-medium">No locations registered yet</p>
                <p className="text-xs text-gray-300 mt-0.5">
                  Add all physical addresses listed in the GST certificate
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {locations.map(loc => {
                  const style = LOCATION_TYPE_STYLE[loc.locationType] || LOCATION_TYPE_STYLE['Additional Place'];
                  return (
                    <div key={loc.id}
                      className="group flex items-start gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all">
                      {/* Type badge */}
                      <span className={`flex-shrink-0 mt-0.5 text-xs font-bold w-5 h-5 flex items-center justify-center rounded ${style.bg} ${style.text}`}>
                        {style.short}
                      </span>
                      {/* Location info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs font-semibold ${style.text}`}>{loc.locationType}</span>
                          {loc.locationName && (
                            <span className="text-xs text-gray-500">— {loc.locationName}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-700 mt-0.5 font-medium">
                          {loc.city}
                          {loc.state && loc.state !== reg.state ? `, ${loc.state}` : ''}
                          {loc.pincode ? ` — ${loc.pincode}` : ''}
                          {loc.district ? ` (${loc.district})` : ''}
                        </p>
                        {loc.address && (
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{loc.address}</p>
                        )}
                      </div>
                      {/* Edit / Delete — visible on hover */}
                      {reg.isActive && (
                        <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setLocationModal(loc)}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                            title="Edit location"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteLocation(loc)}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-100 rounded transition-colors"
                            title="Remove location"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Stats Footer ─────────────────────────────────── */}
      <div className={`px-4 py-2.5 border-t flex items-center gap-5 text-xs text-gray-500 ${
        reg.isActive ? 'bg-gray-50/50 border-gray-100' : 'bg-gray-100 border-gray-200'
      }`}>
        <span title="Employees assigned to this registration">
          👥 {reg._count?.users ?? 0} employees
        </span>
        <span title="Assets assigned to this registration">
          🖥️ {reg._count?.assets ?? 0} assets
        </span>
        <span title="Compliance certificates">
          📜 {reg._count?.certificates ?? reg.certificates?.length ?? 0} certificates
        </span>
      </div>

      {/* Location Modal (rendered inside card, above everything) */}
      {locationModal && (
        <LocationModal
          location={locationModal === 'add' ? null : locationModal}
          registrationId={reg.id}
          registrationState={reg.state}
          onClose={() => setLocationModal(null)}
          onSaved={onLocationsUpdated}
        />
      )}
    </div>
  );
}

// ─── Deactivate Confirm Modal ─────────────────────────────────────────────────

function DeactivateModal({ reg, onClose, onDone }) {
  const { execute, loading, error } = useApi();
  const [preview, setPreview] = useState(null);
  const [checked, setChecked] = useState(false);

  const fetchPreview = async () => {
    try {
      const res = await execute(
        () => api.put(`/company-master/registrations/${reg.id}`, { isActive: false }),
        null
      );
      if (res?.preview) setPreview(res);
    } catch {}
  };

  useEffect(() => { fetchPreview(); }, []);

  const handleConfirm = async () => {
    try {
      await execute(
        () => api.put(`/company-master/registrations/${reg.id}?confirm=true`, { isActive: false }),
        'Registration deactivated'
      );
      onDone();
      onClose();
    } catch {}
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

// ─── Reactivate Confirm Modal ─────────────────────────────────────────────────

function ReactivateModal({ reg, onClose, onDone }) {
  const { execute, loading, error } = useApi();

  const handleConfirm = async () => {
    try {
      await execute(
        () => api.put(`/company-master/registrations/${reg.id}`, { isActive: true }),
        'Registration reactivated'
      );
      onDone();
      onClose();
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="text-green-500" size={20} />
          <h3 className="text-lg font-semibold text-gray-900">Reactivate {reg.abbr}?</h3>
        </div>
        {error && <AlertMessage type="error" message={error} />}
        <p className="text-sm text-gray-600 mb-2">
          This will reactivate the <strong>{reg.abbr}</strong> registration ({reg.officeCity}, {reg.state}).
        </p>
        <p className="text-xs text-gray-500 mb-6">
          Associated employees and assets linked to this registration will resume showing it as active.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={loading}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {loading ? 'Reactivating...' : 'Reactivate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CompanyMaster() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.pathname === '/admin/branches' ? 'branches' : 'registrations';

  const { data: entities, loading: entLoading, error: entError, refetch: refetchEntities } =
    useFetch('/company-master/legal-entities', []);
  const { data: registrations, loading: regLoading, refetch: refetchRegs } =
    useFetch('/company-master/registrations', []);

  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [entityModal, setEntityModal] = useState(null);
  const [regModal, setRegModal] = useState(null);
  const [addAdditionalForId, setAddAdditionalForId] = useState(null); // principalId when adding additional place
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [reactivateTarget, setReactivateTarget] = useState(null);
  const [showCityCodes, setShowCityCodes] = useState(false);
  const [cityCodes, setCityCodes] = useState([]);
  const [cityForm, setCityForm] = useState({ cityName: '', code: '' });
  const [cityLoading, setCityLoading] = useState(false);

  const loadCityCodes = async () => {
    try {
      const res = await api.get('/company-master/city-codes');
      setCityCodes(res.data);
    } catch { /* ignore */ }
  };

  const handleAddCity = async () => {
    if (!cityForm.cityName.trim() || !cityForm.code.trim()) return;
    setCityLoading(true);
    try {
      await api.post('/company-master/city-codes', {
        cityName: cityForm.cityName.trim(),
        code: cityForm.code.trim().toUpperCase(),
      });
      setCityForm({ cityName: '', code: '' });
      await loadCityCodes();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    finally { setCityLoading(false); }
  };

  const handleDeleteCity = async (id) => {
    if (!window.confirm('Delete this city code?')) return;
    try {
      await api.delete(`/company-master/city-codes/${id}`);
      await loadCityCodes();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  if (entLoading) return <LoadingSpinner />;
  if (entError) return <AlertMessage type="error" message={entError} />;

  const selectedEntity = entities.find(e => e.id === selectedEntityId) || entities[0] || null;
  const effectiveId = selectedEntity?.id;

  const entityRegs = registrations.filter(r => r.legalEntityId === effectiveId);
  const entityRegIds = new Set(entityRegs.map(r => r.id));

  // Top-level = no principal linked, OR principal belongs to a different entity (edge case)
  // Additional registrations whose principal is in the same entity are shown INSIDE the principal's card
  const topLevelRegs = entityRegs.filter(
    r => !r.principalRegistrationId || !entityRegIds.has(r.principalRegistrationId)
  );
  const activeRegs = topLevelRegs.filter(r => r.isActive);
  const inactiveRegs = topLevelRegs.filter(r => !r.isActive);

  const handleSaved = () => { refetchEntities(); refetchRegs(); };

  // Total locations across all registrations for this entity
  const totalLocations = entityRegs.reduce((sum, r) => sum + (r.locations?.length || 0), 0);

  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Building2 className="text-blue-600" size={22} />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Company Master</h1>
              <p className="text-xs text-gray-500">Legal entities · GSTIN registrations · Physical locations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowCityCodes(true); loadCityCodes(); }}
              className="flex items-center gap-1.5 px-3 py-2 text-slate-600 border border-slate-200 text-sm rounded-lg hover:bg-slate-50"
              title="Manage City Codes (used for GSTIN abbreviation generation)">
              <Settings size={15} /> City Codes
            </button>
            {activeTab === 'registrations' && (
              <button onClick={() => setEntityModal('add')}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                <Plus size={15} /> Add Entity
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-1 border-b border-slate-100 -mb-4 pb-0">
          <button
            onClick={() => navigate('/admin/company-master')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'registrations'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}>
            <span className="flex items-center gap-1.5"><Building2 size={14} /> Registrations</span>
          </button>
          <button
            onClick={() => navigate('/admin/branches')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'branches'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}>
            <span className="flex items-center gap-1.5"><GitBranch size={14} /> Branches</span>
          </button>
        </div>
      </div>

      {/* Branches tab */}
      {activeTab === 'branches' && <BranchManager embedded />}

      {/* Registrations tab */}
      {activeTab === 'registrations' && (
        <div className="flex flex-1 overflow-hidden">

          {/* Left panel: Legal Entities */}
          <div className="w-72 border-r border-gray-200 flex flex-col overflow-hidden bg-gray-50/50">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Legal Entities ({entities.length})
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {entities.length === 0 ? (
                <EmptyState icon="🏢" title="No entities yet" subtitle="Add a legal entity to start" />
              ) : (
                entities.map(entity => {
                  const isSelected = entity.id === effectiveId;
                  const regCount = registrations.filter(r => r.legalEntityId === entity.id).length;
                  const locCount = registrations
                    .filter(r => r.legalEntityId === entity.id)
                    .reduce((s, r) => s + (r.locations?.length || 0), 0);
                  return (
                    <button key={entity.id}
                      onClick={() => setSelectedEntityId(entity.id)}
                      className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                        isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-100 border border-transparent'
                      }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          {entity.shortName && (
                            <span className={`flex-shrink-0 text-xs font-bold px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                            }`}>
                              {entity.shortName}
                            </span>
                          )}
                          <p className="text-sm font-medium text-gray-900 truncate">{entity.legalName}</p>
                        </div>
                        <ChevronRight size={14} className={`flex-shrink-0 ml-1 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`} />
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {entity.pan && <span className="text-xs text-gray-400 font-mono">{entity.pan}</span>}
                        <Badge color="blue">{regCount} GSTIN{regCount !== 1 ? 's' : ''}</Badge>
                        {locCount > 0 && <Badge color="gray">{locCount} location{locCount !== 1 ? 's' : ''}</Badge>}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right panel */}
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
                    <div className="flex items-start gap-3">
                      {selectedEntity.shortName && (
                        <span className="flex-shrink-0 inline-flex items-center justify-center bg-blue-600 text-white text-lg font-bold px-3 py-1.5 rounded-lg tracking-wide">
                          {selectedEntity.shortName}
                        </span>
                      )}
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">{selectedEntity.legalName}</h2>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                          {selectedEntity.pan && (
                            <span><span className="text-gray-400">PAN:</span> <span className="font-mono">{selectedEntity.pan}</span></span>
                          )}
                          {selectedEntity.tan && (
                            <span><span className="text-gray-400">TAN:</span> <span className="font-mono">{selectedEntity.tan}</span></span>
                          )}
                          {selectedEntity.lei && (
                            <span><span className="text-gray-400">LEI:</span> <span className="font-mono truncate max-w-[140px]">{selectedEntity.lei}</span></span>
                          )}
                        </div>
                        {/* Entity-level summary */}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                          <span>🏛️ {entityRegs.filter(r=>r.isActive).length} active registration{entityRegs.filter(r=>r.isActive).length !== 1 ? 's' : ''}</span>
                          {totalLocations > 0 && (
                            <span>📍 {totalLocations} registered location{totalLocations !== 1 ? 's' : ''}</span>
                          )}
                        </div>
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
                    <div className="space-y-8">
                      {activeRegs.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                            Active Registrations ({entityRegs.filter(r => r.isActive).length} total
                            {entityRegs.filter(r => r.isActive).length !== activeRegs.length
                              ? ` · ${activeRegs.length} principal${activeRegs.length !== 1 ? 's' : ''}`
                              : ''})
                          </p>
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {activeRegs.map(reg => (
                              <RegistrationCard key={reg.id} reg={reg}
                                onEdit={r => setRegModal(r)}
                                onDeactivate={r => setDeactivateTarget(r)}
                                onReactivate={r => setReactivateTarget(r)}
                                onLocationsUpdated={refetchRegs}
                                onAddAdditional={id => { setAddAdditionalForId(id); setRegModal('add-additional'); }} />
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
                              <RegistrationCard key={reg.id} reg={reg}
                                onEdit={() => {}} onDeactivate={() => {}}
                                onReactivate={r => setReactivateTarget(r)}
                                onLocationsUpdated={refetchRegs} />
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
      )}

      {/* Global Modals */}
      {entityModal && (
        <EntityModal
          entity={entityModal === 'add' ? null : entityModal}
          onClose={() => setEntityModal(null)}
          onSaved={handleSaved} />
      )}
      {regModal && (
        <RegistrationModal
          registration={(regModal === 'add' || regModal === 'add-additional') ? null : regModal}
          entityId={effectiveId}
          allRegistrations={registrations || []}
          onClose={() => { setRegModal(null); setAddAdditionalForId(null); }}
          onSaved={handleSaved}
          initialPrincipalId={regModal === 'add-additional' ? addAdditionalForId : null} />
      )}
      {deactivateTarget && (
        <DeactivateModal
          reg={deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
          onDone={handleSaved} />
      )}
      {reactivateTarget && (
        <ReactivateModal
          reg={reactivateTarget}
          onClose={() => setReactivateTarget(null)}
          onDone={handleSaved} />
      )}

      {/* City Codes Modal */}
      {showCityCodes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCityCodes(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold">City Codes</h3>
                <p className="text-xs text-slate-400 mt-0.5">Used to auto-generate GSTIN abbreviations (e.g. Mumbai → MUM → CPIPL-MUM/27-R1)</p>
              </div>
              <button onClick={() => setShowCityCodes(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <input type="text" placeholder="City Name" value={cityForm.cityName}
                  onChange={e => setCityForm(p => ({ ...p, cityName: e.target.value }))}
                  className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="text" placeholder="Code" value={cityForm.code} maxLength={5}
                  onChange={e => setCityForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  className="w-20 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase" />
                <button onClick={handleAddCity} disabled={cityLoading || !cityForm.cityName.trim() || !cityForm.code.trim()}
                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  <Plus size={16} />
                </button>
              </div>
              <div className="max-h-64 overflow-auto border rounded-lg divide-y">
                {cityCodes.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No city codes yet</p>
                ) : cityCodes.map(cc => (
                  <div key={cc.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50">
                    <div>
                      <span className="text-sm font-medium text-slate-700">{cc.cityName}</span>
                      <span className="ml-2 text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded">{cc.code}</span>
                    </div>
                    <button onClick={() => handleDeleteCity(cc.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
