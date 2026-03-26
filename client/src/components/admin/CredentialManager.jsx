import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import StatusBadge from '../shared/StatusBadge';
import { Key, Eye, EyeOff, Plus, ExternalLink, ChevronDown, ChevronRight, Edit2, Trash2, X, RefreshCw } from 'lucide-react';

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

function PortalFormModal({ portal, registrations, onClose, onSaved }) {
  const { execute, loading, error: saveErr } = useApi();
  const isEdit = !!portal;
  const [form, setForm] = useState({
    name: portal?.name || '',
    url: portal?.url || '',
    description: portal?.description || '',
    category: portal?.category || 'other',
    companyRegistrationId: portal?.companyRegistrationId || '',
  });

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{isEdit ? 'Edit Portal' : 'Add Portal'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {saveErr && <AlertMessage type="error" message={saveErr} />}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Portal Name *</label>
            <input required value={form.name} onChange={e => setField('name', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Gmail Workspace, GST Portal" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Login URL</label>
            <input value={form.url} onChange={e => setField('url', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://accounts.google.com" />
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
            <label className="block text-xs font-medium text-slate-600 mb-1">Company Registration</label>
            <select value={form.companyRegistrationId} onChange={e => setField('companyRegistrationId', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">-- All / Unassigned --</option>
              {registrations.map(r => (
                <option key={r.id} value={r.id}>{r.abbr} — {r.officeCity} ({r.gstin})</option>
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

function CredentialFormModal({ portalId, credential, users, onClose, onSaved }) {
  const { execute, loading, error: saveErr } = useApi();
  const isEdit = !!credential;
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({
    portalId: portalId,
    type: credential?.type || 'individual',
    username: credential?.username || '',
    password: credential?.password || '',
    label: credential?.label || '',
    assignedTo: credential?.assignedTo || '',
    sharedWith: credential?.sharedWith || '',
    notes: credential?.notes || '',
    status: credential?.status || 'active',
    lastRotated: credential?.lastRotated || '',
  });

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      assignedTo: form.type === 'individual' && form.assignedTo ? parseInt(form.assignedTo) : null,
      sharedWith: form.type === 'shared' ? form.sharedWith : null,
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
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Shared With (user IDs, JSON array)</label>
              <input value={form.sharedWith} onChange={e => setField('sharedWith', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder='["1","2","3"]' />
              <p className="text-xs text-slate-400 mt-1">Enter a JSON array of user IDs to share with, or leave blank for all admins.</p>
            </div>
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

function PortalCard({ portal, users, onEdit, onAddCredential, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [editingCred, setEditingCred] = useState(null);
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

  const handleEditSaved = () => {
    refetchCreds();
    setEditingCred(null);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Portal header */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <button className="flex items-center gap-2 flex-1 min-w-0 text-left" onClick={() => setExpanded(v => !v)}>
          <span className="text-slate-400">{expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-800 text-sm">{portal.name}</span>
              <CategoryBadge category={portal.category} />
              {portal._count?.credentials > 0 && (
                <span className="text-xs text-slate-400">{portal._count.credentials} credential{portal._count.credentials !== 1 ? 's' : ''}</span>
              )}
            </div>
            {portal.companyRegistration && (
              <div className="text-xs text-slate-400 mt-0.5">{portal.companyRegistration.abbr} — {portal.companyRegistration.officeCity}</div>
            )}
            {portal.description && (
              <div className="text-xs text-slate-500 mt-0.5 truncate">{portal.description}</div>
            )}
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {portal.url && (
            <a href={portal.url} target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50" title="Open portal">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button onClick={() => onEdit(portal)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" title="Edit portal">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onAddCredential(portal)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-3 h-3" /> Add Credential
          </button>
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
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${CREDENTIAL_STATUS_STYLES[cred.status] || 'bg-slate-100 text-slate-600'}`}>
                        {cred.status}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 font-mono">{cred.username}</div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">Password:</span>
                      <MaskedPassword password={cred.password} />
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
                    <button onClick={() => setEditingCred(cred)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" title="Edit">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleRevoke(cred.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Revoke">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
    </div>
  );
}

export default function CredentialManager() {
  const [filterReg, setFilterReg] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showAddPortal, setShowAddPortal] = useState(false);
  const [editingPortal, setEditingPortal] = useState(null);
  const [addCredPortal, setAddCredPortal] = useState(null);

  const params = new URLSearchParams();
  if (filterReg) params.set('companyRegistrationId', filterReg);
  if (filterCat) params.set('category', filterCat);
  const queryStr = params.toString() ? `?${params.toString()}` : '';

  const { data: portals, loading, error: fetchErr, refetch } = useFetch(`/credentials/portals${queryStr}`, []);
  const { data: registrations, error: regErr } = useFetch('/api/company-master/registrations', []);
  const { data: usersData, error: usersErr } = useFetch('/api/users?isActive=true&limit=200', { users: [] });
  const users = Array.isArray(usersData) ? usersData : (usersData?.users || []);

  const handlePortalSaved = () => refetch();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600" /> Credential Manager
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage portal logins and access credentials across all company registrations</p>
        </div>
        <button onClick={() => setShowAddPortal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Portal
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={filterReg} onChange={e => setFilterReg(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]">
          <option value="">All Registrations</option>
          {registrations.map(r => (
            <option key={r.id} value={r.id}>{r.abbr} — {r.officeCity}</option>
          ))}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Categories</option>
          {PORTAL_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Errors */}
      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {regErr && <AlertMessage type="error" message={regErr} />}
      {usersErr && <AlertMessage type="error" message={usersErr} />}

      {/* Portal list */}
      {loading ? (
        <LoadingSpinner />
      ) : portals.length === 0 ? (
        <EmptyState icon="🔑" title="No portals yet" subtitle="Add your first portal to start managing credentials" />
      ) : (
        <div className="space-y-3">
          {portals.map(portal => (
            <PortalCard
              key={portal.id}
              portal={portal}
              users={users}
              onEdit={setEditingPortal}
              onAddCredential={setAddCredPortal}
              onRefresh={refetch}
            />
          ))}
        </div>
      )}

      {/* Portal add/edit modal */}
      {(showAddPortal || editingPortal) && (
        <PortalFormModal
          portal={editingPortal}
          registrations={registrations}
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
