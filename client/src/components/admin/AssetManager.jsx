import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  Laptop,
  Smartphone,
  Monitor,
  CreditCard,
  Headphones,
  Keyboard,
  Mouse,
  Package,
  Plus,
  Edit,
  ArrowLeftRight,
  RotateCcw,
  Search,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';

const ASSET_TYPES = [
  'laptop',
  'phone',
  'id_card',
  'access_card',
  'monitor',
  'headset',
  'keyboard',
  'mouse',
  'other',
];

const ASSET_TYPE_LABELS = {
  laptop: 'Laptop',
  phone: 'Phone',
  id_card: 'ID Card',
  access_card: 'Access Card',
  monitor: 'Monitor',
  headset: 'Headset',
  keyboard: 'Keyboard',
  mouse: 'Mouse',
  other: 'Other',
};

const STATUS_OPTIONS = ['available', 'assigned', 'maintenance', 'retired'];

const STATUS_COLORS = {
  available: 'bg-green-100 text-green-700',
  assigned: 'bg-blue-100 text-blue-700',
  maintenance: 'bg-yellow-100 text-yellow-700',
  retired: 'bg-red-100 text-red-700',
};

const formatINR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function getTypeIcon(type, className = 'w-4 h-4') {
  const icons = {
    laptop: <Laptop className={className} />,
    phone: <Smartphone className={className} />,
    monitor: <Monitor className={className} />,
    id_card: <CreditCard className={className} />,
    access_card: <CreditCard className={className} />,
    headset: <Headphones className={className} />,
    keyboard: <Keyboard className={className} />,
    mouse: <Mouse className={className} />,
    other: <Package className={className} />,
  };
  return icons[type] || <Package className={className} />;
}

// --- Toast Component ---
function Toast({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
        toast.type === 'success'
          ? 'bg-green-600 text-white'
          : 'bg-red-600 text-white'
      }`}
    >
      {toast.type === 'success' ? (
        <Check className="w-4 h-4 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
      )}
      <span>{toast.message}</span>
      <button onClick={() => onDismiss(toast.id)} className="ml-2 hover:opacity-80">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// --- Modal Wrapper ---
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

// === Main Component ===
export default function AssetManager() {
  const { user: currentUser } = useAuth();

  // Data
  const [assets, setAssets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);

  // Form state
  const emptyForm = {
    name: '',
    type: 'laptop',
    serialNumber: '',
    purchaseDate: '',
    value: '',
    notes: '',
    companyId: '',
    status: 'available',
  };
  const [form, setForm] = useState(emptyForm);
  const [assignForm, setAssignForm] = useState({ userId: '', assignedDate: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Toasts
  const [toasts, setToasts] = useState([]);
  let toastIdRef = 0;

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // --- Data Fetching ---
  const fetchAssets = async () => {
    try {
      const res = await api.get('/assets');
      setAssets(res.data);
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await api.get('/assets/summary');
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await api.get('/companies');
      setCompanies(res.data);
    } catch (err) {
      console.error('Failed to fetch companies:', err);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchAssets(), fetchSummary(), fetchUsers(), fetchCompanies()]);
      setLoading(false);
    };
    loadAll();
  }, []);

  // --- Filtering ---
  const filteredAssets = assets.filter((a) => {
    if (filterType !== 'all' && a.type !== filterType) return false;
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = a.name?.toLowerCase().includes(q);
      const serialMatch = a.serialNumber?.toLowerCase().includes(q);
      if (!nameMatch && !serialMatch) return false;
    }
    return true;
  });

  // --- Asset CRUD ---
  const openAddModal = () => {
    setEditingAsset(null);
    setForm(emptyForm);
    setFormError('');
    setShowAssetModal(true);
  };

  const openEditModal = (asset) => {
    setEditingAsset(asset);
    setForm({
      name: asset.name || '',
      type: asset.type || 'laptop',
      serialNumber: asset.serialNumber || '',
      purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
      value: asset.value ?? '',
      notes: asset.notes || '',
      companyId: asset.companyId ? String(asset.companyId) : '',
      status: asset.status || 'available',
    });
    setFormError('');
    setShowAssetModal(true);
  };

  const handleAssetSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) {
      setFormError('Asset name is required.');
      return;
    }
    setFormLoading(true);
    try {
      const payload = {
        ...form,
        value: form.value ? parseFloat(form.value) : null,
        companyId: form.companyId ? parseInt(form.companyId, 10) : null,
        purchaseDate: form.purchaseDate || null,
      };
      if (editingAsset) {
        await api.put(`/assets/${editingAsset.id}`, payload);
        addToast('Asset updated successfully');
      } else {
        await api.post('/assets', payload);
        addToast('Asset created successfully');
      }
      setShowAssetModal(false);
      setEditingAsset(null);
      setForm(emptyForm);
      await Promise.all([fetchAssets(), fetchSummary()]);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save asset.');
    } finally {
      setFormLoading(false);
    }
  };

  // --- Assign / Return ---
  const openAssignModal = (asset) => {
    setAssignTarget(asset);
    setAssignForm({ userId: '', assignedDate: new Date().toISOString().split('T')[0] });
    setFormError('');
    setShowAssignModal(true);
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!assignForm.userId) {
      setFormError('Please select an employee.');
      return;
    }
    setFormLoading(true);
    try {
      await api.put(`/assets/${assignTarget.id}/assign`, {
        userId: parseInt(assignForm.userId, 10),
        assignedDate: assignForm.assignedDate || null,
      });
      addToast(`Asset assigned successfully`);
      setShowAssignModal(false);
      setAssignTarget(null);
      await Promise.all([fetchAssets(), fetchSummary()]);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to assign asset.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleReturn = async (asset) => {
    try {
      await api.put(`/assets/${asset.id}/return`);
      addToast(`"${asset.name}" marked as returned`);
      await Promise.all([fetchAssets(), fetchSummary()]);
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to return asset.', 'error');
    }
  };

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // --- Render ---
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Package className="w-6 h-6 text-blue-600" />
          IT Asset Management
        </h1>
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Asset
        </button>
      </div>

      {/* Stats Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total Assets" value={summary.total ?? 0} color="slate" />
          <StatCard label="Available" value={summary.available ?? 0} color="green" />
          <StatCard label="Assigned" value={summary.assigned ?? 0} color="blue" />
          <StatCard label="In Maintenance" value={summary.maintenance ?? 0} color="yellow" />
          <StatCard
            label="Total Value"
            value={formatINR.format(summary.totalValue ?? 0)}
            color="purple"
            isText
          />
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or serial number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {ASSET_TYPE_LABELS[t]}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Asset Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Package className="w-12 h-12 mb-3" />
            <p className="text-sm font-medium">No assets found</p>
            <p className="text-xs mt-1">
              {assets.length === 0
                ? 'Add your first asset to get started.'
                : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Serial #</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Assigned To</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Value</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{asset.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        {getTypeIcon(asset.type)}
                        {ASSET_TYPE_LABELS[asset.type] || asset.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                      {asset.serialNumber || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_COLORS[asset.status] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {asset.assignedTo?.name || asset.user?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 font-medium">
                      {asset.value ? formatINR.format(asset.value) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(asset)}
                          title="Edit"
                          className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {asset.status === 'available' && (
                          <button
                            onClick={() => openAssignModal(asset)}
                            title="Assign"
                            className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <ArrowLeftRight className="w-4 h-4" />
                          </button>
                        )}
                        {asset.status === 'assigned' && (
                          <button
                            onClick={() => handleReturn(asset)}
                            title="Mark Returned"
                            className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
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
        {filteredAssets.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
            Showing {filteredAssets.length} of {assets.length} assets
          </div>
        )}
      </div>

      {/* Add/Edit Asset Modal */}
      {showAssetModal && (
        <Modal
          title={editingAsset ? 'Edit Asset' : 'Add New Asset'}
          onClose={() => {
            setShowAssetModal(false);
            setEditingAsset(null);
            setFormError('');
          }}
        >
          <form onSubmit={handleAssetSubmit} className="space-y-4">
            {formError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {formError}
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Asset Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="e.g. Dell Latitude 5540"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Type + Status Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => updateForm('type', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ASSET_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ASSET_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => updateForm('status', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Serial Number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Serial Number</label>
              <input
                type="text"
                value={form.serialNumber}
                onChange={(e) => updateForm('serialNumber', e.target.value)}
                placeholder="e.g. SN-2024-001"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Purchase Date + Value Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Purchase Date
                </label>
                <input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => updateForm('purchaseDate', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Value (INR)</label>
                <input
                  type="number"
                  value={form.value}
                  onChange={(e) => updateForm('value', e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Company */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
              <select
                value={form.companyId}
                onChange={(e) => updateForm('companyId', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Company --</option>
                {companies.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => updateForm('notes', e.target.value)}
                rows={3}
                placeholder="Optional notes about this asset..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAssetModal(false);
                  setEditingAsset(null);
                  setFormError('');
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {formLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {editingAsset ? 'Update Asset' : 'Create Asset'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Assign Modal */}
      {showAssignModal && assignTarget && (
        <Modal
          title={`Assign: ${assignTarget.name}`}
          onClose={() => {
            setShowAssignModal(false);
            setAssignTarget(null);
            setFormError('');
          }}
        >
          <form onSubmit={handleAssign} className="space-y-4">
            {formError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {formError}
              </div>
            )}

            <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-3">
              {getTypeIcon(assignTarget.type, 'w-5 h-5 text-slate-500')}
              <div>
                <div className="text-sm font-medium text-slate-800">{assignTarget.name}</div>
                <div className="text-xs text-slate-500">
                  {ASSET_TYPE_LABELS[assignTarget.type] || assignTarget.type}
                  {assignTarget.serialNumber ? ` - ${assignTarget.serialNumber}` : ''}
                </div>
              </div>
            </div>

            {/* Employee Select */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Assign to Employee <span className="text-red-500">*</span>
              </label>
              <select
                value={assignForm.userId}
                onChange={(e) => setAssignForm((prev) => ({ ...prev, userId: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">-- Select Employee --</option>
                {users
                  .filter((u) => u.isActive !== false)
                  .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                  .map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.name} ({u.email})
                    </option>
                  ))}
              </select>
            </div>

            {/* Assigned Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Date</label>
              <input
                type="date"
                value={assignForm.assignedDate}
                onChange={(e) =>
                  setAssignForm((prev) => ({ ...prev, assignedDate: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAssignModal(false);
                  setAssignTarget(null);
                  setFormError('');
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {formLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <ArrowLeftRight className="w-4 h-4" />
                )}
                Assign Asset
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Toast Container */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
          {toasts.map((t) => (
            <Toast key={t.id} toast={t} onDismiss={dismissToast} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Stats Card Sub-Component ---
function StatCard({ label, value, color, isText = false }) {
  const colorMap = {
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.slate}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-70 mb-1">{label}</div>
      <div className={`font-bold ${isText ? 'text-lg' : 'text-2xl'}`}>{value}</div>
    </div>
  );
}
