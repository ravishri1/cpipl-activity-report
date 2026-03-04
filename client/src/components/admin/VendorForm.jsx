import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { useApi } from '../../hooks/useApi';
import AlertMessage from '../shared/AlertMessage';

export default function VendorForm({ isOpen, onClose, vendorId, onSuccess }) {
  const [formData, setFormData] = useState({
    vendorName: '',
    email: '',
    phone: '',
    address: '',
    gstNumber: '',
    category: 'supplier',
    contactPerson: '',
  });

  const [loading, setLoading] = useState(false);
  const { execute, loading: saving, error, success } = useApi();

  useEffect(() => {
    if (vendorId) {
      loadVendor();
    } else {
      setFormData({
        vendorName: '',
        email: '',
        phone: '',
        address: '',
        gstNumber: '',
        category: 'supplier',
        contactPerson: '',
      });
    }
  }, [vendorId, isOpen]);

  const loadVendor = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/procurement/vendors/${vendorId}`);
      setFormData(res.data);
    } catch (err) {
      console.error('Failed to load vendor:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.vendorName || !formData.email || !formData.phone || !formData.address) {
      alert('Please fill in all required fields');
      return;
    }

    const endpoint = vendorId ? `/api/procurement/vendors/${vendorId}` : '/api/procurement/vendors';
    const method = vendorId ? 'put' : 'post';

    await execute(
      () => api[method](endpoint, formData),
      vendorId ? 'Vendor updated successfully' : 'Vendor created successfully'
    );

    if (!error) {
      onSuccess?.();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">{vendorId ? 'Edit Vendor' : 'Add New Vendor'}</h2>
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
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && <AlertMessage type="error" message={error} />}
            {success && <AlertMessage type="success" message={success} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Vendor Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Vendor Name *
                </label>
                <input
                  type="text"
                  name="vendorName"
                  value={formData.vendorName}
                  onChange={handleChange}
                  placeholder="Enter vendor name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="vendor@example.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="10-digit phone number"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Category
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="supplier">Supplier</option>
                  <option value="manufacturer">Manufacturer</option>
                  <option value="distributor">Distributor</option>
                  <option value="service_provider">Service Provider</option>
                </select>
              </div>

              {/* GST Number */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  GST Number
                </label>
                <input
                  type="text"
                  name="gstNumber"
                  value={formData.gstNumber}
                  onChange={handleChange}
                  placeholder="GST Number"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Contact Person */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  name="contactPerson"
                  value={formData.contactPerson}
                  onChange={handleChange}
                  placeholder="Contact person name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Address *
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Full address"
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {vendorId ? 'Update Vendor' : 'Create Vendor'}
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
