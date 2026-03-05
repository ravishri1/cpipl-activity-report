import { useState } from 'react';
import {
  Package,
  Users,
  ShoppingCart,
  Zap,
  Plus,
  Filter,
  Search,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';
import api from '../../services/api';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import StatusBadge from '../shared/StatusBadge';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';

const PROCUREMENT_STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  submitted: 'bg-blue-100 text-blue-700 border-blue-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  completed: 'bg-purple-100 text-purple-700 border-purple-200',
  cancelled: 'bg-slate-100 text-slate-700 border-slate-200',
};

const formatINR = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function ProcurementManager() {
  const [activeTab, setActiveTab] = useState('orders');
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingId, setEditingId] = useState(null);

  // Fetch data
  const { data: orders = [], loading: ordersLoading, error: ordersError, refetch: refetchOrders } = useFetch(
    `/api/procurement/orders`,
    []
  );

  const { data: vendors = [], loading: vendorsLoading, error: vendorsError, refetch: refetchVendors } = useFetch(
    `/api/procurement/vendors`,
    []
  );

  const { data: inventory = [], loading: inventoryLoading, error: inventoryError, refetch: refetchInventory } = useFetch(
    `/api/procurement/inventory`,
    []
  );

  const { data: lowStock = [], loading: lowStockLoading } = useFetch(
    `/api/procurement/inventory/low-stock`,
    []
  );

  const { execute: submitOrder, loading: submitting } = useApi();
  const { execute: approveOrder, loading: approving } = useApi();
  const { execute: deleteVendor, loading: deleting } = useApi();

  // Calculate stats
  const stats = {
    totalOrders: orders.length,
    pending: orders.filter((o) => o.status === 'draft').length,
    submitted: orders.filter((o) => o.status === 'submitted').length,
    approved: orders.filter((o) => o.status === 'approved').length,
    totalVendors: vendors.length,
    lowStockItems: lowStock.length,
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    if (statusFilter && order.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      order.orderNumber?.toLowerCase().includes(q) ||
      order.vendor?.vendorName?.toLowerCase().includes(q) ||
      order.id?.toString().includes(q)
    );
  });

  // Filter vendors
  const filteredVendors = vendors.filter((vendor) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      vendor.vendorName?.toLowerCase().includes(q) ||
      vendor.email?.toLowerCase().includes(q) ||
      vendor.phone?.toLowerCase().includes(q)
    );
  });

  const handleSubmitOrder = async (orderId) => {
    await submitOrder(
      () => api.post(`/api/procurement/orders/${orderId}/submit`, {}),
      'Order submitted successfully'
    );
    refetchOrders();
  };

  const handleApproveOrder = async (orderId) => {
    await approveOrder(
      () =>
        api.post(`/api/procurement/orders/${orderId}/approve`, {
          approvalDate: new Date().toISOString().split('T')[0],
        }),
      'Order approved successfully'
    );
    refetchOrders();
  };

  const handleDeleteVendor = async (vendorId) => {
    if (window.confirm('Are you sure you want to delete this vendor?')) {
      await deleteVendor(
        () => api.delete(`/api/procurement/vendors/${vendorId}`),
        'Vendor deleted successfully'
      );
      refetchVendors();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-b-lg shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-8 h-8" />
            <div>
              <h1 className="text-3xl font-bold">Procurement Management</h1>
              <p className="text-blue-100 mt-1">Manage vendors, orders, and inventory</p>
            </div>
          </div>
          <button
            onClick={() => setShowOrderForm(true)}
            className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 flex items-center gap-2 transition"
          >
            <Plus className="w-5 h-5" />
            New Order
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-blue-700">{stats.totalOrders}</div>
          <div className="text-blue-600 text-sm mt-1">Total Orders</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-gray-700">{stats.pending}</div>
          <div className="text-gray-600 text-sm mt-1">Draft Orders</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-purple-700">{stats.submitted}</div>
          <div className="text-purple-600 text-sm mt-1">Submitted</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-green-700">{stats.approved}</div>
          <div className="text-green-600 text-sm mt-1">Approved</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-orange-700">{stats.totalVendors}</div>
          <div className="text-orange-600 text-sm mt-1">Vendors</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-4">
          {[
            { key: 'orders', label: 'Purchase Orders', icon: ShoppingCart },
            { key: 'approval', label: 'Approvals', icon: CheckCircle2 },
            { key: 'vendors', label: 'Vendors', icon: Users },
            { key: 'inventory', label: 'Inventory', icon: Package },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition ${
                activeTab === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
              </select>
            </div>

            {ordersLoading ? (
              <LoadingSpinner />
            ) : ordersError ? (
              <AlertMessage type="error" message={ordersError} />
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No orders found</div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{order.orderNumber}</h3>
                          <StatusBadge status={order.status} styles={PROCUREMENT_STATUS_STYLES} />
                        </div>
                        <p className="text-sm text-slate-600 mt-1">
                          {order.vendor?.vendorName} • {formatINR(order.totalAmount)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Created: {formatDate(order.createdDate)} • Line Items: {order.lineItems?.length || 0}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {order.status === 'draft' && (
                          <button
                            onClick={() => handleSubmitOrder(order.id)}
                            disabled={submitting}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                          >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Submit
                          </button>
                        )}
                        {order.status === 'submitted' && (
                          <button
                            onClick={() => handleApproveOrder(order.id)}
                            disabled={approving}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                          >
                            {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Approve
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Approval Queue Tab */}
        {activeTab === 'approval' && (
          <div className="space-y-4">
            {ordersLoading ? (
              <LoadingSpinner />
            ) : (
              <div className="space-y-3">
                {orders.filter((o) => o.status === 'submitted').length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No orders pending approval</div>
                ) : (
                  orders
                    .filter((o) => o.status === 'submitted')
                    .map((order) => (
                      <div
                        key={order.id}
                        className="border-l-4 border-amber-500 bg-amber-50 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">{order.orderNumber}</h3>
                            <p className="text-sm text-slate-600 mt-1">
                              Vendor: {order.vendor?.vendorName}
                            </p>
                            <p className="text-sm text-slate-600">Amount: {formatINR(order.totalAmount)}</p>
                          </div>
                          <button
                            onClick={() => handleApproveOrder(order.id)}
                            disabled={approving}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                          >
                            {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Approve
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Vendors Tab */}
        {activeTab === 'vendors' && (
          <div className="space-y-4">
            <button
              onClick={() => setShowVendorForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Vendor
            </button>

            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {vendorsLoading ? (
              <LoadingSpinner />
            ) : vendorsError ? (
              <AlertMessage type="error" message={vendorsError} />
            ) : filteredVendors.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No vendors found</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredVendors.map((vendor) => (
                  <div
                    key={vendor.id}
                    className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{vendor.vendorName}</h3>
                        <p className="text-sm text-slate-600 mt-1">{vendor.email}</p>
                        <p className="text-sm text-slate-600">{vendor.phone}</p>
                        {vendor.gstNumber && <p className="text-xs text-slate-500 mt-1">GST: {vendor.gstNumber}</p>}
                      </div>
                      <button
                        onClick={() => handleDeleteVendor(vendor.id)}
                        disabled={deleting}
                        className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Inventory Tab */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            {lowStockLoading ? (
              <LoadingSpinner />
            ) : lowStock.length > 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-900">Low Stock Alert</h3>
                  <p className="text-sm text-yellow-800">{lowStock.length} item(s) below minimum stock level</p>
                </div>
              </div>
            ) : null}

            {inventoryLoading ? (
              <LoadingSpinner />
            ) : inventoryError ? (
              <AlertMessage type="error" message={inventoryError} />
            ) : inventory.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No inventory items</div>
            ) : (
              <div className="space-y-2">
                {inventory.map((item) => (
                  <div key={item.id} className="border border-slate-200 rounded p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-medium">{item.itemName}</h4>
                        <p className="text-sm text-slate-600">Code: {item.itemCode}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{item.quantity} units</p>
                        <p className="text-xs text-slate-500">Min: {item.minQuantity}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
