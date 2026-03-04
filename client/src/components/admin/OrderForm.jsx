import { useState, useEffect } from 'react';
import { X, Loader2, Plus } from 'lucide-react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import AlertMessage from '../shared/AlertMessage';
import LoadingSpinner from '../shared/LoadingSpinner';

export default function OrderForm({ isOpen, onClose, orderId, onSuccess }) {
  const [formData, setFormData] = useState({
    vendorId: '',
    totalAmount: '',
    deliveryAddress: '',
    notes: '',
    createdDate: new Date().toISOString().split('T')[0],
  });

  const [lineItems, setLineItems] = useState([]);
  const [newLineItem, setNewLineItem] = useState({
    itemCode: '',
    itemName: '',
    quantity: '',
    unitPrice: '',
    category: 'materials',
  });

  const [loading, setLoading] = useState(false);
  const [showLineItemForm, setShowLineItemForm] = useState(false);

  const { data: vendors = [], loading: vendorsLoading } = useFetch('/api/procurement/vendors', []);
  const { execute, loading: saving, error, success } = useApi();

  useEffect(() => {
    if (orderId) {
      loadOrder();
    } else {
      resetForm();
    }
  }, [orderId, isOpen]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/procurement/orders/${orderId}`);
      setFormData({
        vendorId: res.data.vendorId,
        totalAmount: res.data.totalAmount,
        deliveryAddress: res.data.deliveryAddress || '',
        notes: res.data.notes || '',
        createdDate: res.data.createdDate,
      });
      setLineItems(res.data.lineItems || []);
    } catch (err) {
      console.error('Failed to load order:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      vendorId: '',
      totalAmount: '',
      deliveryAddress: '',
      notes: '',
      createdDate: new Date().toISOString().split('T')[0],
    });
    setLineItems([]);
    setNewLineItem({
      itemCode: '',
      itemName: '',
      quantity: '',
      unitPrice: '',
      category: 'materials',
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLineItemChange = (e) => {
    const { name, value } = e.target;
    setNewLineItem((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addLineItem = () => {
    if (
      !newLineItem.itemCode ||
      !newLineItem.itemName ||
      !newLineItem.quantity ||
      !newLineItem.unitPrice
    ) {
      alert('Please fill in all line item fields');
      return;
    }

    const item = {
      ...newLineItem,
      quantity: parseInt(newLineItem.quantity),
      unitPrice: parseFloat(newLineItem.unitPrice),
      amount: parseInt(newLineItem.quantity) * parseFloat(newLineItem.unitPrice),
    };

    setLineItems((prev) => [...prev, { ...item, id: Date.now() }]);

    // Update total amount
    const newTotal = lineItems.reduce((sum, li) => sum + (li.amount || 0), 0) + item.amount;
    setFormData((prev) => ({
      ...prev,
      totalAmount: newTotal.toString(),
    }));

    setNewLineItem({
      itemCode: '',
      itemName: '',
      quantity: '',
      unitPrice: '',
      category: 'materials',
    });
    setShowLineItemForm(false);
  };

  const removeLineItem = (id) => {
    const removed = lineItems.find((li) => li.id === id);
    setLineItems((prev) => prev.filter((li) => li.id !== id));

    // Recalculate total
    const newTotal = lineItems.reduce((sum, li) => {
      if (li.id === id) return sum;
      return sum + (li.amount || 0);
    }, 0);
    setFormData((prev) => ({
      ...prev,
      totalAmount: newTotal.toString(),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.vendorId || !formData.totalAmount) {
      alert('Please fill in vendor and total amount');
      return;
    }

    const payload = {
      vendorId: parseInt(formData.vendorId),
      totalAmount: parseFloat(formData.totalAmount),
      deliveryAddress: formData.deliveryAddress,
      notes: formData.notes,
      createdDate: formData.createdDate,
      status: 'draft',
    };

    const endpoint = orderId ? `/api/procurement/orders/${orderId}` : '/api/procurement/orders';
    const method = orderId ? 'put' : 'post';

    const result = await execute(
      () => api[method](endpoint, payload),
      orderId ? 'Order updated successfully' : 'Order created successfully'
    );

    if (!error && result?.data?.id) {
      // Add line items to the order
      for (const item of lineItems) {
        if (!item.id || item.id > Date.now() - 100000) {
          // New item (has temp ID)
          try {
            await api.post(`/api/procurement/orders/${result.data.id}/line-items`, {
              itemCode: item.itemCode,
              itemName: item.itemName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              category: item.category,
            });
          } catch (err) {
            console.error('Failed to add line item:', err);
          }
        }
      }

      onSuccess?.();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">{orderId ? 'Edit Order' : 'Create Purchase Order'}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-blue-500 rounded-lg transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-6 text-center">
            <LoadingSpinner />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && <AlertMessage type="error" message={error} />}
            {success && <AlertMessage type="success" message={success} />}

            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">Order Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Vendor *
                  </label>
                  {vendorsLoading ? (
                    <div className="text-sm text-slate-500">Loading vendors...</div>
                  ) : (
                    <select
                      name="vendorId"
                      value={formData.vendorId}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a vendor</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.vendorName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Total Amount (₹) *
                  </label>
                  <input
                    type="number"
                    name="totalAmount"
                    value={formData.totalAmount}
                    onChange={handleChange}
                    placeholder="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Order Date
                  </label>
                  <input
                    type="date"
                    name="createdDate"
                    value={formData.createdDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Delivery Address
                  </label>
                  <input
                    type="text"
                    name="deliveryAddress"
                    value={formData.deliveryAddress}
                    onChange={handleChange}
                    placeholder="Delivery location"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Order notes"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-3 border-t pt-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Line Items</h3>
                <button
                  type="button"
                  onClick={() => setShowLineItemForm(!showLineItemForm)}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>

              {/* Add Line Item Form */}
              {showLineItemForm && (
                <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <input
                      type="text"
                      name="itemCode"
                      value={newLineItem.itemCode}
                      onChange={handleLineItemChange}
                      placeholder="Item Code"
                      className="px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      name="itemName"
                      value={newLineItem.itemName}
                      onChange={handleLineItemChange}
                      placeholder="Item Name"
                      className="px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      name="quantity"
                      value={newLineItem.quantity}
                      onChange={handleLineItemChange}
                      placeholder="Qty"
                      className="px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      name="unitPrice"
                      value={newLineItem.unitPrice}
                      onChange={handleLineItemChange}
                      placeholder="Unit Price"
                      step="0.01"
                      className="px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Line Items List */}
              {lineItems.length > 0 ? (
                <div className="space-y-2">
                  {lineItems.map((item) => (
                    <div
                      key={item.id}
                      className="border border-slate-200 rounded p-3 flex items-center justify-between bg-slate-50"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.itemName}</p>
                        <p className="text-sm text-slate-600">
                          Code: {item.itemCode} • {item.quantity} × ₹{item.unitPrice} = ₹
                          {item.amount}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        className="px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-slate-500 text-sm">
                  No line items added yet
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                type="submit"
                disabled={saving || lineItems.length === 0}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {orderId ? 'Update Order' : 'Create Order'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-400"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
