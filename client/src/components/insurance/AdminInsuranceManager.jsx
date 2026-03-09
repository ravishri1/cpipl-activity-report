import { useState } from 'react';
import { Upload, Search, Filter, Trash2, Edit2, Eye, Download, Plus, Loader2, CheckCircle } from 'lucide-react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate, formatINR } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import StatusBadge from '../shared/StatusBadge';

export default function AdminInsuranceManager() {
  const [searchQuery, setSearchQuery] = useState('');
  const [cardTypeFilter, setCardTypeFilter] = useState('all');
  const [isActiveFilter, setIsActiveFilter] = useState('true');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCard, setEditingCard] = useState(null);

  const { data: result, loading, error, refetch } = useFetch(
    `/insurance?search=${searchQuery}&cardType=${cardTypeFilter}&isActive=${isActiveFilter}`,
    { total: 0, cards: [] }
  );

  const { execute: deleteCard, loading: deleting, error: deleteError } = useApi();
  const { execute: updateCard, loading: updating, error: updateError } = useApi();

  const cards = result?.cards || [];

  const handleDeleteCard = async (cardId) => {
    if (!window.confirm('Are you sure you want to delete this insurance card?')) return;
    
    await deleteCard(
      () => api.delete(`/insurance/${cardId}`),
      'Insurance card deleted'
    );
    refetch();
  };

  const cardTypeColors = {
    health: 'bg-green-100 text-green-700',
    life: 'bg-blue-100 text-blue-700',
    accidental: 'bg-orange-100 text-orange-700',
    other: 'bg-gray-100 text-gray-700'
  };

  const getStatusColor = (card) => {
    if (!card.effectiveTo) return 'bg-slate-100 text-slate-700';
    const expiry = new Date(card.effectiveTo);
    if (expiry < new Date()) return 'bg-red-100 text-red-700';
    if (expiry < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  const getStatusText = (card) => {
    if (!card.effectiveTo) return 'No expiry';
    const expiry = new Date(card.effectiveTo);
    if (expiry < new Date()) return 'Expired';
    if (expiry < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) return 'Expiring Soon';
    return 'Active';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Insurance Card Management</h1>
          <p className="text-slate-600 mt-1">Upload and manage employee insurance cards</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          <Plus className="w-5 h-5" />
          Upload Card
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Search Employee</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Name, email, employee ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Card Type</label>
            <select
              value={cardTypeFilter}
              onChange={(e) => setCardTypeFilter(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="health">Health</option>
              <option value="life">Life</option>
              <option value="accidental">Accidental</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              value={isActiveFilter}
              onChange={(e) => setIsActiveFilter(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading && <LoadingSpinner />}
      {error && <AlertMessage type="error" message={error} />}
      {deleteError && <AlertMessage type="error" message={deleteError} />}
      {updateError && <AlertMessage type="error" message={updateError} />}

      {!loading && cards.length === 0 && (
        <EmptyState 
          icon="🎫" 
          title="No Insurance Cards" 
          subtitle="Start by uploading an insurance card for an employee"
        />
      )}

      {!loading && cards.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Employee</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Card Type</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Provider</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Uploaded</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {cards.map((card) => (
                <tr key={card.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{card.user?.name || 'Unknown'}</p>
                      <p className="text-sm text-slate-500">{card.user?.employeeId || ''}</p>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${cardTypeColors[card.cardType]}`}>
                      {card.cardType.charAt(0).toUpperCase() + card.cardType.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm">
                    {card.providerName || '-'}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(card)}`}>
                      {getStatusText(card)}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-600">
                    {formatDate(card.uploadedAt)}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedCard(card);
                          setShowDetailPanel(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingCard(card);
                          setShowEditModal(true);
                        }}
                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                        title="Edit Card"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <a
                        href={card.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                        title="Download File"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDeleteCard(card.id)}
                        disabled={deleting}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                        title="Delete Card"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200">
            <p className="text-sm text-slate-600">
              Showing <span className="font-semibold">{cards.length}</span> insurance card(s)
            </p>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <InsuranceUploadModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            refetch();
          }}
        />
      )}

      {/* Detail Panel */}
      {showDetailPanel && selectedCard && (
        <InsuranceDetailPanel
          card={selectedCard}
          onClose={() => setShowDetailPanel(false)}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && editingCard && (
        <InsuranceEditModal
          card={editingCard}
          onClose={() => { setShowEditModal(false); setEditingCard(null); }}
          onSuccess={() => {
            setShowEditModal(false);
            setEditingCard(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

// Upload Modal Component
function InsuranceUploadModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    userId: '',
    cardType: 'health',
    effectiveFrom: '',
    effectiveTo: '',
    providerName: '',
    policyNumber: '',
    coverageAmount: '',
    notes: '',
    fileUrl: '',
    fileName: '',
    mimeType: ''
  });

  const [fileSelected, setFileSelected] = useState(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileUploadDone, setFileUploadDone] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [searchingEmployees, setSearchingEmployees] = useState(false);

  const { execute: uploadCard, loading: uploading, error } = useApi();

  const handleEmployeeSearch = async (query) => {
    if (!query.trim()) {
      setEmployees([]);
      return;
    }
    setSearchingEmployees(true);
    try {
      const res = await api.get(`/users/directory?search=${query}`);
      setEmployees(res.data.users || []);
    } catch (err) {
      console.error('Failed to search employees:', err);
    } finally {
      setSearchingEmployees(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      alert('Invalid file type. Only PDF and images (PNG, JPEG) are allowed');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit');
      return;
    }

    setFileSelected(file);
    setFileUploadDone(false);
    setFormData(prev => ({ ...prev, fileName: file.name, mimeType: file.type, fileUrl: '' }));

    // Upload file to Google Drive immediately so we have a real URL
    setFileUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/files/upload', fd);
      const driveUrl = res.data?.file?.driveUrl || res.data?.driveUrl || '';
      if (!driveUrl) throw new Error('No URL returned from upload');
      setFormData(prev => ({ ...prev, fileUrl: driveUrl }));
      setFileUploadDone(true);
    } catch (uploadErr) {
      console.error('File upload failed:', uploadErr);
      alert('Failed to upload file: ' + (uploadErr.response?.data?.error || uploadErr.message));
      setFileSelected(null);
    } finally {
      setFileUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.userId) {
      alert('Please select an employee');
      return;
    }
    if (!formData.fileUrl) {
      alert('Please select and wait for the file to finish uploading');
      return;
    }

    await uploadCard(
      () => api.post(`/insurance/upload/${formData.userId}`, {
        fileUrl: formData.fileUrl,
        fileName: formData.fileName,
        mimeType: formData.mimeType,
        cardType: formData.cardType,
        effectiveFrom: formData.effectiveFrom || undefined,
        effectiveTo: formData.effectiveTo || undefined,
        providerName: formData.providerName || undefined,
        policyNumber: formData.policyNumber || undefined,
        coverageAmount: formData.coverageAmount ? parseFloat(formData.coverageAmount) : undefined,
        notes: formData.notes || undefined
      }),
      'Insurance card uploaded successfully'
    );

    if (!error) onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Upload Insurance Card</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <AlertMessage type="error" message={error} />}

          {/* Employee Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Employee *</label>
            <input
              type="text"
              placeholder="Search by name, email, or employee ID..."
              onChange={(e) => handleEmployeeSearch(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            />
            <select
              value={formData.userId}
              onChange={(e) => setFormData({ ...formData, userId: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose employee...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employeeId}) - {emp.email}
                </option>
              ))}
            </select>
          </div>

          {/* Card Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Card Type</label>
              <select
                value={formData.cardType}
                onChange={(e) => setFormData({ ...formData, cardType: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="health">Health</option>
                <option value="life">Life</option>
                <option value="accidental">Accidental</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Provider Name</label>
              <input
                type="text"
                placeholder="e.g., ICICI Prudential"
                value={formData.providerName}
                onChange={(e) => setFormData({ ...formData, providerName: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Policy Number</label>
              <input
                type="text"
                placeholder="Policy #"
                value={formData.policyNumber}
                onChange={(e) => setFormData({ ...formData, policyNumber: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Coverage Amount (₹)</label>
              <input
                type="number"
                placeholder="50000"
                value={formData.coverageAmount}
                onChange={(e) => setFormData({ ...formData, coverageAmount: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Effective From</label>
              <input
                type="date"
                value={formData.effectiveFrom}
                onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expires On</label>
              <input
                type="date"
                value={formData.effectiveTo}
                onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              rows="2"
              placeholder="Any additional notes about this insurance card..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Upload File * (PDF or Image)</label>
            <div className={`border-2 border-dashed rounded-lg p-6 text-center transition ${fileUploadDone ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:border-blue-400'}`}>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="hidden"
                id="file-input"
                disabled={fileUploading}
              />
              <label htmlFor="file-input" className={fileUploading ? 'cursor-wait' : 'cursor-pointer'}>
                {fileUploading ? (
                  <>
                    <Loader2 className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-spin" />
                    <p className="font-medium text-blue-700">Uploading {fileSelected?.name}…</p>
                    <p className="text-sm text-blue-500">Please wait</p>
                  </>
                ) : fileUploadDone ? (
                  <>
                    <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="font-medium text-green-700">{fileSelected?.name}</p>
                    <p className="text-sm text-green-600">File uploaded ✓ — click to replace</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="font-medium text-slate-900">{fileSelected?.name || 'Click to upload or drag and drop'}</p>
                    <p className="text-sm text-slate-500">PDF or images (PNG, JPEG) - Max 10MB</p>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || fileUploading || !formData.userId || !formData.fileUrl}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
            >
              {uploading ? 'Saving…' : 'Upload Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Modal Component
function InsuranceEditModal({ card, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    cardType: card.cardType || 'health',
    providerName: card.providerName || '',
    policyNumber: card.policyNumber || '',
    coverageAmount: card.coverageAmount || '',
    effectiveFrom: card.effectiveFrom || '',
    effectiveTo: card.effectiveTo || '',
    notes: card.notes || '',
    isActive: card.isActive !== false,
  });

  const { execute: updateCard, loading: updating, error } = useApi();

  const handleSubmit = async (e) => {
    e.preventDefault();
    await updateCard(
      () => api.put(`/insurance/${card.id}`, formData),
      'Insurance card updated'
    );
    if (!error) onSuccess();
  };

  const setField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Edit Insurance Card</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>

        <div className="p-6">
          {/* Employee (read-only) */}
          <div className="mb-5 p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500 mb-0.5">Employee</p>
            <p className="font-semibold text-slate-800">{card.user?.name || 'Unknown'}</p>
            <p className="text-sm text-slate-500">{card.user?.employeeId || ''}</p>
          </div>

          {error && <AlertMessage type="error" message={error} />}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Card Type</label>
                <select
                  value={formData.cardType}
                  onChange={e => setField('cardType', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="health">Health</option>
                  <option value="life">Life</option>
                  <option value="accidental">Accidental</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Provider Name</label>
                <input
                  type="text"
                  value={formData.providerName}
                  onChange={e => setField('providerName', e.target.value)}
                  placeholder="e.g. Star Health"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Policy Number</label>
                <input
                  type="text"
                  value={formData.policyNumber}
                  onChange={e => setField('policyNumber', e.target.value)}
                  placeholder="Policy #"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Coverage Amount (₹)</label>
                <input
                  type="number"
                  value={formData.coverageAmount}
                  onChange={e => setField('coverageAmount', e.target.value)}
                  placeholder="e.g. 500000"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Effective From</label>
                <input
                  type="date"
                  value={formData.effectiveFrom}
                  onChange={e => setField('effectiveFrom', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Effective To</label>
                <input
                  type="date"
                  value={formData.effectiveTo}
                  onChange={e => setField('effectiveTo', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={e => setField('notes', e.target.value)}
                rows={3}
                placeholder="Additional notes..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={e => setField('isActive', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-slate-700">Card is Active</label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={updating}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {updating ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Detail Panel Component
function InsuranceDetailPanel({ card, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-50">
      <div className="bg-white w-full max-w-xl h-full overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Insurance Card Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <p className="text-sm text-slate-600 font-medium">Employee</p>
            <p className="text-lg font-semibold text-slate-900">{card.user?.name || 'Unknown'}</p>
            <p className="text-sm text-slate-600">{card.user?.employeeId || ''}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-600 font-medium">Card Type</p>
              <p className="text-lg font-semibold text-slate-900 capitalize">{card.cardType}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 font-medium">Provider</p>
              <p className="text-lg font-semibold text-slate-900">{card.providerName || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 font-medium">Policy #</p>
              <p className="text-lg font-semibold text-slate-900">{card.policyNumber || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 font-medium">Coverage</p>
              <p className="text-lg font-semibold text-slate-900">{card.coverageAmount ? `₹${card.coverageAmount.toLocaleString()}` : '-'}</p>
            </div>
          </div>

          {card.notes && (
            <div>
              <p className="text-sm text-slate-600 font-medium mb-1">Notes</p>
              <p className="text-slate-900">{card.notes}</p>
            </div>
          )}

          <a
            href={card.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-center font-medium"
          >
            Open File
          </a>
        </div>
      </div>
    </div>
  );
}
