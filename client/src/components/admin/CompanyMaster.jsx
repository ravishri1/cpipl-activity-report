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
  Shield, AlertTriangle, GitBranch, Settings, X, Trash2, Layers, Key, Eye, EyeOff, ExternalLink,
  Network, Users, User, Lock, Landmark
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
    isPrimary: entity?.isPrimary || false,
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
      isPrimary: form.isPrimary,
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
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.isPrimary} onChange={e => set('isPrimary', e.target.checked)}
              className="w-4 h-4 accent-emerald-600" />
            <span className="text-sm text-gray-700">
              <span className="font-medium">Primary Entity</span>
              <span className="text-gray-400 ml-1">— bank accounts belong to this entity; others inherit them</span>
            </span>
          </label>
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
  const principalReg = initialPrincipalId
    ? allRegistrations.find(r => r.id === parseInt(initialPrincipalId))
    : null;
  const [form, setForm] = useState({
    gstin: registration?.gstin || principalReg?.gstin || '',
    siteCode: registration?.siteCode || '',
    officeCity: registration?.officeCity || principalReg?.officeCity || '',
    state: registration?.state || principalReg?.state || '',
    district: registration?.district || '',
    placeType: registration?.placeType || (initialPrincipalId ? 'Additional' : 'Principal'),
    principalRegistrationId: registration?.principalRegistrationId || initialPrincipalId || '',
    address: registration?.address || '',
    fssai: registration?.fssai || '',
    udyam: registration?.udyam || '',
    iec: registration?.iec || '',
    primaryBusiness: registration?.primaryBusiness || '',
    isPrimary: registration?.isPrimary || false,
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
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GSTIN *
                {principalReg && !registration && (
                  <span className="text-xs text-blue-500 font-normal ml-1">· same as principal</span>
                )}
              </label>
              <input value={form.gstin} onChange={e => set('gstin', e.target.value.toUpperCase())}
                required maxLength={15} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="27AAJCC2415M1ZJ" disabled={!!registration || !!principalReg} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Site Code
                <span className="text-xs text-gray-400 font-normal ml-1">(e.g. R1, HO, WH1)</span>
              </label>
              <input value={form.siteCode} onChange={e => set('siteCode', e.target.value.toUpperCase())}
                maxLength={10} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="R1" />
            </div>
          </div>
          {abbrPreview && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Abbr Preview:</span>
              <span className="text-sm font-mono font-bold text-blue-700 tracking-wider">{abbrPreview}</span>
              {form.siteCode && <span className="text-xs text-gray-400">· will update on save</span>}
            </div>
          )}
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
                {(() => {
                  const selected = (form.placeType || '').split(',').map(s => s.trim()).filter(Boolean);
                  const hasAdditional = selected.some(s => ['Additional','E-APOB','I-APOB'].includes(s));
                  const hasPrincipal = selected.includes('Principal');
                  // Principal and Additional/E-APOB/I-APOB are mutually exclusive
                  const visibleOptions = PLACE_TYPE_OPTIONS.filter(opt => {
                    if (opt === 'Principal' && hasAdditional) return false;
                    if (opt === 'Additional' && hasPrincipal) return false;
                    return true;
                  });
                  return visibleOptions.map(opt => {
                    const isChecked = selected.includes(opt);
                    const toggle = () => {
                      let next;
                      if (isChecked) {
                        next = selected.filter(s => s !== opt);
                      } else {
                        // Adding — enforce mutual exclusivity
                        if (opt === 'Principal') {
                          next = [...selected.filter(s => !['Additional'].includes(s)), opt];
                        } else {
                          next = [...selected.filter(s => s !== 'Principal'), opt];
                        }
                      }
                      // Clear principalRegistrationId if switching to Principal
                      if (opt === 'Principal' && !isChecked) set('principalRegistrationId', '');
                      set('placeType', next.join(',') || 'Principal');
                    };
                    return (
                      <label key={opt} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors
                        ${isChecked ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                        <input type="checkbox" checked={isChecked} onChange={toggle} className="rounded text-blue-600 w-3.5 h-3.5" />
                        {opt}
                      </label>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
          {/* Principal Registration dropdown — show when NOT Principal */}
          {!(form.placeType || '').includes('Principal') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Linked Principal Registration *</label>
              <select value={form.principalRegistrationId}
                onChange={e => {
                  set('principalRegistrationId', e.target.value);
                  // Auto-fill state from selected principal
                  const principal = allRegistrations.find(r => r.id === parseInt(e.target.value));
                  if (principal) {
                    if (!form.state) set('state', principal.state);
                  }
                }}
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
                <p className="text-xs font-medium text-slate-600 mb-2">
                  Principal: {linkedPrincipal ? linkedPrincipal.abbr : <span className="text-slate-400 font-normal">— select a Principal above</span>}
                </p>
                {linkedPrincipal && (
                  <div className="mb-3 pb-2 border-b border-slate-200">
                    <span className="text-xs text-gray-400 uppercase tracking-wide">GSTIN</span>
                    <p className="text-sm font-mono font-bold text-blue-700 tracking-wider mt-0.5">{linkedPrincipal.gstin}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{linkedPrincipal.officeCity} · {linkedPrincipal.state}</p>
                  </div>
                )}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label <span className="text-xs text-gray-400 font-normal">(short tag — e.g. Primary, Head Office, Regional Hub)</span>
            </label>
            <input value={form.primaryBusiness} onChange={e => set('primaryBusiness', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Primary" maxLength={50} />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={!!form.isPrimary} onChange={e => set('isPrimary', e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
            <span className="text-sm font-medium text-gray-700">Primary registration</span>
            <span className="text-xs text-gray-400">(bank accounts managed here; other branches auto-inherit)</span>
          </label>

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

// ─── Credentials Panel (shown inside Panel 3) ─────────────────────────────────

function MaskedPwd({ password }) {
  const [show, setShow] = useState(false);
  if (!password) return <span className="text-gray-300 italic text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono text-xs">{show ? password : '••••••••'}</span>
      <button onClick={() => setShow(v => !v)} className="text-gray-400 hover:text-gray-600">
        {show ? <EyeOff size={11} /> : <Eye size={11} />}
      </button>
    </span>
  );
}

function CredentialsPanel({ legalEntityId }) {
  const { data: portals, loading, error } = useFetch(
    legalEntityId ? `/credentials/portals?legalEntityId=${legalEntityId}` : null,
    []
  );

  const totalCreds = portals.reduce((s, p) => s + (p._count?.credentials || 0), 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-indigo-50/40">
        <div className="flex items-center gap-2">
          <Key size={15} className="text-indigo-500" />
          <span className="font-semibold text-gray-800 text-sm">Credentials</span>
          {totalCreds > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-indigo-200 text-indigo-800">{totalCreds}</span>
          )}
          <span className="text-xs text-gray-400 hidden sm:inline">Portals & logins for this company</span>
        </div>
        <a href="/admin/credentials" className="flex items-center gap-1 text-xs text-indigo-700 border border-indigo-300 bg-white px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors font-medium">
          <ExternalLink size={11} /> Manage
        </a>
      </div>

      {loading ? (
        <div className="px-5 py-6 text-center text-xs text-gray-400">Loading…</div>
      ) : error ? (
        <div className="px-5 py-4 text-xs text-red-500">{error}</div>
      ) : portals.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <Key size={28} className="mx-auto mb-2 text-gray-200" />
          <p className="text-sm text-gray-400 font-medium">No credentials linked</p>
          <p className="text-xs text-gray-300 mt-1">Go to Credentials to add portals for this company</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {portals.map(portal => (
            <PortalCredRow key={portal.id} portal={portal} />
          ))}
        </div>
      )}
    </div>
  );
}

function PortalCredRow({ portal }) {
  const [expanded, setExpanded] = useState(false);
  const { data: creds, loading } = useFetch(
    expanded ? `/credentials/portals/${portal.id}/credentials` : null,
    []
  );

  const CATEGORY_COLORS = {
    email: 'bg-blue-100 text-blue-700',
    tax: 'bg-orange-100 text-orange-700',
    banking: 'bg-green-100 text-green-700',
    erp: 'bg-purple-100 text-purple-700',
    cloud: 'bg-sky-100 text-sky-700',
    social: 'bg-pink-100 text-pink-700',
    government: 'bg-red-100 text-red-700',
    other: 'bg-slate-100 text-slate-600',
  };

  return (
    <div>
      <button onClick={() => setExpanded(v => !v)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-indigo-50/20 transition-colors text-left">
        <div className="flex items-center gap-2.5">
          {expanded ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
          <span className="text-sm font-medium text-gray-800">{portal.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[portal.category] || CATEGORY_COLORS.other}`}>
            {portal.category}
          </span>
          {portal._count?.credentials > 0 && (
            <span className="text-xs text-gray-400">{portal._count.credentials} login{portal._count.credentials !== 1 ? 's' : ''}</span>
          )}
        </div>
        {portal.url && (
          <a href={portal.url} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-gray-300 hover:text-blue-500 shrink-0">
            <ExternalLink size={12} />
          </a>
        )}
      </button>

      {expanded && (
        <div className="bg-gray-50 border-t border-gray-100">
          {loading ? (
            <div className="px-6 py-3 text-xs text-gray-400">Loading…</div>
          ) : creds.length === 0 ? (
            <div className="px-6 py-3 text-xs text-gray-400 italic">No credentials added yet</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-200">
                  <th className="px-5 py-2 text-left font-medium">Login ID</th>
                  <th className="px-3 py-2 text-left font-medium">Password</th>
                  <th className="px-3 py-2 text-left font-medium">Phone</th>
                  <th className="px-3 py-2 text-left font-medium">Department</th>
                  <th className="px-3 py-2 text-left font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {creds.map(c => (
                  <tr key={c.id} className="hover:bg-white transition-colors">
                    <td className="px-5 py-2.5 font-mono text-gray-700">{c.username}</td>
                    <td className="px-3 py-2.5"><MaskedPwd password={c.password} /></td>
                    <td className="px-3 py-2.5 text-gray-500">{c.phoneNumber || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500">{c.department || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500">{c.purpose || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Bank Accounts Panel ─────────────────────────────────────────────────────

const ACCOUNT_TYPE_LABELS = { current: 'Current', savings: 'Savings', cc: 'Cash Credit', od: 'OD' };
const ACCOUNT_TYPE_COLORS = {
  current:  'bg-blue-100 text-blue-700',
  savings:  'bg-green-100 text-green-700',
  cc:       'bg-orange-100 text-orange-700',
  od:       'bg-red-100 text-red-700',
};

function BankAccountModal({ account, legalEntityId, onClose, onSaved }) {
  const { execute, loading, error } = useApi();
  const [form, setForm] = useState({
    accountHolderName: account?.accountHolderName || '',
    bankName:          account?.bankName || '',
    accountNumber:     account?.accountNumber || '',
    ifscCode:          account?.ifscCode || '',
    branchName:        account?.branchName || '',
    accountType:       account?.accountType || 'current',
    isPrimary:         account?.isPrimary || false,
    notes:             account?.notes || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      legalEntityId,
      accountHolderName: form.accountHolderName,
      bankName:          form.bankName,
      accountNumber:     form.accountNumber,
      ifscCode:          form.ifscCode,
      branchName:        form.branchName || null,
      accountType:       form.accountType,
      isPrimary:         form.isPrimary,
      notes:             form.notes || null,
    };
    try {
      if (account) {
        await execute(() => api.put(`/company-master/bank-accounts/${account.id}`, payload), 'Bank account updated!');
      } else {
        await execute(() => api.post('/company-master/bank-accounts', payload), 'Bank account added!');
      }
      onSaved();
      onClose();
    } catch { /* useApi shows error */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-semibold">{account ? 'Edit Bank Account' : 'Add Bank Account'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <AlertMessage type="error" message={error} />}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Account Holder Name *</label>
              <input value={form.accountHolderName} onChange={e => set('accountHolderName', e.target.value)} required
                placeholder="Color Papers India Private Limited"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Bank Name *</label>
              <input value={form.bankName} onChange={e => set('bankName', e.target.value)} required
                placeholder="State Bank of India"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Account Number *</label>
              <input value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)} required
                placeholder="12345678901234"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">IFSC Code *</label>
              <input value={form.ifscCode} onChange={e => set('ifscCode', e.target.value.toUpperCase())} required
                placeholder="SBIN0001234" maxLength={11}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Branch</label>
              <input value={form.branchName} onChange={e => set('branchName', e.target.value)}
                placeholder="Lucknow Main Branch"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Account Type</label>
              <select value={form.accountType} onChange={e => set('accountType', e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="current">Current</option>
                <option value="savings">Savings</option>
                <option value="cc">Cash Credit (CC)</option>
                <option value="od">Overdraft (OD)</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                placeholder="e.g. Used for GST refunds, salary disbursement..."
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isPrimary} onChange={e => set('isPrimary', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
                <span className="text-sm text-slate-700">Mark as Primary Account</span>
                <span className="text-xs text-slate-400">(used for salary credit, expense reimbursement)</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Saving…' : account ? 'Update' : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BankAccountsPanel({ legalEntityId, selectedReg, entityRegs = [] }) {
  const { data: accounts, loading, error, refetch } = useFetch(
    legalEntityId ? `/company-master/bank-accounts?legalEntityId=${legalEntityId}` : null,
    []
  );
  const { execute } = useApi();
  const [modal, setModal] = useState(null); // null | 'add' | accountObj
  const [showNums, setShowNums] = useState({});

  // If any registration is explicitly marked isPrimary, only that one gets Add.
  // If none is marked, the Principal registration acts as default.
  const entityHasPrimary = entityRegs.some(r => r.isPrimary);
  const isPrincipal = (selectedReg?.placeType || 'Principal').includes('Principal');
  const canAdd = selectedReg?.isPrimary === true || (!entityHasPrimary && isPrincipal);

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this bank account?')) return;
    try {
      await execute(() => api.delete(`/company-master/bank-accounts/${id}`), 'Removed');
      refetch();
    } catch { /* ignore */ }
  };

  const maskAccount = (num) => num ? `****${num.slice(-4)}` : '—';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-emerald-50/40">
        <div className="flex items-center gap-2">
          <Landmark size={15} className="text-emerald-600" />
          <span className="font-semibold text-gray-800 text-sm">Bank Accounts</span>
          {accounts.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-200 text-emerald-800">{accounts.length}</span>
          )}
        </div>
        {canAdd && (
          <button onClick={() => setModal('add')}
            className="flex items-center gap-1 text-xs text-emerald-700 border border-emerald-300 bg-white px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors font-medium">
            <Plus size={11} /> Add
          </button>
        )}
      </div>

      {/* Notice for non-primary/non-principal registrations */}
      {selectedReg && !canAdd && (
        <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
          <Landmark size={12} className="text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700">
            {entityHasPrimary
              ? <>Showing accounts from the primary registration. To manage, select the <span className="font-semibold">Primary</span> GSTIN.</>
              : <>This is an additional registration. Select the <span className="font-semibold">Principal</span> GSTIN to manage bank accounts.</>}
          </p>
        </div>
      )}

      {loading ? (
        <div className="px-5 py-6 text-center text-xs text-gray-400">Loading…</div>
      ) : error ? (
        <div className="px-5 py-4 text-xs text-red-500">{error}</div>
      ) : accounts.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <Landmark size={28} className="mx-auto mb-2 text-gray-200" />
          <p className="text-sm text-gray-400 font-medium">No bank accounts added</p>
          {canAdd
            ? <p className="text-xs text-gray-300 mt-1">Add the company's current / savings accounts</p>
            : <p className="text-xs text-gray-300 mt-1">Select the <span className="font-semibold">Primary</span> GSTIN registration to add bank accounts</p>
          }
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {accounts.map(acc => (
            <div key={acc.id} className="px-5 py-3.5 flex items-start justify-between group hover:bg-gray-50/50 transition-colors">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mt-0.5">
                  <Landmark size={14} className="text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{acc.bankName}</span>
                    {acc.isPrimary && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">Primary</span>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ACCOUNT_TYPE_COLORS[acc.accountType] || 'bg-slate-100 text-slate-600'}`}>
                      {ACCOUNT_TYPE_LABELS[acc.accountType] || acc.accountType}
                    </span>
                    {acc.companyRegistration && (
                      <span className="text-xs text-slate-400">{acc.companyRegistration.abbr}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{acc.accountHolderName}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs font-mono text-gray-600">
                      {showNums[acc.id] ? acc.accountNumber : maskAccount(acc.accountNumber)}
                    </span>
                    <button onClick={() => setShowNums(p => ({ ...p, [acc.id]: !p[acc.id] }))}
                      className="text-slate-300 hover:text-slate-500">
                      {showNums[acc.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                    <span className="text-xs font-mono text-gray-400">{acc.ifscCode}</span>
                    {acc.branchName && <span className="text-xs text-gray-400">{acc.branchName}</span>}
                  </div>
                  {acc.notes && <p className="text-xs text-gray-400 italic mt-1">{acc.notes}</p>}
                </div>
              </div>
              {canAdd && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-3">
                  <button onClick={() => setModal(acc)}
                    className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => handleDelete(acc.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove">
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <BankAccountModal
          account={modal === 'add' ? null : modal}
          legalEntityId={legalEntityId}
          onClose={() => setModal(null)}
          onSaved={refetch}
        />
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

// ─── Company Org Chart ───────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  email:      'bg-blue-100 text-blue-700',
  tax:        'bg-orange-100 text-orange-700',
  banking:    'bg-green-100 text-green-700',
  erp:        'bg-purple-100 text-purple-700',
  cloud:      'bg-sky-100 text-sky-700',
  social:     'bg-pink-100 text-pink-700',
  government: 'bg-red-100 text-red-700',
  other:      'bg-slate-100 text-slate-600',
};
const CATEGORY_LABELS = {
  email: 'Email', tax: 'Tax', banking: 'Banking', erp: 'ERP',
  cloud: 'Cloud', social: 'Social', government: 'Govt', other: 'Other',
};

const OCT_CSS = `
.oct-row{display:flex;flex-direction:row;position:relative;padding-top:28px}
.oct-row::before{content:'';position:absolute;top:0;left:50%;margin-left:-1px;width:2px;height:28px;background:#94a3b8}
.oct-col{display:flex;flex-direction:column;align-items:center;padding:0 10px;position:relative}
.oct-col::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:#94a3b8}
.oct-col:first-child::before{left:50%}
.oct-col:last-child::before{right:50%}
.oct-col:only-child::before{display:none}
.oct-col::after{content:'';position:absolute;top:0;left:50%;margin-left:-1px;width:2px;height:28px;background:#94a3b8}
.oct-gap{height:28px}
`;

function OrgBox({ label, sublabel, badge, colorClass, onClick, open, count, icon: Icon, manageUrl, links }) {
  const navigate = useNavigate();
  const allLinks = [
    ...(manageUrl ? [{ url: manageUrl, text: 'Credential Manager' }] : []),
    ...(links || []),
  ];
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{ minWidth: 110, maxWidth: 160 }}
      className={`border-2 rounded-xl px-3 py-2 text-center shadow-sm transition-all select-none ${colorClass} ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-105' : ''}`}>
      {Icon && <Icon className="w-4 h-4 mx-auto mb-0.5 opacity-50" />}
      <div className="text-xs font-semibold leading-tight break-words">{label}</div>
      {sublabel && <div className="text-[10px] opacity-60 leading-tight mt-0.5">{sublabel}</div>}
      {badge && <div className="mt-1 text-[9px] px-1.5 py-0.5 rounded-full bg-white bg-opacity-60 inline-block font-medium">{badge}</div>}
      {count !== undefined && count > 0 && !open && (
        <div className="text-[9px] opacity-40 mt-0.5">▼ {count} below</div>
      )}
      {allLinks.map((link, i) => (
        <div key={i}
          onClick={e => { e.stopPropagation(); navigate(link.url); }}
          className="mt-1 text-[9px] flex items-center justify-center gap-0.5 opacity-40 hover:opacity-90 cursor-pointer font-medium underline underline-offset-1">
          <ExternalLink className="w-2.5 h-2.5" /> {link.text}
        </div>
      ))}
    </div>
  );
}

function OrgRow({ children }) {
  const kids = [].concat(children).flat().filter(Boolean);
  if (!kids.length) return null;
  return (
    <div className="oct-row">
      {kids.map((child, i) => (
        <div key={i} className="oct-col">
          <div className="oct-gap" />
          {child}
        </div>
      ))}
    </div>
  );
}

function CredOrgNode({ cred }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  // Deduplicate: department users that aren't already assignee or shared
  const existingIds = new Set([cred.assignee?.id, ...cred.sharedWithUsers.map(u => u.id)].filter(Boolean));
  const deptUsers = (cred.departmentUsers || []).filter(u => !existingIds.has(u.id));
  const totalUsers = (cred.assignee ? 1 : 0) + cred.sharedWithUsers.length + deptUsers.length;
  const statusBadge = cred.status === 'active' ? '● active' : cred.status === 'revoked' ? '✕ revoked' : '⊘ expired';
  const employees = [
    cred.assignee && { id: 'a', label: cred.assignee.name, sub: `${cred.assignee.employeeId} · assigned`, color: 'bg-teal-50 border-teal-300 text-teal-900', icon: User, userId: cred.assignee.id },
    ...cred.sharedWithUsers.map(u => ({ id: u.id, label: u.name, sub: `${u.employeeId} · shared`, color: 'bg-teal-50 border-teal-300 text-teal-900', icon: Users, userId: u.id })),
    ...deptUsers.map(u => ({ id: `dept-${u.id}`, label: u.name, sub: `${u.employeeId} · ${cred.department}`, color: 'bg-blue-50 border-blue-300 text-blue-900', icon: Users, userId: u.id })),
  ].filter(Boolean);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <OrgBox
        label={cred.username}
        sublabel={cred.label || cred.type}
        badge={statusBadge}
        colorClass="bg-amber-50 border-amber-300 text-amber-900"
        onClick={totalUsers ? () => setOpen(o => !o) : undefined}
        open={open}
        count={totalUsers}
        icon={Key}
        links={[{ url: '/admin/credentials', text: 'Credentials' }]}
      />
      {open && employees.length > 0 && (
        <OrgRow>
          {employees.map(e => (
            <OrgBox key={e.id} label={e.label} sublabel={e.sub} colorClass={e.color} icon={e.icon}
              onClick={e.userId ? () => navigate(`/employee/${e.userId}`) : undefined}
              links={e.userId ? [{ url: `/employee/${e.userId}`, text: 'Profile' }] : []}
            />
          ))}
        </OrgRow>
      )}
    </div>
  );
}

function PortalOrgNode({ portal, regId }) {
  const [open, setOpen] = useState(false);
  const catLabel = CATEGORY_LABELS[portal.category] || 'Other';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <OrgBox
        label={portal.name}
        sublabel={catLabel}
        badge={`${portal.credentials.length} credentials`}
        colorClass="bg-purple-50 border-purple-400 text-purple-900"
        onClick={() => setOpen(o => !o)}
        open={open}
        count={portal.credentials.length}
        icon={Globe}
        manageUrl={`/admin/credentials?reg=${regId || portal.companyRegistrationId}`}
      />
      {open && portal.credentials.length > 0 && (
        <OrgRow>
          {portal.credentials.map(cred => <CredOrgNode key={cred.id} cred={cred} />)}
        </OrgRow>
      )}
    </div>
  );
}

function RegOrgNode({ reg }) {
  const [open, setOpen] = useState(false);
  const isEntityLevel = reg.id?.toString().startsWith('entity_');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <OrgBox
        label={reg.abbr || reg.gstin || 'Direct'}
        sublabel={reg.officeCity}
        badge={`${reg.portals.length} portals`}
        colorClass={isEntityLevel ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-blue-50 border-blue-400 text-blue-900'}
        onClick={() => setOpen(o => !o)}
        open={open}
        count={reg.portals.length}
        icon={isEntityLevel ? Building2 : Hash}
        manageUrl={reg.manageUrl || `/admin/credentials?reg=${reg.id}`}
      />
      {open && reg.portals.length > 0 && (
        <OrgRow>
          {reg.portals.map(portal => <PortalOrgNode key={portal.id} portal={portal} regId={isEntityLevel ? undefined : reg.id} />)}
        </OrgRow>
      )}
    </div>
  );
}

function CompanyOrgChartView() {
  const { data: tree, loading, error } = useFetch('/credentials/tree', []);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (tree && tree.length > 0 && !selectedId) {
      const best = tree.find(e => e.registrations.some(r => r.portals.length > 0)) || tree[0];
      setSelectedId(best?.id ?? null);
    }
  }, [tree]);

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  if (error) return <AlertMessage type="error" message={error} />;

  const entity = tree.find(e => e.id === selectedId);
  const regsWithPortals = (entity?.registrations || []).filter(r => r.portals.length > 0);
  const entityLevelVirtual = entity?.entityPortals?.length > 0
    ? [{ id: `entity_${entity.id}`, abbr: 'Direct Portals', officeCity: 'Entity-level (no specific registration)', portals: entity.entityPortals, manageUrl: `/admin/credentials?reg=entity_${entity.id}` }]
    : [];
  const allRegs = [...entityLevelVirtual, ...regsWithPortals];
  const filteredRegs = search.trim()
    ? allRegs.filter(reg => {
        const q = search.toLowerCase();
        return reg.abbr?.toLowerCase().includes(q) || reg.officeCity?.toLowerCase().includes(q) ||
          reg.portals.some(p => p.name.toLowerCase().includes(q) ||
            p.credentials.some(c => c.username.toLowerCase().includes(q) || c.label?.toLowerCase().includes(q))
          );
      })
    : allRegs;

  const totalPortals = tree.reduce((s, e) => s + e.registrations.reduce((s2, r) => s2 + r.portals.length, 0), 0);
  const totalCreds = tree.reduce((s, e) => s + e.registrations.reduce((s2, r) => s2 + r.portals.reduce((s3, p) => s3 + p.credentials.length, 0), 0), 0);

  return (
    <div className="p-6 space-y-4">
      <style>{OCT_CSS}</style>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-4 text-sm text-slate-500">
          <span><strong className="text-slate-700">{tree.length}</strong> entities</span>
          <span><strong className="text-slate-700">{totalPortals}</strong> portals</span>
          <span><strong className="text-slate-700">{totalCreds}</strong> credentials</span>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search registration, portal, credential..."
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {tree.map(e => (
          <button key={e.id} onClick={() => { setSelectedId(e.id); setSearch(''); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              selectedId === e.id
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
            }`}>
            {e.shortName || e.legalName}
          </button>
        ))}
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-10 min-h-[300px]">
        {entity ? (
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', minWidth: '100%' }}>
            <OrgBox
              label={entity.legalName}
              sublabel={`PAN: ${entity.pan}`}
              badge={`${entity.registrations.length} registrations`}
              colorClass="bg-emerald-100 border-emerald-500 text-emerald-900"
              icon={Building2}
            />
            {filteredRegs.length > 0 ? (
              <OrgRow>
                {filteredRegs.map(reg => <RegOrgNode key={reg.id} reg={reg} />)}
              </OrgRow>
            ) : (
              <p className="mt-8 text-sm text-slate-400 italic">
                {search ? 'No matching registrations' : 'No portals linked yet'}
              </p>
            )}
          </div>
        ) : (
          <EmptyState icon="🏢" title="Select an entity" subtitle="Choose a company above to view its chart" />
        )}
      </div>

      <p className="text-xs text-slate-400 text-center">
        Click any node to expand · Registrations without portals are hidden
      </p>
    </div>
  );
}

// (kept for backwards compat — unused)
function TreeCredential({ cred }) {
  const [open, setOpen] = useState(false);
  const totalUsers = (cred.assignee ? 1 : 0) + cred.sharedWithUsers.length + (cred.department ? 1 : 0);
  const statusColor = cred.status === 'active' ? 'bg-emerald-100 text-emerald-700'
    : cred.status === 'revoked' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
  return (
    <div className="ml-4 border-l-2 border-slate-100 pl-3 mt-1">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left py-1 hover:bg-slate-50 rounded px-1 group">
        <Key className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-xs font-mono text-slate-700 truncate">{cred.username}</span>
        {cred.label && <span className="text-xs text-slate-400 truncate">· {cred.label}</span>}
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${statusColor}`}>{cred.status}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0 capitalize">{cred.type}</span>
        {totalUsers > 0 && (
          <span className="ml-auto text-[10px] text-slate-400 flex items-center gap-0.5 shrink-0">
            <Users className="w-3 h-3" />{totalUsers}
          </span>
        )}
        {open ? <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" /> : <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div className="ml-4 border-l border-dashed border-slate-200 pl-3 pb-1 space-y-0.5">
          {cred.purpose && (
            <p className="text-[11px] text-slate-500 italic py-0.5">{cred.purpose}</p>
          )}
          {cred.assignee && (
            <div className="flex items-center gap-1.5 py-0.5">
              <User className="w-3 h-3 text-blue-400 shrink-0" />
              <span className="text-xs text-slate-700">{cred.assignee.name}</span>
              <span className="text-[10px] text-slate-400">({cred.assignee.employeeId})</span>
              <span className="text-[10px] bg-blue-50 text-blue-600 px-1 rounded">assigned</span>
            </div>
          )}
          {cred.sharedWithUsers.map(u => (
            <div key={u.id} className="flex items-center gap-1.5 py-0.5">
              <Users className="w-3 h-3 text-purple-400 shrink-0" />
              <span className="text-xs text-slate-700">{u.name}</span>
              <span className="text-[10px] text-slate-400">({u.employeeId})</span>
              <span className="text-[10px] bg-purple-50 text-purple-600 px-1 rounded">shared</span>
            </div>
          ))}
          {cred.department && (
            <div className="flex items-center gap-1.5 py-0.5">
              <Building2 className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-xs text-slate-700">{cred.department}</span>
              <span className="text-[10px] bg-amber-50 text-amber-600 px-1 rounded">dept access</span>
            </div>
          )}
          {totalUsers === 0 && (
            <p className="text-[11px] text-slate-400 italic py-0.5">No assignments</p>
          )}
        </div>
      )}
    </div>
  );
}

function TreePortal({ portal }) {
  const [open, setOpen] = useState(false);
  const credCount = portal.credentials.length;
  const activeCount = portal.credentials.filter(c => c.status === 'active').length;
  const catColor = CATEGORY_COLORS[portal.category] || CATEGORY_COLORS.other;
  const catLabel = CATEGORY_LABELS[portal.category] || 'Other';
  return (
    <div className="ml-4 border-l-2 border-slate-100 pl-3 mt-1.5">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left py-1.5 hover:bg-slate-50 rounded px-1">
        <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span className="text-sm font-medium text-slate-700 truncate">{portal.name}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${catColor}`}>{catLabel}</span>
        <span className="ml-auto text-[10px] text-slate-400 shrink-0">{activeCount}/{credCount} creds</span>
        {portal.url && (
          <a href={portal.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
            className="text-slate-300 hover:text-blue-500 shrink-0"><ExternalLink className="w-3 h-3" /></a>
        )}
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div>
          {credCount === 0 ? (
            <p className="ml-4 text-[11px] text-slate-400 italic py-1">No credentials</p>
          ) : (
            portal.credentials.map(cred => <TreeCredential key={cred.id} cred={cred} />)
          )}
        </div>
      )}
    </div>
  );
}

function TreeRegistration({ reg }) {
  const [open, setOpen] = useState(false);
  const portalCount = reg.portals.length;
  const totalCreds = reg.portals.reduce((s, p) => s + p.credentials.length, 0);
  return (
    <div className="ml-4 border-l-2 border-blue-100 pl-3 mt-2">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left py-1.5 hover:bg-blue-50 rounded px-1">
        <Hash className="w-3.5 h-3.5 text-blue-500 shrink-0" />
        <span className="text-sm font-semibold text-slate-700 font-mono">{reg.abbr || reg.gstin}</span>
        {reg.officeCity && <span className="text-xs text-slate-400">{reg.officeCity}</span>}
        {reg.gstin && reg.abbr && <span className="text-[10px] font-mono text-slate-400 truncate">{reg.gstin}</span>}
        <span className="ml-auto text-[10px] text-slate-400 shrink-0">{portalCount} portals · {totalCreds} creds</span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div>
          {portalCount === 0 ? (
            <p className="ml-4 text-[11px] text-slate-400 italic py-1">No portals linked</p>
          ) : (
            reg.portals.map(portal => <TreePortal key={portal.id} portal={portal} />)
          )}
        </div>
      )}
    </div>
  );
}

function CompanyTreeView() {
  const { data: tree, loading, error } = useFetch('/credentials/tree', []);
  const [expandAll, setExpandAll] = useState(false);
  const [search, setSearch] = useState('');

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  if (error) return <AlertMessage type="error" message={error} />;

  const filtered = search.trim()
    ? tree.filter(entity => {
        const q = search.toLowerCase();
        if (entity.legalName.toLowerCase().includes(q) || entity.shortName?.toLowerCase().includes(q)) return true;
        return entity.registrations.some(reg =>
          reg.abbr?.toLowerCase().includes(q) || reg.gstin?.toLowerCase().includes(q) ||
          reg.officeCity?.toLowerCase().includes(q) ||
          reg.portals.some(p =>
            p.name.toLowerCase().includes(q) ||
            p.credentials.some(c =>
              c.username.toLowerCase().includes(q) || c.label?.toLowerCase().includes(q) ||
              c.assignee?.name.toLowerCase().includes(q) ||
              c.sharedWithUsers.some(u => u.name.toLowerCase().includes(q))
            )
          )
        );
      })
    : tree;

  const totalPortals = tree.reduce((s, e) => s + e.registrations.reduce((s2, r) => s2 + r.portals.length, 0), 0);
  const totalCreds = tree.reduce((s, e) => s + e.registrations.reduce((s2, r) => s2 + r.portals.reduce((s3, p) => s3 + p.credentials.length, 0), 0), 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-4 text-sm text-slate-500">
          <span><strong className="text-slate-700">{tree.length}</strong> entities</span>
          <span><strong className="text-slate-700">{totalPortals}</strong> portals</span>
          <span><strong className="text-slate-700">{totalCreds}</strong> credentials</span>
        </div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search company, portal, employee..."
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🌲" title="No results" subtitle="Try a different search" />
      ) : (
        <div className="space-y-4">
          {filtered.map(entity => {
            const totalRegPortals = entity.registrations.reduce((s, r) => s + r.portals.length, 0);
            const totalRegCreds = entity.registrations.reduce((s, r) => s + r.portals.reduce((s2, p) => s2 + p.credentials.length, 0), 0);
            return (
              <EntityNode key={entity.id} entity={entity}
                totalPortals={totalRegPortals} totalCreds={totalRegCreds} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function EntityNode({ entity, totalPortals, totalCreds }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-3 w-full text-left px-5 py-3.5 bg-slate-50 hover:bg-slate-100 border-b border-slate-100">
        <Building2 className="w-5 h-5 text-blue-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 truncate">{entity.legalName}</p>
          <p className="text-xs text-slate-400">{entity.shortName} · PAN: {entity.pan}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
          <span>{entity.registrations.length} registrations</span>
          <span>{totalPortals} portals</span>
          <span>{totalCreds} creds</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 py-3">
          {entity.registrations.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-2">No registrations</p>
          ) : (
            entity.registrations.map(reg => <TreeRegistration key={reg.id} reg={reg} />)
          )}
        </div>
      )}
    </div>
  );
}

export default function CompanyMaster() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.pathname === '/admin/branches' ? 'branches'
    : new URLSearchParams(location.search).get('view') === 'tree' ? 'tree'
    : 'registrations';

  const { data: entities, loading: entLoading, error: entError, refetch: refetchEntities } =
    useFetch('/company-master/legal-entities', []);
  const { data: registrations, loading: regLoading, refetch: refetchRegs } =
    useFetch('/company-master/registrations', []);

  // Auto-select entity from URL param ?entityId=X (deep-link from Credentials page)
  const urlEntityId = parseInt(new URLSearchParams(location.search).get('entityId')) || null;
  const [selectedEntityId, setSelectedEntityId] = useState(urlEntityId);
  const [selectedRegId, setSelectedRegId] = useState(null);
  const [entityModal, setEntityModal] = useState(null);
  const [regModal, setRegModal] = useState(null);
  const [addAdditionalForId, setAddAdditionalForId] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [reactivateTarget, setReactivateTarget] = useState(null);
  const [locationModal, setLocationModal] = useState(null); // { location: null|obj, regId, regState }
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

  // Sync entity selection when URL param changes
  useEffect(() => {
    if (urlEntityId) setSelectedEntityId(urlEntityId);
  }, [urlEntityId]);

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

  // Auto-select: if no reg selected or selected reg not in this entity, use first active
  const selectedReg = (selectedRegId && topLevelRegs.find(r => r.id === selectedRegId))
    || topLevelRegs.find(r => r.isActive)
    || topLevelRegs[0]
    || null;

  // Visual grouping: standalone Additional registrations (no DB link) grouped under state-matching Principal
  const principalTopLevel = topLevelRegs.filter(r => (r.placeType || 'Principal').includes('Principal'));
  const standaloneAdds = topLevelRegs.filter(r => !(r.placeType || 'Principal').includes('Principal'));
  const inferredUnder = {}; // principalId -> [additional regs matched by stateCode]
  const orphanedAdds = [];
  standaloneAdds.forEach(add => {
    const match = principalTopLevel.find(p => p.stateCode === add.stateCode);
    if (match) {
      if (!inferredUnder[match.id]) inferredUnder[match.id] = [];
      inferredUnder[match.id].push(add);
    } else {
      orphanedAdds.push(add);
    }
  });
  // Panel 2 order: principals (with nested inferred children) + any orphaned additionals
  const panel2Regs = [...principalTopLevel, ...orphanedAdds];

  const handleSaved = () => { refetchEntities(); refetchRegs(); };

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
          <button
            onClick={() => navigate('/admin/company-master?view=tree')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'tree'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}>
            <span className="flex items-center gap-1.5"><Network size={14} /> Company Tree</span>
          </button>
        </div>
      </div>

      {/* Branches tab */}
      {activeTab === 'branches' && <BranchManager embedded />}

      {/* Tree tab */}
      {activeTab === 'tree' && <CompanyOrgChartView />}

      {/* Registrations tab — 3-panel layout (like cpdesk) */}
      {activeTab === 'registrations' && (
        <div className="flex flex-1 overflow-hidden">

          {/* ── Panel 1: Companies ─────────────────────────────── */}
          <div className="w-56 border-r border-gray-200 flex flex-col overflow-hidden bg-gray-100">
            <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Company</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {entities.map(entity => {
                const isSelected = entity.id === effectiveId;
                const regCount = registrations.filter(r => r.legalEntityId === entity.id).length;
                return (
                  <button key={entity.id}
                    onClick={() => { setSelectedEntityId(entity.id); setSelectedRegId(null); }}
                    className={`w-full text-left px-4 py-3.5 border-l-4 transition-colors ${
                      isSelected
                        ? 'border-l-blue-500 bg-white text-blue-900'
                        : 'border-l-transparent hover:bg-gray-50 text-gray-700'
                    }`}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`text-sm font-semibold leading-tight ${isSelected ? 'text-blue-800' : 'text-gray-800'}`}>
                        {entity.legalName}
                      </p>
                      {entity.isPrimary && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium leading-tight">Primary</span>
                      )}
                    </div>
                    {entity.pan && (
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{entity.pan}</p>
                    )}
                    <p className={`text-xs mt-1 font-medium ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}>
                      {regCount} GSTIN{regCount !== 1 ? 's' : ''}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-gray-200 p-2.5 bg-gray-50">
              <button onClick={() => setEntityModal('add')}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-blue-600 border border-blue-200 bg-white text-xs font-medium rounded-lg hover:bg-blue-50 transition-colors">
                <Plus size={13} /> Add Company
              </button>
            </div>
          </div>

          {/* ── Panel 2 + 3 (shown only when entity selected) ── */}
          {!selectedEntity ? (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <EmptyState icon="👈" title="Select a company" subtitle="Choose from the left panel" />
            </div>
          ) : (
            <>
              {/* ── Panel 2: GSTIN / State list ──────────────────── */}
              <div className="w-72 border-r border-gray-200 flex flex-col overflow-hidden bg-white">
                <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">GSTIN / State</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {entityRegs.filter(r => r.isActive).length} active
                        {topLevelRegs.length !== entityRegs.filter(r=>r.isActive).length
                          ? ` · ${topLevelRegs.filter(r=>r.isActive).length} principal${topLevelRegs.filter(r=>r.isActive).length!==1?'s':''}`
                          : ''}
                      </p>
                    </div>
                    <button onClick={() => setRegModal('add')}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
                      <Plus size={12} /> Add
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {regLoading ? <div className="p-4"><LoadingSpinner /></div>
                  : panel2Regs.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-400">No registrations yet.<br />Click Add to create one.</div>
                  ) : panel2Regs.map(reg => {
                    const isSelected = selectedReg?.id === reg.id;
                    const formalChildCount = reg.additionalRegistrations?.filter(r => r.isActive).length || 0;
                    const inferredChildren = inferredUnder[reg.id] || [];
                    const totalChildCount = formalChildCount + inferredChildren.filter(r => r.isActive).length;
                    const locCount = reg.locations?.length || 0;
                    const isPrincipal = (reg.placeType || 'Principal').includes('Principal');
                    return (
                      <div key={reg.id}>
                        <button
                          onClick={() => setSelectedRegId(reg.id)}
                          className={`w-full text-left px-4 py-3.5 border-l-4 transition-colors border-b border-gray-50 ${
                            isSelected
                              ? isPrincipal ? 'border-l-blue-500 bg-blue-50' : 'border-l-amber-500 bg-amber-50'
                              : !reg.isActive
                              ? 'border-l-gray-200 hover:bg-gray-50 opacity-50'
                              : isPrincipal
                              ? 'border-l-blue-200 hover:bg-blue-50/40'
                              : 'border-l-amber-200 hover:bg-amber-50/40'
                          }`}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-sm font-mono font-bold ${isSelected ? (isPrincipal?'text-blue-700':'text-amber-700') : 'text-gray-800'}`}>
                              {reg.abbr}
                            </span>
                            {(reg.placeType || 'Principal').split(',').map(t => t.trim()).filter(Boolean).map(t => (
                              <span key={t} className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                t==='Principal' ? 'bg-blue-100 text-blue-600' :
                                t==='E-APOB'    ? 'bg-purple-100 text-purple-600' :
                                t==='I-APOB'   ? 'bg-pink-100 text-pink-600' :
                                                 'bg-amber-100 text-amber-600'
                              }`}>{t}</span>
                            ))}
                            {!reg.isActive && <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">Off</span>}
                            {reg.primaryBusiness && (
                              <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">
                                🏷️ {reg.primaryBusiness}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                            <MapPin size={9} className="flex-shrink-0" />
                            <span>{reg.officeCity} · {reg.state}</span>
                          </div>
                          {(totalChildCount > 0 || locCount > 0) && (
                            <div className="flex gap-1.5 mt-1.5 flex-wrap">
                              {totalChildCount > 0 && (
                                <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                  {totalChildCount} sub-place{totalChildCount!==1?'s':''}
                                </span>
                              )}
                              {locCount > 0 && (
                                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                                  {locCount} location{locCount!==1?'s':''}
                                </span>
                              )}
                            </div>
                          )}
                        </button>

                        {/* Inferred children: nested under this principal by stateCode match */}
                        {inferredChildren.map(child => {
                          const childSelected = selectedReg?.id === child.id;
                          return (
                            <button key={child.id}
                              onClick={() => setSelectedRegId(child.id)}
                              className={`w-full text-left pl-8 pr-4 py-2.5 border-l-4 transition-colors border-b border-gray-50 ${
                                childSelected
                                  ? 'border-l-amber-500 bg-amber-50'
                                  : !child.isActive
                                  ? 'border-l-gray-200 hover:bg-gray-50 opacity-50'
                                  : 'border-l-amber-300 hover:bg-amber-50/50 bg-amber-50/20'
                              }`}>
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className="text-gray-300 text-xs select-none">└</span>
                                <span className={`text-xs font-mono font-bold ${childSelected ? 'text-amber-700' : 'text-gray-700'}`}>
                                  {child.abbr}
                                </span>
                                {(child.placeType||'').split(',').map(t=>t.trim()).filter(Boolean).map(t=>(
                                  <span key={t} className={`text-xs px-1 py-0.5 rounded font-medium ${
                                    t==='E-APOB'?'bg-purple-100 text-purple-600':
                                    t==='I-APOB'?'bg-pink-100 text-pink-600':
                                    'bg-amber-100 text-amber-600'
                                  }`}>{t}</span>
                                ))}
                                {!child.isActive && <span className="text-xs bg-gray-200 text-gray-500 px-1 rounded">Off</span>}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-400 pl-3">
                                <MapPin size={8} className="flex-shrink-0" />
                                <span>{child.officeCity} · {child.state}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* Entity info footer */}
                <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{selectedEntity.legalName}</p>
                      <div className="flex gap-2 mt-0.5 text-xs text-gray-400 font-mono flex-wrap">
                        {selectedEntity.pan && <span>PAN: {selectedEntity.pan}</span>}
                        {selectedEntity.tan && <span>TAN: {selectedEntity.tan}</span>}
                      </div>
                    </div>
                    <button onClick={() => setEntityModal(selectedEntity)}
                      className="flex-shrink-0 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit entity details">
                      <Edit2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Panel 3: Registration detail ─────────────────── */}
              <div className="flex-1 overflow-y-auto bg-gray-50">
                {!selectedReg ? (
                  <div className="flex items-center justify-center h-full">
                    <EmptyState icon="🏛️" title="No registrations" subtitle="Add a GSTIN registration" />
                  </div>
                ) : (
                  <div className="p-6 max-w-3xl space-y-5">

                    {/* Registration header card */}
                    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                      selectedReg.isActive ? 'border-gray-200' : 'border-gray-300 opacity-80'
                    }`}>
                      <div className={`border-l-4 ${(selectedReg.placeType||'').includes('Principal') ? 'border-l-blue-500' : 'border-l-amber-400'}`}>
                        <div className="px-5 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-2xl text-gray-900">{selectedReg.abbr}</span>
                                {(selectedReg.placeType||'Principal').split(',').map(t=>t.trim()).filter(Boolean).map(t=>(
                                  <span key={t} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                    t==='Principal'?'bg-blue-100 text-blue-700':
                                    t==='E-APOB'?'bg-purple-100 text-purple-700':
                                    t==='I-APOB'?'bg-pink-100 text-pink-700':
                                    'bg-amber-100 text-amber-700'
                                  }`}>{t}</span>
                                ))}
                                {!selectedReg.isActive && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">Inactive</span>}
                              </div>
                              <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                                <MapPin size={13} />
                                <span>{selectedReg.officeCity}{selectedReg.district?`, ${selectedReg.district}`:''} · {selectedReg.state}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {selectedReg.isActive ? (
                                <>
                                  <button onClick={() => setRegModal(selectedReg)}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                    <Edit2 size={15} />
                                  </button>
                                  <button onClick={() => setDeactivateTarget(selectedReg)}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Deactivate">
                                    <Shield size={15} />
                                  </button>
                                </>
                              ) : (
                                <button onClick={() => setReactivateTarget(selectedReg)}
                                  className="text-xs text-green-700 border border-green-300 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                  ↩ Reactivate
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                            <div>
                              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">GSTIN</p>
                              <p className="font-mono font-semibold text-gray-800 tracking-wide">{selectedReg.gstin}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">State Code</p>
                              <p className="text-gray-700">{selectedReg.stateCode} — {selectedReg.state}</p>
                            </div>
                            {selectedReg.siteCode && (
                              <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Site Code</p>
                                <p className="font-mono font-bold text-blue-700">{selectedReg.siteCode}</p>
                              </div>
                            )}
                            {selectedReg.address && (
                              <div className="col-span-2">
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Registered Address</p>
                                <p className="text-gray-700 leading-relaxed">{selectedReg.address}</p>
                              </div>
                            )}
                            {selectedReg.primaryBusiness && (
                              <div className="col-span-2 flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                                  🏷️ {selectedReg.primaryBusiness}
                                </span>
                              </div>
                            )}
                            {selectedReg.fssai && <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">FSSAI</p><p className="font-mono text-gray-700">{selectedReg.fssai}</p></div>}
                            {selectedReg.udyam && <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Udyam</p><p className="font-mono text-gray-700">{selectedReg.udyam}</p></div>}
                            {selectedReg.iec && <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">IEC</p><p className="font-mono text-gray-700">{selectedReg.iec}</p></div>}
                          </div>
                        </div>
                      </div>
                      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center gap-6 text-xs text-gray-500">
                        <span>👥 {selectedReg._count?.users??0} employees</span>
                        <span>🖥️ {selectedReg._count?.assets??0} assets</span>
                        <span>📜 {selectedReg._count?.certificates??selectedReg.certificates?.length??0} certificates</span>
                      </div>
                    </div>

                    {/* Additional Places section */}
                    {(() => {
                      const formalChildren = selectedReg.additionalRegistrations || [];
                      const inferredChildren = inferredUnder[selectedReg.id] || [];
                      const allChildren = [...formalChildren, ...inferredChildren];
                      const activeCount = allChildren.filter(r => r.isActive).length;
                      return (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-amber-50/50">
                            <div className="flex items-center gap-2">
                              <Layers size={15} className="text-amber-500" />
                              <span className="font-semibold text-gray-800 text-sm">Additional Places</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                activeCount > 0 ? 'bg-amber-200 text-amber-800' : 'bg-gray-100 text-gray-400'
                              }`}>
                                {activeCount}
                              </span>
                              <span className="text-xs text-gray-400 hidden sm:inline">E-APOB · I-APOB · Additional registrations</span>
                            </div>
                            {selectedReg.isActive && (
                              <button onClick={() => { setAddAdditionalForId(selectedReg.id); setRegModal('add-additional'); }}
                                className="flex items-center gap-1 text-xs text-amber-700 border border-amber-300 bg-white px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors font-medium">
                                <Plus size={12} /> Add
                              </button>
                            )}
                          </div>
                          {allChildren.length === 0 ? (
                            <div className="px-5 py-8 text-center">
                              <Layers size={28} className="mx-auto mb-2 text-gray-200" />
                              <p className="text-sm text-gray-400 font-medium">No additional places registered</p>
                              <p className="text-xs text-gray-300 mt-1">Additional, E-APOB, I-APOB registrations under this GSTIN will appear here</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-50">
                              {formalChildren.map(child => (
                                <div key={child.id} className="group px-5 py-4 flex items-start gap-4 hover:bg-amber-50/30 transition-colors">
                                  <div className={`flex-shrink-0 w-1 self-stretch rounded-full ${child.isActive?'bg-amber-400':'bg-gray-200'}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono font-bold text-gray-900">{child.abbr}</span>
                                      {(child.placeType||'').split(',').map(t=>t.trim()).filter(Boolean).map(t=>(
                                        <span key={t} className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                          t==='E-APOB'?'bg-purple-100 text-purple-700':
                                          t==='I-APOB'?'bg-pink-100 text-pink-700':
                                          'bg-amber-100 text-amber-700'
                                        }`}>{t}</span>
                                      ))}
                                      {!child.isActive && <span className="text-xs bg-red-100 text-red-600 px-1.5 rounded">Inactive</span>}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs font-semibold text-gray-700 mt-1">
                                      <MapPin size={9} className="flex-shrink-0" />
                                      <span>{child.officeCity}{child.district?`, ${child.district}`:''} · {child.state}</span>
                                    </div>
                                    {child.address && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{child.address}</p>}
                                    {child.gstin && (
                                      <p className="text-xs font-mono font-semibold text-gray-600 mt-0.5 tracking-wide">{child.gstin}</p>
                                    )}
                                  </div>
                                  <button onClick={() => setRegModal(child)}
                                    className="flex-shrink-0 p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    title="Edit this additional place">
                                    <Edit2 size={13} />
                                  </button>
                                </div>
                              ))}
                              {inferredChildren.map(child => (
                                <div key={child.id} className="group px-5 py-4 flex items-start gap-4 hover:bg-amber-50/30 transition-colors bg-amber-50/10">
                                  <div className={`flex-shrink-0 w-1 self-stretch rounded-full ${child.isActive?'bg-amber-300':'bg-gray-200'}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono font-bold text-gray-900">{child.abbr}</span>
                                      {(child.placeType||'').split(',').map(t=>t.trim()).filter(Boolean).map(t=>(
                                        <span key={t} className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                          t==='E-APOB'?'bg-purple-100 text-purple-700':
                                          t==='I-APOB'?'bg-pink-100 text-pink-700':
                                          'bg-amber-100 text-amber-700'
                                        }`}>{t}</span>
                                      ))}
                                      <span className="text-xs bg-amber-100 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded font-medium" title="Not formally linked — same state code match">
                                        ⚠ Unlinked
                                      </span>
                                      {!child.isActive && <span className="text-xs bg-red-100 text-red-600 px-1.5 rounded">Inactive</span>}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs font-semibold text-gray-700 mt-1">
                                      <MapPin size={9} className="flex-shrink-0" />
                                      <span>{child.officeCity}{child.district?`, ${child.district}`:''} · {child.state}</span>
                                    </div>
                                    {child.address && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{child.address}</p>}
                                    {child.gstin && (
                                      <p className="text-xs font-mono font-semibold text-gray-600 mt-0.5 tracking-wide">{child.gstin}</p>
                                    )}
                                    <p className="text-xs text-amber-500 mt-1">
                                      Grouped by state code match · <button onClick={() => setRegModal(child)} className="underline hover:text-amber-700">Click Edit to formally link</button>
                                    </p>
                                  </div>
                                  <button onClick={() => setRegModal(child)}
                                    className="flex-shrink-0 p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    title="Edit to formally link this additional place">
                                    <Edit2 size={13} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Credentials section */}
                    <CredentialsPanel legalEntityId={selectedEntity?.id} />

                    {/* Bank Accounts section — entity level (shared across all GSTINs) */}
                    <BankAccountsPanel legalEntityId={selectedEntity?.id} selectedReg={selectedReg} entityRegs={entityRegs} />

                  </div>
                )}
              </div>
            </>
          )}
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
      {locationModal && (
        <LocationModal
          location={locationModal.location}
          registrationId={locationModal.regId}
          registrationState={locationModal.regState}
          onClose={() => setLocationModal(null)}
          onSaved={() => refetchRegs()} />
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
