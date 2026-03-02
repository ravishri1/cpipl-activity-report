import React, { useState, useEffect } from 'react';
import {
  Package,
  Laptop,
  Smartphone,
  Monitor,
  CreditCard,
  Headphones,
  Keyboard,
  Mouse,
  Calendar,
  Hash,
  IndianRupee,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const ASSET_CONFIG = {
  laptop:      { icon: Laptop,     border: 'border-l-blue-500',   bg: 'bg-blue-50',    text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700' },
  phone:       { icon: Smartphone, border: 'border-l-emerald-500',bg: 'bg-emerald-50',  text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  monitor:     { icon: Monitor,    border: 'border-l-purple-500', bg: 'bg-purple-50',   text: 'text-purple-700',  badge: 'bg-purple-100 text-purple-700' },
  id_card:     { icon: CreditCard, border: 'border-l-amber-500',  bg: 'bg-amber-50',    text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700' },
  access_card: { icon: CreditCard, border: 'border-l-amber-500',  bg: 'bg-amber-50',    text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700' },
  headset:     { icon: Headphones, border: 'border-l-rose-500',   bg: 'bg-rose-50',     text: 'text-rose-700',    badge: 'bg-rose-100 text-rose-700' },
  keyboard:    { icon: Keyboard,   border: 'border-l-cyan-500',   bg: 'bg-cyan-50',     text: 'text-cyan-700',    badge: 'bg-cyan-100 text-cyan-700' },
  mouse:       { icon: Mouse,      border: 'border-l-teal-500',   bg: 'bg-teal-50',     text: 'text-teal-700',    badge: 'bg-teal-100 text-teal-700' },
  other:       { icon: Package,    border: 'border-l-slate-500',  bg: 'bg-slate-50',    text: 'text-slate-700',   badge: 'bg-slate-100 text-slate-700' },
};

const getConfig = (type) => ASSET_CONFIG[type] || ASSET_CONFIG.other;

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatType = (type) =>
  (type || 'other')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export default function MyAssets() {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/assets/my');
      setAssets(response.data || []);
    } catch (err) {
      console.error('Failed to fetch assets:', err);
      setError('Failed to load assets. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
        <p className="text-sm text-slate-500">Loading your assets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="p-4 bg-red-50 rounded-full mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-sm text-slate-600 mb-4">{error}</p>
        <button
          onClick={fetchAssets}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-blue-100 rounded-xl">
          <Package className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Assets</h1>
          <p className="text-sm text-slate-500">
            Assets currently assigned to you
          </p>
        </div>
      </div>

      {/* Content */}
      {assets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Package className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              No Assets Assigned
            </h3>
            <p className="text-sm text-slate-500 max-w-sm">
              No assets have been assigned to you yet. Contact your admin or IT
              team if you believe this is an error.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssetCard({ asset }) {
  const config = getConfig(asset.type);
  const Icon = config.icon;

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 border-l-4 ${config.border} shadow-sm p-5 hover:shadow-md transition-all duration-200`}
    >
      {/* Top row: icon, name, badge */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${config.bg}`}>
            <Icon className={`w-5 h-5 ${config.text}`} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">{asset.name}</h3>
            <span
              className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${config.badge}`}
            >
              {formatType(asset.type)}
            </span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2.5">
        {asset.serialNumber && (
          <div className="flex items-center gap-2 text-sm">
            <Hash className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-slate-500">Serial:</span>
            <span className="font-medium text-slate-700">
              {asset.serialNumber}
            </span>
          </div>
        )}

        {asset.assignedDate && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-slate-500">Assigned:</span>
            <span className="font-medium text-slate-700">
              {formatDate(asset.assignedDate)}
            </span>
          </div>
        )}

        {asset.value != null && asset.value > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <IndianRupee className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-slate-500">Value:</span>
            <span className="font-medium text-slate-700">
              {formatCurrency(asset.value)}
            </span>
          </div>
        )}

        {asset.notes && (
          <div className="flex items-start gap-2 text-sm mt-3 pt-3 border-t border-slate-100">
            <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-slate-500 leading-relaxed">{asset.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
