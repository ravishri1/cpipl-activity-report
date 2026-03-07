import { useState } from 'react';
import {
  Package,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Search,
  Filter,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { useFetch } from '../../hooks/useFetch';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function InventoryAnalytics() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [viewMode, setViewMode] = useState('overview'); // overview, lowstock, trends

  const { data: inventory = [], loading: inventoryLoading, error: inventoryError, refetch: refetchInventory } = useFetch(
    '/procurement/inventory',
    []
  );

  const { data: lowStock = [], loading: lowStockLoading } = useFetch(
    '/procurement/inventory/low-stock',
    []
  );

  // Guard against null API responses (useFetch default [] is bypassed when API returns null)
  const safeInventory = Array.isArray(inventory) ? inventory : [];
  const safeLowStock = Array.isArray(lowStock) ? lowStock : [];

  // Calculate statistics
  const stats = {
    totalItems: safeInventory.length,
    lowStockCount: safeLowStock.length,
    avgStockValue: safeInventory.length > 0 ? safeInventory.reduce((sum, item) => sum + (item.quantity * (item.unitPrice || 0)), 0) / safeInventory.length : 0,
    totalValue: safeInventory.reduce((sum, item) => sum + (item.quantity * (item.unitPrice || 0)), 0),
    criticalItems: safeLowStock.filter((item) => (item.quantity || 0) <= (item.minQuantity || 0) * 0.5).length,
  };

  // Filter inventory
  const filteredInventory = safeInventory.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.itemName?.toLowerCase().includes(q) ||
      item.itemCode?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q)
    );
  });

  // Categorize stock levels
  const stockLevels = {
    critical: safeInventory.filter((i) => (i.quantity || 0) <= (i.minQuantity || 0)),
    low: safeInventory.filter((i) => (i.quantity || 0) > (i.minQuantity || 0) && (i.quantity || 0) <= (i.minQuantity || 0) * 1.5),
    adequate: safeInventory.filter((i) => (i.quantity || 0) > (i.minQuantity || 0) * 1.5),
  };

  const getCategoryBadge = (quantity, minQuantity) => {
    if (quantity <= minQuantity) {
      return {
        label: '🔴 CRITICAL',
        color: 'bg-red-100 text-red-700 border-red-200',
        priority: 1,
      };
    }
    if (quantity <= minQuantity * 1.5) {
      return {
        label: '🟡 LOW',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        priority: 2,
      };
    }
    return {
      label: '🟢 OK',
      color: 'bg-green-100 text-green-700 border-green-200',
      priority: 3,
    };
  };

  const loading = inventoryLoading || lowStockLoading;
  const error = inventoryError;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-600 to-blue-700 text-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8" />
            <div>
              <h1 className="text-3xl font-bold">Inventory Analytics</h1>
              <p className="text-cyan-100 mt-1">Monitor stock levels and trends</p>
            </div>
          </div>
          <button
            onClick={() => refetchInventory()}
            className="p-2 hover:bg-white/20 rounded-lg transition"
          >
            <RefreshCw className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-600 mb-1">Total Items</div>
          <div className="text-3xl font-bold text-blue-700">{stats.totalItems}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-sm text-red-600 mb-1">Critical Stock</div>
          <div className="text-3xl font-bold text-red-700">{stats.criticalItems}</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-sm text-yellow-600 mb-1">Low Stock</div>
          <div className="text-3xl font-bold text-yellow-700">{stats.lowStockCount}</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-sm text-purple-600 mb-1">Total Value</div>
          <div className="text-2xl font-bold text-purple-700">
            ₹{(stats.totalValue / 100000).toFixed(1)}L
          </div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-4">
          {[
            { key: 'overview', label: 'Overview', icon: Package },
            { key: 'lowstock', label: 'Low Stock', icon: AlertTriangle },
            { key: 'trends', label: 'Analysis', icon: BarChart3 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition ${
                viewMode === key
                  ? 'border-cyan-600 text-cyan-600'
                  : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div>
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <AlertMessage type="error" message={error} />
        ) : (
          <>
            {/* Overview Tab */}
            {viewMode === 'overview' && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                {filteredInventory.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No inventory items found</div>
                ) : (
                  <div className="space-y-3">
                    {filteredInventory.map((item) => {
                      const badge = getCategoryBadge(item.quantity || 0, item.minQuantity || 0);
                      const stockPercentage =
                        item.maxQuantity > 0
                          ? ((item.quantity || 0) / item.maxQuantity) * 100
                          : 0;
                      return (
                        <div
                          key={item.id}
                          className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="font-semibold text-slate-900">{item.itemName}</h3>
                              <p className="text-sm text-slate-600">Code: {item.itemCode}</p>
                            </div>
                            <div className={`px-3 py-1 rounded text-sm font-medium border ${badge.color}`}>
                              {badge.label}
                            </div>
                          </div>

                          {/* Stock Bar */}
                          <div className="mb-3">
                            <div className="flex justify-between text-xs text-slate-600 mb-1">
                              <span>Stock Level</span>
                              <span>
                                {item.quantity} / {item.maxQuantity} units
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  stockPercentage < 30
                                    ? 'bg-red-500'
                                    : stockPercentage < 60
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(stockPercentage, 100)}%` }}
                              />
                            </div>
                          </div>

                          {/* Details */}
                          <div className="grid grid-cols-3 gap-3 text-sm">
                            <div>
                              <p className="text-slate-600">Min Stock</p>
                              <p className="font-medium">{item.minQuantity}</p>
                            </div>
                            <div>
                              <p className="text-slate-600">Unit Price</p>
                              <p className="font-medium">₹{item.unitPrice || 0}</p>
                            </div>
                            <div>
                              <p className="text-slate-600">Stock Value</p>
                              <p className="font-medium">₹{(item.quantity * (item.unitPrice || 0)).toLocaleString('en-IN')}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Low Stock Tab */}
            {viewMode === 'lowstock' && (
              <div className="space-y-4">
                {stats.lowStockCount === 0 ? (
                  <div className="text-center py-8 bg-green-50 border border-green-200 rounded-lg">
                    <Zap className="w-12 h-12 text-green-600 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-green-900">All Stock Levels Normal</h3>
                    <p className="text-green-700 mt-1">No items below minimum threshold</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Critical Items */}
                    {stockLevels.critical.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="font-semibold text-red-700 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          Critical (Action Required)
                        </h3>
                        {stockLevels.critical.map((item) => (
                          <div
                            key={item.id}
                            className="border-l-4 border-red-500 bg-red-50 rounded p-3"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium text-red-900">{item.itemName}</h4>
                                <p className="text-sm text-red-700 mt-1">
                                  Current: {item.quantity} units | Min: {item.minQuantity}
                                </p>
                              </div>
                              <button className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
                                Reorder
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Low Items */}
                    {stockLevels.low.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="font-semibold text-yellow-700 flex items-center gap-2 mt-4">
                          <TrendingDown className="w-5 h-5" />
                          Low Stock (Monitor)
                        </h3>
                        {stockLevels.low.map((item) => (
                          <div
                            key={item.id}
                            className="border-l-4 border-yellow-500 bg-yellow-50 rounded p-3"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium text-yellow-900">{item.itemName}</h4>
                                <p className="text-sm text-yellow-700 mt-1">
                                  Current: {item.quantity} units | Min: {item.minQuantity}
                                </p>
                              </div>
                              <button className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700">
                                Monitor
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Analysis Tab */}
            {viewMode === 'trends' && (
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <h3 className="font-semibold text-slate-900 mb-4">Stock Distribution</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-green-700">Adequate Stock</span>
                        <span className="font-medium">
                          {stockLevels.adequate.length} items
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded h-2">
                        <div
                          className="bg-green-500 h-2 rounded"
                          style={{
                            width: `${(stockLevels.adequate.length / stats.totalItems) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-yellow-700">Low Stock</span>
                        <span className="font-medium">{stockLevels.low.length} items</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded h-2">
                        <div
                          className="bg-yellow-500 h-2 rounded"
                          style={{
                            width: `${(stockLevels.low.length / stats.totalItems) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-red-700">Critical Stock</span>
                        <span className="font-medium">
                          {stockLevels.critical.length} items
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded h-2">
                        <div
                          className="bg-red-500 h-2 rounded"
                          style={{
                            width: `${(stockLevels.critical.length / stats.totalItems) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">Most Valuable Items</h4>
                    <div className="space-y-1 text-sm">
                      {[...inventory]
                        .sort(
                          (a, b) =>
                            (b.quantity * (b.unitPrice || 0)) -
                            (a.quantity * (a.unitPrice || 0))
                        )
                        .slice(0, 3)
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between text-blue-700"
                          >
                            <span>{item.itemName}</span>
                            <span className="font-medium">
                              ₹
                              {(item.quantity * (item.unitPrice || 0)).toLocaleString(
                                'en-IN'
                              )}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h4 className="font-semibold text-purple-900 mb-2">Fast Moving Items</h4>
                    <div className="space-y-1 text-sm">
                      {[...inventory]
                        .sort((a, b) => (a.quantity || 0) - (b.quantity || 0))
                        .slice(0, 3)
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between text-purple-700"
                          >
                            <span>{item.itemName}</span>
                            <span className="font-medium">{item.quantity} units</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
