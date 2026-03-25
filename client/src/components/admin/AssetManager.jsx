import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import AssetRepairTimeline from './AssetRepairTimeline';
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
  Trash2,
  Unlink,
  History,
  ShieldAlert,
  Server,
  Printer,
  ScanLine,
  Wifi,
  Camera,
  Armchair,
  TabletSmartphone,
  ChevronDown,
  Users,
  Eye,
  Filter,
  Download,
  RefreshCw,
  Wrench,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const ASSET_TYPES = [
  'laptop', 'desktop', 'phone', 'tablet', 'simcard',
  'monitor', 'keyboard', 'mouse', 'headset', 'webcam',
  'printer', 'scanner', 'projector', 'camera',
  'router', 'switch', 'server',
  'charger', 'ac_remote', 'dongle', 'ups', 'cable', 'adapter',
  'id_card', 'access_card', 'furniture', 'other',
];

const ASSET_TYPE_LABELS = {
  laptop: 'Laptop',
  desktop: 'Desktop',
  phone: 'Phone',
  tablet: 'Tablet',
  simcard: 'SIM Card',
  monitor: 'Monitor',
  keyboard: 'Keyboard',
  mouse: 'Mouse',
  headset: 'Headset',
  webcam: 'Webcam',
  printer: 'Printer',
  scanner: 'Scanner',
  projector: 'Projector',
  camera: 'Camera',
  router: 'Router',
  switch: 'Switch',
  server: 'Server',
  charger: 'Charger',
  ac_remote: 'AC Remote',
  dongle: 'Dongle',
  ups: 'UPS',
  cable: 'Cable',
  adapter: 'Adapter',
  id_card: 'ID Card',
  access_card: 'Access Card',
  furniture: 'Furniture',
  other: 'Other',
};

const STATUS_OPTIONS = ['available', 'assigned', 'maintenance', 'retired', 'lost'];

const STATUS_COLORS = {
  available: 'bg-green-100 text-green-700 border-green-200',
  assigned: 'bg-blue-100 text-blue-700 border-blue-200',
  maintenance: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  retired: 'bg-slate-100 text-slate-500 border-slate-200',
  lost: 'bg-red-100 text-red-700 border-red-200',
};

const CATEGORY_OPTIONS = ['personal', 'office', 'infrastructure'];
const CATEGORY_LABELS = { personal: 'Personal', office: 'Office', infrastructure: 'Infrastructure' };

const CONDITION_OPTIONS = ['new', 'good', 'fair', 'damaged', 'non_working'];
const CONDITION_LABELS = { new: 'New', good: 'Good', fair: 'Fair', damaged: 'Damaged', non_working: 'Non-Working' };
const CONDITION_COLORS = {
  new: 'text-emerald-600',
  good: 'text-green-600',
  fair: 'text-amber-600',
  damaged: 'text-orange-600',
  non_working: 'text-red-600',
};

const LOCATION_OPTIONS = ['Miraroad', 'Lucknow'];

const TABS = [
  { key: 'all', label: 'All Assets' },
  { key: 'free', label: 'Free Assets' },
  { key: 'warranty', label: 'Warranty Expiring' },
  { key: 'in_repair', label: 'In Repair' },
  { key: 'employee', label: 'By Employee' },
];

const WARRANTY_DAY_OPTIONS = [
  { value: 30, label: '30 Days' },
  { value: 60, label: '60 Days' },
  { value: 90, label: '90 Days' },
];

const formatINR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

// ─── Icon Mapping ────────────────────────────────────────────────────────────

function getTypeIcon(type, className = 'w-4 h-4') {
  const icons = {
    laptop: <Laptop className={className} />,
    desktop: <Monitor className={className} />,
    phone: <Smartphone className={className} />,
    tablet: <TabletSmartphone className={className} />,
    id_card: <CreditCard className={className} />,
    access_card: <CreditCard className={className} />,
    monitor: <Monitor className={className} />,
    keyboard: <Keyboard className={className} />,
    mouse: <Mouse className={className} />,
    headset: <Headphones className={className} />,
    printer: <Printer className={className} />,
    scanner: <ScanLine className={className} />,
    router: <Wifi className={className} />,
    switch: <Wifi className={className} />,
    server: <Server className={className} />,
    projector: <Monitor className={className} />,
    camera: <Camera className={className} />,
    furniture: <Armchair className={className} />,
    other: <Package className={className} />,
  };
  return icons[type] || <Package className={className} />;
}

// ─── Toast Component ─────────────────────────────────────────────────────────

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all animate-slide-in ${
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

// ─── Modal Wrapper ───────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className={`bg-white rounded-xl shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'} w-full mx-4 max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ─── Confirm Dialog ──────────────────────────────────────────────────────────

function ConfirmDialog({ title, message, onConfirm, onCancel, confirmText = 'Confirm', danger = false }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, color, isText = false, onClick }) {
  const colorMap = {
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };

  return (
    <div
      className={`rounded-xl border p-4 ${colorMap[color] || colorMap.slate} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="text-xs font-medium uppercase tracking-wide opacity-70 mb-1">{label}</div>
      <div className={`font-bold ${isText ? 'text-lg' : 'text-2xl'}`}>{value}</div>
    </div>
  );
}

// ─── Select Dropdown ─────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, options, allLabel, className = '' }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${className}`}
    >
      <option value="all">{allLabel}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AssetManager() {
  const { user: currentUser } = useAuth();

  // ─── Data State ──────────────────────────────────────────────────────────
  const [assets, setAssets] = useState([]);
  const [freeAssets, setFreeAssets] = useState([]);
  const [warrantyAssets, setWarrantyAssets] = useState([]);
  const [repairAssets, setRepairAssets] = useState([]);
  const [employeeAssets, setEmployeeAssets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [handoverHistory, setHandoverHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);

  // ─── Tab & Filter State ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterCondition, setFilterCondition] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [warrantyDays, setWarrantyDays] = useState(30);
  const [selectedEmployee, setSelectedEmployee] = useState('');

  // ─── Modal State ─────────────────────────────────────────────────────────
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyAsset, setHistoryAsset] = useState(null);
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [repairTarget, setRepairTarget] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  // ─── Form State ──────────────────────────────────────────────────────────
  const emptyForm = {
    name: '',
    type: 'laptop',
    serialNumber: '',
    assetNumber: '',
    category: 'personal',
    condition: 'good',
    location: '',
    purchaseDate: '',
    purchasePrice: '',
    depreciationRate: '10',
    depreciationPeriod: 'yearly',
    warrantyExpiry: '',
    value: '',
    notes: '',
    companyId: '',
    status: 'available',
    brand: '',
    assetGroup: '',
    description: '',
    modelNo: '',
    invoiceNo: '',
    assetOwner: '',
    assetOwnerOther: '',
    assetOldUser: '',
  };

  const emptyRepairForm = {
    repairType: 'repair',
    expectedReturnDate: '',
    vendor: '',
    vendorPhone: '',
    vendorEmail: '',
    vendorLocation: '',
    estimatedCost: '',
    issueDescription: '',
    notes: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [assignForm, setAssignForm] = useState({ userId: '', assignedDate: '' });
  const [repairForm, setRepairForm] = useState(emptyRepairForm);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // ─── Toasts ──────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ─── Data Fetching ───────────────────────────────────────────────────────

  const fetchAssets = useCallback(async () => {
    try {
      const params = {};
      if (filterType !== 'all') params.type = filterType;
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterCategory !== 'all') params.category = filterCategory;
      if (filterCondition !== 'all') params.condition = filterCondition;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await api.get('/assets', { params });
      setAssets(res.data);
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    }
  }, [filterType, filterStatus, filterCategory, filterCondition, searchQuery]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get('/assets/summary');
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await api.get('/companies');
      setCompanies(res.data);
    } catch (err) {
      console.error('Failed to fetch companies:', err);
    }
  }, []);

  const fetchFreeAssets = useCallback(async () => {
    try {
      setTabLoading(true);
      const res = await api.get('/assets/free');
      setFreeAssets(res.data);
    } catch (err) {
      console.error('Failed to fetch free assets:', err);
    } finally {
      setTabLoading(false);
    }
  }, []);

  const fetchWarrantyAssets = useCallback(async (days = 30) => {
    try {
      setTabLoading(true);
      const res = await api.get('/assets/warranty-expiring', { params: { days } });
      setWarrantyAssets(res.data);
    } catch (err) {
      console.error('Failed to fetch warranty-expiring assets:', err);
    } finally {
      setTabLoading(false);
    }
  }, []);

  const fetchRepairAssets = useCallback(async () => {
    try {
      setTabLoading(true);
      const res = await api.get('/assets/in-repair');
      setRepairAssets(res.data);
    } catch (err) {
      console.error('Failed to fetch repair assets:', err);
    } finally {
      setTabLoading(false);
    }
  }, []);

  const fetchEmployeeAssets = useCallback(async (userId) => {
    if (!userId) {
      setEmployeeAssets([]);
      return;
    }
    try {
      setTabLoading(true);
      const res = await api.get(`/assets/employee/${userId}`);
      setEmployeeAssets(res.data);
    } catch (err) {
      console.error('Failed to fetch employee assets:', err);
    } finally {
      setTabLoading(false);
    }
  }, []);

  const fetchHandoverHistory = useCallback(async (assetId) => {
    try {
      const res = await api.get(`/assets/handover-history/${assetId}`);
      setHandoverHistory(res.data);
    } catch (err) {
      console.error('Failed to fetch handover history:', err);
      setHandoverHistory([]);
    }
  }, []);

  // ─── Initial Load ────────────────────────────────────────────────────────

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchAssets(), fetchSummary(), fetchUsers(), fetchCompanies()]);
      setLoading(false);
    };
    loadAll();
  }, []);

  // Re-fetch when filters change (only on All Assets tab)
  useEffect(() => {
    if (activeTab === 'all') {
      fetchAssets();
    }
  }, [filterType, filterStatus, filterCategory, filterCondition, searchQuery, fetchAssets]);

  // Tab data loading
  useEffect(() => {
    if (activeTab === 'free') fetchFreeAssets();
    if (activeTab === 'warranty') fetchWarrantyAssets(warrantyDays);
    if (activeTab === 'in_repair') fetchRepairAssets();
    if (activeTab === 'employee' && selectedEmployee) fetchEmployeeAssets(selectedEmployee);
  }, [activeTab, fetchRepairAssets, fetchFreeAssets, fetchWarrantyAssets, fetchEmployeeAssets]);

  useEffect(() => {
    if (activeTab === 'warranty') fetchWarrantyAssets(warrantyDays);
  }, [warrantyDays]);

  useEffect(() => {
    if (activeTab === 'employee' && selectedEmployee) {
      fetchEmployeeAssets(selectedEmployee);
    }
  }, [selectedEmployee]);

  // ─── Filter by location (client-side since backend doesn't support location filter) ───
  const applyLocationFilter = (list) => {
    if (filterLocation === 'all') return list;
    return list.filter((a) => a.location === filterLocation);
  };

  const getDisplayAssets = () => {
    switch (activeTab) {
      case 'free':
        return applyLocationFilter(freeAssets);
      case 'warranty':
        return applyLocationFilter(warrantyAssets);
      case 'in_repair':
        return applyLocationFilter(repairAssets);
      case 'employee':
        return applyLocationFilter(employeeAssets);
      default:
        return applyLocationFilter(assets);
    }
  };

  const displayAssets = getDisplayAssets();

  // ─── Refresh all data ────────────────────────────────────────────────────

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchAssets(), fetchSummary()]);
    if (activeTab === 'free') await fetchFreeAssets();
    if (activeTab === 'warranty') await fetchWarrantyAssets(warrantyDays);
    if (activeTab === 'in_repair') await fetchRepairAssets();
    if (activeTab === 'employee' && selectedEmployee) await fetchEmployeeAssets(selectedEmployee);
  }, [activeTab, warrantyDays, selectedEmployee, fetchAssets, fetchSummary, fetchFreeAssets, fetchWarrantyAssets, fetchRepairAssets, fetchEmployeeAssets]);

  // ─── Asset CRUD ──────────────────────────────────────────────────────────

  const openAddModal = () => {
    setEditingAsset(null);
    setForm(emptyForm);
    setFormError('');
    setShowAssetModal(true);
  };

  const openEditModal = (asset) => {
    setEditingAsset(asset);
    // Parse assetOwner field: "employee:5" or "other:Some Name"
    let ownerVal = '', ownerOther = '';
    if (asset.assetOwner) {
      if (asset.assetOwner.startsWith('other:')) {
        ownerVal = 'other';
        ownerOther = asset.assetOwner.replace('other:', '');
      } else if (asset.assetOwner.startsWith('employee:')) {
        ownerVal = asset.assetOwner;
      }
    }
    setForm({
      name: asset.name || '',
      type: asset.type || 'laptop',
      serialNumber: asset.serialNumber || '',
      assetNumber: asset.assetNumber || asset.assetTag || '',
      category: asset.category || 'personal',
      condition: asset.condition || 'good',
      location: asset.location || '',
      purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
      purchasePrice: asset.purchasePrice ?? '',
      depreciationRate: asset.depreciationRate ?? '10',
      depreciationPeriod: asset.depreciationPeriod || 'yearly',
      warrantyExpiry: asset.warrantyExpiry ? asset.warrantyExpiry.split('T')[0] : '',
      value: asset.value ?? '',
      notes: asset.notes || '',
      companyId: asset.companyId ? String(asset.companyId) : '',
      status: asset.status || 'available',
      brand: asset.brand || '',
      assetGroup: asset.assetGroup || '',
      description: asset.description || '',
      modelNo: asset.modelNo || '',
      invoiceNo: asset.invoiceNo || '',
      assetOwner: ownerVal,
      assetOwnerOther: ownerOther,
      assetOldUser: asset.assetOldUser || '',
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
    if (!form.type) {
      setFormError('Asset type is required.');
      return;
    }
    setFormLoading(true);
    try {
      // Resolve assetOwner
      let resolvedOwner = null;
      if (form.assetOwner === 'other') {
        resolvedOwner = form.assetOwnerOther ? `other:${form.assetOwnerOther.trim()}` : null;
      } else if (form.assetOwner) {
        resolvedOwner = form.assetOwner; // "employee:5"
      }

      const payload = {
        name: form.name.trim(),
        type: form.type,
        serialNumber: form.serialNumber.trim() || null,
        assetNumber: form.assetNumber.trim() || null,
        category: form.category || 'personal',
        condition: form.condition || 'good',
        location: form.location || null,
        purchaseDate: form.purchaseDate || null,
        purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : null,
        depreciationRate: form.depreciationRate ? parseFloat(form.depreciationRate) : 10,
        depreciationPeriod: form.depreciationPeriod || 'yearly',
        warrantyExpiry: form.warrantyExpiry || null,
        notes: form.notes.trim() || null,
        companyId: form.companyId ? parseInt(form.companyId, 10) : null,
        status: form.status || 'available',
        brand: form.brand.trim() || null,
        assetGroup: form.assetGroup.trim() || null,
        description: form.description.trim() || null,
        modelNo: form.modelNo.trim() || null,
        invoiceNo: form.invoiceNo.trim() || null,
        assetOwner: resolvedOwner,
        assetOldUser: form.assetOldUser.trim() || null,
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
      await refreshAll();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save asset.');
    } finally {
      setFormLoading(false);
    }
  };

  // ─── Delete (Soft) ───────────────────────────────────────────────────────

  const handleDelete = (asset) => {
    setConfirmAction({
      title: 'Retire Asset',
      message: `Are you sure you want to retire "${asset.name}"? This will mark it as retired.`,
      confirmText: 'Retire',
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/assets/${asset.id}`);
          addToast(`"${asset.name}" has been retired`);
          await refreshAll();
        } catch (err) {
          addToast(err.response?.data?.error || 'Failed to retire asset.', 'error');
        }
        setConfirmAction(null);
      },
    });
  };

  // ─── Repair/Maintenance ───────────────────────────────────────────────────

  const handleSendForRepair = (asset) => {
    setRepairTarget(asset);
    setRepairForm(emptyRepairForm);
    setFormError('');
    setShowRepairModal(true);
  };

  const updateRepairForm = (field, value) => {
    setRepairForm(prev => ({ ...prev, [field]: value }));
  };

  const handleRepairSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    
    if (!repairForm.repairType || !repairForm.expectedReturnDate) {
      setFormError('Please fill in repair type and expected return date.');
      return;
    }
    if (!repairForm.vendor || !repairForm.vendorLocation || !repairForm.issueDescription) {
      setFormError('Please fill in vendor name, vendor location, and issue description.');
      return;
    }

    setFormLoading(true);
    try {
      await api.post(`/assets/repairs/${repairTarget.id}/initiate`, {
        repairType: repairForm.repairType,
        expectedReturnDate: repairForm.expectedReturnDate,
        vendor: repairForm.vendor,
        vendorPhone: repairForm.vendorPhone || null,
        vendorEmail: repairForm.vendorEmail || null,
        vendorLocation: repairForm.vendorLocation,
        estimatedCost: repairForm.estimatedCost ? parseFloat(repairForm.estimatedCost) : null,
        issueDescription: repairForm.issueDescription,
        notes: repairForm.notes || null,
      });
      addToast(`Asset sent for repair successfully`);
      setShowRepairModal(false);
      setRepairTarget(null);
      await refreshAll();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to send asset for repair.');
    } finally {
      setFormLoading(false);
    }
  };

  // ─── Assign ──────────────────────────────────────────────────────────────

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
      await refreshAll();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to assign asset.');
    } finally {
      setFormLoading(false);
    }
  };

  // ─── Return ──────────────────────────────────────────────────────────────

  const handleReturn = (asset) => {
    setConfirmAction({
      title: 'Return Asset',
      message: `Mark "${asset.name}" as returned? It will become available again.`,
      confirmText: 'Mark Returned',
      danger: false,
      onConfirm: async () => {
        try {
          await api.put(`/assets/${asset.id}/return`);
          addToast(`"${asset.name}" marked as returned`);
          await refreshAll();
        } catch (err) {
          addToast(err.response?.data?.error || 'Failed to return asset.', 'error');
        }
        setConfirmAction(null);
      },
    });
  };

  // ─── Detach ──────────────────────────────────────────────────────────────

  const handleDetach = (asset) => {
    setConfirmAction({
      title: 'Detach Asset',
      message: `Remove assignment of "${asset.name}" from ${asset.assignee?.name || 'the employee'}? The asset will become available without a formal return record.`,
      confirmText: 'Detach',
      danger: true,
      onConfirm: async () => {
        try {
          await api.put(`/assets/${asset.id}/detach`, { notes: 'Detached by admin' });
          addToast(`"${asset.name}" detached successfully`);
          await refreshAll();
        } catch (err) {
          addToast(err.response?.data?.error || 'Failed to detach asset.', 'error');
        }
        setConfirmAction(null);
      },
    });
  };

  // ─── Handover History ────────────────────────────────────────────────────

  const openHistory = async (asset) => {
    setHistoryAsset(asset);
    setShowHistoryModal(true);
    await fetchHandoverHistory(asset.id);
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const clearFilters = () => {
    setFilterType('all');
    setFilterStatus('all');
    setFilterCategory('all');
    setFilterCondition('all');
    setFilterLocation('all');
    setSearchQuery('');
  };

  const hasActiveFilters = filterType !== 'all' || filterStatus !== 'all' ||
    filterCategory !== 'all' || filterCondition !== 'all' ||
    filterLocation !== 'all' || searchQuery.trim() !== '';

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Package className="w-6 h-6 text-blue-600" />
          IT Asset Management
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshAll}
            className="flex items-center gap-1.5 px-3 py-2 text-slate-600 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Asset
          </button>
        </div>
      </div>

      {/* ─── Stats Row ───────────────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Total Assets"
            value={summary.totalCount ?? 0}
            color="slate"
          />
          <StatCard
            label="Assigned"
            value={summary.byStatus?.assigned ?? 0}
            color="blue"
          />
          <StatCard
            label="Available"
            value={summary.byStatus?.available ?? 0}
            color="green"
          />
          <StatCard
            label="Maintenance"
            value={summary.byStatus?.maintenance ?? 0}
            color="yellow"
          />
          <StatCard
            label="Retired"
            value={summary.byStatus?.retired ?? 0}
            color="red"
          />
          <StatCard
            label="Total Value"
            value={formatINR.format(summary.totalValue ?? 0)}
            color="purple"
            isText
          />
        </div>
      )}

      {/* ─── Tab Navigation ──────────────────────────────────────────────── */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-0 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
              {tab.key === 'warranty' && summary?.warrantyExpiring > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-amber-100 text-amber-700 rounded-full">
                  {summary.warrantyExpiring}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ─── Filter Bar (All Assets tab) ─────────────────────────────────── */}
      {activeTab === 'all' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, serial, asset tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

            {/* Type */}
            <FilterSelect
              value={filterType}
              onChange={setFilterType}
              options={ASSET_TYPES.map((t) => ({ value: t, label: ASSET_TYPE_LABELS[t] }))}
              allLabel="All Types"
            />

            {/* Status */}
            <FilterSelect
              value={filterStatus}
              onChange={setFilterStatus}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: capitalize(s) }))}
              allLabel="All Statuses"
            />

            {/* Category */}
            <FilterSelect
              value={filterCategory}
              onChange={setFilterCategory}
              options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
              allLabel="All Categories"
            />

            {/* Condition */}
            <FilterSelect
              value={filterCondition}
              onChange={setFilterCondition}
              options={CONDITION_OPTIONS.map((c) => ({ value: c, label: CONDITION_LABELS[c] }))}
              allLabel="All Conditions"
            />

            {/* Location */}
            <FilterSelect
              value={filterLocation}
              onChange={setFilterLocation}
              options={LOCATION_OPTIONS.map((l) => ({ value: l, label: l }))}
              allLabel="All Locations"
            />

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Warranty Days Selector ──────────────────────────────────────── */}
      {activeTab === 'warranty' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span className="font-medium">Warranty expiring within:</span>
            </div>
            <div className="flex gap-2">
              {WARRANTY_DAY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setWarrantyDays(opt.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg border font-medium transition-colors ${
                    warrantyDays === opt.value
                      ? 'bg-amber-50 border-amber-300 text-amber-700'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <FilterSelect
              value={filterLocation}
              onChange={setFilterLocation}
              options={LOCATION_OPTIONS.map((l) => ({ value: l, label: l }))}
              allLabel="All Locations"
            />
          </div>
        </div>
      )}

      {/* ─── In Repair Filter Bar ───────────────────────────────────────── */}
      {activeTab === 'in_repair' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Wrench className="w-4 h-4 text-orange-500" />
              <span className="font-medium">Assets currently in repair or maintenance</span>
            </div>
            <FilterSelect
              value={filterLocation}
              onChange={setFilterLocation}
              options={LOCATION_OPTIONS.map((l) => ({ value: l, label: l }))}
              allLabel="All Locations"
            />
          </div>
        </div>
      )}

      {/* ─── Employee Selector ───────────────────────────────────────────── */}
      {activeTab === 'employee' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="font-medium">Select Employee:</span>
            </div>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="flex-1 max-w-md px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Choose Employee --</option>
              {users
                .filter((u) => u.isActive !== false)
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                .map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.name} ({u.email})
                  </option>
                ))}
            </select>
            <FilterSelect
              value={filterLocation}
              onChange={setFilterLocation}
              options={LOCATION_OPTIONS.map((l) => ({ value: l, label: l }))}
              allLabel="All Locations"
            />
          </div>
        </div>
      )}

      {/* ─── Free Assets filter bar ──────────────────────────────────────── */}
      {activeTab === 'free' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Check className="w-4 h-4 text-green-500" />
              <span className="font-medium">Available assets ready for assignment</span>
            </div>
            <FilterSelect
              value={filterLocation}
              onChange={setFilterLocation}
              options={LOCATION_OPTIONS.map((l) => ({ value: l, label: l }))}
              allLabel="All Locations"
            />
          </div>
        </div>
      )}

      {/* ─── Asset Repair Timeline (In Repair Tab) ───────────────────────── */}
      {activeTab === 'in_repair' && (
        <AssetRepairTimeline />
      )}

      {/* ─── Asset Table ─────────────────────────────────────────────────── */}
      {activeTab !== 'in_repair' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {tabLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : displayAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Package className="w-12 h-12 mb-3" />
            <p className="text-sm font-medium">No assets found</p>
            <p className="text-xs mt-1">
              {activeTab === 'employee' && !selectedEmployee
                ? 'Select an employee to view their assets.'
                : activeTab === 'warranty'
                ? `No assets with warranty expiring within ${warrantyDays} days.`
                : activeTab === 'free'
                ? 'No available assets at the moment.'
                : assets.length === 0
                ? 'Add your first asset to get started.'
                : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Asset Number</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Serial #</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Condition</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Location</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Assigned To</th>
                  {activeTab === 'warranty' && (
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Warranty Expiry</th>
                  )}
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayAssets.map((asset) => {
                  const warrantyRemaining = daysUntil(asset.warrantyExpiry);
                  return (
                    <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                      {/* Asset Number */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-500">
                          {asset.assetNumber || asset.assetTag || '-'}
                        </span>
                      </td>
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{asset.name}</div>
                        {asset.value ? (
                          <div className="text-xs text-slate-400 mt-0.5">{formatINR.format(asset.value)}</div>
                        ) : null}
                      </td>
                      {/* Type */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          {getTypeIcon(asset.type)}
                          <span className="whitespace-nowrap">{ASSET_TYPE_LABELS[asset.type] || asset.type}</span>
                        </span>
                      </td>
                      {/* Serial */}
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                        {asset.serialNumber || '-'}
                      </td>
                      {/* Category */}
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {CATEGORY_LABELS[asset.category] || asset.category || '-'}
                        </span>
                      </td>
                      {/* Condition */}
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${CONDITION_COLORS[asset.condition] || 'text-slate-500'}`}>
                          {CONDITION_LABELS[asset.condition] || asset.condition || '-'}
                        </span>
                      </td>
                      {/* Location */}
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {asset.location || '-'}
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            STATUS_COLORS[asset.status] || 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {capitalize(asset.status)}
                        </span>
                      </td>
                      {/* Assigned To */}
                      <td className="px-4 py-3">
                        {asset.assignee ? (
                          <div>
                            <div className="text-sm text-slate-700 font-medium">{asset.assignee.name}</div>
                            {asset.assignedDate && (
                              <div className="text-xs text-slate-400">since {formatDate(asset.assignedDate)}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      {/* Warranty Expiry (warranty tab only) */}
                      {activeTab === 'warranty' && (
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-700">{formatDate(asset.warrantyExpiry)}</div>
                          {warrantyRemaining !== null && (
                            <div className={`text-xs font-medium ${
                              warrantyRemaining <= 7 ? 'text-red-600' : warrantyRemaining <= 14 ? 'text-amber-600' : 'text-slate-400'
                            }`}>
                              {warrantyRemaining <= 0 ? 'Expired' : `${warrantyRemaining} days left`}
                            </div>
                          )}
                        </td>
                      )}
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit */}
                          <button
                            onClick={() => openEditModal(asset)}
                            title="Edit"
                            className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {/* Send for Repair (available or assigned assets only) */}
                          {(asset.status === 'available' || asset.status === 'assigned') && (
                            <button
                              onClick={() => handleSendForRepair(asset)}
                              title="Send for Repair"
                              className="p-1.5 rounded-md text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                            >
                              <Wrench className="w-4 h-4" />
                            </button>
                          )}
                          {/* Assign (only if available) */}
                          {asset.status === 'available' && (
                            <button
                              onClick={() => openAssignModal(asset)}
                              title="Assign to Employee"
                              className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            >
                              <ArrowLeftRight className="w-4 h-4" />
                            </button>
                          )}
                          {/* Return (only if assigned) */}
                          {asset.status === 'assigned' && (
                            <button
                              onClick={() => handleReturn(asset)}
                              title="Mark Returned"
                              className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          {/* Detach (only if assigned) */}
                          {asset.status === 'assigned' && (
                            <button
                              onClick={() => handleDetach(asset)}
                              title="Detach from Employee"
                              className="p-1.5 rounded-md text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                            >
                              <Unlink className="w-4 h-4" />
                            </button>
                          )}
                          {/* History */}
                          <button
                            onClick={() => openHistory(asset)}
                            title="Handover History"
                            className="p-1.5 rounded-md text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          {/* Delete / Retire (only if not assigned) */}
                          {asset.status !== 'assigned' && asset.status !== 'retired' && (
                            <button
                              onClick={() => handleDelete(asset)}
                              title="Retire Asset"
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {displayAssets.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>
              Showing {displayAssets.length} asset{displayAssets.length !== 1 ? 's' : ''}
              {activeTab === 'all' && hasActiveFilters ? ' (filtered)' : ''}
            </span>
            {activeTab === 'all' && (
              <span className="text-slate-400">Total: {summary?.totalCount ?? assets.length}</span>
            )}
          </div>
        )}
      </div>
      )}

      {/* ─── Add/Edit Asset Modal ────────────────────────────────────────── */}
      {showAssetModal && (
        <Modal
          title={editingAsset ? 'Edit Asset' : 'Add New Asset'}
          onClose={() => {
            setShowAssetModal(false);
            setEditingAsset(null);
            setFormError('');
          }}
          wide
        >
          <form onSubmit={handleAssetSubmit} className="space-y-4">
            {formError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {formError}
              </div>
            )}

            {/* Row 1: Name + Asset Number */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Asset Number</label>
                <input
                  type="text"
                  value={form.assetNumber}
                  onChange={(e) => updateForm('assetNumber', e.target.value)}
                  placeholder="e.g. CPIPL-LT-001"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Row 2: Type + Status + Category */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
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
                      {capitalize(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => updateForm('category', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3: Brand + Model No + Serial Number */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Brand</label>
                <input
                  type="text"
                  value={form.brand}
                  onChange={(e) => updateForm('brand', e.target.value)}
                  placeholder="e.g. Apple, Dell, HP"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Model No</label>
                <input
                  type="text"
                  value={form.modelNo}
                  onChange={(e) => updateForm('modelNo', e.target.value)}
                  placeholder="e.g. MacBook Air M2"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
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
            </div>

            {/* Row 4: Condition + Location + Asset Group */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Condition</label>
                <select
                  value={form.condition}
                  onChange={(e) => updateForm('condition', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CONDITION_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {CONDITION_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                <select
                  value={form.location}
                  onChange={(e) => updateForm('location', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Location --</option>
                  {LOCATION_OPTIONS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Asset Group</label>
                <input
                  type="text"
                  value={form.assetGroup}
                  onChange={(e) => updateForm('assetGroup', e.target.value)}
                  placeholder="e.g. IT Equipment, Furniture"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Row 5: Purchase Date + Purchase Price + Invoice No */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Date</label>
                <input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => updateForm('purchaseDate', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Price (INR)</label>
                <input
                  type="number"
                  value={form.purchasePrice}
                  onChange={(e) => updateForm('purchasePrice', e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Invoice No</label>
                <input
                  type="text"
                  value={form.invoiceNo}
                  onChange={(e) => updateForm('invoiceNo', e.target.value)}
                  placeholder="e.g. INV-2024-001"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Row 6: Depreciation Period + Depreciation Rate + Current Value (auto) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Depreciation Period</label>
                <select
                  value={form.depreciationPeriod}
                  onChange={(e) => updateForm('depreciationPeriod', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="yearly">Yearly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Depreciation Rate (%)</label>
                <input
                  type="number"
                  value={form.depreciationRate}
                  onChange={(e) => updateForm('depreciationRate', e.target.value)}
                  placeholder="10"
                  min="0"
                  max="100"
                  step="0.5"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Current Value (INR)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.purchasePrice && form.purchaseDate ? (() => {
                      const pp = parseFloat(form.purchasePrice);
                      const rate = parseFloat(form.depreciationRate || 10) / 100;
                      const period = form.depreciationPeriod || 'yearly';
                      const start = new Date(form.purchaseDate);
                      const now = new Date();
                      const diffMs = now - start;
                      if (diffMs <= 0) return formatINR.format(pp);
                      let periods = 0;
                      if (period === 'yearly') periods = diffMs / (365.25 * 24 * 60 * 60 * 1000);
                      else if (period === 'quarterly') periods = diffMs / (91.3125 * 24 * 60 * 60 * 1000);
                      else if (period === 'monthly') periods = diffMs / (30.4375 * 24 * 60 * 60 * 1000);
                      const val = Math.max(0, Math.round(pp * Math.pow(1 - rate, Math.floor(periods))));
                      return formatINR.format(val);
                    })() : '-'}
                    readOnly
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Auto</span>
                </div>
              </div>
            </div>

            {/* Row 7: Warranty Expiry + Company */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Warranty Expiry</label>
                <input
                  type="date"
                  value={form.warrantyExpiry}
                  onChange={(e) => updateForm('warrantyExpiry', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
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
            </div>

            {/* Row 8: Asset Owner/Assignee (only when status = assigned) */}
            {form.status === 'assigned' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Asset Owner / Assignee</label>
                  <select
                    value={form.assetOwner}
                    onChange={(e) => updateForm('assetOwner', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select Owner --</option>
                    {users.map((u) => (
                      <option key={u.id} value={`employee:${u.id}`}>
                        {u.name} {u.employeeId ? `(${u.employeeId})` : ''} — {u.department || 'No Dept'}
                      </option>
                    ))}
                    <option value="other">Other (External Person)</option>
                  </select>
                </div>
                {form.assetOwner === 'other' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Other Person Name</label>
                    <input
                      type="text"
                      value={form.assetOwnerOther}
                      onChange={(e) => updateForm('assetOwnerOther', e.target.value)}
                      placeholder="Enter person name"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Row 9: Asset Old User */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Asset Old User</label>
                <input
                  type="text"
                  value={form.assetOldUser}
                  onChange={(e) => updateForm('assetOldUser', e.target.value)}
                  placeholder="Previous user of this asset"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                rows={2}
                placeholder="Detailed description of the asset..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => updateForm('notes', e.target.value)}
                rows={2}
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

      {/* ─── Assign Modal ────────────────────────────────────────────────── */}
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
                  {assignTarget.serialNumber ? ` | ${assignTarget.serialNumber}` : ''}
                  {(assignTarget.assetNumber || assignTarget.assetTag) ? ` | ${assignTarget.assetNumber || assignTarget.assetTag}` : ''}
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

      {/* ─── Handover History Modal ──────────────────────────────────────── */}
      {showHistoryModal && historyAsset && (
        <Modal
          title={`Handover History: ${historyAsset.name}`}
          onClose={() => {
            setShowHistoryModal(false);
            setHistoryAsset(null);
            setHandoverHistory([]);
          }}
          wide
        >
          <div className="space-y-3">
            {/* Asset info */}
            <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-3">
              {getTypeIcon(historyAsset.type, 'w-5 h-5 text-slate-500')}
              <div>
                <div className="text-sm font-medium text-slate-800">{historyAsset.name}</div>
                <div className="text-xs text-slate-500">
                  {ASSET_TYPE_LABELS[historyAsset.type] || historyAsset.type}
                  {(historyAsset.assetNumber || historyAsset.assetTag) ? ` | ${historyAsset.assetNumber || historyAsset.assetTag}` : ''}
                  {historyAsset.serialNumber ? ` | SN: ${historyAsset.serialNumber}` : ''}
                </div>
              </div>
            </div>

            {handoverHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <History className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No handover history recorded for this asset.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-2 font-semibold text-slate-600">Date</th>
                      <th className="text-left px-4 py-2 font-semibold text-slate-600">Type</th>
                      <th className="text-left px-4 py-2 font-semibold text-slate-600">From</th>
                      <th className="text-left px-4 py-2 font-semibold text-slate-600">To</th>
                      <th className="text-left px-4 py-2 font-semibold text-slate-600">Condition</th>
                      <th className="text-left px-4 py-2 font-semibold text-slate-600">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {handoverHistory.map((h) => {
                      const fromUser = users.find((u) => u.id === h.fromUserId);
                      const toUser = users.find((u) => u.id === h.toUserId);
                      return (
                        <tr key={h.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                            {formatDate(h.handoverDate || h.createdAt)}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              h.handoverType === 'transfer'
                                ? 'bg-blue-100 text-blue-700'
                                : h.handoverType === 'exit_return'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {capitalize(h.handoverType)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-slate-600">
                            {fromUser?.name || (h.fromUserId ? `User #${h.fromUserId}` : '-')}
                          </td>
                          <td className="px-4 py-2 text-slate-600">
                            {toUser?.name || (h.toUserId ? `User #${h.toUserId}` : 'Pool')}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`text-xs font-medium ${CONDITION_COLORS[h.condition] || 'text-slate-500'}`}>
                              {CONDITION_LABELS[h.condition] || h.condition || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs text-slate-500 max-w-[200px] truncate" title={h.notes}>
                            {h.notes || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ─── Repair Modal ────────────────────────────────────────────────── */}
      {showRepairModal && repairTarget && (
        <Modal
          title={`Send for Repair: ${repairTarget.name}`}
          onClose={() => {
            setShowRepairModal(false);
            setRepairTarget(null);
            setFormError('');
          }}
          wide
        >
          <form onSubmit={handleRepairSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {formError}
              </div>
            )}

            {/* Repair Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Repair Type *</label>
              <select
                value={repairForm.repairType}
                onChange={(e) => updateRepairForm('repairType', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="repair">Repair</option>
                <option value="maintenance">Maintenance</option>
                <option value="inspection">Inspection</option>
                <option value="calibration">Calibration</option>
              </select>
            </div>

            {/* Dates */}
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
              📅 Sent out date will be recorded as <strong>today</strong>.
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Expected Return Date *</label>
              <input
                type="date"
                value={repairForm.expectedReturnDate}
                onChange={(e) => updateRepairForm('expectedReturnDate', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Vendor Info */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Vendor Name *</label>
              <input
                type="text"
                value={repairForm.vendor}
                onChange={(e) => updateRepairForm('vendor', e.target.value)}
                placeholder="e.g., Tech Repair Center"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Vendor Contact */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                <input
                  type="tel"
                  value={repairForm.vendorPhone}
                  onChange={(e) => updateRepairForm('vendorPhone', e.target.value)}
                  placeholder="Phone number"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <input
                  type="email"
                  value={repairForm.vendorEmail}
                  onChange={(e) => updateRepairForm('vendorEmail', e.target.value)}
                  placeholder="Email address"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Vendor Location */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Location *</label>
              <input
                type="text"
                value={repairForm.vendorLocation}
                onChange={(e) => updateRepairForm('vendorLocation', e.target.value)}
                placeholder="City / Address"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Cost & Description */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Estimated Cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={repairForm.estimatedCost}
                  onChange={(e) => updateRepairForm('estimatedCost', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Issue Description *</label>
                <input
                  type="text"
                  value={repairForm.issueDescription}
                  onChange={(e) => updateRepairForm('issueDescription', e.target.value)}
                  placeholder="Brief description"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
              <textarea
                value={repairForm.notes}
                onChange={(e) => updateRepairForm('notes', e.target.value)}
                placeholder="Additional notes"
                rows="3"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowRepairModal(false);
                  setRepairTarget(null);
                  setFormError('');
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {formLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Wrench className="w-4 h-4" />
                )}
                Send for Repair
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── Confirm Dialog ──────────────────────────────────────────────── */}
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          confirmText={confirmAction.confirmText}
          danger={confirmAction.danger}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* ─── Toast Container ─────────────────────────────────────────────── */}
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
