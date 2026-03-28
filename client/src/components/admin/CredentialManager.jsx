import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import StatusBadge from '../shared/StatusBadge';
import { Key, Eye, EyeOff, Plus, ExternalLink, ChevronDown, ChevronRight, Edit2, Trash2, X, RefreshCw, Search, Clock } from 'lucide-react';

const PORTAL_CATEGORIES = [
  { value: 'email',      label: 'Email / Workspace',  color: 'bg-blue-100 text-blue-700' },
  { value: 'tax',        label: 'Tax & Compliance',   color: 'bg-orange-100 text-orange-700' },
  { value: 'banking',    label: 'Banking & Finance',  color: 'bg-green-100 text-green-700' },
  { value: 'erp',        label: 'ERP / Software',     color: 'bg-purple-100 text-purple-700' },
  { value: 'cloud',      label: 'Cloud / Hosting',    color: 'bg-sky-100 text-sky-700' },
  { value: 'social',     label: 'Social Media',       color: 'bg-pink-100 text-pink-700' },
  { value: 'government', label: 'Government Portal',  color: 'bg-red-100 text-red-700' },
  { value: 'other',      label: 'Other',              color: 'bg-slate-100 text-slate-600' },
];

const CREDENTIAL_STATUS_STYLES = {
  active:  'bg-emerald-100 text-emerald-700',
  revoked: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
};

function getCategoryInfo(value) {
  return PORTAL_CATEGORIES.find(c => c.value === value) || PORTAL_CATEGORIES[PORTAL_CATEGORIES.length - 1];
}

function CategoryBadge({ category }) {
  const info = getCategoryInfo(category);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${info.color}`}>
      {info.label}
    </span>
  );
}

function MaskedPassword({ password }) {
  const [show, setShow] = useState(false);
  if (!password) return <span className="text-slate-400 italic text-xs">not set</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-sm">{show ? password : '••••••••'}</span>
      <button
        onClick={() => setShow(v => !v)}
        className="p-0.5 rounded text-slate-400 hover:text-slate-600"
        title={show ? 'Hide password' : 'Reveal password'}
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </span>
  );
}

function PortalFormModal({ portal, registrations, entities, onClose, onSaved }) {
  const { execute, loading, error: saveErr } = useApi();
  const isEdit = !!portal;

  // Determine initial entity from portal (via legalEntityId or via companyRegistration.legalEntityId)
  const initEntityId = portal?.legalEntityId
    ? String(portal.legalEntityId)
    : portal?.companyRegistration?.legalEntityId
      ? String(portal.companyRegistration.legalEntityId)
      : '';

  const [form, setForm] = useState({
    name: portal?.name || '',
    url: portal?.url || '',
    description: portal?.description || '',
    category: portal?.category || 'other',
    legalEntityId: initEntityId,
    companyRegistrationId: portal?.companyRegistrationId ? String(portal.companyRegistrationId) : '',
  });

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Filter registrations by selected entity
  const filteredRegs = form.legalEntityId
    ? registrations.filter(r => String(r.legalEntityId) === form.legalEntityId)
    : registrations;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await execute(() => api.put(`/credentials/portals/${portal.id}`, form), 'Portal updated!');
      } else {
        await execute(() => api.post('/credentials/portals', form), 'Portal created!');
      }
      onSaved();
      onClose();
    } catch {
      // Error shown by useApi
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="font-semibold text-slate-800">{isEdit ? 'Edit Portal' : 'Add Portal'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {saveErr && <AlertMessage type="error" message={saveErr} />}

          {/* Company Entity — first selector */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Company / Entity *</label>
            <select required value={form.legalEntityId} onChange={e => {
              setField('legalEntityId', e.target.value);
              setField('companyRegistrationId', ''); // reset registration when entity changes
            }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">-- Select Company --</option>
              {entities.map(ent => (
                <option key={ent.id} value={String(ent.id)}>{ent.legalName}</option>
              ))}
            </select>
          </div>

          {/* Specific Registration — filtered by entity */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Specific GSTIN / Registration <span className="text-slate-400 font-normal">(optional — if credential is registration-specific)</span>
            </label>
            <select value={form.companyRegistrationId} onChange={e => setField('companyRegistrationId', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!form.legalEntityId}>
              <option value="">-- Entity-level (all registrations) --</option>
              {filteredRegs.map(r => (
                <option key={r.id} value={String(r.id)}>{r.abbr} — {r.officeCity} ({r.gstin})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Portal / Platform Name *</label>
            <input required value={form.name} onChange={e => setField('name', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Gmail, Amazon Seller, Shiprocket, GST Portal" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Login URL</label>
            <input value={form.url} onChange={e => setField('url', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://sellercentral.amazon.in" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
            <select value={form.category} onChange={e => setField('category', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {PORTAL_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setField('description', e.target.value)}
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional notes about this portal" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Portal')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SharedWithPicker({ users, selected, onChange }) {
  const [search, setSearch] = useState('');
  const sel = Array.isArray(selected) ? selected : [];
  const allUsers = Array.isArray(users) ? users : [];
  const toggle = (id) => {
    const sid = String(id);
    onChange(sel.includes(sid) ? sel.filter(x => x !== sid) : [...sel, sid]);
  };
  const filtered = allUsers.filter(u =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );
  const selectedUsers = allUsers.filter(u => sel.includes(String(u.id)));
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        Shared With {sel.length > 0 && <span className="text-blue-600">({sel.length} selected)</span>}
      </label>
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
          {selectedUsers.map(u => (
            <span key={u.id} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              {u.name}
              <button type="button" onClick={() => toggle(u.id)} className="hover:text-red-600 ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
        placeholder="Search employees..." />
      <div className="border border-slate-200 rounded-lg max-h-36 overflow-y-auto divide-y divide-slate-50">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 p-3 text-center">No employees found</p>
        ) : filtered.map(u => {
          const sid = String(u.id);
          const checked = sel.includes(sid);
          return (
            <label key={u.id} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50 ${checked ? 'bg-blue-50' : ''}`}>
              <input type="checkbox" checked={checked} onChange={() => toggle(u.id)}
                className="accent-blue-600 w-3.5 h-3.5 flex-shrink-0" />
              <div className="min-w-0">
                <span className="text-sm text-slate-800 truncate block">{u.name}</span>
                <span className="text-xs text-slate-400 truncate block">{u.email}</span>
              </div>
            </label>
          );
        })}
      </div>
      {sel.length > 0 && (
        <button type="button" onClick={() => onChange([])}
          className="text-xs text-red-500 hover:text-red-700 mt-1">Clear all</button>
      )}
    </div>
  );
}

function DeptMultiPicker({ departments, selected, onChange }) {
  const sel = Array.isArray(selected) ? selected : [];
  const allDepts = Array.isArray(departments) ? departments : [];
  const toggle = (name) => {
    onChange(sel.includes(name) ? sel.filter(x => x !== name) : [...sel, name]);
  };
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        Department Using {sel.length > 0 && <span className="text-blue-600">({sel.length} selected)</span>}
      </label>
      {sel.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
          {sel.map(name => (
            <span key={name} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              {name}
              <button type="button" onClick={() => toggle(name)} className="hover:text-red-600 ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="border border-slate-200 rounded-lg divide-y divide-slate-50">
        {allDepts.map(d => {
          const checked = sel.includes(d.name);
          return (
            <label key={d.id} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50 ${checked ? 'bg-blue-50' : ''}`}>
              <input type="checkbox" checked={checked} onChange={() => toggle(d.name)}
                className="accent-blue-600 w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-sm text-slate-800">{d.name}</span>
            </label>
          );
        })}
      </div>
      {sel.length > 0 && (
        <button type="button" onClick={() => onChange([])}
          className="text-xs text-red-500 hover:text-red-700 mt-1">Clear all</button>
      )}
    </div>
  );
}


function CredentialFormModal({ portalId, credential, users, onClose, onSaved }) {
  const { execute, loading, error: saveErr } = useApi();
  const { data: departments } = useFetch('/departments', []);
  const isEdit = !!credential;
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({
    portalId: portalId,
    type: credential?.type || 'individual',
    username: credential?.username || '',
    password: credential?.password || '',
    label: credential?.label || '',
    assignedTo: credential?.assignedTo || '',
    sharedWith: (() => { try { const v = credential?.sharedWith; return Array.isArray(v) ? v.map(String) : (v ? JSON.parse(v) : []); } catch { return []; } })(),
    notes: credential?.notes || '',
    phoneNumber: credential?.phoneNumber || '',
    department: (() => { const v = credential?.department; if (!v) return ''; try { const p = JSON.parse(v); return Array.isArray(p) ? p : v; } catch { return v; } })(),
    purpose: credential?.purpose || '',
    status: credential?.status || 'active',
    lastRotated: credential?.lastRotated || '',
  });

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      assignedTo: form.type === 'individual' && form.assignedTo ? parseInt(form.assignedTo) : null,
      sharedWith: form.type === 'shared' ? JSON.stringify(form.sharedWith) : null,
      department: form.type === 'shared' && Array.isArray(form.department) ? JSON.stringify(form.department) : (Array.isArray(form.department) ? form.department.join(', ') : form.department),
    };
    try {
      if (isEdit) {
        await execute(() => api.put(`/credentials/credentials/${credential.id}`, payload), 'Credential updated!');
      } else {
        await execute(() => api.post('/credentials/credentials', payload), 'Credential created!');
      }
      onSaved();
      onClose();
    } catch {
      // Error shown by useApi
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="font-semibold text-slate-800">{isEdit ? 'Edit Credential' : 'Add Credential'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {saveErr && <AlertMessage type="error" message={saveErr} />}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
            <div className="flex gap-3">
              {['individual', 'shared'].map(t => (
                <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="type" value={t} checked={form.type === t} onChange={() => setField('type', t)} className="accent-blue-600" />
                  <span className="text-sm text-slate-700 capitalize">{t}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Username / Login ID *</label>
            <input required value={form.username} onChange={e => setField('username', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin@company.com" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
            <div className="relative">
              <input value={form.password} onChange={e => setField('password', e.target.value)}
                type={showPwd ? 'text' : 'password'}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter password" />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Label / Friendly Name</label>
            <input value={form.label} onChange={e => setField('label', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Main Admin, Accounts Login" />
          </div>

          {form.type === 'individual' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Assigned To</label>
              <select value={form.assignedTo} onChange={e => setField('assignedTo', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">-- Unassigned --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
          )}

          {form.type === 'shared' && (
            <SharedWithPicker
              users={users}
              selected={form.sharedWith}
              onChange={ids => setField('sharedWith', ids)}
            />
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select value={form.status} onChange={e => setField('status', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="active">Active</option>
              <option value="revoked">Revoked</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Last Password Rotation</label>
            <input type="date" value={form.lastRotated} onChange={e => setField('lastRotated', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number</label>
            <input value={form.phoneNumber} onChange={e => setField('phoneNumber', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 8369529033" />
          </div>

          {form.type === 'shared' ? (
            <DeptMultiPicker
              departments={departments}
              selected={Array.isArray(form.department) ? form.department : (form.department ? [form.department] : [])}
              onChange={vals => setField('department', vals)}
            />
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Department Using</label>
              <select value={Array.isArray(form.department) ? '' : form.department} onChange={e => setField('department', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">-- Select Department --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Purpose</label>
            <input value={form.purpose} onChange={e => setField('purpose', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Amazon orders, Delivery tracking, User delivery" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setField('notes', e.target.value)}
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional notes" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Credential')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CredentialHistoryModal({ credentialId, onClose }) {
  const { data: history, loading, error } = useFetch(`/credentials/credentials/${credentialId}/history`, []);

  const FIELD_LABELS = {
    username: 'Username', password: 'Password', label: 'Label', type: 'Type',
    assignedTo: 'Assigned To', sharedWith: 'Shared With', notes: 'Notes',
    phoneNumber: 'Phone', department: 'Department', purpose: 'Purpose',
    status: 'Status', lastRotated: 'Last Rotated',
  };

  const ACTION_COLORS = {
    create: 'bg-emerald-100 text-emerald-700',
    update: 'bg-blue-100 text-blue-700',
    revoke: 'bg-red-100 text-red-700',
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-800">Change History</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {error && <AlertMessage type="error" message={error} />}
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : history.length === 0 ? (
            <EmptyState icon="🕐" title="No history" subtitle="No changes recorded yet" />
          ) : (
            <div className="space-y-3">
              {history.map(entry => {
                const changes = (() => { try { return JSON.parse(entry.changes); } catch { return {}; } })();
                const changedFields = Object.keys(changes);
                return (
                  <div key={entry.id} className="border border-slate-100 rounded-lg p-3 bg-slate-50">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${ACTION_COLORS[entry.action] || ACTION_COLORS.update}`}>
                          {entry.action}
                        </span>
                        <span className="text-xs text-slate-600 font-medium">{entry.changedByUser?.name || 'Unknown'}</span>
                        {entry.changedByUser?.employeeId && (
                          <span className="text-xs text-slate-400">({entry.changedByUser.employeeId})</span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">
                        {new Date(entry.changedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {changedFields.length > 0 && (
                      <div className="space-y-1">
                        {changedFields.map(field => (
                          <div key={field} className="text-xs flex items-start gap-1">
                            <span className="text-slate-500 font-medium shrink-0 w-24">{FIELD_LABELS[field] || field}:</span>
                            <span className="text-red-600 line-through mr-1 font-mono">
                              {field === 'password' ? (changes[field].old ? '••••' : '—') : (String(changes[field].old ?? '—'))}
                            </span>
                            <span className="text-slate-400">→</span>
                            <span className="text-emerald-700 ml-1 font-mono">
                              {field === 'password' ? (changes[field].new ? '••••' : '—') : (String(changes[field].new ?? '—'))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PortalCard({ portal, users, onEdit, onAddCredential, onRefresh, selected, onToggleSelect }) {
  const [expanded, setExpanded] = useState(false);
  const [editingCred, setEditingCred] = useState(null);
  const [historyCredId, setHistoryCredId] = useState(null);
  const { execute } = useApi();

  const { data: credentials, loading: credsLoading, error: credsErr, refetch: refetchCreds } = useFetch(
    expanded ? `/credentials/portals/${portal.id}/credentials` : null,
    []
  );

  const handleRevoke = async (credId) => {
    if (!window.confirm('Revoke this credential?')) return;
    try {
      await execute(() => api.delete(`/credentials/credentials/${credId}`), 'Credential revoked');
      refetchCreds();
    } catch {
      // Error shown by useApi
    }
  };

  const handleToggleStatus = async (cred) => {
    const newStatus = cred.status === 'active' ? 'revoked' : 'active';
    try {
      await execute(() => api.put(`/credentials/credentials/${cred.id}`, { status: newStatus }));
      refetchCreds();
    } catch {}
  };

  const handleToggleActive = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`${portal.isActive ? 'Disable' : 'Enable'} this portal?`)) return;
    try {
      await execute(() => api.put(`/credentials/portals/${portal.id}`, { isActive: !portal.isActive }),
        portal.isActive ? 'Portal disabled' : 'Portal enabled');
      if (portal.isActive) setExpanded(false);
      onRefresh();
    } catch {}
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Permanently delete "${portal.name}" and all its credentials? This cannot be undone.`)) return;
    try {
      await execute(() => api.delete(`/credentials/portals/${portal.id}`), 'Portal deleted');
      onRefresh();
    } catch {}
  };

  const handleEditSaved = () => {
    refetchCreds();
    setEditingCred(null);
  };

  const canExpand = true;
  const isActive = portal.isActive !== false;

  return (
    <div className={`bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden ${!isActive ? 'opacity-70' : ''}`}>
      {/* Portal header */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={e => { e.stopPropagation(); onToggleSelect(portal.id); }}
          onClick={e => e.stopPropagation()}
          className="w-4 h-4 accent-blue-600 shrink-0 cursor-pointer"
        />
        <button
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          onClick={() => setExpanded(v => !v)}
        >
          <span className="text-slate-400">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-slate-800">{portal.name}</span>
              <CategoryBadge category={portal.category} />
              {/* Active/Closed badge — always visible */}
              {isActive ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" /> Closed
                </span>
              )}
              {portal._count?.credentials > 0 && (
                <span className="text-xs text-slate-400">{portal._count.credentials} credential{portal._count.credentials !== 1 ? 's' : ''}</span>
              )}
            </div>
            {(portal.legalEntity || portal.companyRegistration) && (
              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                <a
                  href={`/admin/company-master?entityId=${portal.legalEntity?.id || portal.companyRegistration?.legalEntityId}`}
                  className="font-medium text-indigo-500 hover:text-indigo-700 hover:underline"
                  title="Open in Company Master"
                  onClick={e => e.stopPropagation()}
                >
                  🏢 {portal.legalEntity?.legalName || portal.companyRegistration?.abbr?.split('/')[0]}
                </a>
                {portal.companyRegistration && (
                  <span>· {portal.companyRegistration.abbr} ({portal.companyRegistration.officeCity})</span>
                )}
              </div>
            )}
            {portal.description && (
              <div className="text-xs text-slate-500 mt-0.5 truncate">{portal.description}</div>
            )}
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {portal.url && isActive && (
            <a href={portal.url} target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50" title="Open portal">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {/* Portal enable/disable toggle */}
          <button
            onClick={handleToggleActive}
            className={`px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              isActive
                ? 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600'
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            }`}
            title={isActive ? 'Disable portal' : 'Enable portal'}
          >
            {isActive ? 'Disable' : 'Enable'}
          </button>
          <button onClick={() => onEdit(portal)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" title="Edit portal">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleDelete} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete portal">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {isActive && (
            <button onClick={() => onAddCredential(portal)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-3 h-3" /> Add Credential
            </button>
          )}
        </div>
      </div>

      {/* Credentials list */}
      {expanded && (
        <div className="border-t border-slate-100">
          {credsErr && <div className="p-3"><AlertMessage type="error" message={credsErr} /></div>}
          {credsLoading ? (
            <div className="p-4 flex justify-center"><LoadingSpinner /></div>
          ) : credentials.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-400">No credentials yet. Click "Add Credential" to get started.</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {credentials.map(cred => (
                <div key={cred.id} className="px-4 py-3 flex items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {cred.label && <span className="text-sm font-medium text-slate-700">{cred.label}</span>}
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${cred.type === 'shared' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                        {cred.type === 'shared' ? 'Shared' : 'Individual'}
                      </span>
                      <button
                        onClick={() => isActive && handleToggleStatus(cred)}
                        disabled={!isActive}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-colors ${
                          cred.status === 'active'
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        } ${!isActive ? 'cursor-default opacity-70' : ''}`}
                        title={!isActive ? 'Enable portal to edit' : cred.status === 'active' ? 'Click to mark as closed' : 'Click to mark as active'}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${cred.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
                        {cred.status === 'active' ? 'Active' : 'Closed'}
                      </button>
                    </div>
                    <div className="text-sm text-slate-600 font-mono">{cred.username}</div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">Password:</span>
                      <MaskedPassword password={cred.password} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      {cred.phoneNumber && (
                        <span className="text-xs text-slate-500">📞 {cred.phoneNumber}</span>
                      )}
                      {cred.department && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">🏢 {cred.department}</span>
                      )}
                      {cred.purpose && (
                        <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium">🎯 {cred.purpose}</span>
                      )}
                    </div>
                    {cred.assignee && (
                      <div className="text-xs text-slate-500">Assigned to: <span className="text-slate-700">{cred.assignee.name}</span></div>
                    )}
                    {cred.lastRotated && (
                      <div className="text-xs text-slate-400 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> Last rotated: {cred.lastRotated}
                      </div>
                    )}
                    {cred.notes && <div className="text-xs text-slate-400 italic">{cred.notes}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setHistoryCredId(cred.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" title="View history">
                      <Clock className="w-3.5 h-3.5" />
                    </button>
                    {isActive && (
                      <>
                        <button onClick={() => setEditingCred(cred)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleRevoke(cred.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Revoke">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {editingCred && (
            <CredentialFormModal
              portalId={portal.id}
              credential={editingCred}
              users={users}
              onClose={() => setEditingCred(null)}
              onSaved={handleEditSaved}
            />
          )}
        </div>
      )}
      {historyCredId && (
        <CredentialHistoryModal credentialId={historyCredId} onClose={() => setHistoryCredId(null)} />
      )}
    </div>
  );
}

export default function CredentialManager() {
  const [filterReg, setFilterReg] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [search, setSearch] = useState('');
  const [showAddPortal, setShowAddPortal] = useState(false);
  const [editingPortal, setEditingPortal] = useState(null);
  const [addCredPortal, setAddCredPortal] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const { execute: bulkExecute, loading: bulkLoading, error: bulkErr, success: bulkSuccess } = useApi();

  const params = new URLSearchParams();
  if (filterReg) {
    if (filterReg.startsWith('entity_')) {
      params.set('legalEntityId', filterReg.replace('entity_', ''));
    } else {
      params.set('companyRegistrationId', filterReg);
    }
  }
  if (filterCat) params.set('category', filterCat);
  const queryStr = params.toString() ? `?${params.toString()}` : '';

  const { data: portals, loading, error: fetchErr, refetch } = useFetch(`/credentials/portals${queryStr}`, []);
  const { data: allCreds, refetch: refetchAllCreds } = useFetch('/credentials/all', []);
  const [searchEditingCred, setSearchEditingCred] = useState(null);
  const [searchHistoryCredId, setSearchHistoryCredId] = useState(null);
  const { data: registrations, error: regErr } = useFetch('/company-master/registrations', []);
  const { data: entities } = useFetch('/company-master/legal-entities', []);
  const { data: usersData, error: usersErr } = useFetch('/users?isActive=true&limit=200', { users: [] });
  const users = Array.isArray(usersData) ? usersData : (usersData?.users || []);

  const handlePortalSaved = () => refetch();

  const sortedPortals = [...portals].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortBy === 'name_az') return a.name.localeCompare(b.name);
    if (sortBy === 'name_za') return b.name.localeCompare(a.name);
    return 0;
  });

  const searchTerm = search.trim().toLowerCase();
  const searchResults = searchTerm
    ? allCreds.filter(c => {
        const haystack = [
          c.username, c.label, c.department, c.purpose,
          c.assignee?.name, c.portal?.name, c.portal?.category, c.notes,
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(searchTerm);
      })
    : [];

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedPortals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedPortals.map(p => p.id)));
    }
  };

  const handleBulkAction = async (action) => {
    const ids = [...selectedIds];
    const label = action === 'delete' ? `permanently delete ${ids.length} portal(s) and all their credentials` : `${action} ${ids.length} portal(s)`;
    if (!window.confirm(`Are you sure you want to ${label}?`)) return;
    try {
      await bulkExecute(() => api.post('/credentials/portals/bulk', { ids, action }),
        `${ids.length} portal(s) ${action}d`);
      setSelectedIds(new Set());
      refetch();
    } catch {}
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600" /> Credential Manager
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage portal logins and access credentials across all companies</p>
        </div>
        <button onClick={() => setShowAddPortal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Portal
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by email, department, employee, purpose, platform..."
          className="w-full pl-9 pr-9 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={filterReg} onChange={e => setFilterReg(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]">
          <option value="">All Companies</option>
          {entities.map(e => (
            <option key={e.id} value={`entity_${e.id}`}>{e.legalName}</option>
          ))}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Categories</option>
          {PORTAL_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="name_az">Name A→Z</option>
          <option value="name_za">Name Z→A</option>
        </select>
      </div>

      {/* Errors */}
      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {regErr && <AlertMessage type="error" message={regErr} />}
      {usersErr && <AlertMessage type="error" message={usersErr} />}
      {bulkErr && <AlertMessage type="error" message={bulkErr} />}
      {bulkSuccess && <AlertMessage type="success" message={bulkSuccess} />}

      {/* Search results */}
      {searchTerm && (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for <span className="font-medium text-slate-700">"{search}"</span></p>
          {searchResults.length === 0 ? (
            <EmptyState icon="🔍" title="No matches" subtitle="Try a different search term" />
          ) : (
            <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              {searchResults.map(cred => (
                <div key={cred.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getCategoryInfo(cred.portal?.category).color}`}>
                        {cred.portal?.name}
                      </span>
                      {cred.label && <span className="text-sm font-medium text-slate-700">{cred.label}</span>}
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${cred.type === 'shared' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                        {cred.type === 'shared' ? 'Shared' : 'Individual'}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold ${cred.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cred.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
                        {cred.status === 'active' ? 'Active' : 'Closed'}
                      </span>
                    </div>
                    <div className="text-sm text-slate-700 font-mono">{cred.username}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      {cred.department && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">🏢 {cred.department}</span>}
                      {cred.purpose && <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium">🎯 {cred.purpose}</span>}
                      {cred.assignee && <span>👤 {cred.assignee.name}</span>}
                      {cred.phoneNumber && <span>📞 {cred.phoneNumber}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setSearchHistoryCredId(cred.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                      title="View history"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setSearchEditingCred(cred)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                      title="Edit credential"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search result modals */}
      {searchEditingCred && (
        <CredentialFormModal
          portalId={searchEditingCred.portalId}
          credential={searchEditingCred}
          users={users}
          onClose={() => setSearchEditingCred(null)}
          onSaved={() => { setSearchEditingCred(null); refetchAllCreds(); refetch(); }}
        />
      )}
      {searchHistoryCredId && (
        <CredentialHistoryModal credentialId={searchHistoryCredId} onClose={() => setSearchHistoryCredId(null)} />
      )}

      {/* Portal list */}
      {!searchTerm && loading ? (
        <LoadingSpinner />
      ) : !searchTerm && sortedPortals.length === 0 ? (
        <EmptyState icon="🔑" title="No portals yet" subtitle="Add your first portal to start managing credentials" />
      ) : !searchTerm && (
        <>
          {/* Select all + bulk action bar */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedIds.size === sortedPortals.length && sortedPortals.length > 0}
                ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < sortedPortals.length; }}
                onChange={toggleSelectAll}
                className="w-4 h-4 accent-blue-600"
              />
              {selectedIds.size > 0 ? `${selectedIds.size} of ${sortedPortals.length} selected` : 'Select all'}
            </label>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 mr-1">Bulk:</span>
                <button onClick={() => handleBulkAction('enable')} disabled={bulkLoading}
                  className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 font-medium disabled:opacity-50">
                  Enable
                </button>
                <button onClick={() => handleBulkAction('disable')} disabled={bulkLoading}
                  className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-medium disabled:opacity-50">
                  Disable
                </button>
                <button onClick={() => handleBulkAction('delete')} disabled={bulkLoading}
                  className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium disabled:opacity-50">
                  Delete
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {sortedPortals.map(portal => (
              <PortalCard
                key={portal.id}
                portal={portal}
                users={users}
                onEdit={setEditingPortal}
                onAddCredential={setAddCredPortal}
                onRefresh={refetch}
                selected={selectedIds.has(portal.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        </>
      )}

      {/* Portal add/edit modal */}
      {(showAddPortal || editingPortal) && (
        <PortalFormModal
          portal={editingPortal}
          registrations={registrations}
          entities={entities}
          onClose={() => { setShowAddPortal(false); setEditingPortal(null); }}
          onSaved={handlePortalSaved}
        />
      )}

      {/* Add credential modal */}
      {addCredPortal && (
        <CredentialFormModal
          portalId={addCredPortal.id}
          credential={null}
          users={users}
          onClose={() => setAddCredPortal(null)}
          onSaved={refetch}
        />
      )}
    </div>
  );
}
