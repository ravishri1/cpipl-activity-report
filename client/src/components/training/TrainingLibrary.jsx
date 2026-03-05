import { useState } from 'react';
import { BookOpen, Users, Download, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import StatusBadge from '../shared/StatusBadge';

const CATEGORY_COLORS = {
  technical: 'bg-blue-50 border-blue-200 text-blue-700',
  compliance: 'bg-red-50 border-red-200 text-red-700',
  soft_skills: 'bg-purple-50 border-purple-200 text-purple-700',
  management: 'bg-green-50 border-green-200 text-green-700',
  product: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  other: 'bg-gray-50 border-gray-200 text-gray-700'
};

const SCOPE_COLORS = {
  general: 'bg-blue-100 text-blue-800',
  department: 'bg-purple-100 text-purple-800'
};

const CONTRIBUTION_TYPES = ['addition', 'correction', 'improvement', 'resource'];

export default function TrainingLibrary() {
  const { data: modules, loading, error, refetch } = useFetch('/api/training/modules', []);
  const { execute, loading: assigning, error: assignErr, success } = useApi();
  
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedModule, setSelectedModule] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [contributionForm, setContributionForm] = useState({
    type: 'addition',
    title: '',
    content: ''
  });

  // Filter modules by category
  const filteredModules = selectedCategory
    ? modules.filter(m => m.category === selectedCategory)
    : modules;

  // Get unique categories
  const categories = [...new Set(modules.map(m => m.category))];

  // Handle assignment
  const handleAssignToMe = async (moduleId) => {
    await execute(
      () => api.post('/api/training/assign', {
        moduleId,
        assignedToId: null, // System will assign to current user
        dueDate: null
      }),
      'Training assigned to you!'
    );
    refetch();
  };

  // Handle contribution submission
  const handleSubmitContribution = async () => {
    if (!contributionForm.title.trim() || !contributionForm.content.trim()) {
      alert('Please fill in all fields');
      return;
    }

    await execute(
      () => api.post('/api/training/contribute', {
        moduleId: selectedModule.id,
        title: contributionForm.title,
        content: contributionForm.content,
        type: contributionForm.type
      }),
      'Contribution submitted! It will be reviewed by an admin.'
    );

    setContributionForm({ type: 'addition', title: '', content: '' });
    setShowContributeModal(false);
    refetch();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;
  if (modules.length === 0) {
    return <EmptyState icon="📚" title="No Training Modules" subtitle="Training modules will be available soon" />;
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Training Library</h1>
        <p className="text-gray-600">Browse and enroll in training modules tailored to your role and department</p>
      </div>

      {success && <AlertMessage type="success" message={success} />}
      {assignErr && <AlertMessage type="error" message={assignErr} />}

      {/* Category Filter Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            selectedCategory === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All Categories
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {cat.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredModules.map(module => (
          <div
            key={module.id}
            className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition overflow-hidden"
          >
            {/* Header with Category Badge */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-b border-gray-200">
              <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-semibold px-2 py-1 rounded border ${CATEGORY_COLORS[module.category] || CATEGORY_COLORS.other}`}>
                  {module.category.replace(/_/g, ' ')}
                </span>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${SCOPE_COLORS[module.scope]}`}>
                  {module.scope === 'department' ? `Dept: ${module.departmentName}` : 'General'}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">{module.title}</h3>
              {module.isMandatory && (
                <div className="mt-2 flex items-center text-red-600 text-sm font-medium">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Mandatory Training
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              <p className="text-gray-600 text-sm mb-4 line-clamp-3">{module.description}</p>

              {/* Metadata */}
              <div className="space-y-2 mb-4 text-sm">
                {module.duration && (
                  <div className="flex items-center text-gray-600">
                    <Clock className="w-4 h-4 mr-2 text-blue-600" />
                    {module.duration} minutes
                  </div>
                )}
                <div className="flex items-center text-gray-600">
                  <Users className="w-4 h-4 mr-2 text-blue-600" />
                  {module.creator?.name || 'Admin'} created this
                </div>
                {module._count?.contributions > 0 && (
                  <div className="flex items-center text-gray-600">
                    <Download className="w-4 h-4 mr-2 text-blue-600" />
                    {module._count.contributions} community contributions
                  </div>
                )}
              </div>

              {/* Status Indicator */}
              {module.isActive ? (
                <div className="flex items-center text-green-600 text-sm font-medium mb-4">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Active
                </div>
              ) : (
                <div className="flex items-center text-gray-500 text-sm font-medium mb-4">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Inactive
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedModule(module);
                    setShowDetails(true);
                  }}
                  className="flex-1 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition"
                >
                  View Details
                </button>
                {module.isActive && (
                  <button
                    onClick={() => handleAssignToMe(module.id)}
                    disabled={assigning}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:bg-gray-400"
                  >
                    {assigning ? 'Assigning...' : 'Enroll Now'}
                  </button>
                )}
              </div>

              {/* Contribute Link */}
              {module.isActive && (
                <button
                  onClick={() => {
                    setSelectedModule(module);
                    setShowContributeModal(true);
                  }}
                  className="w-full mt-2 px-4 py-2 text-sm border border-green-600 text-green-600 rounded-lg font-medium hover:bg-green-50 transition"
                >
                  + Contribute Improvement
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Module Details Modal */}
      {showDetails && selectedModule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded border mb-2 inline-block ${CATEGORY_COLORS[selectedModule.category]}`}>
                    {selectedModule.category.replace(/_/g, ' ')}
                  </span>
                  <h2 className="text-2xl font-bold text-gray-900 mt-2">{selectedModule.title}</h2>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-500 hover:text-gray-700 font-bold text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Description */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Overview</h3>
                <p className="text-gray-700">{selectedModule.description}</p>
              </div>

              {/* Module Info */}
              <div className="grid grid-cols-2 gap-4">
                {selectedModule.duration && (
                  <div>
                    <p className="text-sm text-gray-600">Duration</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedModule.duration} minutes</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Passing Score</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedModule.passingScore}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Created By</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedModule.creator?.name || 'Admin'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Scope</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedModule.scope === 'department' ? selectedModule.departmentName : 'General'}
                  </p>
                </div>
              </div>

              {/* Content */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Content</h3>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-gray-700 whitespace-pre-wrap">
                  {selectedModule.content}
                </div>
              </div>

              {/* Approved Contributions */}
              {selectedModule.contributions && selectedModule.contributions.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Community Contributions</h3>
                  <div className="space-y-3">
                    {selectedModule.contributions.map(contrib => (
                      <div key={contrib.id} className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-gray-900">{contrib.title}</h4>
                          <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-200 text-blue-800">
                            {contrib.type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm">{contrib.content}</p>
                        <p className="text-gray-600 text-xs mt-2">By {contrib.contributor?.name || 'Anonymous'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowDetails(false);
                    setTimeout(() => {
                      setShowContributeModal(true);
                    }, 200);
                  }}
                  className="flex-1 px-4 py-2 border border-green-600 text-green-600 rounded-lg font-medium hover:bg-green-50 transition"
                >
                  Contribute Improvement
                </button>
                <button
                  onClick={() => handleAssignToMe(selectedModule.id)}
                  disabled={assigning}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:bg-gray-400"
                >
                  {assigning ? 'Assigning...' : 'Enroll Now'}
                </button>
                <button
                  onClick={() => setShowDetails(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contribution Modal */}
      {showContributeModal && selectedModule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Contribute to Training</h2>
                  <p className="text-gray-600 mt-1">{selectedModule.title}</p>
                </div>
                <button
                  onClick={() => setShowContributeModal(false)}
                  className="text-gray-500 hover:text-gray-700 font-bold text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Contribution Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Type of Contribution</label>
                <select
                  value={contributionForm.type}
                  onChange={(e) => setContributionForm({ ...contributionForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  {CONTRIBUTION_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)} - {
                        type === 'addition' ? 'Add new content' :
                        type === 'correction' ? 'Fix errors' :
                        type === 'improvement' ? 'Improve content' :
                        'Share resources'
                      }
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Title</label>
                <input
                  type="text"
                  value={contributionForm.title}
                  onChange={(e) => setContributionForm({ ...contributionForm, title: e.target.value })}
                  placeholder="Brief title for your contribution"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Content (Markdown supported)</label>
                <textarea
                  value={contributionForm.content}
                  onChange={(e) => setContributionForm({ ...contributionForm, content: e.target.value })}
                  placeholder="Describe your contribution in detail..."
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              {/* Help Text */}
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm text-gray-700">
                <p className="font-semibold mb-1">💡 Tips:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Be clear and concise</li>
                  <li>Provide examples if applicable</li>
                  <li>Ensure your contribution adds value</li>
                  <li>Admin approval required before publication</li>
                </ul>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleSubmitContribution}
                  disabled={assigning}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:bg-gray-400"
                >
                  {assigning ? 'Submitting...' : 'Submit Contribution'}
                </button>
                <button
                  onClick={() => setShowContributeModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
