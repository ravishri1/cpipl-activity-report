import { useState } from 'react';
import { Plus, CheckCircle, Clock, AlertCircle, Trash2 } from 'lucide-react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';

const CONTRIBUTION_TYPES = {
  addition: { label: 'Addition', description: 'Add new content or information', color: 'bg-blue-50 border-blue-200' },
  correction: { label: 'Correction', description: 'Fix errors or inaccuracies', color: 'bg-red-50 border-red-200' },
  improvement: { label: 'Improvement', description: 'Enhance existing content', color: 'bg-yellow-50 border-yellow-200' },
  resource: { label: 'Resource', description: 'Share external links or materials', color: 'bg-purple-50 border-purple-200' }
};

const STATUS_COLORS = {
  pending: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50', badge: 'bg-yellow-200 text-yellow-800' },
  approved: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', badge: 'bg-green-200 text-green-800' },
  rejected: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', badge: 'bg-red-200 text-red-800' },
  implemented: { icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50', badge: 'bg-blue-200 text-blue-800' }
};

export default function ContributeToModule() {
  const { data: trainingModules, loading: loadingModules } = useFetch('/api/training/modules', []);
  const { data: contributions, loading: loadingContribs, error: contribError, refetch } = useFetch('/api/training/contributions/pending', []);
  const { execute, loading: submitting, error: submitErr, success } = useApi();

  const [showForm, setShowForm] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [formData, setFormData] = useState({
    type: 'addition',
    title: '',
    content: ''
  });
  const [filter, setFilter] = useState('all'); // all, pending, approved, rejected, implemented

  // Filter contributions by user status
  const filteredContributions = filter === 'all'
    ? contributions
    : contributions.filter(c => c.status === filter);

  const handleSubmit = async () => {
    if (!selectedModuleId || !formData.title.trim() || !formData.content.trim()) {
      alert('Please select a module and fill in all fields');
      return;
    }

    await execute(
      () => api.post('/api/training/contribute', {
        moduleId: selectedModuleId,
        title: formData.title,
        content: formData.content,
        type: formData.type
      }),
      'Contribution submitted! It will be reviewed by an administrator.'
    );

    setFormData({ type: 'addition', title: '', content: '' });
    setSelectedModuleId(null);
    setShowForm(false);
    refetch();
  };

  const loading = loadingModules || loadingContribs;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Contribute to Training</h1>
        <p className="text-gray-600">Help improve our training materials by sharing your insights and corrections</p>
      </div>

      {success && <AlertMessage type="success" message={success} />}
      {submitErr && <AlertMessage type="error" message={submitErr} />}
      {contribError && <AlertMessage type="error" message={contribError} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Submission Form */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 sticky top-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Submit Contribution</h2>

            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                New Contribution
              </button>
            ) : (
              <div className="space-y-4">
                {/* Select Module */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Select Training Module *
                  </label>
                  <select
                    value={selectedModuleId || ''}
                    onChange={(e) => setSelectedModuleId(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  >
                    <option value="">Choose a module...</option>
                    {trainingModules.map(mod => (
                      <option key={mod.id} value={mod.id}>
                        {mod.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Contribution Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Type of Contribution *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  >
                    {Object.entries(CONTRIBUTION_TYPES).map(([key, { label, description }]) => (
                      <option key={key} value={key}>
                        {label} - {description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Brief title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Content *
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Describe your contribution in detail..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:bg-gray-400 text-sm"
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setFormData({ type: 'addition', title: '', content: '' });
                      setSelectedModuleId(null);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition text-sm"
                  >
                    Cancel
                  </button>
                </div>

                {/* Help Text */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-gray-700">
                  <p className="font-semibold mb-1">📋 Guidelines:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Be specific and constructive</li>
                    <li>Provide context and examples</li>
                    <li>Ensure content accuracy</li>
                    <li>Admin will review before publishing</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contributions List */}
        <div className="lg:col-span-2">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Contributions</h2>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {['all', 'pending', 'approved', 'rejected', 'implemented'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    filter === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {filteredContributions.length === 0 ? (
            <EmptyState
              icon="✍️"
              title={filter === 'all' ? 'No Contributions Yet' : `No ${filter} contributions`}
              subtitle={filter === 'all' ? 'Start by submitting a contribution to help improve our training materials' : `You don't have any ${filter} contributions`}
            />
          ) : (
            <div className="space-y-4">
              {filteredContributions.map(contribution => {
                const typeInfo = CONTRIBUTION_TYPES[contribution.type];
                const statusInfo = STATUS_COLORS[contribution.status];
                const StatusIcon = statusInfo.icon;

                return (
                  <div
                    key={contribution.id}
                    className={`border rounded-lg p-5 ${CONTRIBUTION_TYPES[contribution.type]?.color || 'bg-gray-50 border-gray-200'}`}
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${statusInfo.badge}`}>
                            {contribution.status.charAt(0).toUpperCase() + contribution.status.slice(1)}
                          </span>
                          <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-200 text-gray-800">
                            {typeInfo?.label || contribution.type}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">{contribution.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Module: <span className="font-semibold">{contribution.module?.title}</span>
                        </p>
                      </div>
                      <StatusIcon className={`w-6 h-6 ${statusInfo.color}`} />
                    </div>

                    {/* Content */}
                    <div className="bg-white bg-opacity-50 p-3 rounded border border-gray-200 mb-3">
                      <p className="text-gray-700 text-sm whitespace-pre-wrap">{contribution.content}</p>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 mb-3">
                      <span>Submitted: {formatDate(contribution.createdAt)}</span>
                      {contribution.approver && (
                        <span>Reviewed by: {contribution.approver.name}</span>
                      )}
                      {contribution.approvalNotes && (
                        <div className="w-full mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                          <p className="font-semibold text-gray-800">Admin Notes:</p>
                          <p className="text-gray-700">{contribution.approvalNotes}</p>
                        </div>
                      )}
                    </div>

                    {/* Status Message */}
                    {contribution.status === 'pending' && (
                      <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 p-2 rounded">
                        ⏳ Your contribution is awaiting admin review. This usually takes 1-2 business days.
                      </div>
                    )}
                    {contribution.status === 'approved' && (
                      <div className="text-xs text-green-700 bg-green-50 border border-green-200 p-2 rounded">
                        ✅ Your contribution has been approved and will be published soon.
                      </div>
                    )}
                    {contribution.status === 'implemented' && (
                      <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 p-2 rounded">
                        🎉 Your contribution has been implemented into the training module!
                      </div>
                    )}
                    {contribution.status === 'rejected' && (
                      <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-2 rounded">
                        ❌ Your contribution was not approved. Check admin notes above for details.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Stats Section */}
      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-blue-600 mb-1">
            {contributions.filter(c => c.status === 'pending').length}
          </div>
          <div className="text-sm font-medium text-gray-600">Pending Review</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-600 mb-1">
            {contributions.filter(c => c.status === 'approved').length}
          </div>
          <div className="text-sm font-medium text-gray-600">Approved</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-blue-600 mb-1">
            {contributions.filter(c => c.status === 'implemented').length}
          </div>
          <div className="text-sm font-medium text-gray-600">Implemented</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-gray-600 mb-1">
            {contributions.length}
          </div>
          <div className="text-sm font-medium text-gray-600">Total</div>
        </div>
      </div>
    </div>
  );
}
