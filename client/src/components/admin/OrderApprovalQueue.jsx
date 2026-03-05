import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, AlertCircle, Loader2, MessageCircle } from 'lucide-react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import StatusBadge from '../shared/StatusBadge';

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

export default function OrderApprovalQueue() {
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [approvalNote, setApprovalNote] = useState({});
  const [rejectionReason, setRejectionReason] = useState({});

  const { data: allOrders = [], loading, error, refetch } = useFetch('/api/procurement/orders', []);
  const { execute: approve, loading: approving } = useApi();
  const { execute: reject, loading: rejecting } = useApi();

  // Filter only submitted orders
  const pendingOrders = allOrders.filter((o) => o.status === 'submitted');

  // Calculate stats
  const stats = {
    pending: pendingOrders.length,
    highValue: pendingOrders.filter((o) => o.totalAmount > 100000).length,
    multiItem: pendingOrders.filter((o) => (o.lineItems?.length || 0) > 5).length,
  };

  const handleApprove = async (orderId) => {
    const approvalDate = new Date().toISOString().split('T')[0];
    await approve(
      () => api.post(`/api/procurement/orders/${orderId}/approve`, { approvalDate }),
      'Order approved successfully'
    );
    setApprovalNote((prev) => {
      const newState = { ...prev };
      delete newState[orderId];
      return newState;
    });
    refetch();
  };

  const handleReject = async (orderId) => {
    if (!rejectionReason[orderId]?.trim()) {
      alert('Please provide rejection reason');
      return;
    }

    await reject(
      () =>
        api.put(`/api/procurement/orders/${orderId}`, {
          status: 'rejected',
          rejectionReason: rejectionReason[orderId],
        }),
      'Order rejected'
    );
    setRejectionReason((prev) => {
      const newState = { ...prev };
      delete newState[orderId];
      return newState;
    });
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8" />
            <div>
              <h1 className="text-3xl font-bold">Order Approval Queue</h1>
              <p className="text-purple-100 mt-1">Review and approve pending purchase orders</p>
            </div>
          </div>
          <div className="bg-white/20 px-4 py-2 rounded-lg">
            <p className="text-white font-semibold">{pendingOrders.length} Pending</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats.pending > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600" />
              <div>
                <p className="text-2xl font-bold text-amber-700">{stats.highValue}</p>
                <p className="text-sm text-amber-600">High Value (>₹1L)</p>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-blue-700">{stats.multiItem}</p>
                <p className="text-sm text-blue-600">Multiple Items</p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-purple-700">{stats.pending}</p>
                <p className="text-sm text-purple-600">Total Awaiting</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Orders List */}
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <AlertMessage type="error" message={error} />
      ) : pendingOrders.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-900">All Orders Approved!</h3>
          <p className="text-slate-600 mt-1">No pending orders for approval</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingOrders.map((order) => (
            <div
              key={order.id}
              className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition"
            >
              {/* Order Summary */}
              <div
                className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 cursor-pointer hover:from-slate-100 hover:to-slate-200 transition"
                onClick={() =>
                  setExpandedOrderId(expandedOrderId === order.id ? null : order.id)
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{order.orderNumber}</h3>
                      <StatusBadge
                        status={order.status}
                        styles={{
                          submitted: 'bg-amber-100 text-amber-700 border-amber-200',
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600">Vendor</p>
                        <p className="font-medium">{order.vendor?.vendorName}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Amount</p>
                        <p className="font-medium text-lg">{formatINR(order.totalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Items</p>
                        <p className="font-medium">{order.lineItems?.length || 0} lines</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-slate-400 ml-4">
                    {expandedOrderId === order.id ? '▲' : '▼'}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedOrderId === order.id && (
                <div className="border-t border-slate-200 p-4 bg-white space-y-4">
                  {/* Order Info */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-600">Order Date</p>
                      <p className="font-medium">{formatDate(order.createdDate)}</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Delivery Address</p>
                      <p className="font-medium">{order.deliveryAddress || '-'}</p>
                    </div>
                  </div>

                  {/* Line Items */}
                  {order.lineItems && order.lineItems.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 text-slate-900">Line Items</h4>
                      <div className="space-y-2">
                        {order.lineItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-50 rounded p-2 text-sm flex justify-between"
                          >
                            <span>
                              {item.itemName} (Code: {item.itemCode})
                            </span>
                            <span className="font-medium">
                              {item.quantity} × ₹{item.unitPrice} = ₹
                              {item.quantity * item.unitPrice}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {order.notes && (
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Order Notes:</p>
                      <p className="text-sm bg-blue-50 border border-blue-200 rounded p-2">
                        {order.notes}
                      </p>
                    </div>
                  )}

                  {/* Approval Section */}
                  <div className="border-t pt-4 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        <MessageCircle className="w-4 h-4 inline mr-1" />
                        Approval Notes (Optional)
                      </label>
                      <textarea
                        value={approvalNote[order.id] || ''}
                        onChange={(e) =>
                          setApprovalNote((prev) => ({
                            ...prev,
                            [order.id]: e.target.value,
                          }))
                        }
                        placeholder="Add any notes for approval"
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApprove(order.id)}
                        disabled={approving}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        <CheckCircle2 className="w-4 h-4" />
                        Approve Order
                      </button>
                      <button
                        onClick={() => {
                          setExpandedOrderId(order.id);
                          // Show rejection form
                        }}
                        className="flex-1 bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-300"
                      >
                        Request Changes
                      </button>
                    </div>

                    {/* Rejection Form */}
                    {approvalNote[order.id] === 'reject' && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                        <label className="block text-sm font-medium text-red-700">
                          Rejection Reason *
                        </label>
                        <textarea
                          value={rejectionReason[order.id] || ''}
                          onChange={(e) =>
                            setRejectionReason((prev) => ({
                              ...prev,
                              [order.id]: e.target.value,
                            }))
                          }
                          placeholder="Explain why order is being rejected"
                          rows={3}
                          className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                        <button
                          onClick={() => handleReject(order.id)}
                          disabled={rejecting}
                          className="w-full bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {rejecting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          Confirm Rejection
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
